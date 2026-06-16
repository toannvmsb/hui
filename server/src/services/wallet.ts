import type { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../lib/http.js';
import {
  postJournal,
  getUserWalletAccount,
  bankClearingAccount,
  platformFeeAccount,
} from './ledger.js';
import { FEES } from '../lib/constants.js';

type Tx = Prisma.TransactionClient | PrismaClient;

async function syncWallet(tx: Tx, userId: string, walletAccountBalance: number) {
  await tx.wallet.update({ where: { userId }, data: { available: walletAccountBalance } });
}

async function recordHistory(
  tx: Tx,
  userId: string,
  data: { type: string; direction: 'IN' | 'OUT'; amount: number; note: string; groupId?: string }
) {
  const wallet = await tx.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new AppError('Ví không tồn tại', 404);
  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: data.type,
      direction: data.direction,
      amount: data.amount,
      balanceAfter: wallet.available,
      note: data.note,
      groupId: data.groupId,
    },
  });
}

/** Nạp tiền: bank → ví người dùng */
export async function topUp(tx: Tx, userId: string, amount: number, note = 'Nạp tiền vào ví') {
  if (amount <= 0) throw new AppError('Số tiền nạp phải lớn hơn 0');
  const wAcc = await getUserWalletAccount(tx, userId);
  const bank = await bankClearingAccount(tx);
  await postJournal(tx, {
    kind: 'TOPUP',
    memo: note,
    legs: [
      { accountId: bank.id, direction: 'DEBIT', amount },
      { accountId: wAcc.id, direction: 'CREDIT', amount },
    ],
  });
  await syncWallet(tx, userId, wAcc.balance + amount);
  await recordHistory(tx, userId, { type: 'TOPUP', direction: 'IN', amount, note });
}

/** Rút tiền: ví người dùng → bank, trừ phí rút */
export async function withdraw(tx: Tx, userId: string, amount: number, note = 'Rút tiền về ngân hàng') {
  if (amount <= 0) throw new AppError('Số tiền rút phải lớn hơn 0');
  const wallet = await tx.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new AppError('Ví không tồn tại', 404);
  const fee = FEES.WITHDRAW;
  const total = amount + fee;
  if (wallet.available < total) throw new AppError(`Số dư không đủ (cần ${total.toLocaleString('vi-VN')}đ gồm phí rút ${fee.toLocaleString('vi-VN')}đ)`);
  const wAcc = await getUserWalletAccount(tx, userId);
  const bank = await bankClearingAccount(tx);
  const feeAcc = await platformFeeAccount(tx);
  await postJournal(tx, {
    kind: 'WITHDRAW',
    memo: note,
    legs: [
      { accountId: wAcc.id, direction: 'DEBIT', amount: total },
      { accountId: bank.id, direction: 'CREDIT', amount },
      { accountId: feeAcc.id, direction: 'CREDIT', amount: fee },
    ],
  });
  await syncWallet(tx, userId, wAcc.balance - total);
  await recordHistory(tx, userId, { type: 'WITHDRAW', direction: 'OUT', amount, note: `${note} (phí ${fee.toLocaleString('vi-VN')}đ)` });
}

/** Thu phí dịch vụ từ ví người dùng → doanh thu nền tảng */
export async function chargeFee(tx: Tx, userId: string, amount: number, note: string, groupId?: string) {
  if (amount <= 0) return;
  const wallet = await tx.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new AppError('Ví không tồn tại', 404);
  if (wallet.available < amount) throw new AppError(`Số dư không đủ để thanh toán phí ${note}`);
  const wAcc = await getUserWalletAccount(tx, userId);
  const feeAcc = await platformFeeAccount(tx);
  await postJournal(tx, {
    kind: 'FEE',
    memo: note,
    groupId,
    legs: [
      { accountId: wAcc.id, direction: 'DEBIT', amount },
      { accountId: feeAcc.id, direction: 'CREDIT', amount },
    ],
  });
  await syncWallet(tx, userId, wAcc.balance - amount);
  await recordHistory(tx, userId, { type: 'FEE', direction: 'OUT', amount, note, groupId });
}

export { recordHistory, syncWallet };
