import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import {
  aiDiagnoses,
  bookingLocationUpdates,
  bookings,
  customers,
  db,
  notifications,
  payments,
  platformSettings,
  providerAvailability,
  providerDocuments,
  providerEarnings,
  providerLocations,
  providerPortfolio,
  providerProfiles,
  providerRequestInvites,
  providerServices,
  providerWorkingHours,
  providers,
  reviews,
  services,
  studentProfiles,
  studentProviders,
  users,
} from "@workspace/db";
import { config } from "../config";
import { hashPassword } from "./auth";
import { logger } from "./logger";

/**
 * DEMO DATA - clearly separated from production data.
 * Only runs when the database has no users at all (fresh boot) and
 * DEMO_MODE=true. Demo accounts use the @demo.in domain, which the UI
 * badges with "DEMO". Delete the database (or set DEMO_MODE=false) for a
 * clean production environment.
 */

const CATALOG: Array<{ slug: string; name: string; icon: string; category: string; min: number; max: number; desc: string; warranty: number; emergency: boolean }> = [
  { slug: "electrician", name: "Electrician", icon: "zap", category: "home", min: 300, max: 1200, desc: "Wiring, lights, fans, MCB, sockets and power issues", warranty: 7, emergency: true },
  { slug: "plumber", name: "Plumber", icon: "droplets", category: "home", min: 350, max: 1500, desc: "Pipes, taps, drains, geysers and leak repair", warranty: 7, emergency: true },
  { slug: "carpenter", name: "Carpenter", icon: "hammer", category: "home", min: 400, max: 1800, desc: "Furniture repair, doors, hinges and installations", warranty: 15, emergency: false },
  { slug: "ac-repair", name: "AC Repair & Service", icon: "wind", category: "appliance", min: 500, max: 2500, desc: "Cooling issues, gas charging, servicing and repairs", warranty: 15, emergency: true },
  { slug: "appliance-repair", name: "Appliance Repair", icon: "plug-zap", category: "appliance", min: 450, max: 2200, desc: "Ovens, microwave, dishwashers, chimneys and more", warranty: 15, emergency: false },
  { slug: "washing-machine-repair", name: "Washing Machine Repair", icon: "washer", category: "appliance", min: 600, max: 2400, desc: "Drum, drain, inlet and motor issues", warranty: 15, emergency: false },
  { slug: "refrigerator-repair", name: "Refrigerator Repair", icon: "snowflake", category: "appliance", min: 600, max: 2600, desc: "Cooling, compressor, gas and defrost issues", warranty: 30, emergency: true },
  { slug: "painter", name: "Painter", icon: "paint-roller", category: "home", min: 800, max: 5000, desc: "Wall painting, putty, primer and texture work", warranty: 30, emergency: false },
  { slug: "cleaner", name: "Deep Cleaner", icon: "sparkles", category: "home", min: 999, max: 4999, desc: "Home deep cleaning, sofa, oven and AC cleaning", warranty: 0, emergency: false },
  { slug: "pest-control", name: "Pest Control", icon: "bug", category: "home", min: 800, max: 3500, desc: "Cockroach, termite, mosquito and rodent treatment", warranty: 30, emergency: false },
  { slug: "laptop-repair", name: "Laptop & Computer Repair", icon: "laptop", category: "digital", min: 500, max: 3500, desc: "Screen, storage, RAM, overheating and software", warranty: 15, emergency: false },
  { slug: "mobile-repair", name: "Mobile Repair", icon: "smartphone", category: "digital", min: 800, max: 5500, desc: "Screen, battery, charging and water damage", warranty: 15, emergency: false },
  { slug: "cctv-installation", name: "CCTV Installation", icon: "cctv", category: "digital", min: 2000, max: 12000, desc: "Camera setup, DVR/NVR, cabling and remote view", warranty: 90, emergency: false },
  { slug: "wifi-technician", name: "Internet & Wi-Fi Technician", icon: "wifi", category: "digital", min: 500, max: 1800, desc: "Router setup, broadband faults and network tuning", warranty: 7, emergency: false },
  { slug: "ro-service", name: "RO & Water Purifier Service", icon: "droplet", category: "appliance", min: 400, max: 1500, desc: "Filter changes, pump repair and water quality check", warranty: 30, emergency: false },
  { slug: "moving-assistance", name: "Moving & Shifting", icon: "truck", category: "home", min: 1500, max: 9000, desc: "Packing, loading, transport and unpacking", warranty: 0, emergency: false },
  { slug: "beauty-salon", name: "Home Beauty & Salon", icon: "scissors", category: "beauty", min: 300, max: 3000, desc: "Hair, makeup, facials and bridal at home", warranty: 0, emergency: false },
  { slug: "gardening", name: "Gardening", icon: "leaf", category: "home", min: 400, max: 2500, desc: "Lawns, hedges, plant care and irrigation", warranty: 0, emergency: false },
  { slug: "locksmith", name: "Locksmith", icon: "key", category: "emergency", min: 500, max: 2500, desc: "Lock repair, key changes and keypad installation", warranty: 30, emergency: true },
  { slug: "solar-panel", name: "Solar Panel Service", icon: "sun", category: "home", min: 1000, max: 6000, desc: "Cleaning, inverter faults and system checks", warranty: 30, emergency: false },
  { slug: "car-service", name: "Car & Vehicle Service", icon: "car", category: "vehicle", min: 800, max: 5000, desc: "Routine service, brakes, battery and diagnostics", warranty: 30, emergency: false },
  { slug: "general-maintenance", name: "General Maintenance", icon: "wrench", category: "home", min: 300, max: 1500, desc: "Handyman work, small repairs and installations", warranty: 7, emergency: false },
  // legacy slugs kept from phase 1 so old links keep working
  { slug: "plumbing", name: "Plumbing", icon: "droplet", category: "home", min: 350, max: 1500, desc: "Pipes, taps, drains and water systems", warranty: 7, emergency: true },
  { slug: "electrical", name: "Electrical", icon: "zap", category: "home", min: 300, max: 1200, desc: "Wiring, lights and power issues", warranty: 7, emergency: true },
  { slug: "cleaning", name: "Cleaning", icon: "sparkles", category: "home", min: 499, max: 2999, desc: "Home and office cleaning", warranty: 0, emergency: false },
  { slug: "vehicle", name: "Vehicle Repair", icon: "truck", category: "vehicle", min: 800, max: 5000, desc: "Car and bike service", warranty: 30, emergency: false },
  { slug: "computer", name: "Computer Repair", icon: "monitor", category: "digital", min: 500, max: 3500, desc: "Computer and laptop support", warranty: 15, emergency: false },
  { slug: "tutoring", name: "Tutoring", icon: "book-open", category: "other", min: 300, max: 1500, desc: "Local tutoring and lessons", warranty: 0, emergency: false },
];

