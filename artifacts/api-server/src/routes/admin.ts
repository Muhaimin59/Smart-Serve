import { Router } from "express";
import { and, asc, count, desc, eq, gte, inArray, ilike, isNotNull, or, sql } from "drizzle-orm";
import {
  auditLogs,
  bookings,
  customers,
  db,
  disputeEvents,
  disputes,
  disputeStatusEnum,
  emailOutbox,
  payments,
  platformSettings,
  providerAvailability,
  providerDocuments,
  providerEarnings,
  providerProfiles,
  providerRequestInvites,
  providerServices,
  providers,
  reports,
  reviews,
  services,
  sosEvents,
  userRoleEnum,
  users,
  warrantyClaims,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { ok, fail, handle, ApiError } from "../lib/respond";
import { toNumber } from "../lib/geo";
import { refundPayment, formatInr } from "../lib/payments";
import { notify } from "../lib/notify";
import { emitToUser } from "../lib/bus";
import { logger } from "../lib/logger";

const router: Router = Router();
const adminOnly = [requireAuth, requireRole("admin")] as const;

async function audit(adminId: string, action: string, targetType?: string, targetId?: string, detail?: Record<string, unknown>) {
  await db.insert(auditLogs).values({ adminId, action, targetType: targetType ?? null, targetId: targetId ?? null, detail: detail ?? null });
}

/* --------------------------------- stats ----------------------------------- */

router.get(
  "/admin/stats",
  ...adminOnly,
  handle(async (_req, res) => {
    const since7 = new Date(Date.now() - 7 * 86_400_000);
    const [usersAgg, providersAgg, online, bookingsAgg, revenue, pendingDocs, openDisputes, emergency7, completed7, cancelled7, openReports, sos7, avgResponse, activeBookings] = await Promise.all([
      db.select({ total: sql<number>`count(*)::int`, customers: sql<number>`count(*) filter (where ${users.role} = 'customer')::int`, students: sql<number>`count(*) filter (where ${users.role} = 'student_provider')::int` }).from(users),
      db.select({ total: sql<number>`count(*)::int`, verified: sql<number>`count(*) filter (where ${providerProfiles.verificationStatus} = 'verified')::int` }).from(users).leftJoin(providerProfiles, eq(providerProfiles.userId, users.id)).where(or(eq(users.role, "provider"), eq(users.role, "student_provider"))),
      db.select({ n: sql<number>`count(*)::int` }).from(providerAvailability).where(eq(providerAvailability.available, true)),
      db.select({
        total: sql<number>`count(*)::int`,
        byStatus: sql<string>`(select json_object_agg(t.s, t.n)::text from (select status::text as s, count(*)::int as n from bookings group by status) t)`,
      }).from(bookings),
      db.select({ revenue: sql<number>`coalesce(sum(${payments.amountPaise}), 0)::int` }).from(payments).where(eq(payments.status, "paid")),
      db.select({ n: sql<number>`count(*)::int` }).from(providerDocuments).where(eq(providerDocuments.verificationStatus, "pending")),
      db.select({ n: sql<number>`count(*)::int` }).from(disputes).where(inArray(disputes.status, ["open", "under_review", "provider_response", "escalated"])),
      db.select({ n: sql<number>`count(*)::int` }).from(bookings).where(and(eq(bookings.isEmergency, true), gte(bookings.createdAt, since7))),
      db.select({ n: sql<number>`count(*)::int` }).from(bookings).where(and(inArray(bookings.status, ["completed", "payment_pending", "paid", "closed"]), gte(bookings.createdAt, since7))),
      db.select({ n: sql<number>`count(*)::int` }).from(bookings).where(and(eq(bookings.status, "cancelled"), gte(bookings.createdAt, since7))),
      db.select({ n: sql<number>`count(*)::int` }).from(reports).where(eq(reports.status, "open")),
      db.select({ n: sql<number>`count(*)::int` }).from(sosEvents).where(gte(sosEvents.createdAt, since7)),
      db.select({ avgSec: sql<number>`coalesce(avg(extract(epoch from (${bookings.acceptedAt} - ${bookings.createdAt})))::int, 0)` }).from(bookings).where(and(isNotNull(bookings.acceptedAt), gte(bookings.createdAt, since7))).catch(() => []),
      db.select({ n: sql<number>`count(*)::int` }).from(bookings).where(inArray(bookings.status, ["matching", "provider_invited", "accepted", "on_the_way", "arrived", "in_progress"])),
    ]);
    const byStatus: Record<string, number> = {};
    try {
      const parsed = typeof bookingsAgg[0]?.byStatus === "string" ? JSON.parse(bookingsAgg[0].byStatus) : bookingsAgg[0]?.byStatus;
      if (parsed) for (const [k, v] of Object.entries(parsed as Record<string, number>)) byStatus[k] = Number(v);
    } catch {
      /* ignore */
    }
    ok(res, {
      users: { total: Number(usersAgg[0]?.total ?? 0), customers: Number(usersAgg[0]?.customers ?? 0), students: Number(usersAgg[0]?.students ?? 0) },
      providers: { total: Number(providersAgg[0]?.total ?? 0), verified: Number(providersAgg[0]?.verified ?? 0), online: Number(online[0]?.n ?? 0) },
      bookings: { total: Number(bookingsAgg[0]?.total ?? 0), byStatus, active: Number(activeBookings[0]?.n ?? 0) },
      revenuePaise: Number(revenue[0]?.revenue ?? 0),
      revenueDisplay: formatInr(Number(revenue[0]?.revenue ?? 0)),
      pendingVerification: Number(pendingDocs[0]?.n ?? 0),
      openDisputes: Number(openDisputes[0]?.n ?? 0),
      emergencyLast7d: Number(emergency7[0]?.n ?? 0),
      completedLast7d: Number(completed7[0]?.n ?? 0),
      cancelledLast7d: Number(cancelled7[0]?.n ?? 0),
      openReports: Number(openReports[0]?.n ?? 0),
      sosLast7d: Number(sos7[0]?.n ?? 0),
      avgResponseSec: Number(avgResponse[0]?.avgSec ?? 0),
    });
  }),
);

router.get(
  "/admin/analytics",
  ...adminOnly,
  handle(async (req, res) => {
    const days = Math.min(90, Math.max(7, toNumber(req.query.days) ?? 30));
    const since = new Date(Date.now() - days * 86_400_000);
    const [bookingsByDay, revenueByDay, byCategory] = await Promise.all([
      db
        .select({ day: sql<string>`to_char(${bookings.createdAt}::date, 'MM-DD')`, total: sql<number>`count(*)::int` })
        .from(bookings)
        .where(gte(bookings.createdAt, since))
        .groupBy(sql`to_char(${bookings.createdAt}::date, 'MM-DD')`)
        .orderBy(sql`to_char(${bookings.createdAt}::date, 'MM-DD')`),
      db
        .select({ day: sql<string>`to_char(${payments.paidAt}::date, 'MM-DD')`, paise: sql<number>`coalesce(sum(${payments.amountPaise}), 0)::int` })
        .from(payments)
        .where(and(eq(payments.status, "paid"), gte(payments.paidAt, since)))
        .groupBy(sql`to_char(${payments.paidAt}::date, 'MM-DD')`)
        .orderBy(sql`to_char(${payments.paidAt}::date, 'MM-DD')`),
      db
        .select({ name: services.name, total: sql<number>`count(*)::int` })
        .from(bookings)
        .innerJoin(services, eq(services.id, bookings.serviceId))
        .where(gte(bookings.createdAt, since))
        .groupBy(services.name)
        .orderBy(desc(sql`count(*)`))
        .limit(12),
    ]);
    ok(res, {
      days,
      bookingsByDay: bookingsByDay.map((r) => ({ day: r.day, total: r.total })),
      revenueByDay: revenueByDay.map((r) => ({ day: r.day, paise: r.paise })),
      byCategory,
    });
  }),
);

/* ---------------------------------- users ---------------------------------- */

router.get(
  "/admin/users",
  ...adminOnly,
  handle(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const role = typeof req.query.role === "string" ? req.query.role : "";
    const page = Math.max(1, toNumber(req.query.page) ?? 1);
    const pageSize = Math.min(100, toNumber(req.query.limit) ?? 25);
    const filter = and(q ? or(ilike(users.email, `%${q}%`)) : undefined, role ? eq(users.role, role as never) : undefined);
    const [rows, totalRow] = await Promise.all([
      db.select().from(users).where(filter).orderBy(desc(users.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ n: count(users.id) }).from(users).where(filter),
    ]);
    const names: Record<string, string> = {};
    if (rows.length) {
      const custs = await db.select().from(customers).where(inArray(customers.userId, rows.map((r) => r.id)));
      const provs = await db.select().from(providers).where(inArray(providers.userId, rows.map((r) => r.id)));
      for (const c of custs) names[c.userId] = c.displayName;
      for (const p of provs) names[p.userId] = p.displayName;
    }
    ok(res, { users: rows.map((u) => ({ id: u.id, email: u.email, role: u.role, isActive: u.isActive, displayName: names[u.id] ?? null, createdAt: u.createdAt })), total: Number(totalRow[0]?.n ?? 0), page, limit: pageSize });
  }),
);

