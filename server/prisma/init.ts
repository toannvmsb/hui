// Khởi tạo khi deploy: chỉ seed nếu cơ sở dữ liệu còn trống (không ghi đè dữ liệu test).
import { prisma } from '../src/lib/prisma.js';
import { seedDatabase } from './seed.js';

async function main() {
  const count = await prisma.user.count();
  if (count === 0) {
    console.log('🌱 DB trống — tiến hành seed dữ liệu demo...');
    await seedDatabase();
  } else {
    console.log(`✅ DB đã có ${count} người dùng — bỏ qua seed.`);
  }
}

main()
  .catch((e) => { console.error('❌ Init lỗi:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