type ProviderSpec = {
  email: string;
  name: string;
  role: "provider" | "student_provider";
  slugs: string[];
  verified: "verified" | "pending";
  online: boolean;
  emergency: boolean;
  lat: number;
  lon: number;
  city: string;
  experience: string;
  bio: string;
  rating: number;
  ratingCount: number;
  completedJobs: number;
};

const BLR = { lat: 12.9716, lon: 77.5946 };

const PROVIDERS: ProviderSpec[] = [
  { email: "rajesh@demo.in", name: "Rajesh Kumar", role: "provider", slugs: ["electrician", "plumber", "general-maintenance"], verified: "verified", online: true, emergency: true, lat: BLR.lat + 0.012, lon: BLR.lon - 0.008, city: "Bengaluru", experience: "8", bio: "Licensed electrician and plumber serving Bengaluru for 8 years. Fast response, transparent pricing.", rating: 4.8, ratingCount: 3, completedJobs: 24 },
  { email: "sunil@demo.in", name: "Sunil Patil", role: "provider", slugs: ["ac-repair", "appliance-repair"], verified: "verified", online: true, emergency: false, lat: BLR.lat - 0.015, lon: BLR.lon + 0.01, city: "Bengaluru", experience: "6", bio: "AC specialist - split, window and central. Gas charging with brand-approved equipment.", rating: 4.7, ratingCount: 3, completedJobs: 19 },
  { email: "meena@demo.in", name: "Meena Devi", role: "student_provider", slugs: ["cleaner", "general-maintenance"], verified: "verified", online: true, emergency: false, lat: BLR.lat + 0.004, lon: BLR.lon + 0.018, city: "Bengaluru", experience: "2", bio: "Final-year B.Com student doing professional home cleaning on evenings and weekends.", rating: 4.9, ratingCount: 2, completedJobs: 12 },
  { email: "arjun@demo.in", name: "Arjun Reddy", role: "provider", slugs: ["refrigerator-repair", "washing-machine-repair", "appliance-repair"], verified: "verified", online: true, emergency: true, lat: BLR.lat - 0.008, lon: BLR.lon - 0.016, city: "Bengaluru", experience: "10", bio: "10+ years in white goods. Authorised repair partner for 3 major brands.", rating: 4.6, ratingCount: 3, completedJobs: 31 },
  { email: "deepak@demo.in", name: "Deepak Joshi", role: "provider", slugs: ["laptop-repair", "mobile-repair", "wifi-technician"], verified: "verified", online: true, emergency: false, lat: BLR.lat + 0.02, lon: BLR.lon + 0.004, city: "Bengaluru", experience: "5", bio: "Computer and mobile repair with same-day turnaround for common faults.", rating: 4.5, ratingCount: 2, completedJobs: 15 },
  { email: "fatima@demo.in", name: "Fatima Sheikh", role: "provider", slugs: ["beauty-salon"], verified: "verified", online: true, emergency: false, lat: BLR.lat - 0.02, lon: BLR.lon + 0.002, city: "Bengaluru", experience: "4", bio: "Certified beauty artist - hair, makeup and bridal services at your home.", rating: 4.9, ratingCount: 2, completedJobs: 9 },
  { email: "karthik@demo.in", name: "Karthik N", role: "provider", slugs: ["carpenter", "painter", "general-maintenance"], verified: "pending", online: true, emergency: false, lat: BLR.lat + 0.008, lon: BLR.lon - 0.02, city: "Bengaluru", experience: "7", bio: "Carpentry and painting for homes and offices. Free site visit for quotes.", rating: 0, ratingCount: 0, completedJobs: 0 },
  { email: "vikram@demo.in", name: "Vikram Singh", role: "provider", slugs: ["pest-control"], verified: "verified", online: false, emergency: false, lat: BLR.lat - 0.004, lon: BLR.lon + 0.022, city: "Bengaluru", experience: "9", bio: "Certified pest management technician. Safe for homes with kids and pets.", rating: 4.4, ratingCount: 1, completedJobs: 11 },
  { email: "anita@demo.in", name: "Anita Rao", role: "provider", slugs: ["ro-service", "plumber"], verified: "pending", online: true, emergency: true, lat: BLR.lat + 0.016, lon: BLR.lon - 0.012, city: "Bengaluru", experience: "3", bio: "RO, water purifier and plumbing services across Bengaluru south.", rating: 0, ratingCount: 0, completedJobs: 0 },
  { email: "rohan@demo.in", name: "Rohan Das", role: "provider", slugs: ["cctv-installation", "wifi-technician", "electrician"], verified: "verified", online: true, emergency: true, lat: BLR.lat - 0.012, lon: BLR.lon - 0.002, city: "Bengaluru", experience: "6", bio: "CCTV and network specialist - home, shop and small office setups.", rating: 4.7, ratingCount: 1, completedJobs: 8 },
];

