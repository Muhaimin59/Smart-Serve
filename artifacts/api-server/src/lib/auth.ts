import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, isNull } from "drizzle-orm";
import { authSessions, customers, db, emailVerifications, passwordResets, providers, studentProviders, type User, type UserRole, users } from "@workspace/db";

const scrypt = promisify(scryptCallback);
const SESSION_DAYS = 30;
const KEY_LENGTH = 64;

export type PublicUser = {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  language?: string;
  emailVerifiedAt?: Date | null;
  createdAt: Date;
  isDemo?: boolean;
};
export type AuthSession = { token: string; expiresAt: Date; user: PublicUser };

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateSignup(input: unknown): {
  email: string;
  password: string;
  displayName: string;
  role: "customer" | "provider" | "student_provider";
  phone?: string;
} {
  if (!input || typeof input !== "object") throw new ApiError400("Request body must be an object.");
  const body = input as Record<string, unknown>;
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";
  // Accept either "displayName" (API convention) or "name" (what the web form sends).
  const displayName =
    typeof body.displayName === "string" ? body.displayName.trim()
    : typeof body.name === "string" ? body.name.trim()
    : "";
  const role = body.role;
  const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new ApiError400("Enter a valid email address.");
  if (password.length < 8 || password.length > 128) throw new ApiError400("Password must be 8-128 characters.");
  if (displayName.length < 2 || displayName.length > 100) throw new ApiError400("Display name must be 2-100 characters.");
  if (role !== "customer" && role !== "provider" && role !== "student_provider")
    throw new ApiError400("Choose customer, provider or student provider.");
  if (phone && !/^[+\d][\d\s-]{7,15}$/.test(phone)) throw new ApiError400("Enter a valid phone number.");
  return { email, password, displayName, role, phone };
}

class ApiError400 extends Error {
  constructor(msg: string) {
    super(msg);
  }
}

export function validateLogin(input: unknown): { email: string; password: string } {
  if (!input || typeof input !== "object") throw new ApiError400("Request body must be an object.");
  const body = input as Record<string, unknown>;
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) throw new ApiError400("Email and password are required.");
  return { email, password };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  try {
    const [algorithm, salt, expected] = encoded.split("$");
    if (algorithm !== "scrypt" || !salt || !expected) return false;
    const actual = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
    const expectedBuffer = Buffer.from(expected, "base64url");
    return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
  } catch {
    return false;
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

async function displayNameFor(user: User): Promise<string | undefined> {
  if (user.role === "customer")
    return (await db.select({ displayName: customers.displayName }).from(customers).where(eq(customers.userId, user.id)).limit(1))[0]?.displayName;
  if (user.role === "provider")
    return (await db.select({ displayName: providers.displayName }).from(providers).where(eq(providers.userId, user.id)).limit(1))[0]?.displayName;
  if (user.role === "student_provider")
    return (await db.select({ displayName: studentProviders.displayName }).from(studentProviders).where(eq(studentProviders.userId, user.id)).limit(1))[0]
      ?.displayName;
  return undefined;
}

export async function toPublicUser(user: User): Promise<PublicUser> {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: (await displayNameFor(user)) ?? user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    language: user.language,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
    isDemo: user.email.endsWith("@demo.in"),
  };
}

export async function createSession(user: User): Promise<AuthSession> {
  const token = randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(authSessions).values({ userId: user.id, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt, user: await toPublicUser(user) };
}

export async function findUserForToken(token: string): Promise<User | undefined> {
  const row = await db
    .select({ user: users })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(and(eq(authSessions.tokenHash, hashToken(token)), isNull(authSessions.revokedAt), gt(authSessions.expiresAt, new Date()), eq(users.isActive, true)))
    .limit(1);
  if (row[0]) await db.update(authSessions).set({ lastUsedAt: new Date() }).where(eq(authSessions.tokenHash, hashToken(token)));
  return row[0]?.user;
}

export async function revokeSession(token: string): Promise<void> {
  await db.update(authSessions).set({ revokedAt: new Date() }).where(eq(authSessions.tokenHash, hashToken(token)));
}

/* ------------------------- password reset & email verification ------------- */

export async function createPasswordReset(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await db.insert(passwordResets).values({ userId, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt };
}

export async function consumePasswordReset(token: string): Promise<User | undefined> {
  const hash = hashToken(token);
  const rows = await db.select({ row: passwordResets, user: users }).from(passwordResets).innerJoin(users, eq(passwordResets.userId, users.id))
    .where(and(eq(passwordResets.tokenHash, hash), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date()))).limit(1);
  if (!rows[0]) return undefined;
  await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, rows[0].row.id));
  return rows[0].user;
}

export async function createEmailVerification(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(emailVerifications).values({ userId, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt };
}

export async function consumeEmailVerification(token: string): Promise<User | undefined> {
  const hash = hashToken(token);
  const rows = await db.select({ row: emailVerifications, user: users }).from(emailVerifications).innerJoin(users, eq(emailVerifications.userId, users.id))
    .where(and(eq(emailVerifications.tokenHash, hash), isNull(emailVerifications.verifiedAt), gt(emailVerifications.expiresAt, new Date()))).limit(1);
  if (!rows[0]) return undefined;
  await db.update(emailVerifications).set({ verifiedAt: new Date() }).where(eq(emailVerifications.id, rows[0].row.id));
  await db.update(users).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, rows[0].user.id));
  return rows[0].user;
}
