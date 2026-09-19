import { desc, eq, and, isNull } from "drizzle-orm";
import { db, notifications } from "@workspace/db";
import { emitToUser } from "./bus";
import { sendMail } from "./email";
import { logger } from "./logger";

export type NotifyPayload = {
  userId: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  email?: { subject: string; html: string; to: string };
};

/**
 * Persists an in-app notification, pushes it over the socket and (when
 * requested) queues an email. Failures in any channel never break callers.
 */
export async function notify(payload: NotifyPayload): Promise<string | undefined> {
  try {
    const [row] = await db.insert(notifications).values({
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      body: payload.body ?? null,
      data: payload.data ?? null,
    }).returning({ id: notifications.id });
    try {
      emitToUser(payload.userId, "notification", {
        id: row?.id,
        type: payload.type,
        title: payload.title,
        body: payload.body ?? null,
        data: payload.data ?? null,
        createdAt: new Date().toISOString(),
      });
    } catch {
      /* socket emit best-effort */
    }
    if (payload.email) {
      try {
        await sendMail({ to: payload.email.to, subject: payload.email.subject, html: payload.email.html, text: payload.body });
      } catch (error) {
        logger.warn({ error }, "notification email failed");
      }
    }
    return row?.id;
  } catch (error) {
    logger.warn({ error, userId: payload.userId }, "notify failed");
    return undefined;
  }
}

export async function markNotificationsRead(userId: string, notificationId?: string): Promise<void> {
  if (notificationId) {
    await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, userId), eq(notifications.id, notificationId))).catch(() => {});
    return;
  }
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt))).catch(() => {});
}

export async function listNotifications(userId: string, limit = 30) {
  const rows = await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
  return rows;
}

export async function unreadCount(userId: string): Promise<number> {
  const rows = await db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt))).limit(200);
  return rows.length;
}
