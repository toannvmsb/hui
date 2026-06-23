import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { handler, AppError } from '../lib/http.js';
import { signToken } from '../lib/auth.js';
import { authRequired } from '../middleware/auth.js';
import { createUserWithWallet } from '../services/account.js';
import { extractIdCard, matchFaceLiveness } from '../services/ekyc.js';

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
// Bước OCR: trích xuất thông tin từ ảnh CCCD mặt trước (mô phỏng)
authRouter.post('/ekyc/ocr', authRequired, handler(async (req: any, res) => {
  if (!req.body.frontImage) throw new AppError('Thiếu ảnh CCCD mặt trước');
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) throw new AppError('Không tìm thấy người dùng', 404);
  const result = await extractIdCard(req.body.frontImage, user.fullName);
  res.json(result);
}));

// Nộp hồ sơ eKYC: lưu ảnh + đối chiếu khuôn mặt → tự duyệt hoặc chuyển duyệt thủ công
authRouter.post('/ekyc/submit', authRequired, handler(async (req: any, res) => {
  const b = req.body;
  if (!b.frontImage || !b.backImage || !b.selfieImage) throw new AppError('Cần đủ ảnh CCCD trước, sau và selfie');
  if (!/^\d{9,12}$/.test((b.cccd || '').replace(/\s/g, ''))) throw new AppError('Số CCCD không hợp lệ');
  if (!b.fullName?.trim()) throw new AppError('Thiếu họ tên');

  const bio = await matchFaceLiveness(b.frontImage, b.selfieImage);
  // Liveness chủ động (active challenge-response) phía client là tín hiệu thật → ưu tiên dùng.
  const clientLive = Number(b.clientLivenessScore);
  const useClient = b.livenessMethod === 'active-challenge' && clientLive > 0;
  const livenessScore = useClient ? clientLive : bio.livenessScore;
  const livenessMethod = useClient ? 'active-challenge' : (bio.provider === 'fpt' ? 'fpt' : 'derived');
  const passed = bio.faceMatchScore >= bio.faceThreshold && livenessScore >= bio.liveThreshold;
  const status = passed ? 'VERIFIED' : 'PENDING_REVIEW';

  const sub = await prisma.ekycSubmission.create({
    data: {
      userId: req.userId, status,
      cccd: (b.cccd || '').replace(/\s/g, ''), fullName: b.fullName, dob: b.dob, gender: b.gender,
      hometown: b.hometown, address: b.address, issueDate: b.issueDate, issuePlace: b.issuePlace,
      frontImage: b.frontImage, backImage: b.backImage, selfieImage: b.selfieImage,
      faceMatchScore: bio.faceMatchScore, livenessScore, livenessMethod,
      livenessChallenges: Array.isArray(b.livenessChallenges) ? JSON.stringify(b.livenessChallenges) : null,
      ocrConfidence: Number(b.ocrConfidence) || 95,
    },
  });

  await prisma.user.update({
    where: { id: req.userId },
    data: {
      cccd: sub.cccd, address: sub.address, dob: sub.dob,
      cccdFrontUrl: `ekyc:${sub.id}:front`, cccdBackUrl: `ekyc:${sub.id}:back`, selfieUrl: `ekyc:${sub.id}:selfie`,
      ekycStatus: passed ? 'VERIFIED' : 'REVIEWING',
    },
  });

  if (!passed) {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
    for (const a of admins) {
      await prisma.notification.create({ data: { userId: a.id, type: 'SYSTEM', title: 'Hồ sơ eKYC cần duyệt thủ công', body: `${b.fullName} nộp eKYC với điểm khớp ${bio.faceMatchScore}% — cần kiểm tra.`, link: '/admin/ekyc' } });
    }
  }

  res.json({
    ok: true, autoVerified: passed, ekycStatus: passed ? 'VERIFIED' : 'REVIEWING',
    faceMatchScore: bio.faceMatchScore, livenessScore, livenessMethod,
    faceThreshold: bio.faceThreshold, liveThreshold: bio.liveThreshold,
  });
}));

// Trạng thái eKYC hiện tại của người dùng
authRouter.get('/ekyc/status', authRequired, handler(async (req: any, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  const last = await prisma.ekycSubmission.findFirst({ where: { userId: req.userId }, orderBy: { createdAt: 'desc' } });
  res.json({
    ekycStatus: user?.ekycStatus || 'PENDING',
    submission: last ? { status: last.status, faceMatchScore: last.faceMatchScore, livenessScore: last.livenessScore, rejectReason: last.rejectReason, createdAt: last.createdAt } : null,
  });
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
