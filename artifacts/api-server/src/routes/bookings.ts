import { Router } from "express";
import { and, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import {
  aiDiagnoses,
  bookingLocationUpdates,
  bookingStatusHistory,
  bookings,
  db,
  disputeEvents,
  disputes,
  favorites,
  messages,
  payments,
  providerAvailability,
  providerLocations,
  providerProfiles,
  providerRequestInvites,
  providerServices,
  providers,
  reviews,
  services,
  studentProviders,
  users,
  warrantyClaims,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { ok, fail, handle, ApiError } from "../lib/respond";
import { distanceKm, etaMinutes, toNumber, validCoordinate } from "../lib/geo";
import { transitionBooking, cancelBooking, getBookingForUser } from "../lib/bookings";
import { notify } from "../lib/notify";
import { emitToUser } from "../lib/bus";
import { randomInt } from "node:crypto";
import { logger } from "../lib/logger";

const router: Router = Router();

const CHAT_STATUSES = ["accepted", "confirmed", "on_the_way", "arrived", "in_progress", "completed", "payment_pending", "paid", "disputed"];
const PROVIDER_ROLES = ["provider", "student_provider"];

/* --------------------------- shared helpers ------------------------------- */

async function publicBooking(b: typeof bookings.$inferSelect, viewerId?: string) {
  const [service] = await db.select().from(services).where(eq(services.id, b.serviceId)).limit(1);
  const providerId = b.providerId;
  let provider: Record<string, unknown> | null = null;
  if (providerId) {
    const [p] = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        avatarUrl: users.avatarUrl,
        phone: providerProfiles.phone,
        experienceYears: providerProfiles.experienceYears,
        verificationStatus: providerProfiles.verificationStatus,
        rating: sql<number>`coalesce(round(avg(${reviews.rating})::numeric, 1), 0)`,
      })
      .from(users)
      .leftJoin(providerProfiles, eq(providerProfiles.userId, users.id))
      .leftJoin(reviews, and(eq(reviews.providerId, users.id), eq(reviews.status, "visible")))
      .where(eq(users.id, providerId))
      .groupBy(users.id, users.email, users.role, users.avatarUrl, providerProfiles.phone, providerProfiles.experienceYears, providerProfiles.verificationStatus)
      .limit(1);
    const name = (
      p?.role === "student_provider"
        ? (await db.select({ n: studentProviders.displayName }).from(studentProviders).where(eq(studentProviders.userId, providerId)).limit(1))[0]?.n
        : (await db.select({ n: providers.displayName }).from(providers).where(eq(providers.userId, providerId)).limit(1))[0]?.n
    );
    provider = p ? { id: p.id, name: name ?? p.email.split("@")[0], role: p.role, avatarUrl: p.avatarUrl, experienceYears: p.experienceYears, verificationStatus: p.verificationStatus, rating: Number(p.rating ?? 0), phone: viewerId === b.customerId || viewerId === providerId ? p.phone : p.phone ? "98***" + p.phone.slice(-2) : null } : null;
  }
  const [location] = await db.select().from(bookingLocationUpdates).where(eq(bookingLocationUpdates.bookingId, b.id)).limit(1);
  let distanceKmVal: number | null = null;
  let eta: number | null = null;
  if (location && b.latitude && b.longitude) {
    const d = distanceKm(Number(b.latitude), Number(b.longitude), Number(location.latitude), Number(location.longitude));
    distanceKmVal = Number(d.toFixed(2));
    eta = etaMinutes(d);
  }
  const [diagnosis] = b.aiDiagnosisId ? await db.select().from(aiDiagnoses).where(eq(aiDiagnoses.id, b.aiDiagnosisId)).limit(1) : [];
  const payment = (await db.select().from(payments).where(eq(payments.bookingId, b.id)).orderBy(desc(payments.createdAt)).limit(1))[0];
  const [warranty] = await db.select().from(warrantyClaims).where(eq(warrantyClaims.bookingId, b.id)).limit(1);
  const [dispute] = await db.select().from(disputes).where(eq(disputes.bookingId, b.id)).limit(1);
  const [review] = await db.select().from(reviews).where(eq(reviews.bookingId, b.id)).limit(1);
  const [fav] = b.providerId && viewerId === b.customerId ? await db.select({ id: favorites.id }).from(favorites).where(and(eq(favorites.customerId, viewerId), eq(favorites.providerId, b.providerId))).limit(1) : [];
  return {
    id: b.id,
    status: b.status,
    isEmergency: b.isEmergency,
    urgency: b.urgency,
    source: b.source,
    problemDescription: b.problemDescription,
    notes: b.notes,
    service: { id: service?.id, name: service?.name, icon: service?.icon },
    location: {
      address: [b.locationAddress, b.locationArea, b.locationCity, b.locationState].filter(Boolean).join(", ") || b.address || undefined,
      area: b.locationArea,
      city: b.locationCity,
      state: b.locationState,
      postalCode: b.locationPostalCode,
      latitude: b.latitude,
      longitude: b.longitude,
      timezone: b.timezone,
    },
    scheduledAt: b.scheduledAt,
    matchedAt: b.matchedAt,
    acceptedAt: b.acceptedAt,
    arrivedAt: b.arrivedAt,
    startedAt: b.startedAt,
    completedAt: b.completedAt,
    cancelledAt: b.cancelledAt,
    estimatedPriceMin: b.estimatedPriceMin,
    estimatedPriceMax: b.estimatedPriceMax,
    providerQuote: b.providerQuote,
    finalAmount: b.finalAmount,
    amount: b.amount,
    completionNotes: b.completionNotes,
    completionPhoto: b.completionPhoto,
    partsMaterials: b.partsMaterials,
    customerConfirmedAt: b.customerConfirmedAt,
    arrivalOtp: b.providerId === viewerId || b.customerId === viewerId ? b.arrivalOtp : null,
    warrantyDays: b.warrantyDays,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    customer: b.customerId === viewerId ? undefined : { id: b.customerId, name: (await db.select({ email: users.email }).from(users).where(eq(users.id, b.customerId)).limit(1))[0]?.email.split("@")[0] ?? "customer" },
    provider,
    providerLocation: location ? { latitude: location.latitude, longitude: location.longitude, updatedAt: location.updatedAt, distanceKm: distanceKmVal, etaMinutes: eta } : null,
    diagnosis: diagnosis ? { serviceCategory: diagnosis.serviceCategory, urgency: diagnosis.urgency, engine: diagnosis.engine, possibleCauses: diagnosis.possibleCauses, problemSummary: diagnosis.problemSummary } : null,
    payment: payment ? { id: payment.id, gateway: payment.gateway, amountPaise: payment.amountPaise, status: payment.status, transactionId: payment.transactionId, paidAt: payment.paidAt, failureReason: payment.failureReason } : null,
    warrantyClaim: warranty ? { id: warranty.id, status: warranty.status, createdAt: warranty.createdAt, resolution: warranty.resolution } : null,
    dispute: dispute ? { id: dispute.id, status: dispute.status, reason: dispute.reason, createdAt: dispute.createdAt } : null,
    review: review ? { id: review.id, rating: review.rating, comment: review.comment, createdAt: review.createdAt } : null,
    isFavorite: fav !== undefined,
    chatOpen: CHAT_STATUSES.includes(b.status),
  };
}

