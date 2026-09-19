import { Router } from "express";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { aiDiagnoses, bookings, db, providerRequestInvites, services, users } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { ok, fail, handle, ApiError } from "../lib/respond";
import { toNumber, validCoordinate } from "../lib/geo";
import { startMatching, acceptInvite, rejectInvite } from "../lib/matching";
import { computePrice } from "../lib/ai";
import { emitToUser } from "../lib/bus";
import { config } from "../config";
import { logger } from "../lib/logger";

const router: Router = Router();

/**
 * Create a service request and start real-time provider matching.
 * For scheduled requests the booking is stored as SCHEDULED and the
 * scheduler promotes it into matching when the time arrives.
 */
router.post(
  "/service-requests",
  requireAuth,
  requireRole("customer"),
  handle(async (req, res) => {
    const b = req.body ?? {};
    const serviceRef = typeof b.serviceId === "string" ? b.serviceId : typeof b.service === "string" ? b.service : "";
    if (!serviceRef) return fail(res, 422, "validation", "serviceId is required.");
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const byId = UUID_RE.test(serviceRef) ? (await db.select().from(services).where(eq(services.id, serviceRef)).limit(1))[0] : undefined;
    const bySlug = byId ? undefined : (await db.select().from(services).where(eq(services.slug, serviceRef)).limit(1))[0];
    const service = byId ?? bySlug;
    if (!service || service.status !== "active") return fail(res, 404, "service_not_found", "Select a valid service.");

    const latitude = toNumber(b.latitude);
    const longitude = toNumber(b.longitude);
    if (!validCoordinate(latitude, -90, 90) || !validCoordinate(longitude, -180, 180)) {
      return fail(res, 422, "location_required", "A valid service location (latitude & longitude) is required.");
    }
    const problemDescription = typeof b.problemDescription === "string" ? b.problemDescription.trim().slice(0, 2000) : "";
    const isEmergency = b.isEmergency === true;
    const scheduledAtRaw = typeof b.scheduledAt === "string" ? b.scheduledAt : typeof b.scheduledAt === "number" ? new Date(b.scheduledAt).toISOString() : null;
    let scheduledAt: Date | null = null;
    if (scheduledAtRaw) {
      const d = new Date(scheduledAtRaw);
      if (Number.isNaN(d.getTime())) return fail(res, 422, "validation", "Invalid scheduled time.");
      if (d.getTime() < Date.now() + 15 * 60 * 1000) return fail(res, 422, "validation", "Scheduled time must be at least 15 minutes in the future (use immediate for now).");
      scheduledAt = d;
    }
    if (isEmergency && scheduledAt) return fail(res, 422, "validation", "Emergency requests cannot be scheduled.");

    const aiDiagnosisId = typeof b.aiDiagnosisId === "string" ? b.aiDiagnosisId : null;
    let diagnosis: typeof aiDiagnoses.$inferSelect | undefined;
    if (aiDiagnosisId) {
      diagnosis = (await db.select().from(aiDiagnoses).where(and(eq(aiDiagnoses.id, aiDiagnosisId), eq(aiDiagnoses.userId, req.authUser!.id))).limit(1))[0];
    }

    const price = await computePrice({ service, urgency: diagnosis?.urgency ?? "medium", isEmergency, text: problemDescription });
    const now = new Date();
    const status = scheduledAt && scheduledAt.getTime() > now.getTime() ? "scheduled" : "matching";

    const [booking] = await db
      .insert(bookings)
      .values({
        customerId: req.authUser!.id,
        serviceId: service.id,
        status: status as never,
        isEmergency,
        urgency: diagnosis?.urgency ?? (isEmergency ? "critical" : "medium"),
        source: diagnosis ? "ai" : typeof b.source === "string" ? b.source : "manual",
        problemDescription: problemDescription || null,
        notes: typeof b.notes === "string" ? b.notes.trim().slice(0, 500) : null,
        address: typeof b.address === "string" ? b.address.trim().slice(0, 300) : null,
        latitude: String(latitude),
        longitude: String(longitude),
        locationAddress: typeof b.locationAddress === "string" ? b.locationAddress.trim().slice(0, 300) : typeof b.address === "string" ? b.address.trim().slice(0, 300) : null,
        locationArea: typeof b.locationArea === "string" ? b.locationArea.trim().slice(0, 120) : null,
        locationCity: typeof b.locationCity === "string" ? b.locationCity.trim().slice(0, 120) : null,
        locationState: typeof b.locationState === "string" ? b.locationState.trim().slice(0, 120) : null,
        locationPostalCode: typeof b.locationPostalCode === "string" ? b.locationPostalCode.trim().slice(0, 10) : null,
        timezone: typeof b.timezone === "string" ? b.timezone : "Asia/Kolkata",
        estimatedPriceMin: String(price.price_min),
        estimatedPriceMax: String(price.price_max),
        aiDiagnosisId: diagnosis?.id ?? null,
        scheduledAt,
        warrantyDays: service.warrantyDays,
      })
      .returning();

    if (diagnosis) await db.update(aiDiagnoses).set({ bookingId: booking.id }).where(eq(aiDiagnoses.id, diagnosis.id)).catch(() => {});
    emitToUser(req.authUser!.id, "booking:created", { bookingId: booking.id, status: booking.status });
    if (status === "matching") {
      try {
        const { batch, invited } = await startMatching(booking.id, 1);
        emitToUser(req.authUser!.id, "matching:progress", { bookingId: booking.id, batch, invited, status: "provider_invited" });
      } catch (error) {
        logger.warn({ error, bookingId: booking.id }, "startMatching failed on create");
      }
    }
    ok(res, { booking: await bookingRow(booking), scheduled: status === "scheduled" }, 201);
  }),
);

