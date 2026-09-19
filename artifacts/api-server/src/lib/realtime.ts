import { Server, type Socket } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { and, eq, isNull } from "drizzle-orm";
import { bookings, db, messages } from "@workspace/db";
import { findUserForToken } from "./auth";
import { logger } from "./logger";
import { setEmitter } from "./bus";

const CHAT_OPEN_STATUSES = ["accepted", "confirmed", "on_the_way", "arrived", "in_progress", "completed", "payment_pending", "paid", "disputed"];

/**
 * Socket.IO wiring.
 * - Auth via handshake token (same bearer tokens as the REST API).
 * - One room per user; every connected socket of a user joins it, so two
 *   browser tabs of the same account both receive identical updates.
 * - Client events: chat:send, chat:read, ping.
 */
export function attachRealtime(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: true, methods: ["GET", "POST"] },
    serveClient: true,
    pingTimeout: 20000,
    pingInterval: 10000,
  });

  io.use(async (socket, next) => {
    try {
      const token = (socket.handshake.auth?.token as string | undefined) ?? undefined;
      if (!token) return next(new Error("Authentication required"));
      const user = await findUserForToken(token);
      if (!user) return next(new Error("Invalid or expired session"));
      socket.data.userId = user.id;
      socket.data.role = user.role;
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error("Socket auth failed"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);
    socket.emit("connected", { userId, at: new Date().toISOString() });

    socket.on("ping", () => socket.emit("pong", new Date().toISOString()));

    socket.on(
      "chat:send",
      async (payload: { bookingId?: unknown; text?: unknown; imageUrl?: unknown }, ack?: (r: unknown) => void) => {
        try {
          const bookingId = typeof payload?.bookingId === "string" ? payload.bookingId : "";
          const text = typeof payload?.text === "string" ? payload.text.trim() : "";
          const imageUrl = typeof payload?.imageUrl === "string" ? payload.imageUrl : null;
          if (!bookingId || (!text && !imageUrl)) return ack?.({ ok: false, error: "A message is required." });
          if (text.length > 4000 || (imageUrl && imageUrl.length > 6_000_000)) return ack?.({ ok: false, error: "Message too large." });
          const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
          if (!booking) return ack?.({ ok: false, error: "Booking not found." });
          const isCustomer = booking.customerId === userId;
          const isProvider = booking.providerId === userId;
          if (!isCustomer && !isProvider) return ack?.({ ok: false, error: "You are not part of this booking." });
          if (!CHAT_OPEN_STATUSES.includes(booking.status)) {
            return ack?.({ ok: false, error: "Chat opens once the provider accepts the booking." });
          }
          const [message] = await db
            .insert(messages)
            .values({
              bookingId,
              senderId: userId,
              text: text || null,
              imageUrl: imageUrl && imageUrl.startsWith("/uploads/") ? imageUrl : null,
            })
            .returning();
          io.to(`user:${userId}`).emit("chat:message", { message });
          const other = isCustomer ? booking.providerId : booking.customerId;
          if (other) io.to(`user:${other}`).emit("chat:message", { message });
          ack?.({ ok: true, message });
        } catch (error) {
          logger.warn({ error, userId }, "chat:send failed");
          ack?.({ ok: false, error: "Could not send the message." });
        }
      },
    );

    socket.on("chat:read", async (payload: { bookingId?: unknown }) => {
      try {
        const bookingId = typeof payload?.bookingId === "string" ? payload.bookingId : "";
        if (!bookingId) return;
        const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
        if (!booking || (booking.customerId !== userId && booking.providerId !== userId)) return;
        const other = booking.customerId === userId ? booking.providerId : booking.customerId;
        if (!other) return;
        const updated = await db
          .update(messages)
          .set({ readAt: new Date() })
          .where(and(eq(messages.bookingId, bookingId), eq(messages.senderId, other), isNull(messages.readAt)))
          .returning({ id: messages.id });
        io.to(`user:${other}`).emit("chat:read", { bookingId, by: userId, count: updated.length });
      } catch (error) {
        logger.warn({ error, userId }, "chat:read failed");
      }
    });
  });

  setEmitter((userId, event, payload) => {
    io.to(`user:${userId}`).emit(event, payload);
  });

  return io;
}
