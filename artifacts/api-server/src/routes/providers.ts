import { Router } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  bookings,
  db,
  favorites,
  providerAvailability,
  providerDocuments,
  providerLocations,
  providerPortfolio,
  providerProfiles,
  providerServices,
  providers,
  reviews,
  services,
  studentProfiles,
  studentProviders,
  users,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { ok, fail, handle } from "../lib/respond";
import { distanceKm, toNumber } from "../lib/geo";
import { trustScore } from "../lib/trust";

const router: Router = Router();

async function displayNameOf(userId: string, role: string): Promise<string | undefined> {
  if (role === "customer") return undefined;
  const [p] = role === "provider"
    ? await db.select({ n: providers.displayName }).from(providers).where(eq(providers.userId, userId)).limit(1)
    : await db.select({ n: studentProviders.displayName }).from(studentProviders).where(eq(studentProviders.userId, userId)).limit(1);
  return p?.n;
}

/**
 * Provider search. Filters: service (slug or id), lat/lon, minRating,
 * verified, available, q. Distance and trust score come from real DB rows.
 */
/** Public, sanitized snapshot for the landing page (no phone/email). */
router.get(
  "/providers/public",
  handle(async (_req, res) => {
    const rows = await db
      .select({
        id: users.id,
        role: users.role,
        avatarUrl: users.avatarUrl,
        city: providerProfiles.city,
        verificationStatus: providerProfiles.verificationStatus,
        rating: sql<number>`coalesce(round(avg(${reviews.rating})::numeric, 1), 0)`,
        reviewCount: sql<number>`coalesce(count(${reviews.id})::int, 0)`,
      })
      .from(users)
      .leftJoin(providerProfiles, eq(providerProfiles.userId, users.id))
      .leftJoin(reviews, and(eq(reviews.providerId, users.id), eq(reviews.status, "visible")))
      .where(
        and(
          or(eq(users.role, "provider"), eq(users.role, "student_provider")),
          eq(users.isActive, true),
        ),
      )
      .groupBy(users.id, users.role, users.avatarUrl, providerProfiles.city, providerProfiles.verificationStatus)
      .limit(12);
    const providers: Array<Record<string, unknown> & { id: string }> = [];
    for (const r of rows) {
      const skills = await db
        .select({ name: services.name, slug: services.slug })
        .from(providerServices)
        .innerJoin(services, eq(providerServices.serviceId, services.id))
        .where(eq(providerServices.providerId, r.id))
        .limit(4);
      const t = await trustScore(r.id);
      providers.push({
        id: r.id,
        name: (await displayNameOf(r.id, r.role)) ?? r.id.slice(0, 8),
        role: r.role,
        avatarUrl: r.avatarUrl,
        city: r.city,
        verificationStatus: r.verificationStatus,
        rating: Number(r.rating ?? 0),
        reviewCount: Number(r.reviewCount ?? 0),
        skills,
        trustScore: t.score,
        trustGrade: t.grade,
      });
    }
    providers.sort((a, b) => Number(b.rating) - Number(a.rating));
    return ok(res, { providers: providers.slice(0, 6) });
  }),
);

