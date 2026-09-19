import { Router } from "express";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  bookings,
  db,
  providerAvailability,
  providerDocuments,
  providerEarnings,
  providerLocations,
  providerPortfolio,
  providerProfiles,
  providerRequestInvites,
  providerServices,
  providerWorkingHours,
  providers,
  reviews,
  services,
  studentProfiles,
  studentProviders,
  users,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { ok, fail, handle } from "../lib/respond";
import { toNumber, validCoordinate } from "../lib/geo";
import { toPublicUser } from "../lib/auth";
import { trustScore } from "../lib/trust";
import { emitToUser } from "../lib/bus";
import { notify } from "../lib/notify";
import { logger } from "../lib/logger";

const router: Router = Router();
const PROVIDER_ROLES = ["provider", "student_provider"];
const requireProvider = [requireAuth, requireRole("provider", "student_provider")] as const;

/* --------------------------------- profile -------------------------------- */

router.get(
  "/provider/profile",
  requireAuth,
  handle(async (req, res) => {
    if (!PROVIDER_ROLES.includes(req.authUser!.role)) return fail(res, 403, "forbidden", "Providers only.");
    const profile = (await db.select().from(providerProfiles).where(eq(providerProfiles.userId, req.authUser!.id)).limit(1))[0] ?? null;
    const skills = await db.select({ id: services.id, name: services.name, slug: services.slug, icon: services.icon, skill: providerServices.skill }).from(providerServices).innerJoin(services, eq(providerServices.serviceId, services.id)).where(eq(providerServices.providerId, req.authUser!.id));
    const hours = await db.select().from(providerWorkingHours).where(eq(providerWorkingHours.providerId, req.authUser!.id)).orderBy(providerWorkingHours.day);
    const student = (await db.select().from(studentProfiles).where(eq(studentProfiles.userId, req.authUser!.id)).limit(1))[0] ?? null;
    ok(res, { user: await toPublicUser(req.authUser!), profile, skills, workingHours: hours, studentProfile: student });
  }),
);

router.put(
  "/provider/profile",
  requireAuth,
  handle(async (req, res) => {
    if (!PROVIDER_ROLES.includes(req.authUser!.role)) return fail(res, 403, "forbidden", "Providers only.");
    const body = req.body ?? {};
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : null);
    const radius = str(body.serviceRadiusKm);
    const validRadius = radius && Number(radius) > 0 && Number(radius) <= 100 ? radius : "10";
    const phone = str(body.phone);
    if (phone && !/^[+\d][\d\s-]{7,15}$/.test(phone)) return fail(res, 422, "validation", "Enter a valid phone number.");
    const values = {
      phone,
      bio: str(body.bio),
      experienceYears: str(body.experienceYears),
      serviceArea: str(body.serviceArea),
      serviceRadiusKm: validRadius,
      city: str(body.city),
      pincode: str(body.pincode),
      startingPrice: str(body.startingPrice),
      timezone: str(body.timezone) ?? undefined,
      emergencyAvailable: body.emergencyAvailable === true,
      profileImageUrl: str(body.profileImageUrl),
      updatedAt: new Date(),
    };
    const [row] = await db
      .insert(providerProfiles)
      .values({ userId: req.authUser!.id, ...values })
      .onConflictDoUpdate({ target: providerProfiles.userId, set: { ...values } })
      .returning();
    const userPatch: Record<string, unknown> = { updatedAt: new Date() };
    if (phone !== null) userPatch.phone = phone;
    if (str(body.avatarUrl)) userPatch.avatarUrl = str(body.avatarUrl);
    await db.update(users).set(userPatch).where(eq(users.id, req.authUser!.id));
    // display name lives on the role-specific profile tables
    const displayName = str(body.displayName);
    if (displayName && displayName.length >= 2 && displayName.length <= 120) {
      const table = req.authUser!.role === "student_provider" ? studentProviders : providers;
      const [existing] = await db.select({ userId: table.userId }).from(table).where(eq(table.userId, req.authUser!.id)).limit(1);
      if (existing) {
        await db.update(table).set({ displayName }).where(eq(table.userId, existing.userId));
      } else {
        await db.insert(table).values({ userId: req.authUser!.id, displayName }).onConflictDoNothing();
      }
    }
    res.json({ profile: row });
  }),
);

