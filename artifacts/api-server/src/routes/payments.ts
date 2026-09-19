import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { bookings, db, payments } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { ok, fail, handle, ApiError } from "../lib/respond";
import { createPayment, chargeSandbox, verifyRazorpay, publicPayment, paymentGatewayConfigured } from "../lib/payments";

const router: Router = Router();

/** Create a payment for a booking (customer side). */
router.post(
  "/payments",
  requireAuth,
  handle(async (req, res) => {
    const bookingId = typeof req.body?.bookingId === "string" ? req.body.bookingId : "";
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    if (!booking) return fail(res, 404, "not_found", "Booking not found.");
    if (booking.customerId !== req.authUser!.id && req.authUser!.role !== "admin") {
      return fail(res, 403, "forbidden", "You can only pay for your own bookings.");
    }
    try {
      const payment = await createPayment(booking, req.authUser!.id, req.authUser!.role);
      ok(res, { payment: publicPayment(payment), gateway: paymentGatewayConfigured() ? "razorpay" : "sandbox" }, 201);
    } catch (error) {
      if (error instanceof ApiError) return fail(res, error.status, error.code, error.message);
      throw error;
    }
  }),
);

/**
 * Sandbox gateway: settle the payment. `outcome` may be "fail" to test the
 * failure path; the server decides and records the result.
 */
router.post(
  "/payments/:id/charge",
  requireAuth,
  handle(async (req, res) => {
    const [payment] = await db.select().from(payments).where(eq(payments.id, String(req.params.id))).limit(1);
    if (!payment) return fail(res, 404, "not_found", "Payment not found.");
    if (payment.customerId !== req.authUser!.id && req.authUser!.role !== "admin") return fail(res, 403, "forbidden", "You can only settle your own payment.");
    try {
      const updated = await chargeSandbox(payment, req.body?.outcome === "fail" ? "fail" : "success");
      ok(res, { payment: publicPayment(updated) });
    } catch (error) {
      if (error instanceof ApiError) return fail(res, error.status, error.code, error.message);
      throw error;
    }
  }),
);

/** Razorpay: server-side signature verification after Checkout (only with keys). */
router.post(
  "/payments/:id/verify",
  requireAuth,
  handle(async (req, res) => {
    if (!paymentGatewayConfigured()) return fail(res, 503, "gateway_not_configured", "Razorpay is not configured on this server.");
    const [payment] = await db.select().from(payments).where(eq(payments.id, String(req.params.id))).limit(1);
    if (!payment) return fail(res, 404, "not_found", "Payment not found.");
    if (payment.customerId !== req.authUser!.id && req.authUser!.role !== "admin") return fail(res, 403, "forbidden", "You can only verify your own payment.");
    try {
      const updated = await verifyRazorpay(payment, (req.body ?? {}) as Record<string, unknown>);
      ok(res, { payment: publicPayment(updated) });
    } catch (error) {
      if (error instanceof ApiError) return fail(res, error.status, error.code, error.message);
      throw error;
    }
  }),
);

/** Customer payment history. */
router.get(
  "/customer/payments",
  requireAuth,
  requireRole("customer"),
  handle(async (req, res) => {
    const rows = await db.select().from(payments).where(eq(payments.customerId, req.authUser!.id)).orderBy(desc(payments.createdAt)).limit(100);
    ok(res, { payments: rows.map(publicPayment) });
  }),
);

export default router;