router.patch(
  "/admin/users/:id",
  ...adminOnly,
  handle(async (req, res) => {
    const target = String(req.params.id);
    const [user] = await db.select().from(users).where(eq(users.id, target)).limit(1);
    if (!user) return fail(res, 404, "not_found", "User not found.");
    if (user.role === "admin" && target === req.authUser!.id) return fail(res, 400, "self_suspend", "You cannot suspend your own admin account.");
    const isActive = typeof req.body?.isActive === "boolean" ? req.body.isActive : undefined;
    const newRole = typeof req.body?.role === "string" && ["customer", "provider", "student_provider", "admin"].includes(req.body.role) ? (req.body.role as never) : undefined;
    if (isActive === undefined && !newRole) return fail(res, 422, "validation", "Provide isActive and/or role.");
    await db.update(users).set({ ...(isActive !== undefined ? { isActive } : {}), ...(newRole ? { role: newRole } : {}), updatedAt: new Date() }).where(eq(users.id, target));
    await audit(req.authUser!.id, isActive === false ? "user_suspended" : isActive === true ? "user_activated" : "role_changed", "user", target, { isActive, role: newRole ?? null });
    await notify({ userId: target, type: "account_update", title: isActive === false ? "Your account was suspended" : "Your account was updated", body: "Contact support if you believe this is a mistake." });
    ok(res, { updated: true });
  }),
);

