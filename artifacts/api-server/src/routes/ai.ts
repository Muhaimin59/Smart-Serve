import { Router } from "express";
import { eq } from "drizzle-orm";
import { aiDiagnoses, db, priceEstimates, services } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { ok, fail, handle } from "../lib/respond";
import { analyzeProblem, computePrice } from "../lib/ai";
import { toNumber } from "../lib/geo";
import { geminiConfigured } from "../config";
import { logger } from "../lib/logger";

const router: Router = Router();

/**
 * AI problem analysis. Accepts text, an uploaded image URL (or base64) and
 * an optional pre-selected service. Returns a validated, structured
 * diagnosis + price estimate. Falls back to the heuristic engine when
 * Gemini is unconfigured or fails.
 */
router.post(
  "/ai/analyze",
  requireAuth,
  handle(async (req, res) => {
    const b = req.body ?? {};
    const text = typeof b.text === "string" ? b.text.trim().slice(0, 4000) : "";
    const serviceId = typeof b.serviceId === "string" ? b.serviceId : undefined;
    let imageUrl: string | undefined;
    let imageBase64: string | undefined;
    let imageMime: string | undefined;
    if (typeof b.imageUrl === "string" && b.imageUrl.startsWith("/uploads/")) imageUrl = b.imageUrl;
    if (typeof b.imageBase64 === "string" && b.imageBase64.length > 0) {
      const match = /^data:(image\/(jpeg|jpg|png|webp));base64,(.+)$/.exec(b.imageBase64);
      if (match) {
        imageBase64 = match[3];
        imageMime = `image/${match[2] === "jpg" ? "jpeg" : match[2]}`;
      } else if (b.imageBase64.length < 8_000_000) {
        imageBase64 = b.imageBase64;
        imageMime = typeof b.imageMime === "string" ? b.imageMime : "image/jpeg";
      }
    }
    if (!text && !imageUrl && !imageBase64) return fail(res, 422, "validation", "Describe the problem in text, or attach a photo.");

    const result = await analyzeProblem({ text, imageUrl, imageBase64, imageMime, serviceId });
    const [row] = await db
      .insert(aiDiagnoses)
      .values({
        userId: req.authUser!.id,
        inputText: text || null,
        imageUrl: imageUrl ?? null,
        serviceId: result.diagnosis.serviceId,
        serviceCategory: result.diagnosis.service_category,
        problemSummary: result.diagnosis.problem_summary,
        possibleCauses: result.diagnosis.possible_causes,
        urgency: result.diagnosis.urgency,
        priceMin: result.diagnosis.estimated_price_min,
        priceMax: result.diagnosis.estimated_price_max,
        recommendedAction: result.diagnosis.recommended_action,
        questionsForCustomer: result.diagnosis.questions_for_customer,
        engine: result.diagnosis.engine,
      })
      .returning();
    ok(res, { diagnosis: { ...result.diagnosis, id: row?.id }, disclaimer: result.disclaimer, engineAvailable: geminiConfigured() ? "gemini" : "heuristic" });
  }),
);

/** Public AI demo for the landing page (no auth, no persistence). */
router.post(
  "/ai/demo",
  handle(async (req, res) => {
    const text = typeof req.body?.text === "string" ? req.body.text.trim().slice(0, 1000) : "";
    if (!text) return fail(res, 422, "validation", "Describe the problem in text.");
    const result = await analyzeProblem({ text });
    ok(res, {
      diagnosis: {
        service_category: result.diagnosis.service_category,
        urgency: result.diagnosis.urgency,
        estimated_price_min: result.diagnosis.estimated_price_min,
        estimated_price_max: result.diagnosis.estimated_price_max,
        recommended_action: result.diagnosis.recommended_action,
        engine: result.diagnosis.engine,
      },
      disclaimer: result.disclaimer,
    });
  }),
);

/** Standalone price estimate for a service. */
router.post(
  "/ai/price-estimate",
  requireAuth,
  handle(async (req, res) => {
    const b = req.body ?? {};
    const serviceRef = typeof b.serviceId === "string" ? b.serviceId : typeof b.service === "string" ? b.service : "";
    if (!serviceRef) return fail(res, 422, "validation", "serviceId is required.");
    const byId = (await db.select().from(services).where(eq(services.id, serviceRef)).limit(1))[0];
    const bySlug = byId ? undefined : (await db.select().from(services).where(eq(services.slug, serviceRef)).limit(1))[0];
    const service = byId ?? bySlug;
    if (!service) return fail(res, 404, "not_found", "Service not found.");
    const problemText = typeof b.problemText === "string" ? b.problemText.trim() : undefined;
    const isEmergency = b.isEmergency === true;
    const distanceKm = toNumber(b.distanceKm);
    const estimate = await computePrice({ service, urgency: b.urgency === "critical" ? "critical" : undefined, isEmergency, text: problemText, distanceKm: distanceKm });
    const row = await db
      .insert(priceEstimates)
      .values({ userId: req.authUser!.id, serviceId: service.id, problemText: problemText ?? null, isEmergency, distanceKm: distanceKm ?? null, priceMin: estimate.price_min, priceMax: estimate.price_max, factors: estimate.factors })
      .returning({ id: priceEstimates.id })
      .catch(() => null)
      .then((r) => r?.[0] ?? null);
    ok(res, {
      estimate: { serviceId: service.id, serviceName: service.name, min: estimate.price_min, max: estimate.price_max, factors: estimate.factors, id: row?.id },
      disclaimer: "Estimated price. Final price may vary after provider inspection.",
    });
  }),
);

export default router;
