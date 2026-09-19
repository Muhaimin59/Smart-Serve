import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* =========================================================================
 * SmartServe schema
 * Phase 1 (auth) + Phase 2 (marketplace). Kept in sync with the SQL
 * migrations in lib/db/drizzle. Amounts: legacy bookings columns store
 * INR values as text for backward compatibility; new tables store integer
 * paise for precision.
 * ========================================================================= */

export const userRoleEnum = pgEnum("user_role", ["customer", "provider", "student_provider", "admin"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  language: text("language").notNull().default("en"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("users_email_unique").on(table.email)]);

export const customers = pgTable("customers", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const providers = pgTable("providers", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studentProviders = pgTable("student_providers", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studentProfiles = pgTable("student_profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  college: text("college"),
  degree: text("degree"),
  semester: integer("semester"),
  partTimeHours: text("part_time_hours"),
  bio: text("bio"),
  isStudentVerified: boolean("is_student_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Opaque bearer sessions: only a SHA-256 digest of the client token is stored. */
export const authSessions = pgTable("auth_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("auth_sessions_token_hash_unique").on(table.tokenHash),
  index("auth_sessions_user_id_index").on(table.userId),
  index("auth_sessions_expires_at_index").on(table.expiresAt),
]);

export const passwordResets = pgTable("password_resets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("password_resets_user_index").on(table.userId)]);

export const emailVerifications = pgTable("email_verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Dev outbox: used when SMTP is not configured so email features stay visible. */
export const emailOutbox = pgTable("email_outbox", {
  id: uuid("id").defaultRandom().primaryKey(),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("sent"), // sent | failed | skipped
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("email_outbox_created_index").on(table.createdAt)]);

export const serviceStatusEnum = pgEnum("service_status", ["active", "inactive"]);

export const services = pgTable("services", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  category: text("category").notNull().default("home"),
  basePriceMin: integer("base_price_min").notNull().default(300),
  basePriceMax: integer("base_price_max").notNull().default(1500),
  emergencyMultiplier: real("emergency_multiplier").notNull().default(1.4),
  distancePerKm: integer("distance_per_km").notNull().default(15),
  warrantyDays: integer("warranty_days").notNull().default(7),
  emergencySupported: boolean("emergency_supported").notNull().default(true),
  status: serviceStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("services_slug_unique").on(table.slug)]);

export const verificationStatusEnum = pgEnum("verification_status", ["pending", "verified", "rejected"]);

export const providerProfiles = pgTable("provider_profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  phone: text("phone"),
  bio: text("bio"),
  profileImageUrl: text("profile_image_url"),
  experienceYears: text("experience_years"),
  serviceArea: text("service_area"),
  serviceRadiusKm: text("service_radius_km").notNull().default("10"),
  city: text("city"),
  pincode: text("pincode"),
  startingPrice: text("starting_price"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  verificationStatus: verificationStatusEnum("verification_status").notNull().default("pending"),
  emergencyAvailable: boolean("emergency_available").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const providerServices = pgTable("provider_services", {
  providerId: uuid("provider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  skill: text("skill"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("provider_services_unique").on(table.providerId, table.serviceId)]);

export const providerAvailability = pgTable("provider_availability", {
  providerId: uuid("provider_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  available: boolean("available").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const providerWorkingHours = pgTable("provider_working_hours", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: uuid("provider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  day: integer("day").notNull(), // 0=Sunday..6=Saturday
  startHour: integer("start_hour").notNull(),
  endHour: integer("end_hour").notNull(),
}, (table) => [uniqueIndex("provider_working_hours_unique").on(table.providerId, table.day)]);

export const providerDocuments = pgTable("provider_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: uuid("provider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  docType: text("doc_type").notNull(), // id_proof | business_proof | certificate | other
  filename: text("filename").notNull(),
  storedPath: text("stored_path").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull().default(0),
  verificationStatus: text("verification_status").notNull().default("pending"),
  note: text("note"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
}, (table) => [index("provider_documents_provider_index").on(table.providerId)]);

export const providerPortfolio = pgTable("provider_portfolio", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: uuid("provider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("provider_portfolio_provider_index").on(table.providerId)]);

/* ----------------------------- bookings ---------------------------------- */

/** Full booking state machine. Legacy value `requested` is migrated to `matching`. */
export const bookingStatusEnum = pgEnum("booking_status_v2", [
  "draft",
  "pending",
  "matching",
  "provider_invited",
  "scheduled",
  "accepted",
  "confirmed",
  "on_the_way",
  "arrived",
  "in_progress",
  "completed",
  "payment_pending",
  "paid",
  "review_pending",
  "closed",
  "cancelled",
  "expired",
  "disputed",
  "failed",
]);

export const bookings = pgTable("bookings", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").notNull().references(() => users.id),
  providerId: uuid("provider_id").references(() => users.id),
  serviceId: uuid("service_id").notNull().references(() => services.id),
  status: bookingStatusEnum("status").notNull().default("matching"),
  isEmergency: boolean("is_emergency").notNull().default(false),
  urgency: text("urgency"), // low | medium | high | critical (AI-assisted estimate)
  source: text("source").notNull().default("manual"), // manual | ai | voice
  problemDescription: text("problem_description"),
  notes: text("notes"),
  address: text("address"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  locationAddress: text("location_address"),
  locationArea: text("location_area"),
  locationCity: text("location_city"),
  locationState: text("location_state"),
  locationPostalCode: text("location_postal_code"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  estimatedPriceMin: text("estimated_price_min"),
  estimatedPriceMax: text("estimated_price_max"),
  providerQuote: text("provider_quote"),
  finalAmount: text("final_amount"),
  amount: text("amount"),
  aiDiagnosisId: uuid("ai_diagnosis_id"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  matchedAt: timestamp("matched_at", { withTimezone: true }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  arrivedAt: timestamp("arrived_at", { withTimezone: true }),
  arrivalOtp: text("arrival_otp"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  completionNotes: text("completion_notes"),
  completionPhoto: text("completion_photo"),
  partsMaterials: text("parts_materials"),
  customerConfirmedAt: timestamp("customer_confirmed_at", { withTimezone: true }),
  warrantyDays: integer("warranty_days").notNull().default(7),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("bookings_customer_index").on(table.customerId),
  index("bookings_provider_index").on(table.providerId),
  index("bookings_service_index").on(table.serviceId),
  index("bookings_status_index").on(table.status),
  index("bookings_scheduled_index").on(table.scheduledAt),
  index("bookings_created_index").on(table.createdAt),
]);

export const bookingStatusHistory = pgTable("booking_status_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  actorId: uuid("actor_id").references(() => users.id),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("booking_status_history_booking_index").on(table.bookingId)]);

/**
 * One row per (booking, provider, batch) broadcast attempt. Powers the
 * realtime matching engine, timeouts and reassignment.
 */
export const inviteStatusEnum = pgEnum("invite_status", ["invited", "accepted", "rejected", "expired"]);

export const providerRequestInvites = pgTable("provider_request_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  providerId: uuid("provider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  batch: integer("batch").notNull().default(1),
  status: inviteStatusEnum("status").notNull().default("invited"),
  quote: text("quote"),
  rejectReason: text("reject_reason"),
  invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("provider_request_invites_unique").on(table.bookingId, table.providerId, table.batch),
  index("provider_request_invites_provider_index").on(table.providerId, table.status),
  index("provider_request_invites_booking_index").on(table.bookingId, table.status),
]);

export const customerLocations = pgTable("customer_locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  formattedAddress: text("formatted_address"),
  area: text("area"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  country: text("country").notNull().default("India"),
  label: text("label"),
  isDefault: boolean("is_default").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("customer_locations_user_index").on(table.userId)]);

export const providerLocations = pgTable("provider_locations", {
  providerId: uuid("provider_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  serviceRadiusKm: text("service_radius_km").notNull().default("10"),
  sharingBookingId: uuid("sharing_booking_id").references(() => bookings.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bookingLocationUpdates = pgTable("booking_location_updates", {
  bookingId: uuid("booking_id").primaryKey().references(() => bookings.id, { onDelete: "cascade" }),
  providerId: uuid("provider_id").notNull().references(() => users.id),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------- AI --------------------------------------- */

export const aiDiagnoses = pgTable("ai_diagnoses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  inputText: text("input_text"),
  imageUrl: text("image_url"),
  serviceId: uuid("service_id").references(() => services.id),
  serviceCategory: text("service_category"),
  problemSummary: text("problem_summary"),
  possibleCauses: jsonb("possible_causes").$type<string[]>().notNull().default([]),
  urgency: text("urgency"),
  priceMin: integer("price_min"),
  priceMax: integer("price_max"),
  recommendedAction: text("recommended_action"),
  questionsForCustomer: jsonb("questions_for_customer").$type<string[]>().notNull().default([]),
  engine: text("engine").notNull().default("heuristic"), // gemini | heuristic
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("ai_diagnoses_user_index").on(table.userId)]);

export const priceEstimates = pgTable("price_estimates", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  serviceId: uuid("service_id").references(() => services.id),
  problemText: text("problem_text"),
  isEmergency: boolean("is_emergency").notNull().default(false),
  distanceKm: real("distance_km"),
  priceMin: integer("price_min").notNull(),
  priceMax: integer("price_max").notNull(),
  factors: jsonb("factors").$type<Record<string, number>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("price_estimates_user_index").on(table.userId)]);

/* ---------------------------- payments ------------------------------------ */

export const paymentStatusEnum = pgEnum("payment_status", ["created", "pending", "paid", "failed", "refunded"]);

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  providerId: uuid("provider_id").references(() => users.id, { onDelete: "set null" }),
  gateway: text("gateway").notNull().default("sandbox"), // sandbox | razorpay
  gatewayOrderId: text("gateway_order_id"),
  amountPaise: integer("amount_paise").notNull(),
  currency: text("currency").notNull().default("INR"),
  status: paymentStatusEnum("status").notNull().default("pending"),
  transactionId: text("transaction_id"),
  failureReason: text("failure_reason"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("payments_booking_index").on(table.bookingId),
  index("payments_customer_index").on(table.customerId),
  index("payments_status_index").on(table.status),
]);

export const providerEarnings = pgTable("provider_earnings", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: uuid("provider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  amountPaise: integer("amount_paise").notNull(),
  feePaise: integer("fee_paise").notNull().default(0),
  netPaise: integer("net_paise").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("provider_earnings_provider_index").on(table.providerId, table.createdAt)]);

/* ------------------------ reviews / social --------------------------------- */

export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  providerId: uuid("provider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(), // 1..5
  serviceQuality: integer("service_quality").notNull().default(0),
  professionalism: integer("professionalism").notNull().default(0),
  timeliness: integer("timeliness").notNull().default(0),
  comment: text("comment"),
  providerResponse: text("provider_response"),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  status: text("status").notNull().default("visible"), // visible | hidden
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("reviews_booking_unique").on(table.bookingId),
  index("reviews_provider_index").on(table.providerId, table.status),
]);

export const favorites = pgTable("favorites", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  providerId: uuid("provider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("favorites_unique").on(table.customerId, table.providerId),
  index("favorites_provider_index").on(table.providerId),
]);

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  text: text("text"),
  imageUrl: text("image_url"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("messages_booking_index").on(table.bookingId, table.createdAt),
  index("messages_sender_index").on(table.senderId),
]);

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  data: jsonb("data").$type<Record<string, unknown>>(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("notifications_user_index").on(table.userId, table.readAt),
]);

/* ------------------------ safety & disputes -------------------------------- */

export const trustedContacts = pgTable("trusted_contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  relation: text("relation"),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("trusted_contacts_user_index").on(table.userId)]);

export const sosEvents = pgTable("sos_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  latitude: text("latitude"),
  longitude: text("longitude"),
  note: text("note"),
  contactsNotified: integer("contacts_notified").notNull().default(0),
  status: text("status").notNull().default("sent"), // sent | acknowledged
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("sos_events_user_index").on(table.userId, table.createdAt)]);

export const reportStatusEnum = pgEnum("report_status", ["open", "investigating", "closed"]);

export const reports = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  reporterId: uuid("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(), // user | booking | review
  targetId: text("target_id").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: reportStatusEnum("status").notNull().default("open"),
  actionTaken: text("action_taken"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("reports_status_index").on(table.status)]);

export const disputeStatusEnum = pgEnum("dispute_status", ["open", "under_review", "provider_response", "resolved", "rejected", "escalated"]);

export const disputes = pgTable("disputes", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  providerId: uuid("provider_id").references(() => users.id, { onDelete: "set null" }),
  reason: text("reason").notNull(),
  description: text("description").notNull(),
  evidenceImages: jsonb("evidence_images").$type<string[]>().notNull().default([]),
  status: disputeStatusEnum("status").notNull().default("open"),
  providerResponse: text("provider_response"),
  providerRespondedAt: timestamp("provider_responded_at", { withTimezone: true }),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("disputes_booking_index").on(table.bookingId),
  index("disputes_status_index").on(table.status),
]);

export const disputeEvents = pgTable("dispute_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  disputeId: uuid("dispute_id").notNull().references(() => disputes.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("dispute_events_dispute_index").on(table.disputeId)]);

export const warrantyStatusEnum = pgEnum("warranty_status", ["open", "under_review", "approved", "rejected", "resolved"]);

export const warrantyClaims = pgTable("warranty_claims", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  providerId: uuid("provider_id").references(() => users.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  evidenceImages: jsonb("evidence_images").$type<string[]>().notNull().default([]),
  status: warrantyStatusEnum("status").notNull().default("open"),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("warranty_claims_booking_index").on(table.bookingId),
  index("warranty_claims_status_index").on(table.status),
]);

/* ------------------------------ admin -------------------------------------- */

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminId: uuid("admin_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  detail: jsonb("detail").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("audit_logs_created_index").on(table.createdAt),
  index("audit_logs_target_index").on(table.targetType, table.targetId),
]);

export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------ relations ---------------------------------- */

export const usersRelations = relations(users, ({ one, many }) => ({
  customer: one(customers),
  provider: one(providers),
  studentProvider: one(studentProviders),
  studentProfile: one(studentProfiles),
  providerProfile: one(providerProfiles),
  providerAvailability: one(providerAvailability),
  sessions: many(authSessions),
}));

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(users, { fields: [authSessions.userId], references: [users.id] }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  customer: one(users, { fields: [bookings.customerId], references: [users.id] }),
  provider: one(users, { fields: [bookings.providerId], references: [users.id] }),
  service: one(services, { fields: [bookings.serviceId], references: [services.id] }),
  aiDiagnosis: one(aiDiagnoses),
  statusHistory: many(bookingStatusHistory),
  invites: many(providerRequestInvites),
  payments: many(payments),
  messages: many(messages),
}));

export const servicesRelations = relations(services, ({ many }) => ({
  providerLinks: many(providerServices),
  bookings: many(bookings),
}));

export type Service = typeof services.$inferSelect;
export type User = typeof users.$inferSelect;
export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type BookingStatus = (typeof bookingStatusEnum.enumValues)[number];
export type Booking = typeof bookings.$inferSelect;