async function bookingRow(b: typeof bookings.$inferSelect) {
  const [service] = await db.select().from(services).where(eq(services.id, b.serviceId)).limit(1);
  return {
    id: b.id,
    status: b.status,
    service: { id: service?.id, name: service?.name, icon: service?.icon },
    isEmergency: b.isEmergency,
    scheduledAt: b.scheduledAt,
    estimatedPriceMin: b.estimatedPriceMin,
    estimatedPriceMax: b.estimatedPriceMax,
    createdAt: b.createdAt,
  };
}

/** Customer: list of their open matching/scheduled requests with invite progress. */
router.get(
  "/customer/requests",
  requireAuth,
  requireRole("customer"),
  handle(async (req, res) => {
    const rows = await db
      .select({
        id: bookings.id,
        status: bookings.status,
        isEmergency: bookings.isEmergency,
        scheduledAt: bookings.scheduledAt,
        createdAt: bookings.createdAt,
        service: services.name,
        serviceIcon: services.icon,
        invited: providerRequestInvites.id,
        batch: providerRequestInvites.batch,
        inviteStatus: providerRequestInvites.status,
        invitedAt: providerRequestInvites.invitedAt,
      })
      .from(bookings)
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .leftJoin(providerRequestInvites, and(eq(providerRequestInvites.bookingId, bookings.id), inArray(providerRequestInvites.status, ["invited", "accepted", "rejected", "expired"])))
      .where(and(eq(bookings.customerId, req.authUser!.id), inArray(bookings.status, ["matching", "provider_invited"])))
      .orderBy(desc(bookings.createdAt));
    const open: Record<string, { id: string; status: string; isEmergency: boolean; scheduledAt: Date | null; createdAt: Date; service: string; serviceIcon: string | null; invites: number; openInvites: number; batch: number }> = {};
    for (const r of rows) {
      if (!["matching", "provider_invited"].includes(r.status)) continue;
      const o = (open[r.id] ??= { id: r.id, status: r.status, isEmergency: r.isEmergency, scheduledAt: r.scheduledAt, createdAt: r.createdAt, service: r.service, serviceIcon: r.serviceIcon, invites: 0, openInvites: 0, batch: 1 });
      if (r.invited) {
        o.invites += 1;
        o.batch = Math.max(o.batch, r.batch ?? 1);
        if (r.inviteStatus === "invited") o.openInvites += 1;
      }
    }
    ok(res, { requests: Object.values(open) });
  }),
);

