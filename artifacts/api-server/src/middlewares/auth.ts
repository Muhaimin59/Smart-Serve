import type { NextFunction, Request, Response } from "express";
import type { User, UserRole } from "@workspace/db";
import { findUserForToken } from "../lib/auth";
declare global { namespace Express { interface Request { authUser?: User; authToken?: string; } } }
function bearer(request: Request) { const value = request.header("authorization"); return value?.startsWith("Bearer ") ? value.slice(7).trim() : undefined; }
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = bearer(req); if (!token) { res.status(401).json({ message: "Authentication required." }); return; }
  try { const user = await findUserForToken(token); if (!user) { res.status(401).json({ message: "Session is invalid or expired." }); return; } req.authUser = user; req.authToken = token; next(); } catch (error) { next(error); }
}
export function requireRole(...roles: UserRole[]) { return (req: Request, res: Response, next: NextFunction): void => { if (!req.authUser) { res.status(401).json({ message: "Authentication required." }); return; } if (!roles.includes(req.authUser.role)) { res.status(403).json({ message: "You are not authorized for this resource." }); return; } next(); }; }
