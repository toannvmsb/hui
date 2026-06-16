import type { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../lib/http.js';
import { PLATFORM_FEE_ACCOUNT, BANK_CLEARING_ACCOUNT, GUARANTEE_ACCOUNT } from '../lib/constants.js';

type Tx = Prisma.TransactionClient | PrismaClient;

export interface Leg {
  accountId: string;
  direction: 'DEBIT' | 'CREDIT';
  amount: number;
}

/**
 * Post a balanced double-entry journal entry.
 * Convention: a CREDIT increases an account's balance, a DEBIT decreases it.
 * The sum of CREDIT amounts must equal the sum of DEBIT amounts (conservation of money).
 */
export async function postJournal(
  tx: Tx,
  opts: { kind: string; memo: string; groupId?: string; cycleId?: string; legs: Leg[] }
) {
  const credits = opts.legs.filter((l) => l.direction === 'CREDIT').reduce((s, l) => s + l.amount, 0);
  const debits = opts.legs.filter((l) => l.direction === 'DEBIT').reduce((s, l) => s + l.amount, 0);
  if (credits !== debits) {
    throw new AppError(`Bút toán không cân: nợ ${debits} ≠ có ${credits}`, 500);
  }
  if (opts.legs.some((l) => l.amount <= 0)) throw new AppError('Số tiền bút toán phải > 0', 500);

  const entry = await tx.journalEntry.create({
    data: { kind: opts.kind, memo: opts.memo, groupId: opts.groupId, cycleId: opts.cycleId },
  });

  for (const leg of opts.legs) {
    await tx.ledgerPosting.create({
      data: { entryId: entry.id, accountId: leg.accountId, direction: leg.direction, amount: leg.amount },
    });
    const delta = leg.direction === 'CREDIT' ? leg.amount : -leg.amount;
    await tx.ledgerAccount.update({ where: { id: leg.accountId }, data: { balance: { increment: delta } } });
  }
  return entry;
}

export async function getOrCreatePlatformAccount(tx: Tx, code: string, name: string, type: string) {
  const existing = await tx.ledgerAccount.findUnique({ where: { code } });
  if (existing) return existing;
  return tx.ledgerAccount.create({ data: { code, name, type } });
}

export async function getUserWalletAccount(tx: Tx, userId: string) {
  const acc = await tx.ledgerAccount.findFirst({ where: { type: 'USER_WALLET', userId } });
  if (!acc) throw new AppError('Không tìm thấy tài khoản ví người dùng', 500);
  return acc;
}

export async function getGroupWalletAccount(tx: Tx, groupId: string) {
  const acc = await tx.ledgerAccount.findFirst({ where: { type: 'HUI_WALLET', groupId } });
  if (!acc) throw new AppError('Không tìm thấy ví ảo dây hụi', 500);
  return acc;
}

export async function platformFeeAccount(tx: Tx) {
  return getOrCreatePlatformAccount(tx, PLATFORM_FEE_ACCOUNT, 'Doanh thu phí dịch vụ', 'PLATFORM_FEE');
}
export async function bankClearingAccount(tx: Tx) {
  return getOrCreatePlatformAccount(tx, BANK_CLEARING_ACCOUNT, 'Đối soát ngân hàng / nạp rút', 'BANK_CLEARING');
}
export async function guaranteePoolAccount(tx: Tx) {
  return getOrCreatePlatformAccount(tx, GUARANTEE_ACCOUNT, 'Quỹ bảo đảm đối tác', 'GUARANTEE');
}
