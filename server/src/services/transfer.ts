import type { Prisma, PrismaClient } from '@prisma/client';
import { AppError, genCode } from '../lib/http.js';
import { postJournal, getUserWalletAccount } from './ledger.js';
import { recordHistory, syncWallet, chargeFee } from './wallet.js';
import { FEES, HUI_MODE } from '../lib/constants.js';
import { notify, raiseRisk } from './notify.js';

type Tx = Prisma.TransactionClient | PrismaClient;

/** Tạo đề nghị chuyển nhượng suất. */
export async function createTransferRequest(
  tx: Tx,
  opts: { slotId: string; sellerUserId: string; buyerUserId?: string; buyerType: string; askingPrice: number; note?: string }
) {
  const slot = await tx.huiSlot.findUnique({ where: { id: opts.slotId }, include: { group: true } });
  if (!slot) throw new AppError('Suất không tồn tại', 404);
  if (slot.currentOwnerId !== opts.sellerUserId) throw new AppError('Bạn không phải chủ sở hữu suất này', 403);
  if (slot.lockedReason) throw new AppError(`Suất đang bị khóa: ${slot.lockedReason}`);
  if (slot.hasDrawn && !slot.group.allowTransferAfterDrawn)
    throw new AppError('Dây hụi không cho phép chuyển nhượng suất đã hốt');

  // Kiểm tra nghĩa vụ quá hạn
  const overdue = await tx.huiContribution.count({
    where: { slotId: opts.slotId, status: 'OVERDUE' },
  });
  if (overdue > 0) throw new AppError('Suất đang có kỳ quá hạn, không thể chuyển nhượng');

  const secured = slot.group.mode === HUI_MODE.SECURED;
  const fee = secured ? FEES.TRANSFER_SECURED : FEES.TRANSFER_INTERNAL;

  const req = await tx.slotTransferRequest.create({
    data: {
      slotId: opts.slotId,
      sellerUserId: opts.sellerUserId,
      buyerUserId: opts.buyerUserId,
      buyerType: opts.buyerType,
      askingPrice: opts.askingPrice,
      feeAmount: fee,
      guaranteeRecheckStatus: secured ? 'REQUIRED' : 'NA',
      note: opts.note,
    },
  });
  await tx.huiSlot.update({ where: { id: opts.slotId }, data: { status: 'LOCKED', lockedReason: 'Đang chờ chuyển nhượng' } });

  // Cảnh báo rủi ro nếu chuyển nhượng sát ngày & nhiều lần
  if (slot.transferredCount >= 2) {
    await raiseRisk(tx, {
      level: 'MEDIUM', type: 'TRANSFER_ANOMALY',
      title: 'Suất chuyển chủ nhiều lần',
      message: `Suất ${slot.slotCode} (${slot.group.name}) đã chuyển nhượng ${slot.transferredCount} lần.`,
      groupId: slot.groupId,
    });
  }
  return req;
}

/** Duyệt / từ chối đề nghị chuyển nhượng. */
export async function decideTransfer(tx: Tx, requestId: string, approve: boolean, approverId: string) {
  const req = await tx.slotTransferRequest.findUnique({ where: { id: requestId }, include: { slot: { include: { group: true } } } });
  if (!req) throw new AppError('Đề nghị không tồn tại', 404);
  if (req.approvalStatus !== 'PENDING') throw new AppError('Đề nghị đã được xử lý');

  if (!approve) {
    await tx.slotTransferRequest.update({ where: { id: requestId }, data: { approvalStatus: 'REJECTED' } });
    await tx.huiSlot.update({ where: { id: req.slotId }, data: { status: 'ACTIVE', lockedReason: null } });
    return { approved: false };
  }

  await tx.slotTransferRequest.update({ where: { id: requestId }, data: { approvalStatus: 'APPROVED' } });
  await notify(tx, req.sellerUserId, 'TRANSFER', 'Đề nghị chuyển nhượng được duyệt',
    `Suất ${req.slot.slotCode} (${req.slot.group.name}) đã được duyệt. Chờ người mua thanh toán.`);
  if (req.buyerUserId)
    await notify(tx, req.buyerUserId, 'TRANSFER', 'Bạn có thể thanh toán mua suất',
      `Suất ${req.slot.slotCode} — ${req.askingPrice.toLocaleString('vi-VN')}đ. Vào để hoàn tất thanh toán.`);
  return { approved: true };
}

