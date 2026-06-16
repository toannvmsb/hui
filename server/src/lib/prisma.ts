import { PrismaClient } from '@prisma/client';

// Fallback an toàn cho local dev nếu thiếu .env. Railway đặt DATABASE_URL ở dashboard (ưu tiên).
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = 'file:./hui.db';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