/* -------------------------------- providers -------------------------------- */

router.get(
  "/admin/providers",
  ...adminOnly,
  handle(async (req, res) => {
    const status = typeof req.query.verificationStatus === "string" ? req.query.verificationStatus : "";
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        isActive: users.isActive,
        role: users.role,
        name: sql<string>`coalesce(${providers.displayName}, split_part(${users.email}, '@', 1))`,
        verificationStatus: providerProfiles.verificationStatus,
        city: providerProfiles.city,
        emergencyAvailable: providerProfiles.emergencyAvailable,
        rating: sql<number>`coalesce(round(avg(${reviews.rating})::numeric, 1), 0)`,
      })
      .from(users)
      .leftJoin(providers, eq(providers.userId, users.id))
      .leftJoin(providerProfiles, eq(providerProfiles.userId, users.id))
      .leftJoin(reviews, and(eq(reviews.providerId, users.id), eq(reviews.status, "visible")))
      .where(and(or(eq(users.role, "provider"), eq(users.role, "student_provider")), status ? eq(providerProfiles.verificationStatus, status as never) : undefined, q ? ilike(users.email, `%${q}%`) : undefined))
      .groupBy(users.id, users.email, users.isActive, users.role, providers.displayName, providerProfiles.verificationStatus, providerProfiles.city, providerProfiles.emergencyAvailable, providerProfiles.userId)
      .orderBy(desc(users.createdAt))
      .limit(200);
    ok(res, { providers: rows.map((r) => ({ id: r.id, email: r.email, name: (r.name as string) ?? r.email.split("@")[0], role: r.role, isActive: r.isActive, verificationStatus: r.verificationStatus ?? "pending", city: r.city, emergencyAvailable: r.emergencyAvailable, rating: Number(r.rating ?? 0) })) });
  }),
);

