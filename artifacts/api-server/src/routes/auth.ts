import { Router } from "express";
import { eq } from "drizzle-orm";
import { customers, db, providerAvailability, providerProfiles, providers, studentProfiles, studentProviders, users } from "@workspace/db";
import {
  consumeEmailVerification,
  consumePasswordReset,
  createEmailVerification,
  createPasswordReset,
  createSession,
  hashPassword,
  normalizeEmail,
  revokeSession,
  toPublicUser,
  validateLogin,
  validateSignup,
  verifyPassword,
} from "../lib/auth";
import { requireAuth, requireRole } from "../middlewares/auth";
import { ok, fail, handle } from "../lib/respond";
import { sendMail, templates } from "../lib/email";
import { smtpConfigured, googleOAuthConfigured, config } from "../config";
import { ApiError } from "../lib/respond";
import { logger } from "../lib/logger";

const router: Router = Router();

/* ------------------------------ signup ------------------------------------ */
router.post(
  "/auth/signup",
  handle(async (req, res) => {
    const input = validateSignup(req.body);
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
    if (existing[0]) {
      res.status(409).json({ message: "An account with this email already exists." });
      return;
    }
    const passwordHash = await hashPassword(input.password);
    const user = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(users)
        .values({ email: input.email, passwordHash, role: input.role, phone: input.phone ?? null })
        .returning();
      const created = inserted[0];
      if (!created) throw new Error("Could not create account.");
      if (input.role === "customer") {
        await tx.insert(customers).values({ userId: created.id, displayName: input.displayName });
      } else if (input.role === "provider") {
        await tx.insert(providers).values({ userId: created.id, displayName: input.displayName });
        await tx.insert(providerProfiles).values({ userId: created.id });
        await tx.insert(providerAvailability).values({ providerId: created.id, available: false });
      } else {
        await tx.insert(studentProviders).values({ userId: created.id, displayName: input.displayName });
        await tx.insert(studentProfiles).values({ userId: created.id });
        await tx.insert(providerProfiles).values({ userId: created.id });
        await tx.insert(providerAvailability).values({ providerId: created.id, available: false });
      }
      return created;
    });
    const session = await createSession(user);
    let devVerificationToken: string | undefined;
    const verification = await createEmailVerification(user.id);
    if (!smtpConfigured()) devVerificationToken = verification.token;
    else void sendMail(templates.verifyEmail(user.email, verification.token)).catch(() => {});
    void sendMail(templates.welcome(user.email, input.displayName)).catch(() => {});
    res.status(201).json({ ...session, ...(devVerificationToken ? { devVerification: { token: devVerificationToken, hint: "SMTP not configured - use /api/auth/verify-email with this token (dev only)" } } : {}) });
  }),
);

/* ------------------------------ login ------------------------------------- */
router.post(
  "/auth/login",
  handle(async (req, res) => {
    const input = validateLogin(req.body);
    const user = (await db.select().from(users).where(eq(users.email, normalizeEmail(input.email))).limit(1))[0];
    if (!user || !user.isActive || !(await verifyPassword(input.password, user.passwordHash))) {
      res.status(401).json({ message: "Invalid email or password." });
      return;
    }
    res.json(await createSession(user));
  }),
);

router.post(
  "/auth/logout",
  requireAuth,
  handle(async (req, res) => {
    await revokeSession(req.authToken!);
    res.status(204).end();
  }),
);

router.get(
  "/auth/me",
  requireAuth,
  handle(async (req, res) => {
    res.json({ user: await toPublicUser(req.authUser!) });
  }),
);

router.get(
  "/users/me",
  requireAuth,
  handle(async (req, res) => {
    res.json({ user: await toPublicUser(req.authUser!) });
  }),
);

/* ------------------------- forgot / reset password ------------------------- */
router.post(
  "/auth/forgot-password",
  handle(async (req, res) => {
    const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
    if (!email) return fail(res, 422, "validation", "Email is required.");
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    // Always report success to avoid account enumeration.
    if (user) {
      const { token } = await createPasswordReset(user.id);
      if (smtpConfigured()) {
        await sendMail(templates.passwordReset(user.email, token));
      } else {
        ok(res, { resetSent: true, devReset: { token, link: `/reset-password?token=${token}`, hint: "SMTP not configured - open the link above (dev only)" } });
        return;
      }
    }
    ok(res, { resetSent: true });
  }),
);

router.post(
  "/auth/reset-password",
  handle(async (req, res) => {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!token || password.length < 8 || password.length > 128) return fail(res, 422, "validation", "Token and a password of 8-128 characters are required.");
    const user = await consumePasswordReset(token);
    if (!user) return fail(res, 400, "token_invalid", "This reset link is invalid or has expired. Request a new one.");
    await db.update(users).set({ passwordHash: await hashPassword(password), updatedAt: new Date() }).where(eq(users.id, user.id));
    ok(res, { reset: true });
  }),
);

/* ---------------------------- email verification --------------------------- */
router.post(
  "/auth/verify-email",
  handle(async (req, res) => {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    if (!token) return fail(res, 422, "validation", "Token is required.");
    const user = await consumeEmailVerification(token);
    if (!user) return fail(res, 400, "token_invalid", "Verification link is invalid or has expired.");
    ok(res, { verified: true });
  }),
);

/* ------------------------------ google oauth ------------------------------- */
router.get(
  "/auth/google/status",
  handle(async (_req, res) => {
    return ok(res, { configured: googleOAuthConfigured() });
  }),
);

router.get(
  "/auth/google",
  handle(async (_req, res) => {
    if (!googleOAuthConfigured()) return fail(res, 503, "oauth_not_configured", "Google Sign-In is not configured on this server.");
    const state = Math.random().toString(36).slice(2);
    const params = new URLSearchParams({
      client_id: config.googleClientId,
      redirect_uri: `${config.publicOrigin}/api/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "online",
      prompt: "select_account",
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  }),
);

router.get(
  "/auth/google/callback",
  handle(async (req, res) => {
    if (!googleOAuthConfigured()) return fail(res, 503, "oauth_not_configured", "Google Sign-In is not configured on this server.");
    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!code) return fail(res, 400, "missing_code", "Missing OAuth code.");
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        redirect_uri: `${config.publicOrigin}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }).toString(),
    });
    if (!tokenRes.ok) throw new ApiError(502, "oauth_error", "Google token exchange failed.");
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${tokenJson.access_token}` } });
    if (!userRes.ok) throw new ApiError(502, "oauth_error", "Could not fetch Google profile.");
    const profile = (await userRes.json()) as { email?: string; name?: string; picture?: string };
    const email = profile.email ? normalizeEmail(profile.email) : "";
    if (!email) throw new ApiError(502, "oauth_error", "Google account has no email.");
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      // Google login only for existing accounts; registration is via /auth/signup
      return fail(res, 404, "no_account", "No SmartServe account exists for this Google email. Please register first.");
    }
    const session = await createSession(user);
    logger.info({ email }, "google oauth login");
    res.redirect(`${config.publicOrigin}/google-login?ok=1&token=${encodeURIComponent(session.token)}`);
  }),
);

export default router;