router.get(
  "/providers",
  requireAuth,
  handle(async (req, res) => {
    const service = typeof req.query.service === "string" ? req.query.service : "";
    const lat = toNumber(req.query.lat);
    const lon = toNumber(req.query.lon);
    const minRating = toNumber(req.query.minRating);
    const verifiedOnly = req.query.verified === "true" || req.query.verified === "1";
    const onlineOnly = req.query.available === "true" || req.query.available === "1";
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const page = Math.max(1, toNumber(req.query.page) ?? 1);
    const pageSize = Math.min(50, toNumber(req.query.limit) ?? 24);

    const base = and(
      or(eq(users.role, "provider"), eq(users.role, "student_provider")),
      eq(users.isActive, true),
      verifiedOnly ? eq(providerProfiles.verificationStatus, "verified") : undefined,
      onlineOnly ? eq(providerAvailability.available, true) : undefined,
      q ? or(ilike(users.email, `%${q}%`), ilike(providerProfiles.bio, `%${q}%`), ilike(providerProfiles.city, `%${q}%`)) : undefined,
    );

    let candidateIds: string[] = [];
    if (service) {
      const bySlug = (await db.select({ id: services.id }).from(services).where(eq(services.slug, service)).limit(1))[0];
      const serviceId = bySlug?.id ?? (service.length === 36 ? service : undefined);
      if (serviceId) {
        const rows = await db
          .select({ providerId: users.id })
          .from(providerServices)
          .innerJoin(users, eq(providerServices.providerId, users.id))
          .where(and(eq(providerServices.serviceId, serviceId), base));
        candidateIds = rows.map((r) => r.providerId);
      }
    } else {
      const rows = await db.select({ id: users.id }).from(users).where(base);
      candidateIds = rows.map((r) => r.id);
    }

    const out: Array<Record<string, unknown> & { id: string }> = [];
    for (const id of candidateIds) {
      const rows = await db
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
          avatarUrl: users.avatarUrl,
          phone: providerProfiles.phone,
          bio: providerProfiles.bio,
          experienceYears: providerProfiles.experienceYears,
          serviceArea: providerProfiles.serviceArea,
          city: providerProfiles.city,
          pincode: providerProfiles.pincode,
          startingPrice: providerProfiles.startingPrice,
          serviceRadiusKm: providerProfiles.serviceRadiusKm,
          verificationStatus: providerProfiles.verificationStatus,
          emergencyAvailable: providerProfiles.emergencyAvailable,
          available: providerAvailability.available,
          lat: providerLocations.latitude,
          lon: providerLocations.longitude,
          rating: sql<number>`coalesce(round(avg(${reviews.rating})::numeric, 1), 0)`,
          reviewCount: sql<number>`coalesce(count(${reviews.id})::int, 0)`,
        })
        .from(users)
        .leftJoin(providerProfiles, eq(providerProfiles.userId, users.id))
        .leftJoin(providerAvailability, eq(providerAvailability.providerId, users.id))
        .leftJoin(providerLocations, eq(providerLocations.providerId, users.id))
        .leftJoin(reviews, and(eq(reviews.providerId, users.id), eq(reviews.status, "visible")))
        .where(eq(users.id, id))
        .groupBy(users.id, users.email, users.role, users.avatarUrl, providerProfiles.phone, providerProfiles.bio, providerProfiles.experienceYears, providerProfiles.serviceArea, providerProfiles.city, providerProfiles.pincode, providerProfiles.startingPrice, providerProfiles.serviceRadiusKm, providerProfiles.verificationStatus, providerProfiles.emergencyAvailable, providerAvailability.available, providerLocations.latitude, providerLocations.longitude)
        .limit(1);
      const r = rows[0];
      if (!r) continue;
      const skillRows = await db
        .select({ name: services.name, slug: services.slug, icon: services.icon })
        .from(providerServices)
        .innerJoin(services, eq(providerServices.serviceId, services.id))
        .where(eq(providerServices.providerId, id));
      const rLat = toNumber(r.lat);
      const rLon = toNumber(r.lon);
      const row = {
        id: r.id,
        name: (await displayNameOf(r.id, r.role)) ?? r.email.split("@")[0],
        email: r.email,
        role: r.role,
        phone: r.phone,
        bio: r.bio,
        avatarUrl: r.avatarUrl,
        experienceYears: r.experienceYears,
        serviceArea: r.serviceArea,
        city: r.city,
        pincode: r.pincode,
        startingPrice: r.startingPrice,
        serviceRadiusKm: r.serviceRadiusKm,
        verificationStatus: r.verificationStatus,
        emergencyAvailable: r.emergencyAvailable,
        available: r.available === true,
        rating: Number(r.rating ?? 0),
        reviewCount: Number(r.reviewCount ?? 0),
        skills: skillRows,
        distanceKm: lat !== undefined && lon !== undefined && rLat !== undefined && rLon !== undefined ? Number(distanceKm(lat, lon, rLat, rLon).toFixed(2)) : null,
      };
      if (minRating !== undefined && row.rating < minRating) continue;
      out.push(row as never);
    }

    out.sort((A, B) => {
      if (A.available !== B.available) return A.available ? -1 : 1;
      const da = (A.distanceKm as number | null) ?? 99999;
      const dbb = (B.distanceKm as number | null) ?? 99999;
      if (da !== dbb) return da - dbb;
      return (B.rating as number) - (A.rating as number);
    });

    const total = out.length;
    const paged = out.slice((page - 1) * pageSize, page * pageSize);
    const withTrust = await Promise.all(
      paged.map(async (p) => {
        const t = await trustScore(p.id);
        return { ...p, trustScore: t.score, trustGrade: t.grade };
      }),
    );
    ok(res, { providers: withTrust, locationRequired: lat === undefined, total, page, limit: pageSize });
  }),
);