router.patch(
  "/admin/providers/:id/verification",
  ...adminOnly,
  handle(async (req, res) => {
    const target = String(req.params.id);
    const status = req.body?.status === "verified" || req.body?.status === "rejected" ? req.body.status : req.body?.status === "pending" ? "pending" : null;
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 300) : undefined;
    if (!status) return fail(res, 422, "validation", "status must be verified | rejected | pending.");
    const [profile] = await db
      .update(providerProfiles)
      .set({ verificationStatus: status, updatedAt: new Date() })
      .where(eq(providerProfiles.userId, target))
      .returning({ userId: providerProfiles.userId });
    if (!profile) return fail(res, 404, "not_found", "Provider not found.");
    await audit(req.authUser!.id, `provider_${status}`, "provider", target, { note: note ?? null });
    await notify({
      userId: target,
      type: "verification_update",
      title: status === "verified" ? "You are now a verified provider" : status === "rejected" ? "Verification rejected" : "Verification status updated",
      body: status === "rejected" ? (note ?? "Please review your documents and re-upload.") : status === "verified" ? "Your profile now shows the verified badge." : undefined,
    });
    ok(res, { verificationStatus: status });
  }),
);

router.get(
  "/admin/documents",
  ...adminOnly,
  handle(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "pending";
    const rows = await db
      .select({
        doc: providerDocuments,
        email: users.email,
        name: providers.displayName,
      })
      .from(providerDocuments)
      .innerJoin(users, eq(users.id, providerDocuments.providerId))
      .leftJoin(providers, eq(providers.userId, providerDocuments.providerId))
      .where(status === "all" ? undefined : eq(providerDocuments.verificationStatus, status))
      .orderBy(desc(providerDocuments.uploadedAt))
      .limit(100);
    ok(res, { documents: rows.map((r) => ({ ...r.doc, email: r.email, name: (r.name as string) ?? r.email.split("@")[0] })) });
  }),
);

router.patch(
  "/admin/documents/:id",
  ...adminOnly,
  handle(async (req, res) => {
    const id = String(req.params.id);
    const approve = req.body?.approve === true;
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 300) : undefined;
    const [doc] = await db
      .update(providerDocuments)
      .set({ verificationStatus: approve ? "approved" : "rejected", reviewedAt: new Date(), reviewedBy: req.authUser!.id, note: note ?? null })
      .where(eq(providerDocuments.id, id))
      .returning({ providerId: providerDocuments.providerId, docType: providerDocuments.docType });
    if (!doc) return fail(res, 404, "not_found", "Document not found.");
    await audit(req.authUser!.id, `document_${approve ? "approved" : "rejected"}`, "document", id, { providerId: doc.providerId });
    await notify({ userId: doc.providerId, type: "document_review", title: approve ? "Document approved" : "Document rejected", body: note ?? undefined });
    // auto-verify provider when an ID proof is approved
    if (approve && doc.docType === "id_proof") {
      await db.update(providerProfiles).set({ verificationStatus: "verified", updatedAt: new Date() }).where(eq(providerProfiles.userId, doc.providerId));
      await notify({ userId: doc.providerId, type: "verification_update", title: "You are now a verified provider", body: "Your ID proof was approved and the verified badge is active." });
    }
    ok(res, { reviewed: true });
  }),
);

/* -------------------------------- bookings --------------------------------- */

