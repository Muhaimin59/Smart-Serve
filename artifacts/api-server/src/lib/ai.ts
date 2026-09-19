import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, services, type Service } from "@workspace/db";
import { config, geminiConfigured } from "../config";
import { logger } from "./logger";

/* =========================================================================
 * AI problem analysis + price prediction.
 * Two engines:
 *  1. gemini - Google Gemini (when GEMINI_API_KEY is configured). Output is
 *     forced to JSON and validated with Zod before use.
 *  2. heuristic - built-in rule engine. Always available, clearly labeled.
 * Raw AI output is never trusted: every response passes the same Zod schema
 * and is merged with server-side price data from the services catalog.
 * ========================================================================= */

export const diagnosisSchema = z.object({
  service_category: z.string().min(1),
  problem_summary: z.string().min(1),
  possible_causes: z.array(z.string()).default([]),
  urgency: z.enum(["low", "medium", "high", "critical"]),
  estimated_price_min: z.number().int().nonnegative().nullable().optional(),
  estimated_price_max: z.number().int().nonnegative().nullable().optional(),
  recommended_action: z.string(),
  questions_for_customer: z.array(z.string()).default([]),
});
export type Diagnosis = z.infer<typeof diagnosisSchema>;

export const priceEstimateSchema = z.object({
  price_min: z.number().int().positive(),
  price_max: z.number().int().positive(),
  factors: z.record(z.number()).default({}),
});

const URGENCY_WORDS = /(urgent|emergency|immediately|asap|right away|today)/i;
const CRITICAL_WORDS = /(spark|smoke|burning|shock|burst pipe|flood|overflow|gas|fire|leaking badly|electric shock|no power)/i;

type Rule = { slug: string; name: string; pattern: RegExp; causes: string[]; questions: string[]; action: string };