/** Student-mode profile fields. */
router.put(
  "/provider/student-profile",
  requireAuth,
  handle(async (req, res) => {
    if (req.authUser!.role !== "student_provider") return fail(res, 403, "forbidden", "Student mode only.");
    const b = req.body ?? {};
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : null);
    const [row] = await db
      .insert(studentProfiles)
      .values({
        userId: req.authUser!.id,
        college: str(b.college),
        degree: str(b.degree),
        semester: toNumber(b.semester) ?? null,
        partTimeHours: str(b.partTimeHours),
        bio: str(b.bio),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({ target: studentProfiles.userId, set: { college: str(b.college), degree: str(b.degree), semester: toNumber(b.semester) ?? null, partTimeHours: str(b.partTimeHours), bio: str(b.bio), updatedAt: new Date() } })
      .returning();
    ok(res, { studentProfile: row });
  }),
);

router.put(
  "/provider/services",
  requireAuth,
  handle(async (req, res) => {
    if (!PROVIDER_ROLES.includes(req.authUser!.role)) return fail(res, 403, "forbidden", "Providers only.");
    const items = Array.isArray(req.body?.services) ? req.body.services : [];
    if (!items.length || items.some((item: unknown) => typeof (item as Record<string, unknown>)?.serviceId !== "string")) {
      return fail(res, 422, "validation", "At least one serviceId is required.");
    }
    await db.delete(providerServices).where(eq(providerServices.providerId, req.authUser!.id));
    const rows = await db
      .insert(providerServices)
      .values(items.map((item: Record<string, unknown>) => ({ providerId: req.authUser!.id, serviceId: item.serviceId as string, skill: typeof item.skill === "string" ? item.skill.trim().slice(0, 120) : null })))
      .returning();
    res.json({ services: rows });
  }),
);

router.put(
  "/provider/working-hours",
  requireAuth,
  handle(async (req, res) => {
    if (!PROVIDER_ROLES.includes(req.authUser!.role)) return fail(res, 403, "forbidden", "Providers only.");
    const items = Array.isArray(req.body?.hours) ? req.body.hours : [];
    await db.delete(providerWorkingHours).where(eq(providerWorkingHours.providerId, req.authUser!.id));
    for (const h of items) {
      const day = toNumber(h?.day);
      const s = toNumber(h?.startHour);
      const e = toNumber(h?.endHour);
      if (typeof day !== "number" || typeof s !== "number" || typeof e !== "number" || !Number.isInteger(day) || day < 0 || day > 6 || !Number.isInteger(s) || s < 0 || s > 23 || !Number.isInteger(e) || e < 1 || e > 24) continue;
      await db.insert(providerWorkingHours).values({ providerId: req.authUser!.id, day, startHour: s, endHour: e }).onConflictDoNothing();
    }
    ok(res, { saved: true });
  }),
);

/* ------------------------------- availability ------------------------------ */

router.put(
  "/provider/availability",
  requireAuth,
  handle(async (req, res) => {
    if (!PROVIDER_ROLES.includes(req.authUser!.role)) return fail(res, 403, "forbidden", "Providers only.");
    if (typeof req.body?.available !== "boolean") return fail(res, 422, "validation", "available must be a boolean.");
    const [row] = await db
      .insert(providerAvailability)
      .values({ providerId: req.authUser!.id, available: req.body.available })
      .onConflictDoUpdate({ target: providerAvailability.providerId, set: { available: req.body.available, updatedAt: new Date() } })
      .returning();
    emitToUser(req.authUser!.id, "provider:online", { available: row?.available });
    res.json({ available: row?.available ?? req.body.available });
  }),
);

router.get(
  "/provider/location",
  requireAuth,
  handle(async (req, res) => {
    if (!PROVIDER_ROLES.includes(req.authUser!.role)) return fail(res, 403, "forbidden", "Providers only.");
    const [location] = await db.select().from(providerLocations).where(eq(providerLocations.providerId, req.authUser!.id)).limit(1);
    res.json({ location: location ?? null });
  }),
);

router.put(
  "/provider/location",
  requireAuth,
  handle(async (req, res) => {
    if (!PROVIDER_ROLES.includes(req.authUser!.role)) return fail(res, 403, "forbidden", "Providers only.");
    const b = req.body ?? {};
    if (!validCoordinate(b.latitude, -90, 90) || !validCoordinate(b.longitude, -180, 180)) return fail(res, 422, "validation", "Valid latitude and longitude are required.");
    const radius = Number(b.serviceRadiusKm ?? 10);
    if (!Number.isFinite(radius) || radius <= 0 || radius > 100) return fail(res, 422, "validation", "serviceRadiusKm must be between 1 and 100.");
    const [location] = await db
      .insert(providerLocations)
      .values({ providerId: req.authUser!.id, latitude: String(b.latitude), longitude: String(b.longitude), serviceRadiusKm: String(radius) })
      .onConflictDoUpdate({ target: providerLocations.providerId, set: { latitude: String(b.latitude), longitude: String(b.longitude), serviceRadiusKm: String(radius), updatedAt: new Date() } })
      .returning();
    res.json({ location });
  }),
);

/* ------------------------------ verification ------------------------------- */

router.post(
  "/provider/documents",
  requireAuth,
  handle(async (req, res) => {
    if (!PROVIDER_ROLES.includes(req.authUser!.role)) return fail(res, 403, "forbidden", "Providers only.");
    const docType = typeof req.body?.docType === "string" ? req.body.docType : "";
    if (!["id_proof", "business_proof", "certificate", "other"].includes(docType)) return fail(res, 422, "validation", "Invalid document type.");
    const imageUrl = typeof req.body?.imageUrl === "string" ? req.body.imageUrl : "";
    if (!imageUrl.startsWith("/uploads/")) return fail(res, 422, "validation", "Upload the document first via /api/uploads, then submit its URL.");
    const [doc] = await db
      .insert(providerDocuments)
      .values({ providerId: req.authUser!.id, docType, filename: imageUrl.split("/").pop() ?? "document", storedPath: imageUrl, mimeType: "image", sizeBytes: 0, verificationStatus: "pending" })
      .returning();
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
    for (const a of admins) emitToUser(a.id, "document:pending", { documentId: doc.id, providerId: req.authUser!.id });
    ok(res, { document: { id: doc.id, docType, verificationStatus: doc.verificationStatus } }, 201);
  }),
);

router.get(
  "/provider/documents",
  requireAuth,
  handle(async (req, res) => {
    if (!PROVIDER_ROLES.includes(req.authUser!.role)) return fail(res, 403, "forbidden", "Providers only.");
    const rows = await db.select().from(providerDocuments).where(eq(providerDocuments.providerId, req.authUser!.id)).orderBy(desc(providerDocuments.uploadedAt));
    ok(res, { documents: rows });
  }),
);

/* -------------------------------- portfolio -------------------------------- */

router.post(
  "/provider/portfolio",
  requireAuth,
  handle(async (req, res) => {
    if (!PROVIDER_ROLES.includes(req.authUser!.role)) return fail(res, 403, "forbidden", "Providers only.");
    const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 120) : "";
    const imageUrl = typeof req.body?.imageUrl === "string" ? req.body.imageUrl : "";
    const description = typeof req.body?.description === "string" ? req.body.description.trim().slice(0, 300) : null;
    if (!title || !imageUrl.startsWith("/uploads/")) return fail(res, 422, "validation", "title and an uploaded imageUrl are required.");
    const [item] = await db.insert(providerPortfolio).values({ providerId: req.authUser!.id, title, imageUrl, description }).returning();
    ok(res, { item }, 201);
  }),
);

