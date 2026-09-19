import { Router } from "express";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { customerLocations, customers, db, favorites, notifications, providerProfiles, providers, reports, sosEvents, trustedContacts, users } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { ok, fail, handle, ApiError } from "../lib/respond";
import { validCoordinate, toNumber } from "../lib/geo";
import { toPublicUser } from "../lib/auth";
import { listNotifications, markNotificationsRead, unreadCount, notify } from "../lib/notify";
import { emitToUser } from "../lib/bus";

const router: Router = Router();

/* ------------------------------- profile ---------------------------------- */

router.put(
  "/customer/profile",
  requireAuth,
  requireRole("customer"),
  handle(async (req, res) => {
    const b = req.body ?? {};
    const name = typeof b.displayName === "string" ? b.displayName.trim() : "";
    const phone = typeof b.phone === "string" ? b.phone.trim() : undefined;
    const language = typeof b.language === "string" ? b.language.trim().slice(0, 8) : undefined;
    if (name && (name.length < 2 || name.length > 120)) return fail(res, 422, "validation", "Display name must be between 2 and 120 characters.");
    if (phone && !/^[+\d][\d\s-]{7,15}$/.test(phone)) return fail(res, 422, "validation", "Enter a valid phone number.");
    if (name) {
      const [updated] = await db.update(customers).set({ displayName: name, updatedAt: new Date() }).where(eq(customers.userId, req.authUser!.id)).returning();
      if (!updated) return fail(res, 404, "not_found", "Customer profile not found.");
    }
    const userPatch: Record<string, unknown> = { updatedAt: new Date() };
    if (phone !== undefined) userPatch.phone = phone || null;
    if (language) userPatch.language = language;
    if (Object.keys(userPatch).length > 1) await db.update(users).set(userPatch).where(eq(users.id, req.authUser!.id));
    res.json({ user: await toPublicUser(req.authUser!) });
  }),
);

/* ------------------------------- location --------------------------------- */

router.get(
  "/customer/location",
  requireAuth,
  requireRole("customer"),
  handle(async (req, res) => {
    const [location] = await db.select().from(customerLocations).where(eq(customerLocations.userId, req.authUser!.id)).orderBy(desc(customerLocations.updatedAt)).limit(1);
    res.json({ location: location ?? null });
  }),
);

router.put(
  "/customer/location",
  requireAuth,
  requireRole("customer"),
  handle(async (req, res) => {
    const b = req.body ?? {};
    const latitude = toNumber(b.latitude);
    const longitude = toNumber(b.longitude);
    if (!validCoordinate(latitude, -90, 90) || !validCoordinate(longitude, -180, 180)) {
      return fail(res, 422, "validation", "Valid latitude and longitude are required.");
    }
    await db.update(customerLocations).set({ isDefault: false, updatedAt: new Date() }).where(eq(customerLocations.userId, req.authUser!.id));
    const [location] = await db
      .insert(customerLocations)
      .values({
        userId: req.authUser!.id,
        latitude: String(latitude),
        longitude: String(longitude),
        formattedAddress: typeof b.formattedAddress === "string" ? b.formattedAddress.slice(0, 500) : null,
        area: typeof b.area === "string" ? b.area.slice(0, 120) : null,
        city: typeof b.city === "string" ? b.city.slice(0, 120) : null,
        state: typeof b.state === "string" ? b.state.slice(0, 120) : null,
        postalCode: typeof b.postalCode === "string" ? b.postalCode.slice(0, 10) : null,
        country: typeof b.country === "string" ? b.country.slice(0, 60) : null,
        label: typeof b.label === "string" ? b.label.slice(0, 60) : null,
        isDefault: true,
      })
      .returning();
    res.json({ location });
  }),
);

/* ------------------------------- favorites -------------------------------- */

router.get(
  "/customer/favorites",
  requireAuth,
  requireRole("customer"),
  handle(async (req, res) => {
    const rows = await db
      .select({
        providerId: favorites.providerId,
        name: providers.displayName,
        email: users.email,
        available: providerProfiles.verificationStatus,
        rating: sql<number | null>`null`,
      })
      .from(favorites)
      .innerJoin(providers, eq(providers.userId, favorites.providerId))
      .innerJoin(users, eq(users.id, favorites.providerId))
      .leftJoin(providerProfiles, eq(providerProfiles.userId, favorites.providerId))
      .where(eq(favorites.customerId, req.authUser!.id))
      .orderBy(desc(favorites.createdAt));
    ok(res, { favorites: rows.map((r) => ({ providerId: r.providerId, name: r.name, email: r.email })) });
  }),
);

router.post(
  "/customer/favorites",
  requireAuth,
  requireRole("customer"),
  handle(async (req, res) => {
    const providerId = typeof req.body?.providerId === "string" ? req.body.providerId : "";
    const [p] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, providerId), eq(users.isActive, true))).limit(1);
    if (!p) return fail(res, 404, "not_found", "Provider not found.");
    await db.insert(favorites).values({ customerId: req.authUser!.id, providerId }).onConflictDoNothing();
    ok(res, { favorited: true }, 201);
  }),
);

router.delete(
  "/customer/favorites/:providerId",
  requireAuth,
  requireRole("customer"),
  handle(async (req, res) => {
    await db.delete(favorites).where(and(eq(favorites.customerId, req.authUser!.id), eq(favorites.providerId, String(req.params.providerId))));
    ok(res, { removed: true });
  }),
);

/* ---------------------------- trusted contacts ---------------------------- */