const RULES: Rule[] = [
  { slug: "refrigerator-repair", name: "Refrigerator Repair", pattern: /refrigerat|fridge|freezer/i, causes: ["Compressor not kicking in", "Low refrigerant gas", "Defrost drain blocked", "Condenser coil dirty"], questions: ["Is the fridge making any humming or clicking noise?", "How old is the refrigerator?"], action: "Keep the fridge closed to hold the temperature and avoid perishables until the technician checks the compressor and gas levels." },
  { slug: "washing-machine-repair", name: "Washing Machine Repair", pattern: /washing ?machine|washer|wm not|drum/i, causes: ["Drain pump blocked", "Inlet valve not opening", "Drum bearing worn", "Control board fault"], questions: ["Is the drum spinning but not draining?", "Top load or front load?"], action: "Stop using the machine if it is overflowing or making grinding noises to prevent water damage." },
  { slug: "ac-repair", name: "AC Repair & Service", pattern: /ac\b|air ?condition|split ?unit|not cooling|cooling not/i, causes: ["Low gas charge", "Dirty filter or coil", "Compressor pressure issue", "Thermostat sensor fault"], questions: ["Split or window AC?", "Roughly how old is the unit?"], action: "Run the unit on fan mode only and clean the front filter if you can reach it safely." },
  { slug: "plumber", name: "Plumber", pattern: /pipe|leak|tap|drain|plumb|geyser|shower|water (line|pressure|pipe)|toilet/i, causes: ["Worn washers or seals", "Clogged drain line", "Corroded pipe joint", "Geyser heating element fault"], questions: ["Where exactly is the leak?", "Is the water pressure low or normal?"], action: "Close the nearest water valve to stop the leak from worsening." },
  { slug: "electrician", name: "Electrician", pattern: /electric|wiring|mcb|switch|light|fan not|inverter|socket|breaker|short circuit|power/i, causes: ["Loose or burnt wiring", "Tripped MCB / RCD", "Failed driver or capacitor", "Overloaded circuit"], questions: ["Did the issue start after a power cut or storm?", "Is the problem in one room or the whole house?"], action: "Do not touch wet outlets or switch the MCB repeatedly - switch off the main if you see sparks or smell burning." },
  { slug: "laptop-repair", name: "Laptop & Computer Repair", pattern: /laptop|computer|desktop|ssd|ram|monitor|keyboard/i, causes: ["Thermal paste dried / fan clogged", "Failing storage (SSD/HDD)", "RAM or motherboard fault", "Software or driver corruption"], questions: ["Does it power on at all (any lights)?", "Windows, Mac or Chromebook?"], action: "Back up important files if the machine still boots, and avoid repeated forceful restarts." },
  { slug: "mobile-repair", name: "Mobile Repair", pattern: /mobile|phone|iphone|android|cracked screen|charging port/i, causes: ["Cracked display assembly", "Charging port debris or wear", "Battery swelling or ageing", "Software fault"], questions: ["Is the screen physically cracked?", "Does it charge at all, even slowly?"], action: "Avoid pressing a cracked screen and use a known-good charger to rule out a cable issue." },
  { slug: "cctv-installation", name: "CCTV Installation", pattern: /cctv|camera|surveillance|doorbell/i, causes: ["Camera placement or cabling needed", "DVR/NVR configuration", "Power supply issue on existing cameras", "Network (PoE) setup"], questions: ["How many cameras and roughly how many metres of cable?", "Wired or Wi-Fi cameras?"], action: "Walk through the areas you want covered so cable routing can be planned." },
  { slug: "wifi-technician", name: "Internet & Wi-Fi Technician", pattern: /wi-?fi|internet|router|broadband|network down/i, causes: ["Router or ONT misconfiguration", "Cable or port fault", "ISP-side outage", "Interference / poor placement"], questions: ["Is the issue one device or the whole network?", "ISP name and plan type (fibre/4G)?"], action: "Restart the router and ONT (unplug 30 seconds) - many dropouts resolve with a clean power cycle." },
  { slug: "ro-service", name: "RO & Water Purifier Service", pattern: /water purifier|\bro\b (machine|tank|filter|service)|ro tank/i, causes: ["Membrane or filter due for change", "Low tank pressure", "Pump failure", "Mineralised or stale water"], questions: ["When were the filters last changed?", "Is the pump making a humming sound?"], action: "Do not drink the RO water until the unit is checked if it tastes or smells abnormal." },
  { slug: "pest-control", name: "Pest Control", pattern: /cockroach|pest|termite|ants?|mosquito|snake|rat|flea/i, causes: ["Entry points not sealed", "Food/water sources available", "Infestation needs chemical treatment", "Drain or gap issue"], questions: ["Which rooms are affected and for how long?", "Any visible nests or droppings?"], action: "Keep food covered, remove standing water and note the worst-affected areas for the technician." },
  { slug: "painter", name: "Painter", pattern: /paint|putty|shuttering|coating/i, causes: ["Wall prep (putty/primer) needed", "Damp or fungus behind paint", "Colour/texture work requested", "Peeling from moisture"], questions: ["Approximate wall area (rooms or sq ft)?", "Just painting or also putty + primer?"], action: "Move furniture away from walls and cover floors; note any damp patches." },
  { slug: "cleaner", name: "Deep Cleaner", pattern: /clean|deep clean|mop|sweep|kitchen (grease|cleaning)|sofa (cleaning|shampoo)/i, causes: ["Accumulated grime and limescale", "Tough kitchen/stove grease", "Dust in vents and corners", "Urgent pre-event cleaning"], questions: ["How many rooms / bathrooms?", "Sofa, AC or oven cleaning also needed?"], action: "Clear small valuables and let the crew know about any fragile items." },
  { slug: "carpenter", name: "Carpenter", pattern: /furniture|wooden|cupboard|table|door hinge|carpent|bed frame|shelf/i, causes: ["Loose joints or screws", "Door alignment / hinges", "Water damage swelling", "Assembly or repair needed"], questions: ["Which furniture piece and what is the issue?", "Any squeaking, wobble or broken part?"], action: "Avoid leaning on the damaged piece to prevent it worsening." },
  { slug: "gardening", name: "Gardening", pattern: /garden|plant|lawn|grass|tree (trim|cut)|greenery/i, causes: ["Overgrown lawn or hedges", "Plant disease or pests", "Irrigation line issue", "Seasonal maintenance"], questions: ["Rough garden size?", "Mowing, pruning or full landscape work?"], action: "Mark any sprinkler heads or underground lines before work begins." },
  { slug: "beauty-salon", name: "Home Beauty & Salon", pattern: /salon|hair (cut|wash)|makeup|facial|manicure|bridal|waxing/i, causes: ["Home visit appointment requested", "Bridal / event grooming", "Regular cut and styling", "Skin or hair treatment"], questions: ["How many people and what time?", "Any specific style or reference?"], action: "Keep the area clean and let the artist know about allergies." },
  { slug: "moving-assistance", name: "Moving & Shifting", pattern: /moving|shift|relocat|packing|transport (luggage|stuff)/i, causes: ["House/office shifting", "Packing + transport", "Furniture dismantling", "Stair / truck logistics"], questions: ["From where to where and how much stuff (approx rooms)?", "Do you need packing material too?"], action: "Keep a list of fragile items and important documents separate." },
  { slug: "locksmith", name: "Locksmith", pattern: /lock|key (lock|change)|keypad|padlock|door not (opening|locking)/i, causes: ["Lock jammed or worn", "Key lost - lock change needed", "Keypad installation", "Cylinder upgrade"], questions: ["Door lock, padlock or keypad?", "Do you currently have access to the room?"], action: "Keep your ID handy for the locksmith's identity check." },
  { slug: "solar-panel", name: "Solar Panel Service", pattern: /solar|pv (panel|system)/i, causes: ["Panel soiling reducing output", "Inverter fault or alarm", "Wiring or MC4 connector issue", "Battery bank ageing"], questions: ["What is the system size (kW) and inverter brand?", "Any alarm codes shown?"], action: "Note the inverter display readings for the technician." },
  { slug: "appliance-repair", name: "Appliance Repair", pattern: /appliance|oven|microwave|dish ?washer|stove|chimney|induction|water heater|mixer|blender/i, causes: ["Heating element or magnetron fault", "Drainage blockage", "Control board issue", "Motor or brush wear"], questions: ["Which appliance and the exact symptoms?", "Model/brand if visible?"], action: "Unplug the appliance before the technician arrives (unless gas - then close the valve)." },
  { slug: "car-service", name: "Car & Vehicle Service", pattern: /car|vehicle|bike|motorcycle|two ?wheeler|four ?wheeler/i, causes: ["Routine service / oil change", "Brake or suspension wear", "Battery or starter issue", "Check-engine warning"], questions: ["Car or bike, and the main symptom?", "Last service date if known?"], action: "Keep the vehicle accessible with some fuel in the tank." },
  { slug: "general-maintenance", name: "General Maintenance", pattern: /maintenance|repair|fix|install|hang|mount|general/i, causes: ["General home repair", "Small installation or mounting", "Multi-task maintenance visit", "Ad-hoc handyman work"], questions: ["What exactly needs fixing?", "Any photos you can share?"], action: "Have the item ready and clear the work area." },
];