router.delete(
  "/provider/portfolio/:id",
  requireAuth,
  handle(async (req, res) => {
    if (!PROVIDER_ROLES.includes(req.authUser!.role)) return fail(res, 403, "forbidden", "Providers only.");
    const [deleted] = await db.delete(providerPortfolio).where(and(eq(providerPortfolio.id, String(req.params.id)), eq(providerPortfolio.providerId, req.authUser!.id))).returning({ id: providerPortfolio.id });
    if (!deleted) return fail(res, 404, "not_found", "Portfolio item not found.");
    ok(res, { removed: true });
  }),
);

/* -------------------------------- dashboard -------------------------------- */

router.get(
  "/provider/dashboard",
  requireAuth,
  handle(async (req, res) => {
    if (!PROVIDER_ROLES.includes(req.authUser!.role)) return fail(res, 403, "forbidden", "Providers only.");
    const providerId = req.authUser!.id;
    const now = new Date();
    const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const [availability, profile, earningsMonth, earningsPrevMonth, trust, openRequests, ratingRow] = await Promise.all([
      db.select().from(providerAvailability).where(eq(providerAvailability.providerId, providerId)).limit(1),
      db.select().from(providerProfiles).where(eq(providerProfiles.userId, providerId)).limit(1),
      db.select({ amount: sql<number>`coalesce(sum(${providerEarnings.amountPaise}))::int` }).from(providerEarnings).where(and(eq(providerEarnings.providerId, providerId), gte(providerEarnings.createdAt, currentStart))),
      db.select({ amount: sql<number>`coalesce(sum(${providerEarnings.amountPaise}))::int` }).from(providerEarnings).where(and(eq(providerEarnings.providerId, providerId), gte(providerEarnings.createdAt, previousStart), sql`${providerEarnings.createdAt} < ${currentStart}`)),
      trustScore(providerId),
      db.select({ id: providerRequestInvites.id, bookingId: providerRequestInvites.bookingId, invitedAt: providerRequestInvites.invitedAt, status: providerRequestInvites.status, batch: providerRequestInvites.batch }).from(providerRequestInvites).innerJoin(bookings, eq(bookings.id, providerRequestInvites.bookingId)).where(and(eq(providerRequestInvites.providerId, providerId), eq(providerRequestInvites.status, "invited"), inArray(bookings.status, ["matching", "provider_invited"]))).orderBy(desc(providerRequestInvites.invitedAt)).limit(20),
      db.select({ rating: sql<number>`coalesce(round(avg(${reviews.rating})::numeric, 1), 0)`, count: sql<number>`count(*)::int` }).from(reviews).where(and(eq(reviews.providerId, providerId), eq(reviews.status, "visible"))),
    ]);
    const completedCount = await db.select({ n: sql<number>`count(*)::int` }).from(bookings).where(and(eq(bookings.providerId, providerId), inArray(bookings.status, ["completed", "payment_pending", "paid", "closed"])));
    const activeJobs = await db.select({ id: bookings.id, status: bookings.status, service: services.name, problemDescription: bookings.problemDescription, finalAmount: bookings.finalAmount, acceptedAt: bookings.acceptedAt }).from(bookings).innerJoin(services, eq(bookings.serviceId, services.id)).where(and(eq(bookings.providerId, providerId), inArray(bookings.status, ["accepted", "on_the_way", "arrived", "in_progress"]))).limit(5);
    const upcoming = await db.select({ id: bookings.id, status: bookings.status, service: services.name, scheduledAt: bookings.scheduledAt }).from(bookings).innerJoin(services, eq(bookings.serviceId, services.id)).where(and(eq(bookings.providerId, providerId), eq(bookings.status, "scheduled"))).orderBy(bookings.scheduledAt).limit(10);
    const recentReviews = await db.select({ id: reviews.id, rating: reviews.rating, comment: reviews.comment, createdAt: reviews.createdAt, customerName: sql<string>`split_part(${users.email}, '@', 1)` }).from(reviews).innerJoin(users, sql`${users.id} = ${reviews.customerId}`).where(and(eq(reviews.providerId, providerId), eq(reviews.status, "visible"))).orderBy(desc(reviews.createdAt)).limit(5);

    res.json({
      availability: availability[0]?.available ?? false,
      verificationStatus: profile[0]?.verificationStatus ?? "pending",
      earningsThisMonth: String(Math.round(Number(earningsMonth[0]?.amount ?? 0) / 100)),
      earningsPreviousMonth: String(Math.round(Number(earningsPrevMonth[0]?.amount ?? 0) / 100)),
      earningsThisMonthPaise: Number(earningsMonth[0]?.amount ?? 0),
      earningsPreviousMonthPaise: Number(earningsPrevMonth[0]?.amount ?? 0),
      completedJobs: Number(completedCount[0]?.n ?? 0),
      pendingAmount: "0",
      rating: Number(ratingRow[0]?.rating ?? 0) || null,
      reviewCount: Number(ratingRow[0]?.count ?? 0),
      onTimeRate: null,
      trustScore: trust.score,
      trust,
      openRequests,
      activeJobs,
      upcoming,
      recentReviews,
    });
  }),
);

