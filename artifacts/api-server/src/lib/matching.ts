import { and, asc, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import {
  bookingStatusHistory,
  bookings,
  db,
  providerAvailability,
  providerLocations,
  providerProfiles,
  providerRequestInvites,
  providerServices,
  reviews,
  services,
  users,
  type Booking,
} from "@workspace/db";
import { config } from "../config";
import { distanceKm, toNumber } from "./geo";
import { emitToUser, emitToProviders } from "./bus";
import { notify } from "./notify";
import { transitionBooking } from "./bookings";
import { ApiError } from "./respond";
import { logger } from "./logger";
import { templates } from "./email";

type Candidate = {
  providerId: string;
  name: string;
  distance: number | null;
  verified: boolean;
  emergency: boolean;
  rating: number;
};

async function customerDisplayName(userId: string): Promise<string> {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return row?.email?.split("@")[0] ?? "A customer";
}

/**
 * Select eligible providers for a booking.
 * batch 1 -> within the provider's own service radius
 * batch 2 -> 2x radius
 * batch 3+ -> any online provider with the skill
 * Eligible = right skill, online/available, no active booking, account active.
 */
async function selectCandidates(booking: Booking, batch: number): Promise<Candidate[]> {
  const cLat = toNumber(booking.latitude);
  const cLon = toNumber(booking.longitude);
  const hasCoords = cLat !== undefined && cLon !== undefined;

  const rows = await db
    .select({
      providerId: users.id,
      name: users.email,
      role: users.role,
      active: users.isActive,
      lat: providerLocations.latitude,
      lon: providerLocations.longitude,
      verified: providerProfiles.verificationStatus,
      emergency: providerProfiles.emergencyAvailable,
      skill: providerServices.serviceId,
      available: providerAvailability.available,
      rating: sql<number>`coalesce(round(avg(${reviews.rating})::numeric, 1), 0)`,
    })
    .from(users)
    .innerJoin(providerServices, and(eq(providerServices.providerId, users.id), eq(providerServices.serviceId, booking.serviceId)))
    .innerJoin(providerAvailability, eq(providerAvailability.providerId, users.id))
    .innerJoin(providerProfiles, eq(providerProfiles.userId, users.id))
    .leftJoin(providerLocations, eq(providerLocations.providerId, users.id))
    .leftJoin(reviews, and(eq(reviews.providerId, users.id), eq(reviews.status, "visible")))
    .where(
      and(
        or(eq(users.role, "provider"), eq(users.role, "student_provider")),
        eq(users.isActive, true),
        eq(providerAvailability.available, true),
      ),
    )
    .groupBy(
      users.id,
      users.email,
      users.role,
      users.isActive,
      providerLocations.latitude,
      providerLocations.longitude,
      providerProfiles.verificationStatus,
      providerProfiles.emergencyAvailable,
      providerServices.serviceId,
      providerAvailability.available,
    );

  const out: Candidate[] = [];
  for (const r of rows) {
    if (!r.active || r.available !== true) continue;
    const distance = hasCoords && r.lat && r.lon ? distanceKm(cLat!, cLon!, Number(r.lat), Number(r.lon)) : null;
    const radius = 10; // default km; widened per batch
    const inRadius = distance === null ? batch >= 3 : distance <= radius * batch;
    if (!inRadius) continue;
    out.push({
      providerId: r.providerId,
      name: r.name,
      distance,
      verified: r.verified === "verified",
      emergency: r.emergency === true,
      rating: Number(r.rating ?? 0),
    });
  }
  // Emergency requests strongly prefer providers who handle emergencies.
  out.sort((a, b) => {
    if (booking.isEmergency && a.emergency !== b.emergency) return a.emergency ? -1 : 1;
    if (a.verified !== b.verified) return a.verified ? -1 : 1;
    const da = a.distance ?? 9999;
    const dbb = b.distance ?? 9999;
    if (da !== dbb) return da - dbb;
    if (a.rating !== b.rating) return b.rating - a.rating;
    return 0;
  });
  return out;
}

async function activeInvitedCount(bookingId: string): Promise<number> {
  const rows = await db
    .select({ id: providerRequestInvites.id })
    .from(providerRequestInvites)
    .where(and(eq(providerRequestInvites.bookingId, bookingId), eq(providerRequestInvites.status, "invited")))
    .limit(100);
  return rows.length;
}

async function maxBatch(bookingId: string): Promise<number> {
  const rows = await db.select({ batch: providerRequestInvites.batch }).from(providerRequestInvites).where(eq(providerRequestInvites.bookingId, bookingId)).limit(500);
  return rows.reduce((m, r) => Math.max(m, r.batch ?? 0), 0);
}

/**
 * Broadcast a booking to the next batch of eligible providers.
 * Called when a booking enters matching, and again by the scheduler after
 * every batch fully expires (reassignment).
 */
export async function startMatching(bookingId: string, batch?: number): Promise<{ batch: number; invited: number }> {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!booking) throw new ApiError(404, "booking_not_found", "Booking not found.");
  if (!["matching", "scheduled", "provider_invited"].includes(booking.status)) {
    return { batch: 0, invited: 0 };
  }
  const b = batch ?? (await maxBatch(bookingId)) + 1;
  if (b > config.maxMatchBatches) {
    await expireBooking(booking, "No providers responded after all matching attempts.");
    return { batch: b, invited: 0 };
  }

  const candidates = await selectCandidates(booking, b);
  if (candidates.length === 0) {
    // no one eligible in this radius tier -> jump to next tier (or expire)
    if (b < config.maxMatchBatches) return startMatching(bookingId, b + 1);
    await expireBooking(booking, "No available providers with this skill were found nearby. Try again in a few minutes or widen the service area.");
    return { batch: b, invited: 0 };
  }

  const top = candidates.slice(0, config.matchBatchSize);
  const customerName = await customerDisplayName(booking.customerId);
  const [service] = await db.select().from(services).where(eq(services.id, booking.serviceId)).limit(1);

  await db.transaction(async (tx) => {
    for (const c of top) {
      await tx
        .insert(providerRequestInvites)
        .values({ bookingId, providerId: c.providerId, batch: b, status: "invited" })
        .onConflictDoNothing();
    }
    if (booking.status !== "provider_invited" && booking.status !== "accepted") {
      await tx.update(bookings).set({ status: "provider_invited" as never, updatedAt: new Date() }).where(and(eq(bookings.id, bookingId), or(eq(bookings.status, "matching"), eq(bookings.status, "scheduled"))));
    }
  });

  const invites = await db
    .select()
    .from(providerRequestInvites)
    .where(and(eq(providerRequestInvites.bookingId, bookingId), eq(providerRequestInvites.batch, b), eq(providerRequestInvites.status, "invited")));

  const payload = {
    bookingId,
    batch: b,
    service: { id: service?.id, name: service?.name, icon: service?.icon },
    customer: { name: customerName },
    problem: booking.problemDescription ?? undefined,
    urgency: booking.urgency ?? (booking.isEmergency ? "critical" : "medium"),
    emergency: booking.isEmergency,
    location: {
      address: [booking.locationAddress, booking.locationArea, booking.locationCity, booking.locationState].filter(Boolean).join(", ") || booking.address || undefined,
      latitude: booking.latitude,
      longitude: booking.longitude,
      postalCode: booking.locationPostalCode,
    },
    scheduledAt: booking.scheduledAt,
    estimate: booking.estimatedPriceMin ? { min: Number(booking.estimatedPriceMin), max: Number(booking.estimatedPriceMax ?? booking.estimatedPriceMin) } : undefined,
    expiresInSec: config.requestTimeoutSec,
  };

  for (const inv of invites) {
    const candidate = top.find((c) => c.providerId === inv.providerId);
    emitToUser(inv.providerId, "provider:request", { invite: { id: inv.id, status: inv.status }, ...payload, distanceKm: candidate?.distance ?? undefined });
    await notify({
      userId: inv.providerId,
      type: "provider_request",
      title: `New request: ${service?.name ?? "service"}`,
      body: `${customerName} in ${payload.location?.address ?? "your area"} - respond within ${config.requestTimeoutSec}s.`,
      data: { bookingId, inviteId: inv.id },
      email: {
        to: (await db.select({ email: users.email }).from(users).where(eq(users.id, inv.providerId)).limit(1))[0]?.email ?? "",
        subject: `New service request: ${service?.name}`,
        html: "",
      },
    });
  }
  // customer sees matching progress in real time
  emitToUser(booking.customerId, "matching:progress", { bookingId, batch: b, invited: invites.length, status: "provider_invited" });
  logger.info({ bookingId, batch: b, invited: invites.length }, "broadcast batch");
  return { batch: b, invited: invites.length };
}

