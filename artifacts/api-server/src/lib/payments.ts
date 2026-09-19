import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { bookingStatusHistory, bookings, db, payments, providerEarnings, users, type Booking } from "@workspace/db";
import { config, paymentGatewayConfigured } from "../config";

export { paymentGatewayConfigured };
import { ApiError } from "./respond";
import { emitToUser } from "./bus";
import { notify } from "./notify";
import { sendMail, templates } from "./email";
import { logger } from "./logger";

export type PaymentRecord = typeof payments.$inferSelect;

export function inrPaise(inr: number): number {
  return Math.round(inr * 100);
}
export function formatInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

/**
 * Create a payment for a booking.
 * - sandbox gateway (default): server-side simulated checkout. The charge
 *   endpoint settles it; success is decided server-side, never by the client.
 * - razorpay (when keys configured): creates a real order via the API;
 *   the client opens Razorpay Checkout and the server verifies the HMAC
 *   signature server-side before marking paid.
 */
export async function createPayment(booking: Booking, actorId: string, role: string): Promise<PaymentRecord> {
  if (booking.customerId !== actorId && booking.providerId !== actorId && role !== "admin") {
    throw new ApiError(403, "forbidden", "You are not authorized to pay for this booking.");
  }
  if (!["payment_pending", "completed"].includes(booking.status)) {
    throw new ApiError(409, "not_payable", "This booking is not awaiting payment.");
  }
  const amountInr = Number(booking.finalAmount ?? booking.providerQuote ?? booking.estimatedPriceMax ?? booking.amount ?? 0);
  if (!Number.isFinite(amountInr) || amountInr <= 0) {
    throw new ApiError(422, "no_amount", "No agreed amount is set for this booking yet.");
  }
  const amountPaise = inrPaise(amountInr);

  let gatewayOrderId = `sb_${randomBytes(10).toString("hex")}`;
  let gateway = "sandbox";
  if (paymentGatewayConfigured()) {
    gateway = "razorpay";
    gatewayOrderId = await createRazorpayOrder(booking, amountPaise);
  }

  const [payment] = await db
    .insert(payments)
    .values({
      bookingId: booking.id,
      customerId: booking.customerId,
      providerId: booking.providerId ?? undefined,
      gateway,
      gatewayOrderId,
      amountPaise,
      currency: config.razorpayCurrency,
      status: "pending",
    })
    .returning();

  emitToUser(booking.customerId, "payment:updated", { payment: publicPayment(payment), bookingId: booking.id });
  return payment;
}

export function publicPayment(p: PaymentRecord) {
  return {
    id: p.id,
    bookingId: p.bookingId,
    gateway: p.gateway,
    gatewayOrderId: p.gatewayOrderId,
    amountPaise: p.amountPaise,
    amountDisplay: formatInr(p.amountPaise),
    currency: p.currency,
    status: p.status,
    transactionId: p.transactionId,
    failureReason: p.failureReason,
    paidAt: p.paidAt,
    createdAt: p.createdAt,
  };
}

/**
 * Sandbox gateway charge. `outcome` lets the UI test the failure path
 * ("simulate decline"); the default is success. The server always decides
 * and records the result - the client only requests an outcome.
 */
export async function chargeSandbox(payment: PaymentRecord, outcome: "success" | "fail" = "success"): Promise<PaymentRecord> {
  if (payment.status === "paid") throw new ApiError(409, "already_paid", "This payment was already completed.");
  if (payment.gateway !== "sandbox") throw new ApiError(409, "wrong_gateway", "This payment uses a different gateway.");
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, payment.bookingId)).limit(1);
  if (!booking) throw new ApiError(404, "booking_not_found", "Booking not found.");

  if (outcome === "fail") {
    const [updated] = await db.update(payments).set({ status: "failed", failureReason: "Card declined (simulated sandbox decline)", updatedAt: new Date() }).where(eq(payments.id, payment.id)).returning();
    emitToUser(booking.customerId, "payment:updated", { payment: publicPayment(updated), bookingId: booking.id, status: "failed" });
    return updated;
  }

  const now = new Date();
  const transactionId = `txn_${randomBytes(12).toString("hex")}`;
  const [updated] = await db.update(payments).set({ status: "paid", transactionId, paidAt: now, updatedAt: now }).where(eq(payments.id, payment.id)).returning();
  await onPaymentSettled(updated, booking);
  return updated;
}

/** Razorpay order creation (only when keys are configured). */
async function createRazorpayOrder(booking: Booking, amountPaise: number): Promise<string> {
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.razorpayKeyId}:${config.razorpayKeySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: config.razorpayCurrency,
      receipt: booking.id.slice(0, 40),
      notes: { bookingId: booking.id },
    }),
  });
  if (!res.ok) throw new ApiError(502, "gateway_error", `Razorpay order creation failed (${res.status}). The sandbox gateway will be used instead.`);
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new ApiError(502, "gateway_error", "Razorpay did not return an order id.");
  return json.id;
}

