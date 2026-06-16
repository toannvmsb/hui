// Shared domain constants & flat-fee schedule (no interest, no %, theo tài liệu pháp lý).

export const JWT_SECRET = process.env.JWT_SECRET || 'hui-thong-minh-dev-secret-2026';
export const PORT = Number(process.env.PORT || 4000);

export const FEES = {
  CREATE_SELF: 29_000, // tạo dây thường
  CREATE_SECURED: 79_000, // tạo dây có bảo đảm
  BID_SELF: 9_000, // giật hụi thường
  BID_SECURED: 29_000, // giật hụi có bảo đảm
  TRANSFER_INTERNAL: 9_000, // chuyển nhượng suất nội bộ
  TRANSFER_SECURED: 29_000, // chuyển nhượng có đối tác bảo đảm
  AUCTION: 10_000, // phí đấu giá / lần
  WITHDRAW: 10_000, // phí rút tiền
} as const;

export const ROLES = { PLAYER: 'PLAYER', ORGANIZER: 'ORGANIZER', ADMIN: 'ADMIN' } as const;

export const HUI_TYPE = { DEAD: 'DEAD', LIVE: 'LIVE' } as const;
export const HUI_MODE = { SELF: 'SELF', SECURED: 'SECURED' } as const;

export const GROUP_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_MEMBERS: 'PENDING_MEMBERS',
  PENDING_SIGN: 'PENDING_SIGN',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  BROKEN: 'BROKEN',
} as const;

export const CYCLE_STATUS = {
  PENDING: 'PENDING',
  COLLECTING: 'COLLECTING',
  BIDDING: 'BIDDING',
  PAID: 'PAID',
  CLOSED: 'CLOSED',
} as const;

export const CONTRIB_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  GUARANTEED_PAID: 'GUARANTEED_PAID',
} as const;

// Platform ledger account codes
export const PLATFORM_FEE_ACCOUNT = 'PLATFORM_FEE';
export const BANK_CLEARING_ACCOUNT = 'BANK_CLEARING';
export const GUARANTEE_ACCOUNT = 'GUARANTEE_POOL';