/* --------------------------------- earnings -------------------------------- */

router.get(
  "/provider/earnings",
  requireAuth,
  handle(async (req, res) => {
    if (!PROVIDER_ROLES.includes(req.authUser!.role)) return fail(res, 403, "forbidden", "Providers only.");
    const days = Math.min(365, Math.max(1, toNumber(req.query.days) ?? 30));
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await db
      .select({
        id: providerEarnings.id,
        amountPaise: providerEarnings.amountPaise,
        feePaise: providerEarnings.feePaise,
        netPaise: providerEarnings.netPaise,
        createdAt: providerEarnings.createdAt,
        service: services.name,
      })
      .from(providerEarnings)
      .innerJoin(bookings, eq(bookings.id, providerEarnings.bookingId))
      .innerJoin(services, eq(services.id, bookings.serviceId))
      .where(and(eq(providerEarnings.providerId, req.authUser!.id), gte(providerEarnings.createdAt, since)))
      .orderBy(desc(providerEarnings.createdAt))
      .limit(200);
    const total = rows.reduce((s, r) => ({ gross: s.gross + r.amountPaise, fee: s.fee + r.feePaise, net: s.net + r.netPaise }), { gross: 0, fee: 0, net: 0 });
    ok(res, { earnings: rows, total: { gross: total.gross, fee: total.fee, net: total.net, days } });
  }),
);