router.get(
  "/admin/bookings",
  ...adminOnly,
  handle(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const page = Math.max(1, toNumber(req.query.page) ?? 1);
    const pageSize = Math.min(100, toNumber(req.query.limit) ?? 25);
    const rows = await db
      .select({
        id: bookings.id,
        status: bookings.status,
        isEmergency: bookings.isEmergency,
        createdAt: bookings.createdAt,
        customer: users.email,
        provider: sql<string>`null`,
        service: services.name,
        finalAmount: bookings.finalAmount,
        problemDescription: bookings.problemDescription,
      })
      .from(bookings)
      .innerJoin(users, eq(users.id, bookings.customerId))
      .innerJoin(services, eq(services.id, bookings.serviceId))
      .where(and(status ? eq(bookings.status, status as never) : undefined))
      .orderBy(desc(bookings.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const [totalRow] = await db.select({ n: count(bookings.id) }).from(bookings).where(and(status ? eq(bookings.status, status as never) : undefined));
    ok(res, { bookings: rows, total: Number(totalRow?.n ?? 0), page, limit: pageSize });
  }),
);

router.post(
  "/admin/bookings/:id/cancel",
  ...adminOnly,
  handle(async (req, res) => {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, String(req.params.id))).limit(1);
    if (!booking) return fail(res, 404, "not_found", "Booking not found.");
    const { cancelBooking } = await import("../lib/bookings");
    const updated = await cancelBooking(booking, req.authUser!.id, "admin", typeof req.body?.reason === "string" ? req.body.reason : "admin cancellation");
    await audit(req.authUser!.id, "booking_cancelled", "booking", booking.id, { status: updated.status });
    ok(res, { bookingId: updated.id, status: updated.status });
  }),
);

/* --------------------------------- disputes -------------------------------- */

router.get(
  "/admin/disputes",
  ...adminOnly,
  handle(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const rows = await db
      .select({
        d: disputes,
        service: services.name,
        customer: sql<string>`(select email from users where id = ${bookings.customerId})`,
        provider: sql<string | null>`(select email from users where id = ${bookings.providerId})`,
      })
      .from(disputes)
      .innerJoin(bookings, eq(bookings.id, disputes.bookingId))
      .innerJoin(services, eq(services.id, bookings.serviceId))
      .where(status ? eq(disputes.status, status as (typeof disputeStatusEnum.enumValues)[number]) : sql`true`)
      .orderBy(desc(disputes.createdAt))
      .limit(100);
    const events: (typeof disputeEvents.$inferSelect)[] = await db.select().from(disputeEvents).where(rows.length ? inArray(disputeEvents.disputeId, rows.map((r) => r.d.id)) : eq(disputeEvents.disputeId, "")).catch(() => []);
    const shortName = (email?: string | null) => (email ? email.split("@")[0] : "—");
    ok(res, {
      disputes: rows.map((r) => ({
        ...r.d,
        service: r.service,
        customerName: shortName(r.customer),
        providerName: shortName(r.provider),
        events: events.filter((e) => e.disputeId === r.d.id),
      })),
    });
  }),
);

router.post(
  "/admin/disputes/:id/response",
  ...adminOnly,
  handle(async (req, res) => {
    const id = String(req.params.id);
    const status = ["open", "under_review", "provider_response", "escalated"].includes(String(req.body?.status)) ? (req.body.status as never) : "under_review";
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 500) : undefined;
    const [dispute] = await db.update(disputes).set({ status, updatedAt: new Date() }).where(eq(disputes.id, id)).returning({ customerId: disputes.customerId, providerId: disputes.providerId, bookingId: disputes.bookingId });
    if (!dispute) return fail(res, 404, "not_found", "Dispute not found.");
    await db.insert(disputeEvents).values({ disputeId: id, actorId: req.authUser!.id, action: status, note: note ?? null });
    await audit(req.authUser!.id, "dispute_update", "dispute", id, { status, note: note ?? null });
    for (const uid of [dispute.customerId, dispute.providerId].filter(Boolean) as string[]) {
      emitToUser(uid, "dispute:updated", { disputeId: id, status });
      await notify({ userId: uid, type: "dispute_update", title: `Dispute status: ${status.replace("_", " ")}`, body: note ?? undefined, data: { disputeId: id, bookingId: dispute.bookingId } });
    }
    ok(res, { status });
  }),
);

