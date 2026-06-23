import { prisma } from '../src/lib/prisma.js';
import { createUserWithWallet } from '../src/services/account.js';
import { topUp } from '../src/services/wallet.js';
import { generateSchedule, payContribution, harvestCycle } from '../src/services/hui.js';
import { placeBid, closeAuction } from '../src/services/auction.js';
import { createTransferRequest, decideTransfer } from '../src/services/transfer.js';
import { genCode } from '../src/lib/http.js';
import { notify, raiseRisk } from '../src/services/notify.js';
import { mockOcr } from '../src/services/ekyc.js';

const svgImg = (label: string, color: string) =>
  'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="100%" height="100%" fill="${color}"/><text x="50%" y="50%" fill="white" font-size="20" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`);

async function wipe() {
  // Xóa theo thứ tự phụ thuộc
  const tables = [
    'ledgerPosting', 'journalEntry', 'walletTransaction', 'payout', 'huiBid', 'huiContribution',
    'slotTransferAgreement', 'slotTransferRequest', 'slotOwnershipHistory', 'agreementSignature',
    'huiCycle', 'huiSlot', 'membership', 'guarantee', 'riskAlert', 'dispute', 'notification', 'ekycSubmission',
    'adminApproval', 'auditLog', 'bankLink', 'huiGroup', 'ledgerAccount', 'wallet', 'guaranteeProvider', 'user',
  ];
  for (const t of tables) {
    // @ts-ignore
    await prisma[t].deleteMany();
  }
}

async function mkGroup(opts: {
  name: string; huiType: 'DEAD' | 'LIVE'; mode: 'SELF' | 'SECURED';
  amountPerSlot: number; cycleUnit: 'DAY' | 'WEEK' | 'MONTH'; totalCycles: number;
  organizerId: string; owners: string[]; bidRule?: 'SEALED' | 'OPEN'; startDate?: string;
}) {
  const totalSlots = opts.owners.length;
  const group = await prisma.huiGroup.create({
    data: {
      name: opts.name, code: genCode('H', 6), organizerId: opts.organizerId,
      huiType: opts.huiType, mode: opts.mode, totalSlots, amountPerSlot: opts.amountPerSlot,
      cycleUnit: opts.cycleUnit, totalCycles: opts.totalCycles, closingDay: 15,
      bidRule: opts.bidRule || 'SEALED',
      creationFee: opts.mode === 'SECURED' ? 79000 : 29000,
      status: 'ACTIVE', startDate: opts.startDate || new Date().toISOString(),
      organizerSharePct: 1.0, membersSharePct: 2.0,
      agreementText: `Quy ước dây hụi ${opts.name}`, agreementHash: genCode('HASH', 16),
    },
  });
  await prisma.ledgerAccount.create({ data: { code: `HW-${group.id}`, type: 'HUI_WALLET', name: `Ví dây ${group.name}`, groupId: group.id } });

  const uniqueOwners = [...new Set(opts.owners)];
  for (const uid of uniqueOwners) {
    await prisma.membership.upsert({
      where: { groupId_userId: { groupId: group.id, userId: uid } },
      create: { groupId: group.id, userId: uid, status: 'APPROVED', role: uid === opts.organizerId ? 'ORGANIZER' : 'MEMBER' },
      update: {},
    });
    await prisma.agreementSignature.create({ data: { groupId: group.id, userId: uid, signHash: genCode('SIG', 10) } });
  }
  for (let i = 0; i < totalSlots; i++) {
    await prisma.huiSlot.create({
      data: {
        groupId: group.id, slotCode: 'S' + String(i + 1).padStart(2, '0'),
        initialOwnerId: opts.owners[i], currentOwnerId: opts.owners[i], status: 'ACTIVE',
      },
    });
  }
  await prisma.$transaction((tx) => generateSchedule(tx, group.id));
  return group;
}

async function payCycleExcept(groupId: string, cycleNo: number, skip: string[] = []) {
  const cycle = await prisma.huiCycle.findFirst({ where: { groupId, cycleNo } });
  if (!cycle) return;
  const contribs = await prisma.huiContribution.findMany({ where: { cycleId: cycle.id, status: 'PENDING' } });
  for (const c of contribs) {
    if (skip.includes(c.ownerUserIdAtDueTime)) continue;
    await prisma.$transaction((tx) => payContribution(tx, c.id, c.ownerUserIdAtDueTime));
  }
}