router.get(
  "/provider/analytics",
  requireAuth,
  handle(async (req, res) => {
    if (!PROVIDER_ROLES.includes(req.authUser!.role)) return fail(res, 403, "forbidden", "Providers only.");
    const since = new Date(Date.now() - 30 * 86_400_000);
    const weekly = await db
      .select({
        week: sql<string>`to_char(date_trunc('week', ${bookings.createdAt}), 'YYYY-MM-DD')`,
        jobs: sql<number>`count(*)::int`,
      })
      .from(bookings)
      .where(and(eq(bookings.providerId, req.authUser!.id), gte(bookings.createdAt, since)))
      .groupBy(sql`date_trunc('week', ${bookings.createdAt})`)
      .orderBy(sql`date_trunc('week', ${bookings.createdAt})`);
    const cancelled = await db.select({ n: sql<number>`count(*)::int` }).from(bookings).where(and(eq(bookings.providerId, req.authUser!.id), eq(bookings.status, "cancelled")));
    const responded = await db.select({ n: sql<number>`count(*)::int` }).from(providerRequestInvites).where(and(eq(providerRequestInvites.providerId, req.authUser!.id), inArray(providerRequestInvites.status, ["accepted", "rejected"])));
    const invited = await db.select({ n: sql<number>`count(*)::int` }).from(providerRequestInvites).where(eq(providerRequestInvites.providerId, req.authUser!.id));
    const [ratingRow] = await db.select({ rating: sql<number>`coalesce(round(avg(${reviews.rating})::numeric, 2), 0)`, count: sql<number>`count(*)::int` }).from(reviews).where(and(eq(reviews.providerId, req.authUser!.id), eq(reviews.status, "visible")));
    ok(res, {
      jobsByWeek: weekly.map((w) => ({ week: w.week, jobs: w.jobs })),
      cancellationRate: Number(cancelled[0]?.n ?? 0),
      responseRate: Number(invited[0]?.n ?? 0) > 0 ? Number(responded[0]?.n ?? 0) / Number(invited[0].n) : null,
      rating: Number(ratingRow?.rating ?? 0) || null,
      reviewCount: Number(ratingRow?.count ?? 0),
    });
  }),
);

router.get(
  "/provider/reviews",
  requireAuth,
  handle(async (req, res) => {
    if (!PROVIDER_ROLES.includes(req.authUser!.role)) return fail(res, 403, "forbidden", "Providers only.");
    const rows = await db.select({ id: reviews.id, bookingId: reviews.bookingId, rating: reviews.rating, comment: reviews.comment, providerResponse: reviews.providerResponse, createdAt: reviews.createdAt }).from(reviews).where(and(eq(reviews.providerId, req.authUser!.id), eq(reviews.status, "visible"))).orderBy(desc(reviews.createdAt)).limit(100);
    ok(res, { reviews: rows });
  }),
);

/* --------------------------- protected (legacy) ---------------------------- */

router.get("/protected/provider", requireAuth, requireRole("provider"), (_req, res) => res.json({ ok: true }));

export default router;