/** Người mua thanh toán & hoàn tất chuyển nhượng (escrow buyer→seller + phí nền tảng). */
export async function payAndCompleteTransfer(tx: Tx, requestId: string, buyerUserId: string) {
  const req = await tx.slotTransferRequest.findUnique({ where: { id: requestId }, include: { slot: { include: { group: true } } } });
  if (!req) throw new AppError('Đề nghị không tồn tại', 404);
  if (req.approvalStatus !== 'APPROVED') throw new AppError('Đề nghị chưa được duyệt');
  if (req.paymentStatus === 'PAID') throw new AppError('Đã thanh toán');
  if (req.buyerUserId && req.buyerUserId !== buyerUserId) throw new AppError('Bạn không phải người mua được chỉ định', 403);

  const buyerWallet = await tx.wallet.findUnique({ where: { userId: buyerUserId } });
  if (!buyerWallet) throw new AppError('Ví người mua không tồn tại', 404);
  const total = req.askingPrice + req.feeAmount;
  if (buyerWallet.available < total)
    throw new AppError(`Số dư không đủ. Cần ${total.toLocaleString('vi-VN')}đ (giá ${req.askingPrice.toLocaleString('vi-VN')}đ + phí ${req.feeAmount.toLocaleString('vi-VN')}đ).`);

  // buyer → seller (giá mua)
  if (req.askingPrice > 0) {
    const buyerAcc = await getUserWalletAccount(tx, buyerUserId);
    const sellerAcc = await getUserWalletAccount(tx, req.sellerUserId);
    await postJournal(tx, {
      kind: 'SLOT_TRANSFER',
      memo: `Mua suất ${req.slot.slotCode} — ${req.slot.group.name}`,
      groupId: req.slot.groupId,
      legs: [
        { accountId: buyerAcc.id, direction: 'DEBIT', amount: req.askingPrice },
        { accountId: sellerAcc.id, direction: 'CREDIT', amount: req.askingPrice },
      ],
    });
    await syncWallet(tx, buyerUserId, buyerAcc.balance - req.askingPrice);
    await syncWallet(tx, req.sellerUserId, sellerAcc.balance + req.askingPrice);
    await recordHistory(tx, buyerUserId, { type: 'TRANSFER_OUT', direction: 'OUT', amount: req.askingPrice, note: `Mua suất ${req.slot.slotCode}`, groupId: req.slot.groupId });
    await recordHistory(tx, req.sellerUserId, { type: 'TRANSFER_IN', direction: 'IN', amount: req.askingPrice, note: `Bán suất ${req.slot.slotCode}`, groupId: req.slot.groupId });
  }
  // phí nền tảng (người mua chịu)
  await chargeFee(tx, buyerUserId, req.feeAmount, `Phí chuyển nhượng suất ${req.slot.slotCode}`, req.slot.groupId);

  const fromUserId = req.sellerUserId;
  // cập nhật chủ sở hữu
  await tx.huiSlot.update({
    where: { id: req.slotId },
    data: {
      currentOwnerId: buyerUserId,
      status: 'ACTIVE',
      lockedReason: null,
      acquiredAt: new Date(),
      transferredCount: { increment: 1 },
    },
  });
  await tx.slotOwnershipHistory.create({
    data: {
      slotId: req.slotId, fromUserId, toUserId: buyerUserId,
      transferType: req.buyerType === 'INTERNAL' ? 'INTERNAL' : 'EXTERNAL',
      transferPrice: req.askingPrice, note: req.note,
    },
  });
  // đảm bảo buyer là thành viên dây
  await tx.membership.upsert({
    where: { groupId_userId: { groupId: req.slot.groupId, userId: buyerUserId } },
    create: { groupId: req.slot.groupId, userId: buyerUserId, status: 'APPROVED', role: 'MEMBER' },
    update: { status: 'APPROVED' },
  });
  // hợp đồng chuyển nhượng điện tử
  const hash = genCode('HASH', 12);
  await tx.slotTransferAgreement.upsert({
    where: { transferRequestId: requestId },
    create: {
      transferRequestId: requestId,
      agreementText: `Hợp đồng chuyển nhượng suất ${req.slot.slotCode} dây "${req.slot.group.name}" từ người bán sang người mua với giá ${req.askingPrice.toLocaleString('vi-VN')}đ.`,
      sellerSignedAt: new Date(), buyerSignedAt: new Date(), signedHash: hash,
    },
    update: { buyerSignedAt: new Date(), signedHash: hash },
  });
  await tx.slotTransferRequest.update({
    where: { id: requestId },
    data: { paymentStatus: 'PAID', completedAt: new Date(), buyerUserId },
  });
  await notify(tx, req.sellerUserId, 'TRANSFER', 'Chuyển nhượng hoàn tất', `Bạn đã bán suất ${req.slot.slotCode} thành công.`);
  await notify(tx, buyerUserId, 'TRANSFER', 'Bạn đã sở hữu suất mới', `Suất ${req.slot.slotCode} — ${req.slot.group.name} đã thuộc về bạn.`);
  return { completed: true, hash };
}