/* ------------------------- customer list / detail -------------------------- */

router.get(
  "/customer/bookings",
  requireAuth,
  requireRole("customer"),
  handle(async (req, res) => {
    const rows = await db.select().from(bookings).where(eq(bookings.customerId, req.authUser!.id)).orderBy(desc(bookings.createdAt)).limit(100);
    const out = await Promise.all(rows.map((b) => publicBooking(b, req.authUser!.id)));
    ok(res, { bookings: out });
  }),
);

router.get(
  "/bookings/:id",
  requireAuth,
  handle(async (req, res) => {
    const booking = await getBookingForUser(String(req.params.id), req.authUser!.id);
    ok(res, { booking: await publicBooking(booking, req.authUser!.id) });
  }),
);

router.get(
  "/bookings/:id/status-history",
  requireAuth,
  handle(async (req, res) => {
    const booking = await getBookingForUser(String(req.params.id), req.authUser!.id);
    const rows = await db.select().from(bookingStatusHistory).where(eq(bookingStatusHistory.bookingId, booking.id)).orderBy(desc(bookingStatusHistory.createdAt));
    ok(res, { history: rows });
  }),
);

router.get(
  "/bookings/:id/messages",
  requireAuth,
  handle(async (req, res) => {
    const booking = await getBookingForUser(String(req.params.id), req.authUser!.id);
    const rows = await db.select().from(messages).where(eq(messages.bookingId, booking.id)).orderBy(messages.createdAt).limit(500);
    ok(res, {
      messages: rows.map((m) => ({ id: m.id, senderId: m.senderId, text: m.text, imageUrl: m.imageUrl, readAt: m.readAt, createdAt: m.createdAt, mine: m.senderId === req.authUser!.id })),
    });
  }),
);

/* ---------------------------- direct booking ------------------------------- */

/**
 * Direct booking with a chosen provider (keeps the legacy POST /bookings
 * contract). The provider is notified instantly; the booking starts as
 * ACCEPTED so the provider workflow (on the way -> arrived -> ...) applies.
 */