router.post(
  "/admin/disputes/:id/resolve",
  ...adminOnly,
  handle(async (req, res) => {
    const id = String(req.params.id);
    const outcome = req.body?.outcome === "reject" ? "rejected" : "resolved";
    const resolution = typeof req.body?.resolution === "string" ? req.body.resolution.trim().slice(0, 500) : "";
    const refundPaise = toNumber(req.body?.refundPaise);
    if (!resolution) return fail(res, 422, "validation", "resolution is required.");
    const [dispute] = await db.update(disputes).set({ status: outcome, resolution, resolvedAt: new Date(), updatedAt: new Date() }).where(eq(disputes.id, id)).returning();
    if (!dispute) return fail(res, 404, "not_found", "Dispute not found.");
    await db.insert(disputeEvents).values({ disputeId: id, actorId: req.authUser!.id, action: outcome, note: resolution });
    await audit(req.authUser!.id, `dispute_${outcome}`, "dispute", id, { resolution, refundPaise: refundPaise ?? null });
    if (outcome === "resolved" && refundPaise && refundPaise > 0) {
      const paid = (await db.select().from(payments).where(and(eq(payments.bookingId, dispute.bookingId), eq(payments.status, "paid"))).orderBy(desc(payments.createdAt)).limit(1))[0];
      if (paid) {
        await refundPayment(paid, req.authUser!.id, `Dispute ${id}: ${resolution}`);
      }
    }
    for (const uid of [dispute.customerId, dispute.providerId].filter(Boolean) as string[]) {
      emitToUser(uid, "dispute:updated", { disputeId: id, status: outcome });
      await notify({ userId: uid, type: "dispute_resolved", title: outcome === "resolved" ? "Dispute resolved" : "Dispute rejected", body: resolution, data: { disputeId: id, bookingId: dispute.bookingId } });
    }
    ok(res, { status: outcome });
  }),
);

/* --------------------------------- reports --------------------------------- */

router.get(
  "/admin/reports",
  ...adminOnly,
  handle(async (req, res) => {
    const rows = await db
      .select({
        r: reports,
        reporter: sql<string>`(select email from users where id = ${reports.reporterId})`,
        target: sql<string | null>`(select email from users where id::text = ${reports.targetId})`,
      })
      .from(reports)
      .orderBy(desc(reports.createdAt))
      .limit(100);
    const shortName = (email?: string | null) => (email ? email.split("@")[0] : "—");
    ok(res, { reports: rows.map((x) => ({ ...x.r, reporterName: shortName(x.reporter), targetEmail: x.target ?? null })) });
  }),
);

router.patch(
  "/admin/reports/:id",
  ...adminOnly,
  handle(async (req, res) => {
    const id = String(req.params.id);
    const status = ["open", "investigating", "closed"].includes(String(req.body?.status)) ? (req.body.status as never) : null;
    const action = typeof req.body?.actionTaken === "string" ? req.body.actionTaken.trim().slice(0, 300) : undefined;
    if (!status) return fail(res, 422, "validation", "status is required.");
    const [report] = await db.update(reports).set({ status, actionTaken: action ?? null, updatedAt: new Date() }).where(eq(reports.id, id)).returning();
    if (!report) return fail(res, 404, "not_found", "Report not found.");
    await audit(req.authUser!.id, `report_${status}`, "report", id, { action: action ?? null });
    ok(res, { status });
  }),
);

/* --------------------------------- services -------------------------------- */

router.get(
  "/admin/services",
  ...adminOnly,
  handle(async (_req, res) => {
    const rows = await db.select().from(services).orderBy(asc(services.name));
    ok(res, { services: rows });
  }),
);

router.post(
  "/admin/services",
  ...adminOnly,
  handle(async (req, res) => {
    const b = req.body ?? {};
    const name = typeof b.name === "string" ? b.name.trim() : "";
    const slug = typeof b.slug === "string" ? b.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-") : name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!name || !slug) return fail(res, 422, "validation", "name is required.");
    const [row] = await db
      .insert(services)
      .values({
        slug,
        name,
        description: typeof b.description === "string" ? b.description.trim().slice(0, 300) : null,
        icon: typeof b.icon === "string" ? b.icon.trim().slice(0, 40) : "wrench",
        category: typeof b.category === "string" ? b.category.trim().slice(0, 30) : "home",
        basePriceMin: Math.max(0, toNumber(b.basePriceMin) ?? 300),
        basePriceMax: Math.max(0, toNumber(b.basePriceMax) ?? 1500),
        warrantyDays: Math.max(0, toNumber(b.warrantyDays) ?? 7),
        emergencySupported: b.emergencySupported !== false,
        status: "active",
      })
      .returning();
    await audit(req.authUser!.id, "service_created", "service", row.id, { name });
    ok(res, { service: row }, 201);
  }),
);