/* ------------------------- heuristic engine ------------------------------- */

export function heuristicDiagnose(input: { text?: string; serviceSlug?: string }): Diagnosis & { matchedSlug?: string } {
  const text = input.text ?? "";
  const byText = RULES.find((r) => r.pattern.test(text));
  const bySlug = input.serviceSlug ? RULES.find((r) => r.slug === input.serviceSlug) : undefined;
  const rule = byText ?? bySlug ?? RULES[RULES.length - 1];
  const matchedSlug = byText?.slug ?? bySlug?.slug ?? input.serviceSlug ?? rule.slug;
  const critical = CRITICAL_WORDS.test(text);
  const urgent = URGENCY_WORDS.test(text);
  const notWorking = /not (working|cooling|running|spinning|heating|charging|turning)/i.test(text);
  const urgency = critical ? "critical" : urgent || notWorking ? "high" : "medium";
  return {
    service_category: rule.name,
    problem_summary: text.trim() ? text.trim().slice(0, 200) : `General issue requiring a ${rule.name} visit.`,
    possible_causes: rule.causes,
    urgency,
    estimated_price_min: 0,
    estimated_price_max: 0,
    recommended_action: critical ? "Treat this as urgent. Cut power/water to the affected area if it is safe to do so, and request the earliest slot." : rule.action,
    questions_for_customer: rule.questions,
    matchedSlug,
  };
}

