import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { handler, AppError } from '../lib/http.js';
import { authRequired } from '../middleware/auth.js';
import { topUp, withdraw } from '../services/wallet.js';
import { FEES } from '../lib/constants.js';

export const walletRouter = Router();
walletRouter.use(authRequired);

walletRouter.get('/', handler(async (req: any, res) => {
  const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId } });
  if (!wallet) throw new AppError('Ví không tồn tại', 404);
  res.json(wallet);
}));

walletRouter.get('/transactions', handler(async (req: any, res) => {
  const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId } });
  if (!wallet) throw new AppError('Ví không tồn tại', 404);
  const txs = await prisma.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(txs);
}));

walletRouter.post('/topup', handler(async (req: any, res) => {
  const amount = Math.round(Number(req.body.amount));
  if (!amount || amount <= 0) throw new AppError('Số tiền không hợp lệ');
  await prisma.$transaction((tx) => topUp(tx, req.userId, amount));
  const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId } });
  res.json({ ok: true, wallet });
}));

walletRouter.post('/withdraw', handler(async (req: any, res) => {
  const amount = Math.round(Number(req.body.amount));
  if (!amount || amount <= 0) throw new AppError('Số tiền không hợp lệ');
  await prisma.$transaction((tx) => withdraw(tx, req.userId, amount));
  const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId } });
  res.json({ ok: true, wallet, fee: FEES.WITHDRAW });
}));

// Liên kết ngân hàng
walletRouter.get('/banks', handler(async (req: any, res) => {
  const banks = await prisma.bankLink.findMany({ where: { userId: req.userId }, orderBy: { isDefault: 'desc' } });
  res.json(banks);
}));

walletRouter.post('/banks', handler(async (req: any, res) => {
  const { bankName, bankCode, accountNo, accountName } = req.body;
  if (!bankName || !accountNo) throw new AppError('Thiếu thông tin ngân hàng');
  const count = await prisma.bankLink.count({ where: { userId: req.userId } });
  const bank = await prisma.bankLink.create({
    data: { userId: req.userId, bankName, bankCode: bankCode || '', accountNo, accountName: accountName || '', isDefault: count === 0 },
  });
  res.json(bank);
}));

walletRouter.delete('/banks/:id', handler(async (req: any, res) => {
  await prisma.bankLink.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  res.json({ ok: true });
}));