router.post(
  "/bookings",
  requireAuth,
  requireRole("customer"),
  handle(async (req, res) => {
    const b = req.body ?? {};
    const serviceId = typeof b.serviceId === "string" ? b.serviceId : "";
    const providerId = typeof b.providerId === "string" ? b.providerId : "";
    const latitude = toNumber(b.latitude);
    const longitude = toNumber(b.longitude);
    if (!serviceId || !providerId) return fail(res, 422, "validation", "serviceId and providerId are required.");
    if (!validCoordinate(latitude, -90, 90) || !validCoordinate(longitude, -180, 180)) return fail(res, 422, "location_required", "A valid service location is required.");
    const [provider] = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(providerServices, eq(providerServices.providerId, users.id))
      .where(and(eq(users.id, providerId), or(eq(users.role, "provider"), eq(users.role, "student_provider")), eq(users.isActive, true), eq(providerServices.serviceId, serviceId)))
      .limit(1);
    if (!provider) return fail(res, 409, "provider_unavailable", "Provider does not offer this service or is unavailable.");
    const [service] = await db.select().from(services).where(and(eq(services.id, serviceId), eq(services.status, "active"))).limit(1);
    if (!service) return fail(res, 404, "service_not_found", "Service not found.");
    const problemDescription = typeof b.problemDescription === "string" ? b.problemDescription.trim().slice(0, 2000) : null;
    const now = new Date();
    const [created] = await db
      .insert(bookings)
      .values({
        customerId: req.authUser!.id,
        providerId,
        serviceId,
        status: "accepted" as never,
        isEmergency: b.isEmergency === true,
        source: "manual",
        problemDescription,
        address: typeof b.address === "string" ? b.address.trim() : typeof b.locationAddress === "string" ? b.locationAddress.trim() : null,
        latitude: String(latitude),
        longitude: String(longitude),
        locationAddress: typeof b.locationAddress === "string" ? b.locationAddress.trim() : null,
        locationArea: typeof b.locationArea === "string" ? b.locationArea.trim() : null,
        locationCity: typeof b.locationCity === "string" ? b.locationCity.trim() : null,
        locationState: typeof b.locationState === "string" ? b.locationState.trim() : null,
        locationPostalCode: typeof b.locationPostalCode === "string" ? b.locationPostalCode.trim() : null,
        timezone: typeof b.timezone === "string" ? b.timezone : "Asia/Kolkata",
        estimatedPriceMin: typeof b.estimatedPriceMin === "string" ? b.estimatedPriceMin : null,
        estimatedPriceMax: typeof b.estimatedPriceMax === "string" ? b.estimatedPriceMax : null,
        scheduledAt: typeof b.scheduledAt === "string" ? new Date(b.scheduledAt) : null,
        matchedAt: now,
        acceptedAt: now,
        warrantyDays: service.warrantyDays,
      })
      .returning();
    emitToUser(providerId, "direct:booking", { bookingId: created.id, service: { name: service.name, icon: service.icon } });
    await notify({
      userId: providerId,
      type: "booking_assigned",
      title: `A customer booked you directly: ${service.name}`,
      body: "Open the job from your dashboard to accept the trip.",
      data: { bookingId: created.id },
    });
    res.status(201).json({ booking: await publicBooking(created, req.authUser!.id) });
  }),
);

/* ------------------------- provider jobs list ------------------------------ */

router.get(
  "/provider/jobs",
  requireAuth,
  handle(async (req, res) => {
    if (!PROVIDER_ROLES.includes(req.authUser!.role)) return fail(res, 403, "forbidden", "Providers only.");
    const rows = await db
      .select().from(bookings)
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .where(eq(bookings.providerId, req.authUser!.id))
      .orderBy(desc(bookings.createdAt))
      .limit(100);
    const out = await Promise.all(rows.map((row) => publicBooking(row.bookings, req.authUser!.id)));
    ok(res, { jobs: out });
  }),
);

/* --------------------------- cancel ---------------------------------------- */

router.post(
  "/bookings/:id/cancel",
  requireAuth,
  handle(async (req, res) => {
    const booking = await getBookingForUser(String(req.params.id), req.authUser!.id);
    try {
      const updated = await cancelBooking(booking, req.authUser!.id, req.authUser!.role, typeof req.body?.reason === "string" ? req.body.reason.slice(0, 300) : undefined);
      const invites = await db.select({ providerId: providerRequestInvites.providerId }).from(providerRequestInvites).where(and(eq(providerRequestInvites.bookingId, booking.id), eq(providerRequestInvites.status, "invited")));
      emitToUser(booking.customerId, "booking_cancelled", { bookingId: booking.id });
      emitToUser(booking.customerId === req.authUser!.id && booking.providerId ? booking.providerId : req.authUser!.id, "booking_cancelled", { bookingId: booking.id });
      for (const i of invites) emitToUser(i.providerId, "provider:request_gone", { bookingId: booking.id, reason: "cancelled" });
      ok(res, { booking: await publicBooking(updated, req.authUser!.id) });
    } catch (error) {
      if (error instanceof ApiError) return fail(res, error.status, error.code, error.message);
      throw error;
    }
  }),
);