/* --------------------------- Gemini engine --------------------------------- */

let categoriesCache: string | undefined;
async function categoryList(): Promise<string> {
  if (categoriesCache) return categoriesCache;
  let list = "General Maintenance";
  try {
    const rows = await db.select({ name: services.name }).from(services);
    const joined = rows.map((r) => r.name).join(", ");
    if (joined) list = joined;
  } catch {
    /* keep the default */
  }
  categoriesCache = list;
  return list;
}

async function geminiDiagnose(input: { text?: string; imageBase64?: string; imageMime?: string }): Promise<Diagnosis> {
  const prompt = `You are SmartServe, an assistant for a local home-services marketplace in India.
Analyze the customer's problem description (and photo if provided) and reply with STRICT JSON only, no markdown, matching:
{"service_category": string, "problem_summary": string, "possible_causes": string[], "urgency": "low"|"medium"|"high"|"critical", "estimated_price_min": number, "estimated_price_max": number, "recommended_action": string, "questions_for_customer": string[]}
Rules:
- service_category must be one of: ${await categoryList()}
- prices in Indian Rupees, realistic ranges for a technician visit + typical repair; do not guarantee them
- never claim a certain diagnosis; phrase causes as possibilities
- keep questions_for_customer to at most 2 short questions
- urgency: "critical" only for electrical shock, fire risk, burst pipes, gas, or total water/power loss

Customer problem: ${input.text ?? "(photo only - analyze the visible problem)"}`;

  const parts: unknown[] = [];
  if (input.imageBase64) parts.push({ inline_data: { mime_type: input.imageMime ?? "image/jpeg", data: input.imageBase64 } });
  parts.push({ text: prompt });

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.2, response_mime_type: "application/json" } }),
  });
  if (!res.ok) throw new Error(`Gemini API responded ${res.status}`);
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const raw = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return diagnosisSchema.parse(JSON.parse(cleaned));
}

export const ANALYSIS_DISCLAIMER =
  "AI-assisted estimate. The diagnosis is a suggestion, not a technical guarantee, and the final price may vary after the provider inspects the problem.";

export type AnalyzeResult = {
  diagnosis: {
    service_category: string;
    problem_summary: string;
    possible_causes: string[];
    urgency: "low" | "medium" | "high" | "critical";
    estimated_price_min: number;
    estimated_price_max: number;
    recommended_action: string;
    questions_for_customer: string[];
    serviceSlug: string | null;
    serviceId: string | null;
    engine: "gemini" | "heuristic";
  };
  disclaimer: string;
};