async function markOverdue(groupId: string, cycleNo: number, userIds: string[]) {
  const cycle = await prisma.huiCycle.findFirst({ where: { groupId, cycleNo } });
  if (!cycle) return;
  await prisma.huiContribution.updateMany({
    where: { cycleId: cycle.id, ownerUserIdAtDueTime: { in: userIds }, status: 'PENDING' },
    data: { status: 'OVERDUE' },
  });
}

export async function seedDatabase() {
  console.log('🧹 Dọn dữ liệu cũ...');
  await wipe();

  console.log('👤 Tạo người dùng...');
  // Người dùng demo chính
  const an = await prisma.$transaction((tx) => createUserWithWallet(tx, { phone: '0900000001', fullName: 'Nguyễn Văn An', creditScore: 720 }));
  const binh = await prisma.$transaction((tx) => createUserWithWallet(tx, { phone: '0900000002', fullName: 'Trần Thị Bình', creditScore: 690 }));
  const cuong = await prisma.$transaction((tx) => createUserWithWallet(tx, { phone: '0900000003', fullName: 'Lê Văn Cường', creditScore: 650 }));
  const dung = await prisma.$transaction((tx) => createUserWithWallet(tx, { phone: '0900000004', fullName: 'Phạm Thị Dung', creditScore: 710 }));
  const em = await prisma.$transaction((tx) => createUserWithWallet(tx, { phone: '0900000005', fullName: 'Hoàng Văn Em', creditScore: 600 }));
  const phuong = await prisma.$transaction((tx) => createUserWithWallet(tx, { phone: '0900000006', fullName: 'Vũ Thị Phương', creditScore: 730 }));
  const giang = await prisma.$transaction((tx) => createUserWithWallet(tx, { phone: '0900000007', fullName: 'Đỗ Văn Giang', creditScore: 670 }));
  const hoa = await prisma.$transaction((tx) => createUserWithWallet(tx, { phone: '0900000008', fullName: 'Bùi Thị Hoa', creditScore: 680 }));
  const admin = await prisma.$transaction((tx) => createUserWithWallet(tx, { phone: '0911111111', fullName: 'Quản Trị Viên', role: 'ADMIN', creditScore: 800 }));
  const admin2 = await prisma.$transaction((tx) => createUserWithWallet(tx, { phone: '0922222222', fullName: 'Kiểm Soát Viên', role: 'ADMIN', creditScore: 800 }));
  await prisma.scoreConfig.upsert({ where: { id: 'default' }, create: { id: 'default' }, update: {} });

  const players = [an, binh, cuong, dung, em, phuong, giang, hoa];
  // eKYC verified + topup
  for (const u of [...players, admin]) {
    await prisma.user.update({ where: { id: u.id }, data: { ekycStatus: 'VERIFIED', cccd: '0' + genCode('', 11), address: 'TP. Hồ Chí Minh', pinHash: '123456' } });
    await prisma.$transaction((tx) => topUp(tx, u.id, 200_000_000, 'Nạp tiền khởi tạo'));
  }
  // bank links
  await prisma.bankLink.create({ data: { userId: an.id, bankName: 'Vietcombank', bankCode: 'VCB', accountNo: '0071000123456', accountName: 'NGUYEN VAN AN', isDefault: true } });
  await prisma.bankLink.create({ data: { userId: an.id, bankName: 'MB Bank', bankCode: 'MB', accountNo: '0901234567', accountName: 'NGUYEN VAN AN' } });

  console.log('🏦 Tạo đối tác bảo đảm...');
  const f88 = await prisma.guaranteeProvider.create({ data: { name: 'F88 — Cầm đồ & Tài chính', type: 'PAWN', logoColor: '#00a859' } });
  const fe = await prisma.guaranteeProvider.create({ data: { name: 'FE Credit', type: 'FINANCE', logoColor: '#e2001a' } });
  await prisma.guaranteeProvider.create({ data: { name: 'Home Credit', type: 'FINANCE', logoColor: '#e2241a' } });

  console.log('💎 Dây 1: Kim Cương (hụi sống, tự quản)...');
  // An là chủ, giữ 2 suất; mỗi người khác 1 suất → 10 suất
  const g1 = await mkGroup({
    name: 'Dây hụi Kim Cương', huiType: 'LIVE', mode: 'SELF', amountPerSlot: 5_000_000,
    cycleUnit: 'MONTH', totalCycles: 10, organizerId: an.id, bidRule: 'OPEN',
    owners: [an.id, an.id, binh.id, cuong.id, dung.id, em.id, phuong.id, giang.id, hoa.id, binh.id],
    startDate: new Date(Date.now() - 30 * 86400000).toISOString(),
  });
  // Kỳ 1: mọi người đóng, đấu giật → Bình thắng
  {
    const c1 = await prisma.huiCycle.findFirst({ where: { groupId: g1.id, cycleNo: 1 } });
    const binhSlot = await prisma.huiSlot.findFirst({ where: { groupId: g1.id, currentOwnerId: binh.id } });
    const cuongSlot = await prisma.huiSlot.findFirst({ where: { groupId: g1.id, currentOwnerId: cuong.id } });
    await prisma.$transaction((tx) => placeBid(tx, c1!.id, cuongSlot!.id, 1_500_000));
    await prisma.$transaction((tx) => placeBid(tx, c1!.id, binhSlot!.id, 2_200_000));
    await prisma.$transaction((tx) => closeAuction(tx, c1!.id));
    await payCycleExcept(g1.id, 1);
    await prisma.$transaction((tx) => harvestCycle(tx, c1!.id, {}));
  }
  // Kỳ 2 đang thu: An (2 suất) CHƯA đóng → tạo "cần đóng tháng này"
  await payCycleExcept(g1.id, 2, [an.id, em.id]);
  await markOverdue(g1.id, 2, [em.id]); // Em quá hạn → rủi ro

  console.log('🛍️ Dây 2: Hội Chị Em Chợ Lớn (hụi chết)...');
  const g2 = await mkGroup({
    name: 'Hội Chị Em Chợ Lớn', huiType: 'DEAD', mode: 'SELF', amountPerSlot: 2_500_000,
    cycleUnit: 'MONTH', totalCycles: 6, organizerId: phuong.id,
    owners: [phuong.id, an.id, binh.id, dung.id, hoa.id, giang.id],
    startDate: new Date(Date.now() - 60 * 86400000).toISOString(),
  });
  // Kỳ 1 (Phương hốt) & kỳ 2 (An hốt) đã xong
  await payCycleExcept(g2.id, 1);
  {
    const c1 = await prisma.huiCycle.findFirst({ where: { groupId: g2.id, cycleNo: 1 } });
    await prisma.$transaction((tx) => harvestCycle(tx, c1!.id, {}));
  }
  await payCycleExcept(g2.id, 2);
  {
    const c2 = await prisma.huiCycle.findFirst({ where: { groupId: g2.id, cycleNo: 2 } });
    await prisma.$transaction((tx) => harvestCycle(tx, c2!.id, {}));
  }
  // Kỳ 3 đang thu, An chưa đóng
  await payCycleExcept(g2.id, 3, [an.id]);

  console.log('🏠 Dây 3: Mua Nhà (hụi sống, CÓ BẢO ĐẢM)...');
  const g3 = await mkGroup({
    name: 'Dây hụi Mua Nhà', huiType: 'LIVE', mode: 'SECURED', amountPerSlot: 10_000_000,
    cycleUnit: 'MONTH', totalCycles: 8, organizerId: dung.id, bidRule: 'SEALED',
    owners: [dung.id, an.id, binh.id, cuong.id, phuong.id, giang.id, hoa.id, em.id],
    startDate: new Date(Date.now() - 15 * 86400000).toISOString(),
  });
  // An xin hạn mức bảo đảm cho suất của mình
  const anSlotG3 = await prisma.huiSlot.findFirst({ where: { groupId: g3.id, currentOwnerId: an.id } });
  await prisma.guarantee.create({ data: { userId: an.id, providerId: f88.id, slotId: anSlotG3!.id, limitAmount: 70_000_000, status: 'APPROVED' } });
  await prisma.huiSlot.update({ where: { id: anSlotG3!.id }, data: { guaranteeStatus: 'APPROVED' } });
  // Kỳ 1 đang thu — An chưa đóng
  await payCycleExcept(g3.id, 1, [an.id, cuong.id]);

  console.log('🚀 Dây 4: Khởi Nghiệp (đang tuyển thành viên)...');
  const g4 = await prisma.huiGroup.create({
    data: {
      name: 'Hụi Khởi Nghiệp Trẻ', code: genCode('H', 6), organizerId: giang.id,
      huiType: 'LIVE', mode: 'SELF', totalSlots: 12, amountPerSlot: 3_000_000,
      cycleUnit: 'MONTH', totalCycles: 12, closingDay: 10, bidRule: 'OPEN',
      creationFee: 29000, status: 'PENDING_MEMBERS', organizerSharePct: 1.0, membersSharePct: 2.0,
      agreementText: 'Quy ước dây hụi Hụi Khởi Nghiệp Trẻ',
    },
  });
  await prisma.ledgerAccount.create({ data: { code: `HW-${g4.id}`, type: 'HUI_WALLET', name: `Ví dây ${g4.name}`, groupId: g4.id } });
  await prisma.membership.create({ data: { groupId: g4.id, userId: giang.id, status: 'APPROVED', role: 'ORGANIZER' } });
  await prisma.agreementSignature.create({ data: { groupId: g4.id, userId: giang.id, signHash: genCode('SIG', 10) } });
  for (let i = 0; i < 12; i++) {
    const mine = i < 3;
    await prisma.huiSlot.create({ data: { groupId: g4.id, slotCode: 'S' + String(i + 1).padStart(2, '0'), initialOwnerId: mine ? giang.id : null, currentOwnerId: mine ? giang.id : null, status: mine ? 'ACTIVE' : 'OPEN' } });
  }
  // Bình & Cường đang xin tham gia
  await prisma.membership.create({ data: { groupId: g4.id, userId: binh.id, status: 'PENDING' } });
  await prisma.membership.create({ data: { groupId: g4.id, userId: cuong.id, status: 'PENDING' } });

  console.log('🔁 Tạo đề nghị chuyển nhượng suất...');
  // Hoa muốn bán 1 suất ở Dây Kim Cương cho An (đã duyệt, chờ An thanh toán)
  const hoaSlot = await prisma.huiSlot.findFirst({ where: { groupId: g1.id, currentOwnerId: hoa.id, hasDrawn: false } });
  if (hoaSlot) {
    const tr = await prisma.$transaction((tx) => createTransferRequest(tx, {
      slotId: hoaSlot.id, sellerUserId: hoa.id, buyerUserId: an.id, buyerType: 'INTERNAL', askingPrice: 4_000_000, note: 'Cần tiền gấp, sang suất chưa hốt',
    }));
    await prisma.$transaction((tx) => decideTransfer(tx, tr.id, true, an.id));
  }

  console.log('⚠️ Tạo cảnh báo rủi ro & tranh chấp...');
  await raiseRisk(prisma, { level: 'HIGH', type: 'LATE_PAYMENT', title: 'Thành viên chậm đóng nhiều kỳ', message: 'Hoàng Văn Em đã quá hạn đóng kỳ 2 dây Kim Cương.', userId: em.id, groupId: g1.id });
  await raiseRisk(prisma, { level: 'MEDIUM', type: 'BREAK_RISK', title: 'Dây hụi có nguy cơ', message: 'Dây Kim Cương có 1 thành viên quá hạn — theo dõi sát nguy cơ vỡ.', groupId: g1.id });
  await prisma.dispute.create({ data: { code: genCode('KN', 7), raiserId: cuong.id, groupId: g1.id, category: 'BID_RESULT', subject: 'Thắc mắc kết quả giật hụi kỳ 1', detail: 'Tôi muốn xem lại log đấu giá kỳ 1 vì giá giật của tôi sát với người thắng.', status: 'OPEN' } });

  console.log('👥 Tạo thêm người dùng (để demo tìm kiếm hồ sơ)...');
  const ho = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
  const dem = ['Văn', 'Thị', 'Hữu', 'Đức', 'Minh', 'Ngọc', 'Quang', 'Thanh', 'Gia', 'Kim'];
  const ten = ['Tuấn', 'Linh', 'Hùng', 'Mai', 'Sơn', 'Lan', 'Khoa', 'Trang', 'Nam', 'Hà', 'Long', 'Thảo', 'Phúc', 'Vy', 'Đạt', 'Như', 'Bảo', 'Yến', 'Kiên', 'Ngân', 'Tài', 'Hương'];
  for (let i = 0; i < 22; i++) {
    const name = `${ho[i % ho.length]} ${dem[i % dem.length]} ${ten[i % ten.length]}`;
    const phone = '093' + String(1000000 + i * 137).padStart(7, '0');
    const score = 540 + Math.floor(Math.random() * 280);
    const u = await prisma.$transaction((tx) => createUserWithWallet(tx, { phone, fullName: name, creditScore: score }));
    // ~70% đã eKYC, phần còn lại đang khám phá
    if (i % 10 < 7) await prisma.user.update({ where: { id: u.id }, data: { ekycStatus: 'VERIFIED', cccd: '0' + genCode('', 11), address: 'Việt Nam' } });
  }

  console.log('🪪 Tạo hồ sơ eKYC chờ duyệt...');
  const reviewUsers = await prisma.user.findMany({ where: { ekycStatus: 'PENDING', role: 'PLAYER' }, take: 2 });
  for (const u of reviewUsers) {
    const o = mockOcr(u.fullName);
    await prisma.ekycSubmission.create({
      data: {
        userId: u.id, status: 'PENDING_REVIEW', cccd: o.cccd, fullName: u.fullName, dob: o.dob, gender: o.gender,
        hometown: o.hometown, address: o.address, issueDate: o.issueDate, issuePlace: o.issuePlace,
        frontImage: svgImg('CCCD mặt trước', '#006c49'), backImage: svgImg('CCCD mặt sau', '#131b2e'), selfieImage: svgImg('Selfie', '#3980f4'),
        faceMatchScore: 70 + Math.round(Math.random() * 80) / 10, livenessScore: 80 + Math.round(Math.random() * 100) / 10, ocrConfidence: o.ocrConfidence,
      },
    });
    await prisma.user.update({ where: { id: u.id }, data: { ekycStatus: 'REVIEWING' } });
    await notify(prisma, admin.id, 'SYSTEM', 'Hồ sơ eKYC cần duyệt', `${u.fullName} đã nộp hồ sơ định danh — cần kiểm tra.`, '/admin/ekyc');
  }

  console.log('🔔 Tạo thông báo chào mừng...');
  await notify(prisma, an.id, 'SYSTEM', 'Chào mừng đến với Hụi Thông Minh!', 'Quản lý hụi minh bạch, an toàn. Khám phá các dây hụi của bạn ngay.', '/');

  const feeAcc = await prisma.ledgerAccount.findFirst({ where: { code: 'PLATFORM_FEE' } });
  console.log('\n✅ Seed hoàn tất!');
  console.log(`   • ${players.length} người chơi + 1 admin`);
  console.log(`   • 4 dây hụi (Kim Cương, Chợ Lớn, Mua Nhà, Khởi Nghiệp)`);
  console.log(`   • Doanh thu phí nền tảng: ${(feeAcc?.balance || 0).toLocaleString('vi-VN')}đ`);
  console.log('\n📱 Đăng nhập demo:');
  console.log('   Người chơi:  0900000001  (OTP: 123456)  — Nguyễn Văn An');
  console.log('   Admin:       0911111111  (OTP: 123456)  — Quản Trị Viên\n');
}

// Chạy trực tiếp (npm run seed): luôn reset + seed
import { pathToFileURL } from 'url';
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  seedDatabase()
    .catch((e) => { console.error('❌ Seed lỗi:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