/** Scheduler hook: expire stale invites and reassign when a batch is done. */
export async function processTimeouts(): Promise<void> {
  const cutoff = new Date(Date.now() - config.requestTimeoutSec * 1000);
  const stale = await db
    .select({ invite: providerRequestInvites, booking: bookings })
    .from(providerRequestInvites)
    .innerJoin(bookings, eq(bookings.id, providerRequestInvites.bookingId))
    .where(and(eq(providerRequestInvites.status, "invited"), lte(providerRequestInvites.invitedAt, cutoff), or(eq(bookings.status, "matching"), eq(bookings.status, "provider_invited"))));

  const touched = new Set<string>();
  for (const { invite } of stale) {
    await db.update(providerRequestInvites).set({ status: "expired", respondedAt: new Date() }).where(eq(providerRequestInvites.id, invite.id));
    emitToUser(invite.providerId, "provider:request_expired", { bookingId: invite.bookingId, inviteId: invite.id });
    if (!touched.has(invite.bookingId)) {
      touched.add(invite.bookingId);
      await maybeReassign(invite.bookingId);
    }
  }
}

async function maybeReassign(bookingId: string): Promise<void> {
  const open = await activeInvitedCount(bookingId);
  if (open > 0) return;
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!booking || !["matching", "provider_invited"].includes(booking.status)) return;
  const currentBatch = await maxBatch(bookingId);
  if (currentBatch >= config.maxMatchBatches) {
    await expireBooking(booking, "No providers responded in time. You can re-request the service or try a nearby location.");
    return;
  }
  emitToUser(booking.customerId, "matching:progress", { bookingId, batch: currentBatch + 1, status: "reassigning" });
  await startMatching(bookingId, currentBatch + 1);
}