/* ------------------- provider workflow actions ----------------------------- */

function providerActionGuard(req: Parameters<Parameters<typeof handle>[0]>[0], booking: typeof bookings.$inferSelect): void {
  if (!PROVIDER_ROLES.includes(req.authUser!.role) || booking.providerId !== req.authUser!.id) {
    throw new ApiError(403, "forbidden", "Only the assigned provider can perform this action.");
  }
}

/** Provider: start the trip (accepted -> on_the_way). Generates arrival OTP. */
router.post(
  "/bookings/:id/on-the-way",
  requireAuth,
  handle(async (req, res) => {
    const booking = await getBookingForUser(String(req.params.id), req.authUser!.id);
    providerActionGuard(req, booking);
    const otp = String(randomInt(1000, 9999));
    const updated = await db.transaction(async (tx) => transitionBooking(booking.id, "on_the_way", tx, { arrivalOtp: otp }, { actorId: req.authUser!.id, reason: "provider started the trip" }));
    await notify({
      userId: booking.customerId,
      type: "provider_on_the_way",
      title: "Your provider is on the way",
      body: `Arrival OTP: ${otp}. Your provider will share it when they arrive - confirm from the booking page.`,
      data: { bookingId: updated.id },
    });
    ok(res, { booking: await publicBooking(updated, req.authUser!.id), otp });
  }),
);

/** Provider: arrived (with optional OTP check). */
router.post(
  "/bookings/:id/arrived",
  requireAuth,
  handle(async (req, res) => {
    const booking = await getBookingForUser(String(req.params.id), req.authUser!.id);
    providerActionGuard(req, booking);
    const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
    if (otp && booking.arrivalOtp && otp !== booking.arrivalOtp) {
      return fail(res, 400, "bad_otp", "The arrival OTP does not match the one shared with the customer.");
    }
    const updated = await db.transaction(async (tx) => transitionBooking(booking.id, "arrived", tx, { arrivedAt: new Date() }, { actorId: req.authUser!.id, reason: otp ? "arrived (OTP verified)" : "arrived" }));
    await notify({
      userId: booking.customerId,
      type: "provider_arrived",
      title: "Your provider has arrived",
      body: otp ? "They verified the arrival OTP." : undefined,
      data: { bookingId: updated.id },
    });
    ok(res, { booking: await publicBooking(updated, req.authUser!.id) });
  }),
);

/** Provider: start the service (arrived -> in_progress). */
router.post(
  "/bookings/:id/start",
  requireAuth,
  handle(async (req, res) => {
    const booking = await getBookingForUser(String(req.params.id), req.authUser!.id);
    providerActionGuard(req, booking);
    const updated = await db.transaction(async (tx) => transitionBooking(booking.id, "in_progress", tx, { startedAt: new Date() }, { actorId: req.authUser!.id, reason: "service started" }));
    await notify({ userId: booking.customerId, type: "service_started", title: "Service started", body: "Your provider has started the work.", data: { bookingId: updated.id } });
    ok(res, { booking: await publicBooking(updated, req.authUser!.id) });
  }),
);

/** Provider: complete the service with final price + proof. */
router.post(
  "/bookings/:id/complete",
  requireAuth,
  handle(async (req, res) => {
    const booking = await getBookingForUser(String(req.params.id), req.authUser!.id);
    providerActionGuard(req, booking);
    const finalAmount = toNumber(req.body?.finalAmount);
    if (typeof finalAmount !== "number" || !Number.isFinite(finalAmount) || finalAmount <= 0 || finalAmount > 10_000_000) {
      return fail(res, 422, "validation", "Enter a valid final amount in rupees.");
    }
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim().slice(0, 1000) : undefined;
    const parts = typeof req.body?.parts === "string" ? req.body.parts.trim().slice(0, 500) : undefined;
    const proofImage = typeof req.body?.proofImage === "string" && req.body.proofImage.startsWith("/uploads/") ? req.body.proofImage : undefined;
    const updated = await db.transaction(async (tx) =>
      transitionBooking(
        booking.id,
        "completed",
        tx,
        {
          completedAt: new Date(),
          finalAmount: String(Math.round(finalAmount)),
          completionNotes: notes ?? booking.completionNotes,
          partsMaterials: parts ?? booking.partsMaterials,
          completionPhoto: proofImage ?? booking.completionPhoto,
        },
        { actorId: req.authUser!.id, reason: "service completed" },
      ),
    );
    // immediately move to payment_pending so the customer can confirm + pay
    const pay = await db.transaction(async (tx) => transitionBooking(updated.id, "payment_pending", tx, undefined, { actorId: req.authUser!.id, reason: "payment requested" }));
    await notify({
      userId: booking.customerId,
      type: "service_completed",
      title: "Service completed",
      body: `Your provider finished the job. Final amount: ₹${Math.round(finalAmount)}. Confirm and pay from the booking page.`,
      data: { bookingId: pay.id },
      email: { to: (await db.select({ email: users.email }).from(users).where(eq(users.id, booking.customerId)).limit(1))[0]?.email ?? "", subject: "Service completed", html: "" },
    });
    ok(res, { booking: await publicBooking(pay, req.authUser!.id) });
  }),
);

