import { and, count, eq, inArray, sql } from "drizzle-orm";
import {
  bookings,
  db,
  providerDocuments,
  providerPortfolio,
  providerProfiles,
  providerRequestInvites,
  reviews,
  users,
} from "@workspace/db";

export type TrustFactor = { factor: string; points: number; max: number; note: string };
export type TrustScore = { score: number; grade: string; factors: TrustFactor[]; explanation: string };

const GRADES: Array<[number, string]> = [
  [90, "Excellent"],
  [75, "Great"],
  [60, "Good"],
  [40, "Fair"],
  [0, "New"],
];

/**
 * Explainable provider trust score (0-99).
 * Uses only service-quality signals: verification, completed jobs, ratings,
 * reliability, response behaviour and profile completeness. No sensitive
 * personal attributes are used.
 */
export async function trustScore(providerId: string): Promise<TrustScore> {
  const factors: TrustFactor[] = [];
  const add = (factor: string, points: number, max: number, note: string) => factors.push({ factor, points, max, note });

  // 1. Identity verification (25)
  const idDocs = await db
    .select({ s: providerDocuments.verificationStatus })
    .from(providerDocuments)
    .where(and(eq(providerDocuments.providerId, providerId), eq(providerDocuments.docType, "id_proof"), eq(providerDocuments.verificationStatus, "approved")))
    .limit(1);
  add("Identity verification", idDocs.length ? 25 : 0, 25, idDocs.length ? "Government ID verified by SmartServe" : "ID verification pending");

  // 2. Extra documents (10)
  const otherDocs = await db
    .select({ n: sql<number>`count(*)` })
    .from(providerDocuments)
    .where(and(eq(providerDocuments.providerId, providerId), inArray(providerDocuments.docType, ["business_proof", "certificate"]), eq(providerDocuments.verificationStatus, "approved")))
    .limit(1);
  add("Credentials", otherDocs[0] && otherDocs[0].n > 0 ? 10 : 0, 10, "Business/certification documents on file");

  // 3. Completed jobs (20)
  const jobs = await db.select({ n: sql<number>`count(*)` }).from(bookings).where(and(eq(bookings.providerId, providerId), eq(bookings.status, "closed"))).limit(1);
  const jobCount = Number(jobs[0]?.n ?? 0);
  add("Completed services", Math.min(20, jobCount * 2), 20, `${jobCount} service${jobCount === 1 ? "" : "s"} closed`);

  // 4. Rating (20)
  const ratingRow = await db.select({ avg: sql<number>`coalesce(round(avg(${reviews.rating})::numeric, 2), 0)` }).from(reviews).where(and(eq(reviews.providerId, providerId), eq(reviews.status, "visible"))).limit(1);
  const avgRating = Number(ratingRow[0]?.avg ?? 0);
  add("Customer rating", Math.round((avgRating / 5) * 20), 20, avgRating > 0 ? `Average ${avgRating.toFixed(1)}/5 from customers` : "No ratings yet");

  // 5. Cancellation behaviour (10)
  const cancelled = await db.select({ n: sql<number>`count(*)` }).from(bookings).where(and(eq(bookings.providerId, providerId), eq(bookings.status, "cancelled"))).limit(1);
  const cancelCount = Number(cancelled[0]?.n ?? 0);
  const totalAssigned = await db.select({ n: sql<number>`count(*)` }).from(bookings).where(eq(bookings.providerId, providerId)).limit(1);
  const total = Number(totalAssigned[0]?.n ?? 0);
  const cancelRate = total > 0 ? cancelCount / total : 0;
  add("Reliability", Math.round((1 - cancelRate) * 10), 10, total > 0 ? `${Math.round(cancelRate * 100)}% cancellation rate` : "No history yet");

  // 6. Response behaviour (10)
  const responded = await db.select({ n: sql<number>`count(*)` }).from(providerRequestInvites).where(and(eq(providerRequestInvites.providerId, providerId), inArray(providerRequestInvites.status, ["accepted", "rejected"]))).limit(1);
  const invited = await db.select({ n: sql<number>`count(*)` }).from(providerRequestInvites).where(eq(providerRequestInvites.providerId, providerId)).limit(1);
  const resp = Number(responded[0]?.n ?? 0);
  const inv = Number(invited[0]?.n ?? 0);
  const respRate = inv > 0 ? resp / inv : 0.85;
  add("Response rate", Math.round(respRate * 10), 10, inv > 0 ? `Responded to ${Math.round(respRate * 100)}% of requests` : "Usually responds quickly");

  // 7. Profile completeness (14)
  const profile = (await db.select().from(providerProfiles).where(eq(providerProfiles.userId, providerId)).limit(1))[0];
  const portfolio = await db.select({ n: sql<number>`count(*)` }).from(providerPortfolio).where(eq(providerPortfolio.providerId, providerId)).limit(1);
  const [user] = await db.select().from(users).where(eq(users.id, providerId)).limit(1);
  let completeness = 0;
  if (profile?.bio) completeness += 3;
  if (profile?.phone) completeness += 3;
  if (profile?.city) completeness += 2;
  if (Number(portfolio[0]?.n ?? 0) > 0) completeness += 3;
  if (user?.avatarUrl) completeness += 3;
  add("Profile completeness", completeness, 14, "Bio, contact, area, portfolio and photo");

  const raw = factors.reduce((s, f) => s + f.points, 0);
  const score = Math.max(5, Math.min(99, Math.round(raw * (99 / 115))));
  const grade = GRADES.find(([min]) => score >= min)?.[1] ?? "New";
  return {
    score,
    grade,
    factors,
    explanation: "Trust score is based on identity verification, completed services, customer reviews, reliability and profile quality. It never uses personal attributes.",
  };
}
