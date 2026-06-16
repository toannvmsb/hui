import type { Prisma, PrismaClient } from '@prisma/client';
import { genCode } from '../lib/http.js';

type Tx = Prisma.TransactionClient | PrismaClient;

const AVATAR_COLORS = ['#006c49', '#131b2e', '#3980f4', '#9333ea', '#FF9800', '#ba1a1a', '#00714d'];

/** Tạo user + ví + tài khoản sổ cái ví. */
export async function createUserWithWallet(
  tx: Tx,
  data: { phone: string; fullName: string; role?: string; creditScore?: number }
) {
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  const user = await tx.user.create({
    data: {
      phone: data.phone,
      fullName: data.fullName,
      role: data.role || 'PLAYER',
      avatarColor: color,
      creditScore: data.creditScore ?? 650,
    },
  });
  await tx.wallet.create({
    data: { userId: user.id, accountNumber: '9' + genCode('', 11) },
  });
  await tx.ledgerAccount.create({
    data: { code: `UW-${user.id}`, type: 'USER_WALLET', name: `Ví ${data.fullName}`, userId: user.id },
  });
  return user;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