/** Provider: requests broadcast to them that are still open. */
router.get(
  "/provider/requests",
  requireAuth,
  handle(async (req, res) => {
    if (!["provider", "student_provider"].includes(req.authUser!.role)) return fail(res, 403, "forbidden", "Providers only.");
    const rows = await db
      .select({
        invite: providerRequestInvites,
        bookingId: bookings.id,
        status: bookings.status,
        isEmergency: bookings.isEmergency,
        urgency: bookings.urgency,
        problemDescription: bookings.problemDescription,
        address: bookings.locationAddress,
        city: bookings.locationCity,
        area: bookings.locationArea,
        latitude: bookings.latitude,
        longitude: bookings.longitude,
        postalCode: bookings.locationPostalCode,
        scheduledAt: bookings.scheduledAt,
        estimatedPriceMin: bookings.estimatedPriceMin,
        estimatedPriceMax: bookings.estimatedPriceMax,
        service: services.name,
        serviceIcon: services.icon,
        customerEmail: users.email,
      })
      .from(providerRequestInvites)
      .innerJoin(bookings, eq(bookings.id, providerRequestInvites.bookingId))
      .innerJoin(services, eq(services.id, bookings.serviceId))
      .innerJoin(users, eq(users.id, bookings.customerId))
      .where(and(eq(providerRequestInvites.providerId, req.authUser!.id), eq(providerRequestInvites.status, "invited"), eq(bookings.status, "provider_invited")))
      .orderBy(desc(providerRequestInvites.invitedAt))
      .limit(20);
    const out = rows.map((r) => ({
      inviteId: r.invite.id,
      batch: r.invite.batch,
      invitedAt: r.invite.invitedAt,
      expiresInSec: Math.max(0, Math.round((Date.now() + config.requestTimeoutSec * 1000 - r.invite.invitedAt.getTime()) / 1000)),
      bookingId: r.bookingId,
      status: r.status,
      emergency: r.isEmergency,
      urgency: r.urgency,
      problem: r.problemDescription,
      location: [r.address, r.area, r.city].filter(Boolean).join(", ") || undefined,
      latitude: r.latitude,
      longitude: r.longitude,
      postalCode: r.postalCode,
      scheduledAt: r.scheduledAt,
      estimate: r.estimatedPriceMin ? { min: Number(r.estimatedPriceMin), max: Number(r.estimatedPriceMax ?? r.estimatedPriceMin) } : undefined,
      service: { name: r.service, icon: r.serviceIcon },
      customer: { name: r.customerEmail.split("@")[0] },
    }));
    ok(res, { requests: out });
  }),
);

/** Provider accepts a broadcast request (race-safe). */
router.post(
  "/provider/requests/:inviteId/accept",
  requireAuth,
  handle(async (req, res) => {
    if (!["provider", "student_provider"].includes(req.authUser!.role)) return fail(res, 403, "forbidden", "Providers only.");
    const quote = typeof req.body?.quote === "string" ? req.body.quote.trim() : undefined;
    try {
      const { booking } = await acceptInvite(String(req.params.inviteId), req.authUser!.id, quote);
      ok(res, { booking: { id: booking.id, status: booking.status, providerId: booking.providerId } });
    } catch (error) {
      if (error instanceof ApiError) return fail(res, error.status, error.code, error.message);
      throw error;
    }
  }),
);

/** Provider rejects (or ignores) a broadcast request. */
router.post(
  "/provider/requests/:inviteId/reject",
  requireAuth,
  handle(async (req, res) => {
    if (!["provider", "student_provider"].includes(req.authUser!.role)) return fail(res, 403, "forbidden", "Providers only.");
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 200) : undefined;
    try {
      await rejectInvite(String(req.params.inviteId), req.authUser!.id, reason);
      ok(res, { rejected: true });
    } catch (error) {
      if (error instanceof ApiError) return fail(res, error.status, error.code, error.message);
      throw error;
    }
  }),
);

export default router;
