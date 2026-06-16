import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';

export interface AuthedRequest extends Request {
  userId: string;
  role: string;
}

export async function authRequired(req: any, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa đăng nhập' });
  }
  try {
    const payload = verifyToken(header.slice(7));
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { role: true, locked: true } });
    if (!user) return res.status(401).json({ error: 'Tài khoản không tồn tại' });
    if (user.locked) return res.status(403).json({ error: 'Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ.', code: 'ACCOUNT_LOCKED' });
    req.userId = payload.userId;
    req.role = user.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Phiên đăng nhập hết hạn' });
  }
}

export function adminRequired(req: any, res: Response, next: NextFunction) {
  if (req.role !== 'ADMIN') return res.status(403).json({ error: 'Chỉ dành cho quản trị viên' });
  next();
}