export async function analyzeProblem(input: { text?: string; imageUrl?: string; imageBase64?: string; imageMime?: string; serviceId?: string }): Promise<AnalyzeResult> {
  let serviceId: string | null = input.serviceId ?? null;
  let service: Service | undefined;
  if (input.serviceId) {
    service = (await db.select().from(services).where(eq(services.id, input.serviceId)).limit(1))[0];
  }

  const heur = heuristicDiagnose({ text: input.text, serviceSlug: service?.slug });
  const matchedSlug = heur.matchedSlug ?? service?.slug ?? null;
  if (matchedSlug && !service) {
    service = (await db.select().from(services).where(eq(services.slug, matchedSlug)).limit(1))[0];
    if (service) serviceId = service.id;
  }

  const price = await computePrice({ service, urgency: heur.urgency, isEmergency: false, text: input.text });

  if (geminiConfigured()) {
    try {
      const g = await Promise.race([
        geminiDiagnose(input),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("gemini timeout")), 20000)),
      ]);
      const gService = await findServiceByName(g.service_category);
      const finalService = gService ?? service;
      if (gService) serviceId = gService.id;
      const gPrice = await computePrice({ service: finalService, urgency: g.urgency, isEmergency: false, text: input.text });
      return {
        diagnosis: {
          service_category: gService?.name ?? g.service_category,
          problem_summary: g.problem_summary,
          possible_causes: g.possible_causes.slice(0, 6),
          urgency: g.urgency,
          estimated_price_min: gPrice.price_min,
          estimated_price_max: gPrice.price_max,
          recommended_action: g.recommended_action,
          questions_for_customer: g.questions_for_customer.slice(0, 2),
          serviceSlug: gService?.slug ?? matchedSlug,
          serviceId,
          engine: "gemini",
        },
        disclaimer: ANALYSIS_DISCLAIMER,
      };
    } catch (error) {
      logger.warn({ error }, "Gemini analysis failed - falling back to heuristic engine");
    }
  }

  return {
    diagnosis: {
      service_category: heur.service_category,
      problem_summary: heur.problem_summary,
      possible_causes: heur.possible_causes,
      urgency: heur.urgency,
      estimated_price_min: price.price_min,
      estimated_price_max: price.price_max,
      recommended_action: heur.recommended_action,
      questions_for_customer: heur.questions_for_customer,
      serviceSlug: matchedSlug,
      serviceId,
      engine: "heuristic",
    },
    disclaimer: ANALYSIS_DISCLAIMER,
  };
}

/* --------------------------- price engine ---------------------------------- */

async function findServiceByName(name: string): Promise<Service | undefined> {
  const target = name.toLowerCase().trim();
  const rows = await db.select().from(services).limit(300);
  return (
    rows.find((r) => r.name.toLowerCase() === target) ??
    rows.find((r) => target.includes(r.name.toLowerCase()) || r.name.toLowerCase().includes(target) || target.includes(r.slug.replace(/-/g, " ")))
  );
}

export async function computePrice(args: {
  service?: Service;
  urgency?: string;
  isEmergency?: boolean;
  text?: string;
  distanceKm?: number;
}): Promise<z.infer<typeof priceEstimateSchema>> {
  const baseMin = args.service?.basePriceMin ?? 300;
  const baseMax = args.service?.basePriceMax ?? 1500;
  const factors: Record<string, number> = { base_min: baseMin, base_max: baseMax };
  let mult = 1;
  if (args.isEmergency) {
    mult *= args.service?.emergencyMultiplier ?? 1.4;
    factors.emergency_multiplier = args.service?.emergencyMultiplier ?? 1.4;
  }
  const complex = /(multiple|several|whole house|entire|all rooms|full house|big|large area)/i.test(args.text ?? "");
  if (complex) {
    mult *= 1.2;
    factors.complexity = 1.2;
  }
  if (args.urgency === "critical") mult *= 1.15;
  let min = Math.round((baseMin * mult) / 50) * 50;
  let max = Math.round((baseMax * mult) / 50) * 50;
  if (args.distanceKm !== undefined && args.distanceKm > 3 && args.service) {
    const travel = Math.round(((args.distanceKm - 3) * (args.service.distancePerKm ?? 15)) / 10) * 10;
    min += travel;
    max += travel;
    factors.travel = travel;
  }
  if (max < min) max = min;
  return { price_min: min, price_max: max, factors };
}
