import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, isNull } from "drizzle-orm";
import { authSessions, customers, db, providers, type User, type UserRole, users } from "@workspace/db";

const scrypt = promisify(scryptCallback);
const SESSION_DAYS = 30;
const KEY_LENGTH = 64;

export type PublicUser = { id: string; email: string; role: UserRole; displayName: string; createdAt: Date };
export type AuthSession = { token: string; expiresAt: Date; user: PublicUser };

export function normalizeEmail(value: string) { return value.trim().toLowerCase(); }
export function validateSignup(input: unknown): { email: string; password: string; displayName: string; role: "customer" | "provider" } {
  if (!input || typeof input !== "object") throw new Error("Request body must be an object.");
  const body = input as Record<string, unknown>;
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const role = body.role;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Enter a valid email address.");
  if (password.length < 12 || password.length > 128) throw new Error("Password must be 12–128 characters.");
  if (displayName.length < 2 || displayName.length > 100) throw new Error("Display name must be 2–100 characters.");
  if (role !== "customer" && role !== "provider") throw new Error("Choose customer or provider.");
  return { email, password, displayName, role };
}
export function validateLogin(input: unknown): { email: string; password: string } {
  if (!input || typeof input !== "object") throw new Error("Request body must be an object.");
  const body = input as Record<string, unknown>;
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) throw new Error("Email and password are required.");
  return { email, password };
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scrypt(password, salt, KEY_LENGTH) as Buffer;
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, expected] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const actual = await scrypt(password, salt, KEY_LENGTH) as Buffer;
  const expectedBuffer = Buffer.from(expected, "base64url");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}
export function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
async function displayNameFor(user: User) {
  if (user.role === "customer") return (await db.select({ displayName: customers.displayName }).from(customers).where(eq(customers.userId, user.id)).limit(1))[0]?.displayName;
  if (user.role === "provider") return (await db.select({ displayName: providers.displayName }).from(providers).where(eq(providers.userId, user.id)).limit(1))[0]?.displayName;
  return undefined;
}
export async function toPublicUser(user: User): Promise<PublicUser> {
  return { id: user.id, email: user.email, role: user.role, displayName: (await displayNameFor(user)) ?? user.email, createdAt: user.createdAt };
}
export async function createSession(user: User): Promise<AuthSession> {
  const token = randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(authSessions).values({ userId: user.id, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt, user: await toPublicUser(user) };
}
export async function findUserForToken(token: string): Promise<User | undefined> {
  const row = await db.select({ user: users }).from(authSessions).innerJoin(users, eq(authSessions.userId, users.id))
    .where(and(eq(authSessions.tokenHash, hashToken(token)), isNull(authSessions.revokedAt), gt(authSessions.expiresAt, new Date()), eq(users.isActive, true))).limit(1);
  if (row[0]) await db.update(authSessions).set({ lastUsedAt: new Date() }).where(eq(authSessions.tokenHash, hashToken(token)));
  return row[0]?.user;
}
export async function revokeSession(token: string) { await db.update(authSessions).set({ revokedAt: new Date() }).where(eq(authSessions.tokenHash, hashToken(token))); }