/** Provider (or customer): request payment on a completed job. */
router.post(
  "/bookings/:id/request-payment",
  requireAuth,
  handle(async (req, res) => {
    const booking = await getBookingForUser(String(req.params.id), req.authUser!.id);
    if (req.authUser!.role !== "admin" && booking.providerId !== req.authUser!.id && booking.customerId !== req.authUser!.id) {
      throw new ApiError(403, "forbidden", "You are not part of this booking.");
    }
    if (booking.status !== "completed") return fail(res, 409, "invalid_state", "Only completed bookings can request payment.");
    const updated = await db.transaction(async (tx) => transitionBooking(booking.id, "payment_pending", tx, undefined, { actorId: req.authUser!.id, reason: "payment requested" }));
    ok(res, { booking: await publicBooking(updated, req.authUser!.id) });
  }),
);

/** Customer confirms completion (accepts the final price). */
router.post(
  "/bookings/:id/confirm-completion",
  requireAuth,
  handle(async (req, res) => {
    const booking = await getBookingForUser(String(req.params.id), req.authUser!.id);
    if (booking.customerId !== req.authUser!.id) throw new ApiError(403, "forbidden", "Only the customer can confirm completion.");
    if (!["completed", "payment_pending"].includes(booking.status)) return fail(res, 409, "invalid_state", "This booking is not awaiting your confirmation.");
    const extra = { customerConfirmedAt: new Date() };
    const updated = booking.status === "completed" ? await db.transaction(async (tx) => { await tx.update(bookings).set({ customerConfirmedAt: new Date() }).where(eq(bookings.id, booking.id)); return transitionBooking(booking.id, "payment_pending", tx, undefined, { actorId: req.authUser!.id, reason: "customer confirmed completion" }); })
      : await db.transaction(async (tx) => transitionBooking(booking.id, booking.status, tx, undefined, { actorId: req.authUser!.id, reason: "noop" }).catch(async () => { await tx.update(bookings).set({ customerConfirmedAt: new Date() }).where(eq(bookings.id, booking.id)); return (await tx.select().from(bookings).where(eq(bookings.id, booking.id)).limit(1))[0]; }));
    await db.update(bookings).set({ customerConfirmedAt: new Date() }).where(eq(bookings.id, booking.id));
    if (booking.providerId) await notify({ userId: booking.providerId, type: "completion_confirmed", title: "Customer confirmed the service", body: "Payment is now due from the customer.", data: { bookingId: booking.id } });
    void extra;
    ok(res, { booking: await publicBooking(updated, req.authUser!.id) });
  }),
);

/* ------------------------ live location sharing ---------------------------- */

router.put(
  "/bookings/:id/provider-location",
  requireAuth,
  handle(async (req, res) => {
    if (!PROVIDER_ROLES.includes(req.authUser!.role)) return fail(res, 403, "forbidden", "Providers only.");
    const b = req.body ?? {};
    if (!validCoordinate(b.latitude, -90, 90) || !validCoordinate(b.longitude, -180, 180)) return fail(res, 422, "validation", "Valid latitude and longitude are required.");
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, String(req.params.id))).limit(1);
    if (!booking || booking.providerId !== req.authUser!.id) return fail(res, 403, "forbidden", "Booking access denied.");
    if (!["accepted", "confirmed", "on_the_way"].includes(booking.status)) return fail(res, 409, "invalid_state", "Location sharing is available between acceptance and arrival.");
    const [update] = await db
      .insert(bookingLocationUpdates)
      .values({ bookingId: booking.id, providerId: req.authUser!.id, latitude: String(b.latitude), longitude: String(b.longitude) })
      .onConflictDoUpdate({ target: bookingLocationUpdates.bookingId, set: { latitude: String(b.latitude), longitude: String(b.longitude), updatedAt: new Date() } })
      .returning();
    // also keep the provider's base location fresh
    await db
      .insert(providerLocations)
      .values({ providerId: req.authUser!.id, latitude: String(b.latitude), longitude: String(b.longitude) })
      .onConflictDoUpdate({ target: providerLocations.providerId, set: { latitude: String(b.latitude), longitude: String(b.longitude), updatedAt: new Date() } })
      .catch(() => {});
    let distanceKmVal: number | null = null;
    if (booking.latitude && booking.longitude) {
      const d = distanceKm(Number(booking.latitude), Number(booking.longitude), Number(b.latitude), Number(b.longitude));
      distanceKmVal = Number(d.toFixed(2));
    }
    emitToUser(booking.customerId, "provider:location", {
      bookingId: booking.id,
      latitude: String(b.latitude),
      longitude: String(b.longitude),
      distanceKm: distanceKmVal,
      etaMinutes: distanceKmVal !== null ? etaMinutes(distanceKmVal) : null,
      updatedAt: update.updatedAt,
    });
    res.json({ location: update });
  }),
);

