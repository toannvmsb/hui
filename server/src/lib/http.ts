import type { Response } from 'express';

export class AppError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Wrap an async route handler so thrown errors become JSON responses.
export function handler<T>(fn: (req: any, res: Response) => Promise<T>) {
  return async (req: any, res: Response) => {
    try {
      await fn(req, res);
    } catch (err: any) {
      if (err instanceof AppError) {
        res.status(err.status).json({ error: err.message, code: err.code });
      } else {
        console.error('[ERROR]', err);
        res.status(500).json({ error: err?.message || 'Lỗi hệ thống' });
      }
    }
  };
}

export function genCode(prefix: string, len = 6): string {
  const chars = '0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}${s}`;
}
