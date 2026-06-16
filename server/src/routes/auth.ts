import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { handler, AppError } from '../lib/http.js';
import { signToken } from '../lib/auth.js';
import { authRequired } from '../middleware/auth.js';
import { createUserWithWallet } from '../services/account.js';

export const authRouter = Router();

const DEMO_OTP = '123456';

// Gửi OTP (mock) — luôn trả 123456 ở môi trường dev
authRouter.post('/request-otp', handler(async (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^0\d{9}$/.test(phone)) throw new AppError('Số điện thoại không hợp lệ (10 số, bắt đầu 0)');
  const existing = await prisma.user.findUnique({ where: { phone } });
  res.json({ ok: true, devOtp: DEMO_OTP, isNewUser: !existing });
}));

// Xác thực OTP → đăng nhập hoặc tạo tài khoản mới
authRouter.post('/verify-otp', handler(async (req, res) => {
  const { phone, otp, fullName } = req.body;
  if (otp !== DEMO_OTP) throw new AppError('Mã OTP không đúng');
  let user = await prisma.user.findUnique({ where: { phone } });
  if (user?.locked) throw new AppError('Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ.', 403, 'ACCOUNT_LOCKED');
  if (!user) {
    user = await prisma.$transaction((tx) =>
      createUserWithWallet(tx, { phone, fullName: fullName?.trim() || 'Người chơi mới' })
    );
  }
  const token = signToken({ userId: user.id, role: user.role });
  res.json({ token, user: { id: user.id, phone: user.phone, fullName: user.fullName, role: user.role, ekycStatus: user.ekycStatus } });
}));

// Nộp eKYC (mock auto-verify)
authRouter.post('/ekyc', authRequired, handler(async (req: any, res) => {
  const { cccd, address, dob, cccdFrontUrl, cccdBackUrl, selfieUrl } = req.body;
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: {
      cccd, address, dob,
      cccdFrontUrl: cccdFrontUrl || 'mock://front',
      cccdBackUrl: cccdBackUrl || 'mock://back',
      selfieUrl: selfieUrl || 'mock://selfie',
      ekycStatus: 'VERIFIED',
    },
  });
  res.json({ ok: true, ekycStatus: user.ekycStatus });
}));

// Đặt PIN giao dịch (mock — lưu thẳng, demo)
authRouter.post('/set-pin', authRequired, handler(async (req: any, res) => {
  const { pin } = req.body;
  if (!/^\d{6}$/.test(pin || '')) throw new AppError('PIN phải gồm 6 chữ số');
  await prisma.user.update({ where: { id: req.userId }, data: { pinHash: pin } });
  res.json({ ok: true });
}));

authRouter.get('/me', authRequired, handler(async (req: any, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { wallet: true },
  });
  if (!user) throw new AppError('Không tìm thấy người dùng', 404);
  const ownedSlots = await prisma.huiSlot.count({ where: { currentOwnerId: user.id } });
  const groupsJoined = await prisma.membership.count({ where: { userId: user.id, status: 'APPROVED' } });
  res.json({
    id: user.id, phone: user.phone, fullName: user.fullName, role: user.role,
    ekycStatus: user.ekycStatus, cccd: user.cccd, address: user.address,
    creditScore: user.creditScore, trustRating: user.trustRating, avatarColor: user.avatarColor,
    hasPin: !!user.pinHash,
    wallet: user.wallet ? { available: user.wallet.available, blocked: user.wallet.blocked, accountNumber: user.wallet.accountNumber } : null,
    stats: { ownedSlots, groupsJoined },
  });
}));