router.patch(
  "/admin/services/:id",
  ...adminOnly,
  handle(async (req, res) => {
    const id = String(req.params.id);
    const b = req.body ?? {};
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof b.name === "string" && b.name.trim()) patch.name = b.name.trim().slice(0, 80);
    if (typeof b.description === "string") patch.description = b.description.trim().slice(0, 300);
    if (typeof b.icon === "string") patch.icon = b.icon.trim().slice(0, 40);
    if (typeof b.category === "string") patch.category = b.category.trim().slice(0, 30);
    if (toNumber(b.basePriceMin) !== undefined) patch.basePriceMin = toNumber(b.basePriceMin);
    if (toNumber(b.basePriceMax) !== undefined) patch.basePriceMax = toNumber(b.basePriceMax);
    if (toNumber(b.warrantyDays) !== undefined) patch.warrantyDays = toNumber(b.warrantyDays);
    if (typeof b.status === "string" && ["active", "inactive"].includes(b.status)) patch.status = b.status;
    if (typeof b.emergencySupported === "boolean") patch.emergencySupported = b.emergencySupported;
    const [row] = await db.update(services).set(patch).where(eq(services.id, id)).returning();
    if (!row) return fail(res, 404, "not_found", "Service not found.");
    await audit(req.authUser!.id, "service_updated", "service", id, patch);
    ok(res, { service: row });
  }),
);

/* ---------------------------------- audits --------------------------------- */

router.get(
  "/admin/audit",
  ...adminOnly,
  handle(async (_req, res) => {
    const rows = await db
      .select({
        a: auditLogs,
        admin: sql<string | null>`(select email from users where id = ${auditLogs.adminId})`,
      })
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(200);
    ok(res, { logs: rows.map((r) => ({ ...r.a, adminName: r.admin ? r.admin.split("@")[0] : "system" })) });
  }),
);

/* --------------------------------- settings -------------------------------- */

router.get(
  "/admin/settings",
  ...adminOnly,
  handle(async (_req, res) => {
    const rows = await db.select().from(platformSettings);
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    ok(res, { settings: map });
  }),
);

router.patch(
  "/admin/settings",
  ...adminOnly,
  handle(async (req, res) => {
    const entries = Object.entries(req.body ?? {});
    if (!entries.length) return fail(res, 422, "validation", "No settings provided.");
    for (const [key, value] of entries) {
      if (!/^[a-z0-9_]{2,40}$/.test(key)) continue;
      await db.insert(platformSettings).values({ key, value: String(value).slice(0, 500) }).onConflictDoUpdate({ target: platformSettings.key, set: { value: String(value).slice(0, 500), updatedAt: new Date() } });
    }
    await audit(req.authUser!.id, "settings_updated", "settings", undefined, Object.fromEntries(entries));
    ok(res, { updated: entries.length });
  }),
);

/* ---------------------------------- outbox ---------------------------------- */

router.get(
  "/admin/outbox",
  ...adminOnly,
  handle(async (_req, res) => {
    const rows = await db.select().from(emailOutbox).orderBy(desc(emailOutbox.createdAt)).limit(100);
    ok(res, { emails: rows });
  }),
);

/* ----------------------------------- refunds -------------------------------- */

router.post(
  "/admin/payments/:id/refund",
  ...adminOnly,
  handle(async (req, res) => {
    const [payment] = await db.select().from(payments).where(eq(payments.id, String(req.params.id))).limit(1);
    if (!payment) return fail(res, 404, "not_found", "Payment not found.");
    try {
      const updated = await refundPayment(payment, req.authUser!.id, typeof req.body?.reason === "string" ? req.body.reason.trim() : "admin refund");
      await audit(req.authUser!.id, "payment_refunded", "payment", payment.id, { paise: payment.amountPaise });
      ok(res, { paymentId: updated.id, status: updated.status });
    } catch (error) {
      if (error instanceof ApiError) return fail(res, error.status, error.code, error.message);
      throw error;
    }
  }),
);

export default router;
