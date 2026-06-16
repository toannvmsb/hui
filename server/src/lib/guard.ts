import { prisma } from './prisma.js';
import { AppError } from './http.js';

/** Bắt buộc đã định danh eKYC trước khi tạo/tham gia dây, mua suất... */
export async function requireEkyc(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { ekycStatus: true } });
  if (!u || u.ekycStatus !== 'VERIFIED') {
    throw new AppError('Bạn cần hoàn tất định danh eKYC trước khi thực hiện thao tác này.', 403, 'EKYC_REQUIRED');
  }
}