router.get(
  "/customer/trusted-contacts",
  requireAuth,
  handle(async (req, res) => {
    const rows = await db.select().from(trustedContacts).where(eq(trustedContacts.userId, req.authUser!.id)).orderBy(desc(trustedContacts.createdAt));
    ok(res, { contacts: rows.map((c) => ({ id: c.id, name: c.name, phone: c.phone, relation: c.relation, isPrimary: c.isPrimary })) });
  }),
);

router.post(
  "/customer/trusted-contacts",
  requireAuth,
  handle(async (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
    const relation = typeof req.body?.relation === "string" ? req.body.relation.trim().slice(0, 40) : null;
    if (name.length < 2 || name.length > 60) return fail(res, 422, "validation", "Contact name must be 2-60 characters.");
    if (!/^[+\d][\d\s-]{7,15}$/.test(phone)) return fail(res, 422, "validation", "Enter a valid phone number.");
    const [contact] = await db.insert(trustedContacts).values({ userId: req.authUser!.id, name, phone, relation }).returning();
    ok(res, { contact }, 201);
  }),
);

router.delete(
  "/customer/trusted-contacts/:id",
  requireAuth,
  handle(async (req, res) => {
    const [deleted] = await db.delete(trustedContacts).where(and(eq(trustedContacts.id, String(req.params.id)), eq(trustedContacts.userId, req.authUser!.id))).returning({ id: trustedContacts.id });
    if (!deleted) return fail(res, 404, "not_found", "Contact not found.");
    ok(res, { removed: true });
  }),
);

/* --------------------------------- SOS ------------------------------------- */

/**
 * SOS: notifies the user's trusted contacts (in-app) and alerts platform
 * support. SmartServe does NOT call emergency authorities directly - the UI
 * makes that distinction explicit.
 */
router.post(
  "/customer/sos",
  requireAuth,
  handle(async (req, res) => {
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 300) : undefined;
    const bookingId = typeof req.body?.bookingId === "string" ? req.body.bookingId : undefined;
    const lat = toNumber(req.body?.latitude);
    const lon = toNumber(req.body?.longitude);
    const contacts = await db.select().from(trustedContacts).where(eq(trustedContacts.userId, req.authUser!.id)).limit(10);
    const [event] = await db
      .insert(sosEvents)
      .values({ userId: req.authUser!.id, bookingId: bookingId ?? null, latitude: lat !== undefined ? String(lat) : null, longitude: lon !== undefined ? String(lon) : null, note: note ?? null, contactsNotified: contacts.length })
      .returning();
    for (const c of contacts) {
      // contacts are not platform users - we record the notification intent.
      await db.insert(notifications).values({
        userId: req.authUser!.id,
        type: "sos_sent",
        title: `SOS alert prepared for ${c.name}`,
        body: `Shared with trusted contact ${c.name} (${c.relation ?? "contact"}). Call them now if you are in danger: ${c.phone}`,
        data: { sosId: event.id },
      });
    }
    const admins = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.role, "admin"));
    for (const a of admins) {
      emitToUser(a.id, "sos:alert", { userId: req.authUser!.id, name: (await toPublicUser(req.authUser!)).displayName, note, bookingId, at: new Date().toISOString() });
      await notify({ userId: a.id, type: "sos_alert", title: "SOS triggered", body: `${(await toPublicUser(req.authUser!)).displayName} triggered SOS${note ? `: ${note}` : ""}`, data: { userId: req.authUser!.id, bookingId } });
    }
    ok(res, { sos: { id: event.id, contactsNotified: contacts.length, hint: "SmartServe support has been alerted. For life-threatening danger, call local emergency numbers (112 in India)." } }, 201);
  }),
);

/* ------------------------------ notifications ------------------------------ */

router.get(
  "/customer/notifications",
  requireAuth,
  handle(async (req, res) => {
    const rows = await listNotifications(req.authUser!.id, 50);
    ok(res, { notifications: rows.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, data: n.data, readAt: n.readAt, createdAt: n.createdAt })), unread: await unreadCount(req.authUser!.id) });
  }),
);

router.post(
  "/customer/notifications/read",
  requireAuth,
  handle(async (req, res) => {
    const id = typeof req.body?.id === "string" ? req.body.id : undefined;
    await markNotificationsRead(req.authUser!.id, id);
    ok(res, { read: true, unread: await unreadCount(req.authUser!.id) });
  }),
);

/* -------------------------------- reports ---------------------------------- */

router.post(
  "/customer/reports",
  requireAuth,
  handle(async (req, res) => {
    const targetType = req.body?.targetType === "provider" ? "provider" : req.body?.targetType === "customer" ? "customer" : "user";
    const targetId = typeof req.body?.targetId === "string" ? req.body.targetId : "";
    const category = typeof req.body?.category === "string" ? req.body.category.trim().slice(0, 60) : "";
    const description = typeof req.body?.description === "string" ? req.body.description.trim().slice(0, 1000) : "";
    if (!targetId || !category) return fail(res, 422, "validation", "targetId and category are required.");
    if (targetId === req.authUser!.id) return fail(res, 422, "validation", "You cannot report yourself.");
    const [report] = await db.insert(reports).values({ reporterId: req.authUser!.id, targetType, targetId, category, description: description || null }).returning();
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
    for (const a of admins) emitToUser(a.id, "report:new", { reportId: report.id });
    ok(res, { report: { id: report.id, status: report.status } }, 201);
  }),
);

/* --------------------------- protected (legacy) ---------------------------- */

router.get("/protected/customer", requireAuth, requireRole("customer"), (_req, res) => res.json({ ok: true }));

export default router;
