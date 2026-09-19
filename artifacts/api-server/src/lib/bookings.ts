import { and, eq, isNull, or } from "drizzle-orm";
import { bookingStatusHistory, bookings, db, services, users, type Booking } from "@workspace/db";
import { ApiError } from "./respond";
import { emitToUser } from "./bus";
import { notify } from "./notify";
import { templates, sendMail } from "./email";
import { logger } from "./logger";

/**
 * Controlled booking state machine. Only transitions listed here are legal;
 * every change is recorded in booking_status_history and pushed to both
 * parties in real time.
 */
export const TRANSITIONS: Record<string, string[]> = {
  draft: ["pending", "matching", "scheduled", "cancelled"],
  pending: ["matching", "scheduled", "cancelled"],
  matching: ["provider_invited", "accepted", "confirmed", "cancelled", "expired", "failed"],
  provider_invited: ["accepted", "confirmed", "cancelled", "expired", "matching", "failed"],
  scheduled: ["matching", "provider_invited", "cancelled", "accepted"],
  accepted: ["confirmed", "on_the_way", "arrived", "cancelled", "failed"],
  confirmed: ["on_the_way", "arrived", "cancelled"],
  on_the_way: ["arrived", "cancelled"],
  arrived: ["in_progress", "cancelled"],
  in_progress: ["completed", "failed"],
  completed: ["payment_pending", "disputed", "failed"],
  payment_pending: ["paid", "disputed", "cancelled"],
  paid: ["review_pending", "closed", "disputed"],
  review_pending: ["closed"],
  disputed: ["payment_pending", "paid", "closed", "failed"],
  cancelled: [],
  expired: [],
  closed: [],
  failed: [],
};

export const ACTIVE_STATUSES = ["matching", "provider_invited", "accepted", "confirmed", "on_the_way", "arrived", "in_progress"];

export function canTransition(from: string, to: string): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(status: string): boolean {
  return (["cancelled", "expired", "closed", "failed"] as string[]).includes(status);
}

type ChangeOpts = {
  actorId?: string;
  reason?: string;
  actorRole?: string;
  emit?: boolean;
};

/**
 * Loads a booking with FOR UPDATE (transactional), verifies the transition
 * is legal, applies it (plus optional extra fields) and records history.
 * Must run inside db.transaction where concurrency matters (accept race).
 */
/** Both the plain db handle and an open drizzle transaction support these queries. */
type DbOrTx = {
  select: () => any;
  update: (table: unknown) => any;
  insert: (table: unknown) => any;
};

export async function transitionBooking(
  bookingId: string,
  to: string,
  tx: DbOrTx,
  extra?: Partial<typeof bookings.$inferInsert>,
  opts: ChangeOpts = {},
): Promise<Booking> {
  const rows = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update").limit(1);
  const booking = rows[0];
  if (!booking) throw new ApiError(404, "booking_not_found", "Booking not found.");
  if (!canTransition(booking.status, to)) {
    throw new ApiError(409, "invalid_transition", `Cannot move a booking from ${booking.status} to ${to}.`);
  }
  const now = new Date();
  const patch: Partial<typeof bookings.$inferInsert> = { ...extra, status: to as never, updatedAt: now };
  if (to === "cancelled") patch.cancelledAt = now;
  if (to === "expired") patch.cancelledAt = now;
  const [updated] = await tx.update(bookings).set(patch).where(eq(bookings.id, bookingId)).returning();
  await tx.insert(bookingStatusHistory).values({
    bookingId,
    fromStatus: booking.status,
    toStatus: to,
    actorId: opts.actorId ?? null,
    reason: opts.reason ?? null,
  });
  logger.info({ bookingId, from: booking.status, to, actor: opts.actorId }, "booking transitioned");
  if (opts.emit !== false) await emitBookingUpdate(updated, booking);
  return updated;
}

export async function emitBookingUpdate(booking: Booking, prev?: Booking): Promise<void> {
  try {
    const [service] = await db.select({ name: services.name, icon: services.icon }).from(services).where(eq(services.id, booking.serviceId)).limit(1);
    const customer = booking.customerId ? booking : booking;
    const payload = {
      bookingId: booking.id,
      status: booking.status,
      prevStatus: prev?.status,
      service: service ? { name: service.name, icon: service.icon } : undefined,
      updatedAt: booking.updatedAt?.toISOString?.() ?? new Date().toISOString(),
    };
    if (booking.customerId) emitToUser(booking.customerId, "booking:updated", payload);
    if (booking.providerId) emitToUser(booking.providerId, "booking:updated", payload);
  } catch (error) {
    logger.warn({ error }, "emitBookingUpdate failed");
  }
}

/** Convenience: find a booking and verify the actor participates. */
export async function getBookingForUser(bookingId: string, userId: string): Promise<Booking> {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!booking) throw new ApiError(404, "booking_not_found", "Booking not found.");
  if (booking.customerId !== userId && booking.providerId !== userId) {
    throw new ApiError(403, "forbidden", "You are not authorized to access this booking.");
  }
  return booking;
}

/** Cancel policy: free before the provider is on the way; fee applies after. */
export async function cancelBooking(booking: Booking, actorId: string, role: string, reason?: string): Promise<Booking> {
  if (role !== "customer" && role !== "admin") {
    throw new ApiError(403, "forbidden", "Only the customer (or admin) can cancel a booking.");
  }
  if (booking.customerId !== actorId && role !== "admin") {
    throw new ApiError(403, "forbidden", "You can only cancel your own bookings.");
  }
  const feeApplies = ["on_the_way", "arrived", "in_progress"].includes(booking.status);
  const updated = await db.transaction(async (tx) =>
    transitionBooking(booking.id, "cancelled", tx, { notes: reason ? `${booking.notes ? booking.notes + " | " : ""}Cancelled: ${reason}` : booking.notes }, { actorId, reason: reason ?? (feeApplies ? "cancelled after provider departure (fee may apply)" : "customer cancelled") }),
  );
  const [service] = await db.select({ name: services.name }).from(services).where(eq(services.id, updated.serviceId)).limit(1);
  if (updated.providerId) {
    await notify({
      userId: updated.providerId,
      type: "booking_cancelled",
      title: `Booking cancelled - ${service?.name ?? "service"}`,
      body: feeApplies ? "The customer cancelled after you started. A cancellation fee may be due; support will review." : "The customer cancelled the request before you departed.",
      data: { bookingId: updated.id },
    });
  }
  if (updated.customerId && role !== "customer") {
    await notify({ userId: updated.customerId, type: "booking_cancelled", title: "Your booking was cancelled by an administrator", body: reason ?? undefined, data: { bookingId: updated.id } });
  }
  return updated;
}

/** Providers with an in-flight booking are excluded from new matching. */
export async function hasActiveBooking(providerId: string): Promise<boolean> {
  const rows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.providerId, providerId), or(...ACTIVE_STATUSES.map((s) => eq(bookings.status, s as never)))))
    .limit(1);
  return rows.length > 0;
}

export async function bookingDisplayName(serviceId: string): Promise<string | undefined> {
  const [s] = await db.select({ name: services.name }).from(services).where(eq(services.id, serviceId)).limit(1);
  return s?.name;
}

export { isNull };
