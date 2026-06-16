import type { Prisma, PrismaClient } from '@prisma/client';

type Tx = Prisma.TransactionClient | PrismaClient;

export async function notify(
  tx: Tx,
  userId: string,
  type: string,
  title: string,
  body: string,
  link?: string
) {
  await tx.notification.create({ data: { userId, type, title, body, link } });
}

export async function raiseRisk(
  tx: Tx,
  opts: { level: string; type: string; title: string; message: string; userId?: string; groupId?: string }
) {
  await tx.riskAlert.create({ data: opts });
}
