import type { NextFunction, Request, Response } from "express";

export class ApiError extends Error {
  status: number;
  code: string;
  data?: unknown;
  constructor(status: number, code: string, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ success: true, data });
}
export function fail(res: Response, status: number, code: string, message: string, data?: unknown): void {
  res.status(status).json({ success: false, error: { code, message }, ...(data ? { data } : {}) });
}

export function handle(fn: (req: Request, res: Response) => Promise<unknown>): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}

export function asyncErr(fn: (req: Request, res: Response) => Promise<unknown>): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}