router.get(
  "/bookings/:id/provider-location",
  requireAuth,
  handle(async (req, res) => {
    const booking = await getBookingForUser(String(req.params.id), req.authUser!.id);
    if (!["accepted", "confirmed", "on_the_way", "arrived", "in_progress"].includes(booking.status)) return ok(res, { location: null });
    const [location] = await db.select().from(bookingLocationUpdates).where(eq(bookingLocationUpdates.bookingId, booking.id)).limit(1);
    let distanceKmVal: number | null = null;
    let eta: number | null = null;
    if (location && booking.latitude && booking.longitude) {
      const d = distanceKm(Number(booking.latitude), Number(booking.longitude), Number(location.latitude), Number(location.longitude));
      distanceKmVal = Number(d.toFixed(2));
      eta = etaMinutes(d);
    }
    ok(res, { location: location ? { ...location, distanceKm: distanceKmVal, etaMinutes: eta } : null });
  }),
);

/* ------------------------------ reviews ------------------------------------ */

router.post(
  "/bookings/:id/review",
  requireAuth,
  handle(async (req, res) => {
    const booking = await getBookingForUser(String(req.params.id), req.authUser!.id);
    if (booking.customerId !== req.authUser!.id) throw new ApiError(403, "forbidden", "Only the customer can review this booking.");
    if (booking.providerId !== req.authUser!.id && !["paid", "closed", "review_pending"].includes(booking.status)) {
      return fail(res, 409, "invalid_state", "You can review after the service is completed and paid.");
    }
    const existing = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.bookingId, booking.id)).limit(1);
    if (existing.length > 0) return fail(res, 409, "duplicate_review", "You have already reviewed this booking.");
    const rating = toNumber(req.body?.rating);
    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) return fail(res, 422, "validation", "Rating must be between 1 and 5.");
    const clamp = (v: unknown) => {
      const n = toNumber(v);
      return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5 ? n : 0;
    };
    const comment = typeof req.body?.comment === "string" ? req.body.comment.trim().slice(0, 2000) : undefined;
    const [review] = await db
      .insert(reviews)
      .values({
        bookingId: booking.id,
        customerId: booking.customerId,
        providerId: booking.providerId!,
        rating,
        serviceQuality: clamp(req.body?.serviceQuality),
        professionalism: clamp(req.body?.professionalism),
        timeliness: clamp(req.body?.timeliness),
        comment,
      })
      .returning();
    // paid -> review_pending so the booking can be closed after review
    if (booking.status === "paid") {
      await db.transaction(async (tx) => transitionBooking(booking.id, "review_pending", tx, undefined, { actorId: req.authUser!.id, reason: "review submitted" })).catch(() => {});
    }
    if (booking.providerId) {
      await notify({ userId: booking.providerId, type: "new_review", title: `New review: ${rating}/5`, body: comment || undefined, data: { bookingId: booking.id } });
    }
    ok(res, { review }, 201);
  }),
);

router.put(
  "/bookings/:id/review-response",
  requireAuth,
  handle(async (req, res) => {
    if (!PROVIDER_ROLES.includes(req.authUser!.role)) return fail(res, 403, "forbidden", "Providers only.");
    const booking = await getBookingForUser(String(req.params.id), req.authUser!.id);
    if (booking.providerId !== req.authUser!.id) throw new ApiError(403, "forbidden", "Only the assigned provider can respond.");
    const text = typeof req.body?.response === "string" ? req.body.response.trim().slice(0, 1000) : "";
    if (!text) return fail(res, 422, "validation", "Response text is required.");
    const [review] = await db.select().from(reviews).where(eq(reviews.bookingId, booking.id)).limit(1);
    if (!review) return fail(res, 404, "not_found", "No review found for this booking.");
    const [updated] = await db.update(reviews).set({ providerResponse: text, respondedAt: new Date() }).where(eq(reviews.id, review.id)).returning();
    if (review.customerId) await notify({ userId: review.customerId, type: "review_response", title: "The provider responded to your review", body: text, data: { bookingId: booking.id } });
    ok(res, { review: updated });
  }),
);