async function expireBooking(booking: Booking, message: string): Promise<void> {
  try {
    const updated = await db.transaction(async (tx) => transitionBooking(booking.id, "expired", tx, undefined, { reason: message }));
    await notify({
      userId: booking.customerId,
      type: "booking_expired",
      title: "We could not find an available provider",
      body: message,
      data: { bookingId: updated.id },
    });
  } catch (error) {
    logger.warn({ error, bookingId: booking.id }, "expireBooking failed");
  }
}

/**
 * Provider accepts an invitation. The whole thing runs in one transaction
 * with the booking row locked, so if two providers accept simultaneously
 * exactly one wins; the loser gets a 409.
 */
export async function acceptInvite(inviteId: string, providerId: string, quote?: string): Promise<{ booking: Booking; invite: typeof providerRequestInvites.$inferSelect }> {
  return db.transaction(async (tx) => {
    const [invite] = await tx.select().from(providerRequestInvites).where(eq(providerRequestInvites.id, inviteId)).for("update").limit(1);
    if (!invite) throw new ApiError(404, "invite_not_found", "Request not found.");
    if (invite.providerId !== providerId) throw new ApiError(403, "forbidden", "This request was sent to a different provider.");
    if (invite.status !== "invited") {
      throw new ApiError(409, "invite_closed", "This request is no longer available - it was accepted by another provider or expired.");
    }

    // Lock the booking and check it is still open for assignment.
    const bookingRows = await tx.select().from(bookings).where(eq(bookings.id, invite.bookingId)).for("update").limit(1);
    const booking = bookingRows[0];
    if (!booking) throw new ApiError(404, "booking_not_found", "Booking not found.");
    if (!["matching", "provider_invited", "scheduled"].includes(booking.status)) {
      throw new ApiError(409, "already_assigned", "This request was already assigned to another provider.");
    }
    const [service] = await tx.select().from(services).where(eq(services.id, booking.serviceId)).limit(1);

    const now = new Date();
    // Everyone else loses this request.
    await tx.update(providerRequestInvites).set({ status: "expired", respondedAt: now }).where(and(eq(providerRequestInvites.bookingId, invite.bookingId), eq(providerRequestInvites.status, "invited"), sql`${providerRequestInvites.id} <> ${invite.id}`));
    const [winner] = await tx.update(providerRequestInvites).set({ status: "accepted", respondedAt: now, quote: quote ?? null }).where(eq(providerRequestInvites.id, invite.id)).returning();
    const [updated] = await tx
      .update(bookings)
      .set({
        status: "accepted" as never,
        providerId,
        matchedAt: now,
        acceptedAt: now,
        providerQuote: quote ?? booking.providerQuote,
        warrantyDays: service?.warrantyDays ?? booking.warrantyDays,
        updatedAt: now,
      })
      .where(eq(bookings.id, invite.bookingId))
      .returning();
    await tx.insert(bookingStatusHistory).values({ bookingId: booking.id, fromStatus: booking.status, toStatus: "accepted", actorId: providerId, reason: "provider accepted" });

    return { booking: updated, invite: winner };
  }).then(async ({ booking, invite }) => {
    const [provider] = await db.select({ displayName: users.email }).from(users).where(eq(users.id, providerId)).limit(1);
    const [service] = await db.select().from(services).where(eq(services.id, booking.serviceId)).limit(1);
    // Tell the customer + all other invited providers immediately.
    emitToUser(booking.customerId, "provider:accepted", { bookingId: booking.id, providerId, service: { name: service?.name, icon: service?.icon }, providerName: provider?.displayName });
    const others = await db.select({ providerId: providerRequestInvites.providerId }).from(providerRequestInvites).where(and(eq(providerRequestInvites.bookingId, booking.id), sql`${providerRequestInvites.providerId} <> ${providerId}`, isNull(providerRequestInvites.respondedAt)));
    emitToProviders(others.map((o) => o.providerId), "provider:request_gone", { bookingId: booking.id, reason: "accepted" });
    await notify({
      userId: booking.customerId,
      type: "provider_accepted",
      title: "A provider accepted your request",
      body: `${service?.name ?? "Your service"} has been accepted. You will be notified when the provider is on the way.`,
      data: { bookingId: booking.id },
    });
    await notify({
      userId: providerId,
      type: "booking_assigned",
      title: `You were assigned a ${service?.name ?? "service"} job`,
      body: "Open the job to view the customer location and start your trip.",
      data: { bookingId: booking.id },
    });
    const customerEmail = (await db.select({ email: users.email }).from(users).where(eq(users.id, booking.customerId)).limit(1))[0]?.email;
    if (customerEmail) {
      const when = booking.scheduledAt ? booking.scheduledAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "as soon as possible";
      void (await import("./email")).sendMail(templates.bookingConfirmed(customerEmail, service?.name ?? "service", provider?.displayName ?? "A provider", when));
    }
    return { booking, invite };
  });
}