/** Server-side verification of a Razorpay Checkout callback (HMAC SHA-256). */
export async function verifyRazorpay(payment: PaymentRecord, body: { razorpay_payment_id?: unknown; razorpay_order_id?: unknown; razorpay_signature?: unknown }): Promise<PaymentRecord> {
  const pid = typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
  const oid = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id : "";
  const sig = typeof body.razorpay_signature === "string" ? body.razorpay_signature : "";
  if (!pid || !oid || !sig) throw new ApiError(422, "missing_fields", "Payment verification fields are missing.");
  if (oid !== payment.gatewayOrderId) throw new ApiError(400, "order_mismatch", "The payment order does not match this payment.");
  const expected = createHmac("sha256", config.razorpayKeySecret).update(`${oid}|${pid}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    const [updated] = await db.update(payments).set({ status: "failed", failureReason: "Signature verification failed", updatedAt: new Date() }).where(eq(payments.id, payment.id)).returning();
    throw new ApiError(400, "bad_signature", "Payment signature verification failed.");
  }
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, payment.bookingId)).limit(1);
  const [updated] = await db.update(payments).set({ status: "paid", transactionId: pid, paidAt: new Date(), updatedAt: new Date() }).where(eq(payments.id, payment.id)).returning();
  if (booking) await onPaymentSettled(updated, booking);
  return updated;
}

/** Marks the booking paid, books provider earnings and notifies everyone. */
async function onPaymentSettled(payment: PaymentRecord, booking: Booking): Promise<void> {
  const feePaise = Math.round((payment.amountPaise * config.platformFeePercent) / 100);
  if (booking.providerId) {
    await db.insert(providerEarnings).values({
      providerId: booking.providerId,
      bookingId: booking.id,
      amountPaise: payment.amountPaise,
      feePaise,
      netPaise: payment.amountPaise - feePaise,
    });
  }
  // booking -> paid (or review_pending handled when the review lands)
  const active = (["payment_pending", "completed", "paid"] as string[]).includes(booking.status);
  if (active && booking.status !== "paid") {
    await db
      .update(bookings)
      .set({ status: "paid" as never, updatedAt: new Date() })
      .where(and(eq(bookings.id, booking.id), eq(bookings.status, booking.status)));
    await db.insert(bookingStatusHistory).values({ bookingId: booking.id, fromStatus: booking.status, toStatus: "paid", reason: "payment received" });
  }
  emitToUser(booking.customerId, "payment:updated", { payment: publicPayment(payment), bookingId: booking.id, status: "paid" });
  if (booking.providerId) emitToUser(booking.providerId, "payment:updated", { payment: publicPayment(payment), bookingId: booking.id, status: "paid" });
  const customer = (await db.select({ email: users.email }).from(users).where(eq(users.id, booking.customerId)).limit(1))[0];
  await notify({
    userId: booking.customerId,
    type: "payment_received",
    title: "Payment received",
    body: `Payment of ${formatInr(payment.amountPaise)} successful. Transaction ${payment.transactionId}.`,
    data: { bookingId: booking.id, paymentId: payment.id },
    email: customer ? templates.paymentConfirmed(customer.email, formatInr(payment.amountPaise), payment.transactionId ?? "") : undefined,
  });
  if (booking.providerId) {
    await notify({
      userId: booking.providerId,
      type: "payment_received",
      title: "Customer paid for your job",
      body: `You earned ${formatInr(payment.amountPaise - feePaise)} after the ${config.platformFeePercent}% platform fee.`,
      data: { bookingId: booking.id },
    });
  }
  if (customer) {
    try {
      await sendMail(templates.paymentConfirmed(customer.email, formatInr(payment.amountPaise), payment.transactionId ?? ""));
    } catch (error) {
      logger.warn({ error }, "payment email failed");
    }
  }
}

export async function refundPayment(payment: PaymentRecord, adminId: string, reason: string): Promise<PaymentRecord> {
  if (payment.status !== "paid") throw new ApiError(409, "not_paid", "Only paid payments can be refunded.");
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, payment.bookingId)).limit(1);
  const [updated] = await db.update(payments).set({ status: "refunded", refundedAt: new Date(), updatedAt: new Date(), failureReason: reason || undefined }).where(eq(payments.id, payment.id)).returning();
  if (booking) {
    await db.update(bookings).set({ status: "payment_pending" as never, updatedAt: new Date() }).where(and(eq(bookings.id, booking.id), eq(bookings.status, "paid")));
    await notify({
      userId: booking.customerId,
      type: "refund_issued",
      title: "Refund issued",
      body: `SmartServe support issued a refund of ${formatInr(payment.amountPaise)}${reason ? ` (${reason})` : ""}.`,
      data: { bookingId: booking.id, paymentId: payment.id },
    });
    if (booking.providerId) {
      await notify({ userId: booking.providerId, type: "refund_issued", title: "Refund issued for your job", body: `The customer was refunded ${formatInr(payment.amountPaise)}.`, data: { bookingId: booking.id } });
    }
  }
  logger.info({ paymentId: payment.id, adminId, reason }, "payment refunded");
  return updated;
}

export async function paymentsForBooking(bookingId: string) {
  return db.select().from(payments).where(eq(payments.bookingId, bookingId)).orderBy(desc(payments.createdAt));
}
