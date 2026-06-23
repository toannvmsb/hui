# Hụi Thông Minh — Nền tảng quản lý hụi/họ

Ứng dụng quản lý chơi hụi/họ minh bạch, an toàn cho người chơi — số hóa toàn bộ vòng đời dây hụi: tạo dây, mời thành viên, ký quy ước điện tử, đóng hụi, đấu/giật hụi, lĩnh hụi, chuyển nhượng suất, bảo đảm, ví điện tử, cảnh báo rủi ro, tranh chấp, và bảng điều khiển cho chủ hụi & admin.

Xây dựng theo 3 tài liệu đặc tả + bộ thiết kế UI/UX (Stitch "Modern Trust Finance").

## Kiến trúc

| Tầng | Công nghệ |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS (mobile-first, đúng design token) + React Query + Zustand |
| Backend | Node + Express + TypeScript + Prisma |
| Database | SQLite (chạy local không cần cài đặt; schema sẵn sàng chuyển PostgreSQL) |
| Sổ cái | Double-entry ledger (bút toán kép, luôn cân về 0) |

Điểm cốt lõi theo tài liệu:
- **Quản lý theo suất hụi (slot)** — một người giữ nhiều suất, suất chuyển nhượng được.
- **2 loại hụi:** hụi chết (thứ tự cố định) / hụi sống (đấu giật).
- **2 chế độ:** tự quản / có bảo đảm (đối tác tài chính trả thay).
- **Phí cố định (flat fee)** — không lãi, không % trên tiền hụi.
- Ví người dùng + ví ảo dây hụi, dòng tiền: User → ví dây → người hốt.

## Chạy ứng dụng

```bash
# 1. Cài đặt (đã tự generate Prisma client)
npm install

# 2. Tạo DB + nạp dữ liệu demo
npm run setup

# 3. Chạy cả backend (cổng 4000) + frontend (cổng 5173)
npm run dev
```

Mở http://localhost:5173

## Tài khoản demo (OTP luôn là `123456`)

| Vai trò | SĐT | Tên |
|---------|-----|-----|
| Người chơi | `0900000001` | Nguyễn Văn An (đang nợ kỳ ở 3 dây, giữ 4 suất, có đề nghị mua suất chờ thanh toán) |
| Admin | `0911111111` | Quản trị viên |

Các thành viên khác: `0900000002` … `0900000008`.

## Luồng trải nghiệm thử

1. Đăng nhập `0900000001` → Trang chủ thấy "Cần đóng" → **Đóng hụi** một dây.
2. Vào **Dây hụi Kim Cương** (hụi sống) → tab Kỳ hụi → **phiên đấu hụi** đặt giá giật.
3. **Ví** → Nạp/Rút tiền, xem lịch sử & biên nhận.
4. **Suất hụi** → chi tiết suất → lịch sử sở hữu; **Chuyển nhượng** ở mục Chuyển nhượng (có 1 đề nghị chờ thanh toán).
5. **Cá nhân** → điểm uy tín, bảo đảm, khiếu nại, hỗ trợ.
6. Đăng nhập **admin** → GMV, **đối soát sổ cái (cân = 0)**, rủi ro, tranh chấp.

## Cấu trúc

```
server/   API Express + Prisma + services (ledger, hui, auction, transfer, wallet)
web/      React app (pages/, components/, lib/, store/)
```

## Bật eKYC thật (FPT.AI)

Mặc định eKYC chạy **mô phỏng** (OCR + đối chiếu khuôn mặt giả lập) để demo không cần chi phí.
Để dùng **eKYC thật**, hệ thống đã tích hợp sẵn **FPT.AI** — chỉ cần lấy API key:

1. Tạo tài khoản tại **https://console.fpt.ai** → tạo **API key** (eKYC / Vision).
2. Đặt biến môi trường (local: `server/.env`; Railway: tab Variables):
   ```
   EKYC_PROVIDER=fpt
   FPT_API_KEY=<api-key-của-bạn>
   ```
3. Khởi động lại app. Từ giờ:
   - Bước OCR gọi `api.fpt.ai/vision/idr/vnm` để đọc CCCD thật.
   - Bước đối chiếu gọi `api.fpt.ai/dmp/checkface` so khớp selfie ↔ ảnh CCCD thật.
   - Tự duyệt nếu điểm khớp ≥ `EKYC_FACE_THRESHOLD` (mặc định 80), ngược lại chuyển admin duyệt.

> An toàn: nếu thiếu key hoặc FPT.AI lỗi/chậm, hệ thống **tự fallback về mô phỏng** (có timeout 12s) — app không bao giờ treo. Code tích hợp ở `server/src/services/ekyc.ts` (đổi sang VNPT/VNG chỉ cần thêm 1 adapter ở đây).

## Triển khai lên Railway (1 service: API + giao diện + DB)

App được cấu hình chạy **1 service duy nhất**: Express phục vụ cả API lẫn giao diện React (cùng origin),
DB là SQLite lưu trên **Volume** của Railway. Khi deploy lần đầu, hệ thống tự tạo bảng + nạp dữ liệu demo.

**Bước 1 — Đưa code lên GitHub** (nếu chưa có repo):
```bash
git init && git add . && git commit -m "Hụi Thông Minh"
git branch -M main
git remote add origin <URL_repo_GitHub_cua_anh>
git push -u origin main
```

**Bước 2 — Tạo project trên Railway:**
1. Vào https://railway.app → **New Project** → **Deploy from GitHub repo** → chọn repo này.
2. Railway tự đọc `railway.json` (build: `npm run build`, start: `npm start`).

**Bước 3 — Thêm Volume (ổ đĩa lưu DB):**
- Trong service → tab **Variables/Settings** → **Volumes** → **New Volume**, mount path: `/data`.

**Bước 4 — Đặt biến môi trường (Variables):**
| Biến | Giá trị |
|------|---------|
| `DATABASE_URL` | `file:/data/hui.db` |
| `JWT_SECRET` | một chuỗi ngẫu nhiên bất kỳ (bảo mật token) |
| `NODE_ENV` | `production` |

> `PORT` do Railway tự cấp — không cần đặt.

**Bước 5 — Deploy & mở app:**
- Railway tự build & chạy. Sau khi xong, vào **Settings → Networking → Generate Domain** để lấy URL công khai.
- Mở URL → đăng nhập demo `0900000001` / OTP `123456` (hoặc admin `0911111111`).

**Ghi chú:**
- Lần deploy đầu DB trống → tự seed dữ liệu demo. Các lần sau giữ nguyên dữ liệu (không seed đè).
- Muốn làm mới dữ liệu: xoá file trên Volume hoặc tạo Volume mới rồi redeploy.
- Đây là SQLite 1 instance (phù hợp chạy thử/demo). Khi lên production thật nhiều người dùng, nên chuyển
  sang PostgreSQL — schema đã thiết kế sẵn để chuyển dễ dàng (không dùng enum), chỉ cần đổi `provider` và `DATABASE_URL`.