export async function rejectInvite(inviteId: string, providerId: string, reason?: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [invite] = await tx.select().from(providerRequestInvites).where(eq(providerRequestInvites.id, inviteId)).limit(1);
    if (!invite) throw new ApiError(404, "invite_not_found", "Request not found.");
    if (invite.providerId !== providerId) throw new ApiError(403, "forbidden", "This request was sent to a different provider.");
    if (invite.status !== "invited") throw new ApiError(409, "invite_closed", "This request is no longer available.");
    await tx.update(providerRequestInvites).set({ status: "rejected", respondedAt: new Date(), rejectReason: reason ?? null }).where(eq(providerRequestInvites.id, invite.id));
  });
  const bookingId = await getBookingOfInvite(inviteId);
  if (!bookingId) return;
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (booking) emitToUser(booking.customerId, "matching:progress", { bookingId, status: "provider_rejected", providerId });
  await maybeReassign(bookingId);
}

async function getBookingOfInvite(inviteId: string): Promise<string | undefined> {
  const [r] = await db.select({ bookingId: providerRequestInvites.bookingId }).from(providerRequestInvites).where(eq(providerRequestInvites.id, inviteId)).limit(1);
  return r?.bookingId;
}

/** Scheduler hook: promote due scheduled bookings into the matching flow. */
export async function promoteScheduled(): Promise<void> {
  const due = await db.select().from(bookings).where(and(eq(bookings.status, "scheduled"), lte(bookings.scheduledAt, new Date()))).limit(50);
  for (const booking of due) {
    try {
      await db.transaction(async (tx) => transitionBooking(booking.id, "matching", tx, undefined, { reason: "scheduled time reached" }));
      await startMatching(booking.id, 1);
    } catch (error) {
      logger.warn({ error, bookingId: booking.id }, "promoteScheduled failed");
    }
  }
}