/* --------------------------- disputes & warranty --------------------------- */

router.post(
  "/bookings/:id/dispute",
  requireAuth,
  handle(async (req, res) => {
    const booking = await getBookingForUser(String(req.params.id), req.authUser!.id);
    if (booking.customerId !== req.authUser!.id) throw new ApiError(403, "forbidden", "Only the customer can raise a dispute.");
    if (!["completed", "payment_pending", "paid", "closed", "disputed"].includes(booking.status)) {
      return fail(res, 409, "invalid_state", "Disputes can be raised after the service is completed.");
    }
    const existing = await db.select({ id: disputes.id }).from(disputes).where(and(eq(disputes.bookingId, booking.id), inArray(disputes.status, ["open", "under_review", "provider_response", "escalated"]))).limit(1);
    if (existing.length > 0) return fail(res, 409, "dispute_open", "A dispute is already open for this booking.");
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
    const images = Array.isArray(req.body?.evidenceImages) ? (req.body.evidenceImages as string[]).filter((x) => typeof x === "string" && x.startsWith("/uploads/")).slice(0, 5) : [];
    if (!reason || description.length < 10) return fail(res, 422, "validation", "A reason and a description of at least 10 characters are required.");
    const [dispute] = await db.insert(disputes).values({ bookingId: booking.id, customerId: booking.customerId, providerId: booking.providerId ?? undefined, reason, description, evidenceImages: images }).returning();
    await db.insert(disputeEvents).values({ disputeId: dispute.id, actorId: booking.customerId, action: "created", note: reason });
    if (["completed", "payment_pending", "paid"].includes(booking.status)) {
      await db.transaction(async (tx) => transitionBooking(booking.id, "disputed", tx, undefined, { actorId: booking.customerId, reason: `dispute raised: ${reason}` })).catch(() => {});
    }
    if (booking.providerId) await notify({ userId: booking.providerId, type: "dispute_raised", title: "Customer raised a dispute", body: `${reason}: ${description.slice(0, 140)}`, data: { bookingId: booking.id, disputeId: dispute.id } });
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
    for (const a of admins) emitToUser(a.id, "dispute:updated", { disputeId: dispute.id, status: "open", bookingId: booking.id });
    ok(res, { dispute: { id: dispute.id, status: dispute.status } }, 201);
  }),
);

router.post(
  "/bookings/:id/warranty-claim",
  requireAuth,
  handle(async (req, res) => {
    const booking = await getBookingForUser(String(req.params.id), req.authUser!.id);
    if (booking.customerId !== req.authUser!.id) throw new ApiError(403, "forbidden", "Only the customer can raise a warranty claim.");
    if (!["paid", "closed", "review_pending"].includes(booking.status)) return fail(res, 409, "invalid_state", "Warranty claims apply to paid, completed services.");
    if ((booking.completedAt ?? booking.createdAt).getTime() + booking.warrantyDays * 86_400_000 < Date.now()) {
      return fail(res, 409, "warranty_expired", "The service warranty period for this booking has ended.");
    }
    const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
    const images = Array.isArray(req.body?.evidenceImages) ? (req.body.evidenceImages as string[]).filter((x) => typeof x === "string" && x.startsWith("/uploads/")).slice(0, 5) : [];
    if (description.length < 10) return fail(res, 422, "validation", "Describe the issue (at least 10 characters).");
    const existing = await db.select({ id: warrantyClaims.id }).from(warrantyClaims).where(and(eq(warrantyClaims.bookingId, booking.id), inArray(warrantyClaims.status, ["open", "under_review", "approved"]))).limit(1);
    if (existing.length > 0) return fail(res, 409, "claim_open", "A warranty claim is already open for this booking.");
    const [claim] = await db.insert(warrantyClaims).values({ bookingId: booking.id, customerId: booking.customerId, providerId: booking.providerId ?? undefined, description, evidenceImages: images }).returning();
    if (booking.providerId) await notify({ userId: booking.providerId, type: "warranty_claim", title: "Warranty claim on your job", body: description.slice(0, 140), data: { bookingId: booking.id, claimId: claim.id } });
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
    for (const a of admins) emitToUser(a.id, "warranty:updated", { claimId: claim.id, status: "open", bookingId: booking.id });
    ok(res, { claim: { id: claim.id, status: claim.status } }, 201);
  }),
);