/** Full provider profile: stats, reviews, portfolio, documents, trust breakdown. */
router.get(
  "/providers/:id",
  requireAuth,
  handle(async (req, res) => {
    const providerId = String(req.params.id);
    const cLat = toNumber(req.query.lat);
    const cLon = toNumber(req.query.lon);
    const [r] = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        avatarUrl: users.avatarUrl,
        phone: providerProfiles.phone,
        bio: providerProfiles.bio,
        experienceYears: providerProfiles.experienceYears,
        serviceArea: providerProfiles.serviceArea,
        city: providerProfiles.city,
        pincode: providerProfiles.pincode,
        startingPrice: providerProfiles.startingPrice,
        serviceRadiusKm: providerProfiles.serviceRadiusKm,
        verificationStatus: providerProfiles.verificationStatus,
        emergencyAvailable: providerProfiles.emergencyAvailable,
        available: providerAvailability.available,
        lat: providerLocations.latitude,
        lon: providerLocations.longitude,
        rating: sql<number>`coalesce(round(avg(${reviews.rating})::numeric, 1), 0)`,
        reviewCount: sql<number>`coalesce(count(${reviews.id})::int, 0)`,
      })
      .from(users)
      .leftJoin(providerProfiles, eq(providerProfiles.userId, users.id))
      .leftJoin(providerAvailability, eq(providerAvailability.providerId, users.id))
      .leftJoin(providerLocations, eq(providerLocations.providerId, users.id))
      .leftJoin(reviews, and(eq(reviews.providerId, users.id), eq(reviews.status, "visible")))
      .where(and(eq(users.id, providerId), or(eq(users.role, "provider"), eq(users.role, "student_provider")), eq(users.isActive, true)))
      .groupBy(users.id, users.email, users.role, users.avatarUrl, providerProfiles.phone, providerProfiles.bio, providerProfiles.experienceYears, providerProfiles.serviceArea, providerProfiles.city, providerProfiles.pincode, providerProfiles.startingPrice, providerProfiles.serviceRadiusKm, providerProfiles.verificationStatus, providerProfiles.emergencyAvailable, providerAvailability.available, providerLocations.latitude, providerLocations.longitude)
      .limit(1);
    if (!r) return fail(res, 404, "not_found", "Provider not found.");

    const [jobStats] = await db
      .select({
        closedJobs: sql<number>`coalesce(count(*) filter (where ${bookings.status} in ('closed','paid'))::int, 0)`,
        cancelledJobs: sql<number>`coalesce(count(*) filter (where ${bookings.status} = 'cancelled')::int, 0)`,
        activeJobs: sql<number>`coalesce(count(*) filter (where ${bookings.status} in ('accepted','on_the_way','arrived','in_progress'))::int, 0)`,
      })
      .from(bookings)
      .where(eq(bookings.providerId, providerId));

    const skillRows = await db
      .select({ id: services.id, name: services.name, slug: services.slug, icon: services.icon })
      .from(providerServices)
      .innerJoin(services, eq(providerServices.serviceId, services.id))
      .where(eq(providerServices.providerId, providerId));

    const reviewRows = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        serviceQuality: reviews.serviceQuality,
        professionalism: reviews.professionalism,
        timeliness: reviews.timeliness,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        customerName: sql<string>`split_part(${users.email}, '@', 1)`,
        providerResponse: reviews.providerResponse,
      })
      .from(reviews)
      .innerJoin(users, sql`${users.id} = ${reviews.customerId}`)
      .where(and(eq(reviews.providerId, providerId), eq(reviews.status, "visible")))
      .orderBy(desc(reviews.createdAt))
      .limit(50);

    const portfolio = await db.select().from(providerPortfolio).where(eq(providerPortfolio.providerId, providerId)).orderBy(desc(providerPortfolio.createdAt)).limit(12);
    const docs = await db
      .select({ id: providerDocuments.id, docType: providerDocuments.docType, verificationStatus: providerDocuments.verificationStatus, uploadedAt: providerDocuments.uploadedAt })
      .from(providerDocuments)
      .where(eq(providerDocuments.providerId, providerId))
      .orderBy(desc(providerDocuments.uploadedAt))
      .limit(12);
    const trust = await trustScore(providerId);
    const student = (await db.select().from(studentProfiles).where(eq(studentProfiles.userId, providerId)).limit(1))[0] ?? null;
    const fav = req.authUser ? (await db.select({ id: favorites.id }).from(favorites).where(and(eq(favorites.customerId, req.authUser.id), eq(favorites.providerId, providerId))).limit(1)) : [];

    const rLat = toNumber(r.lat);
    const rLon = toNumber(r.lon);
    ok(res, {
      provider: {
        id: r.id,
        name: (await displayNameOf(r.id, r.role)) ?? r.email.split("@")[0],
        email: r.email,
        role: r.role,
        phone: r.phone,
        bio: r.bio,
        avatarUrl: r.avatarUrl,
        experienceYears: r.experienceYears,
        serviceArea: r.serviceArea,
        city: r.city,
        pincode: r.pincode,
        startingPrice: r.startingPrice,
        serviceRadiusKm: r.serviceRadiusKm,
        verificationStatus: r.verificationStatus,
        emergencyAvailable: r.emergencyAvailable,
        available: r.available === true,
        rating: Number(r.rating ?? 0),
        reviewCount: Number(r.reviewCount ?? 0),
        skills: skillRows,
        distanceKm: cLat !== undefined && cLon !== undefined && rLat !== undefined && rLon !== undefined ? Number(distanceKm(cLat, cLon, rLat, rLon).toFixed(2)) : null,
        trustScore: trust.score,
        trustGrade: trust.grade,
        trust,
        studentProfile: student ? { college: student.college, degree: student.degree, partTimeHours: student.partTimeHours, isStudentVerified: student.isStudentVerified } : null,
        isFavorite: fav.length > 0,
      },
      stats: { closedJobs: Number(jobStats?.closedJobs ?? 0), cancelledJobs: Number(jobStats?.cancelledJobs ?? 0), activeJobs: Number(jobStats?.activeJobs ?? 0) },
      reviews: reviewRows,
      portfolio,
      documents: docs,
    });
  }),
);

export default router;