const CUSTOMERS = [
  { email: "rahul@demo.in", name: "Rahul Sharma" },
  { email: "priya@demo.in", name: "Priya Menon" },
];

const day = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * day);

export async function runSeed(): Promise<void> {
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length > 0) {
    logger.info("seed skipped - database already has users");
    return;
  }
  logger.info("Seeding DEMO data (accounts use the @demo.in domain)");

  // ---------- services ----------
  const serviceIds: Record<string, string> = {};
  for (const s of CATALOG) {
    const [row] = await db
      .insert(services)
      .values({ slug: s.slug, name: s.name, icon: s.icon, category: s.category, basePriceMin: s.min, basePriceMax: s.max, warrantyDays: s.warranty, emergencySupported: s.emergency, description: s.desc })
      .onConflictDoNothing()
      .returning({ id: services.id });
    if (row) serviceIds[s.slug] = row.id;
    else {
      const [found] = await db.select({ id: services.id }).from(services).where(eq(services.slug, s.slug)).limit(1);
      serviceIds[s.slug] = found?.id ?? "";
    }
  }

  // ---------- portfolio seed images (simple local SVGs) ----------
  const seedDir = path.join(config.uploadDir, "seed");
  await mkdir(seedDir, { recursive: true });
  const svg = (label: string, color: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="${color}"/><circle cx="90" cy="80" r="34" fill="rgba(255,255,255,.25)"/><text x="320" y="210" font-family="Arial" font-size="34" fill="#fff" text-anchor="middle" font-weight="bold">${label}</text><text x="320" y="250" font-family="Arial" font-size="18" fill="rgba(255,255,255,.85)" text-anchor="middle">SmartServe demo portfolio</text></svg>`;
  const portraits = ["/uploads/seed/p-electrical.svg", "/uploads/seed/p-ac.svg", "/uploads/seed/p-clean.svg"];
  for (let i = 0; i < portraits.length; i++) {
    await path.join(seedDir, path.basename(portraits[i]));
    await writeFile(path.join(seedDir, path.basename(portraits[i])), svg(["Electrical wiring - completed job", "AC gas charging - service photo", "Deep cleaning - before/after"][i], ["#db2777", "#ea580c", "#0ea5e9"][i]), "utf8");
  }

  // ---------- users ----------
  const adminHash = await hashPassword("Admin@12345");
  const [admin] = await db.insert(users).values({ email: "admin@demo.in", passwordHash: adminHash, role: "admin", phone: "+91 98000 00001" }).returning();

  const customerHash = await hashPassword("Demo@12345");
  const providerHash = await hashPassword("Demo@12345");
  const customerIds: Record<string, string> = {};
  for (const c of CUSTOMERS) {
    const [u] = await db.insert(users).values({ email: c.email, passwordHash: customerHash, role: "customer", phone: "+91 98440 12345" }).returning();
    await db.insert(customers).values({ userId: u.id, displayName: c.name });
    customerIds[c.email] = u.id;
  }

  const providerIds: Record<string, string> = {};
  for (const p of PROVIDERS) {
    const [u] = await db.insert(users).values({ email: p.email, passwordHash: providerHash, role: p.role, phone: "+91 98450 55667" }).returning();
    providerIds[p.email] = u.id;
    if (p.role === "provider") await db.insert(providers).values({ userId: u.id, displayName: p.name });
    else {
      await db.insert(studentProviders).values({ userId: u.id, displayName: p.name });
      await db.insert(studentProfiles).values({ userId: u.id, college: "Christ University", degree: "B.Com", semester: 7, partTimeHours: "Evenings 5-9 PM, weekends", bio: p.bio });
    }
    await db.insert(providerProfiles).values({
      userId: u.id,
      phone: "+91 98450 55667",
      bio: p.bio,
      city: p.city,
      pincode: "560001",
      serviceArea: "Bengaluru",
      serviceRadiusKm: "12",
      experienceYears: p.experience,
      verificationStatus: p.verified,
      emergencyAvailable: p.emergency,
      startingPrice: "300",
      profileImageUrl: portraits[0],
    });
    await db.insert(providerAvailability).values({ providerId: u.id, available: p.online });
    await db.insert(providerLocations).values({ providerId: u.id, latitude: String(p.lat), longitude: String(p.lon), serviceRadiusKm: "12" });
    for (const slug of p.slugs) {
      if (serviceIds[slug]) await db.insert(providerServices).values({ providerId: u.id, serviceId: serviceIds[slug] });
    }
    for (let d = 0; d < 7; d++) {
      await db.insert(providerWorkingHours).values({ providerId: u.id, day: d, startHour: 9, endHour: 20 });
    }
    if (p.verified === "verified") {
      await db.insert(providerDocuments).values([
        { providerId: u.id, docType: "id_proof", filename: "aadhaar.pdf", storedPath: "/uploads/seed/id.svg", mimeType: "image/svg+xml", sizeBytes: 1000, verificationStatus: "approved", reviewedAt: daysAgo(60) },
        { providerId: u.id, docType: "business_proof", filename: "shop-act.pdf", storedPath: "/uploads/seed/biz.svg", mimeType: "image/svg+xml", sizeBytes: 900, verificationStatus: "approved", reviewedAt: daysAgo(60) },
      ]);
    } else {
      await db.insert(providerDocuments).values({ providerId: u.id, docType: "id_proof", filename: "aadhaar.pdf", storedPath: "/uploads/seed/id-pending.svg", mimeType: "image/svg+xml", sizeBytes: 1000, verificationStatus: "pending" });
    }
    if (["rajesh@demo.in", "sunil@demo.in", "arjun@demo.in"].includes(p.email)) {
      const titles = ["Electrical rewiring - Indiranagar", "AC gas charging - Koramangala", "Refrigerator compressor - HSR Layout"];
      const idx = PROVIDERS.findIndex((x) => x.email === p.email);
      await db.insert(providerPortfolio).values({ providerId: u.id, title: titles[idx % titles.length], imageUrl: portraits[idx % portraits.length], description: "Completed job photo (demo)" });
    }
  }

  // ---------- history: completed + paid bookings with payments/earnings/reviews ----------
  const histProviders = ["rajesh@demo.in", "sunil@demo.in", "arjun@demo.in", "deepak@demo.in", "meena@demo.in", "rohan@demo.in"];
  const histServices = ["electrician", "ac-repair", "refrigerator-repair", "laptop-repair", "cleaner", "cctv-installation"];
  const comments = ["Very professional, fixed it quickly.", "On time and honest about the price.", "Explained everything clearly. Recommended!", "Good work, reasonable charge.", "Friendly and neat. Will book again."];
  let i = 0;
  for (const email of histProviders) {
    const slug = histServices[i % histServices.length];
    const cust = i % 2 === 0 ? customerIds["rahul@demo.in"] : customerIds["priya@demo.in"];
    const age = 2 + i * 3;
    const amount = 300 + i * 350;
    const [b] = await db
      .insert(bookings)
      .values({
        customerId: cust,
        providerId: providerIds[email],
        serviceId: serviceIds[slug],
        status: "closed",
        problemDescription: "Demo history: " + ["Light switch not working", "AC not cooling properly", "Fridge not cooling", "Laptop over heating", "Deep cleaning for 2BHK", "2 camera setup"][i % 6],
        locationAddress: "Demo Layout, Bengaluru",
        locationCity: "Bengaluru",
        locationState: "Karnataka",
        locationPostalCode: "560001",
        latitude: String(BLR.lat),
        longitude: String(BLR.lon),
        estimatedPriceMin: String(amount - 100),
        estimatedPriceMax: String(amount + 200),
        finalAmount: String(amount),
        warrantyDays: 15,
        acceptedAt: daysAgo(age),
        startedAt: daysAgo(age),
        completedAt: daysAgo(age),
        createdAt: daysAgo(age + 1),
      })
      .returning();
    const paise = amount * 100;
    const [payment] = await db.insert(payments).values({ bookingId: b.id, customerId: cust, providerId: providerIds[email], gateway: "sandbox", gatewayOrderId: `sb_demo${i}`, amountPaise: paise, status: "paid", transactionId: `txn_demo${i}`, paidAt: daysAgo(age) }).returning();
    await db.insert(providerEarnings).values({ providerId: providerIds[email], bookingId: b.id, amountPaise: paise, feePaise: Math.round(paise * 0.1), netPaise: Math.round(paise * 0.9) });
    if (i % 2 === 0 || providerIds[email] === providerIds["rajesh@demo.in"]) {
      await db.insert(reviews).values({
        bookingId: b.id,
        customerId: cust,
        providerId: providerIds[email],
        rating: 4 + (i % 2),
        serviceQuality: 5,
        professionalism: 4 + (i % 2),
        timeliness: 5,
        comment: comments[i % comments.length],
      });
    }
    i++;
  }

  // ---------- live demo bookings ----------
  // 1) Active job (in progress) for Rahul - provider Arjun, refrigerator
  const [active] = await db
    .insert(bookings)
    .values({
      customerId: customerIds["rahul@demo.in"],
      providerId: providerIds["arjun@demo.in"],
      serviceId: serviceIds["refrigerator-repair"],
      status: "in_progress",
      problemDescription: "Refrigerator is running but not cooling. Double door, 3 years old.",
      urgency: "high",
      source: "ai",
      locationAddress: "12, 4th Cross, Indiranagar",
      locationArea: "Indiranagar",
      locationCity: "Bengaluru",
      locationState: "Karnataka",
      locationPostalCode: "560038",
      latitude: String(BLR.lat + 0.002),
      longitude: String(BLR.lon + 0.001),
      estimatedPriceMin: "800",
      estimatedPriceMax: "2400",
      warrantyDays: 30,
      matchedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      acceptedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      arrivedAt: new Date(Date.now() - 40 * 60 * 1000),
      startedAt: new Date(Date.now() - 25 * 60 * 1000),
    })
    .returning();
  await db.insert(aiDiagnoses).values({ userId: customerIds["rahul@demo.in"], bookingId: active.id, inputText: "Refrigerator running but not cooling", serviceId: serviceIds["refrigerator-repair"], serviceCategory: "Refrigerator Repair", problemSummary: "Fridge compressor runs but the chamber does not cool.", possibleCauses: ["Low refrigerant gas", "Compressor not compressing", "Defrost drain blocked"], urgency: "high", priceMin: 800, priceMax: 2400, recommendedAction: "Avoid overloading; technician will check gas and compressor.", questionsForCustomer: ["Any humming noise?", "Top or bottom freezer not cooling?"], engine: "heuristic" });
  await db.insert(bookingLocationUpdates).values({ bookingId: active.id, providerId: providerIds["arjun@demo.in"], latitude: String(BLR.lat + 0.002), longitude: String(BLR.lon + 0.001) });

  // 2) Scheduled booking for Priya - tomorrow 10:30 IST (AC service)
  const tomorrow = new Date(Date.now() + 1 * day);
  tomorrow.setUTCHours(5, 0, 0, 0); // 10:30 IST
  await db.insert(bookings).values({
    customerId: customerIds["priya@demo.in"],
    serviceId: serviceIds["ac-repair"],
    status: "scheduled",
    problemDescription: "AC blowing warm air after a month. 1.5 ton split.",
    urgency: "medium",
    source: "ai",
    locationAddress: "221, 1st Stage, Indiranagar",
    locationArea: "Indiranagar",
    locationCity: "Bengaluru",
    locationState: "Karnataka",
    locationPostalCode: "560038",
    latitude: String(BLR.lat + 0.003),
    longitude: String(BLR.lon - 0.001),
    estimatedPriceMin: "500",
    estimatedPriceMax: "1800",
    scheduledAt: tomorrow,
    timezone: "Asia/Kolkata",
  });

  // ---------- notifications for demo users ----------
  for (const c of CUSTOMERS) {
    await db.insert(notifications).values({
      userId: customerIds[c.email],
      type: "welcome",
      title: "Welcome to SmartServe",
      body: "This is a demo account. Book a service from the dashboard to see the full real-time flow.",
    });
  }
  await db.insert(notifications).values({ userId: providerIds["arjun@demo.in"], type: "job_active", title: "You have an active job", body: "Rahul S. - Refrigerator Repair (in progress). Open the job to complete it." });

  // ---------- platform settings ----------
  for (const [k, v] of Object.entries({ demo_mode: "true", request_timeout_sec: String(config.requestTimeoutSec), platform_fee_percent: String(config.platformFeePercent) })) {
    await db.insert(platformSettings).values({ key: k, value: v }).onConflictDoNothing();
  }

  logger.info({ admin: admin.email }, "Demo seed complete");
  logger.info("Demo logins -> customer: rahul@demo.in | provider: arjun@demo.in | admin: admin@demo.in (passwords in README)");
}