router.get(
  "/customer/warranty-claims",
  requireAuth,
  requireRole("customer"),
  handle(async (req, res) => {
    const rows = await db.select({ claim: warrantyClaims, service: services.name, finalAmount: bookings.finalAmount }).from(warrantyClaims).innerJoin(bookings, eq(bookings.id, warrantyClaims.bookingId)).innerJoin(services, eq(services.id, bookings.serviceId)).where(eq(warrantyClaims.customerId, req.authUser!.id)).orderBy(desc(warrantyClaims.createdAt));
    ok(res, { claims: rows.map((r) => ({ ...r.claim, service: r.service, amount: r.finalAmount })) });
  }),
);

router.get(
  "/customer/disputes",
  requireAuth,
  requireRole("customer"),
  handle(async (req, res) => {
    const rows = await db.select({ dispute: disputes, service: services.name }).from(disputes).innerJoin(bookings, eq(bookings.id, disputes.bookingId)).innerJoin(services, eq(services.id, bookings.serviceId)).where(eq(disputes.customerId, req.authUser!.id)).orderBy(desc(disputes.createdAt));
    ok(res, { disputes: rows.map((r) => ({ ...r.dispute, service: r.service })) });
  }),
);

/* --------------------------- repeat booking ------------------------------- */

router.post(
  "/customer/repeat-booking",
  requireAuth,
  requireRole("customer"),
  handle(async (req, res) => {
    const bookingId = typeof req.body?.bookingId === "string" ? req.body.bookingId : "";
    const [prev] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    if (!prev) return fail(res, 404, "not_found", "Booking not found.");
    if (prev.customerId !== req.authUser!.id) throw new ApiError(403, "forbidden", "You can only repeat your own bookings.");
    const [service] = await db.select().from(services).where(eq(services.id, prev.serviceId)).limit(1);
    ok(res, {
      prefill: {
        service: { id: service?.id, name: service?.name, icon: service?.icon },
        providerId: prev.providerId ?? undefined,
        problemDescription: prev.problemDescription ?? undefined,
        location: {
          latitude: prev.latitude,
          longitude: prev.longitude,
          address: [prev.locationAddress, prev.locationArea, prev.locationCity, prev.locationState].filter(Boolean).join(", "),
          area: prev.locationArea,
          city: prev.locationCity,
          state: prev.locationState,
          postalCode: prev.locationPostalCode,
        },
        notes: prev.notes ?? undefined,
      },
    });
  }),
);

/* ------------------------ legacy compat endpoints -------------------------- */

/**
 * Legacy PATCH /bookings/:id/status (kept for backwards compatibility with
 * the phase-1 Expo app). Maps the old statuses onto the new state machine.
 */
router.patch(
  "/bookings/:id/status",
  requireAuth,
  handle(async (req, res) => {
    const nextStatus = req.body?.status;
    const booking = await getBookingForUser(String(req.params.id), req.authUser!.id);
    const legacyMap: Record<string, string | undefined> = {
      accepted: undefined, // handled via invite accept; direct accepted->confirmed is a no-op guard
      rejected: undefined,
      in_progress: "in_progress",
      completed: "completed",
      cancelled: "cancelled",
    };
    if (!nextStatus || !legacyMap.hasOwnProperty(nextStatus)) return fail(res, 422, "validation", "Invalid booking status.");
    if (nextStatus === "cancelled") {
      try {
        const updated = await cancelBooking(booking, req.authUser!.id, req.authUser!.role, typeof req.body?.reason === "string" ? req.body.reason : undefined);
        res.json({ booking: { ...publicBooking(updated, req.authUser!.id), status: "cancelled" } });
      } catch (error) {
        if (error instanceof ApiError) return fail(res, error.status, error.code, error.message);
        throw error;
      }
      return;
    }
    if (nextStatus === "accepted" || nextStatus === "rejected") return fail(res, 409, "legacy", "Provider acceptance now happens through the request feed (POST /api/provider/requests/:inviteId/accept).");
    providerActionGuard(req, booking);
    try {
      const extra = nextStatus === "in_progress" ? { startedAt: new Date() } : nextStatus === "completed" ? { completedAt: new Date(), finalAmount: typeof req.body?.finalAmount === "string" ? req.body.finalAmount : booking.finalAmount ?? null } : {};
      const updated = await db.transaction(async (tx) => transitionBooking(booking.id, nextStatus, tx, extra as never, { actorId: req.authUser!.id }));
      res.json({ booking: await publicBooking(updated, req.authUser!.id) });
    } catch (error) {
      if (error instanceof ApiError) return fail(res, error.status, error.code, error.message);
      throw error;
    }
  }),
);

export default router;
