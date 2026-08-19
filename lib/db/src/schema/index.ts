import { relations } from "drizzle-orm";
import { index, boolean, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/** Later roles are modeled now, but Phase 1 permits self-registration only as customer or provider. */
export const userRoleEnum = pgEnum("user_role", ["customer", "provider", "student_provider", "admin"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("users_email_unique").on(table.email)]);

export const customers = pgTable("customers", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
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

/** Opaque bearer sessions: only a SHA-256 digest of the client token is stored. */
export const serviceStatusEnum = pgEnum("service_status", ["active", "inactive"]);
export const bookingStatusEnum = pgEnum("booking_status", ["requested", "accepted", "on_the_way", "in_progress", "completed", "cancelled"]);
export const verificationStatusEnum = pgEnum("verification_status", ["pending", "verified", "rejected"]);

export const services = pgTable("services", {
  id: uuid("id").defaultRandom().primaryKey(), slug: text("slug").notNull(), name: text("name").notNull(), description: text("description"), icon: text("icon"), status: serviceStatusEnum("status").notNull().default("active"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("services_slug_unique").on(table.slug)]);
export const providerProfiles = pgTable("provider_profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }), phone: text("phone"), experienceYears: text("experience_years"), serviceArea: text("service_area"), serviceRadiusKm: text("service_radius_km").notNull().default("10"), city: text("city"), pincode: text("pincode"), startingPrice: text("starting_price"), verificationStatus: verificationStatusEnum("verification_status").notNull().default("pending"), emergencyAvailable: boolean("emergency_available").notNull().default(false), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const providerServices = pgTable("provider_services", { providerId: uuid("provider_id").notNull().references(() => users.id, { onDelete: "cascade" }), serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "cascade" }), skill: text("skill"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), }, (table) => [uniqueIndex("provider_services_unique").on(table.providerId, table.serviceId)]);
export const providerAvailability = pgTable("provider_availability", { providerId: uuid("provider_id").primaryKey().references(() => users.id, { onDelete: "cascade" }), available: boolean("available").notNull().default(false), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow() });
export const bookings = pgTable("bookings", { id: uuid("id").defaultRandom().primaryKey(), customerId: uuid("customer_id").notNull().references(() => users.id), providerId: uuid("provider_id").references(() => users.id), serviceId: uuid("service_id").notNull().references(() => services.id), status: bookingStatusEnum("status").notNull().default("requested"), problemDescription: text("problem_description"), address: text("address"), latitude: text("latitude"), longitude: text("longitude"), locationAddress: text("location_address"), locationArea: text("location_area"), locationCity: text("location_city"), locationState: text("location_state"), locationPostalCode: text("location_postal_code"), estimatedPriceMin: text("estimated_price_min"), estimatedPriceMax: text("estimated_price_max"), providerQuote: text("provider_quote"), finalAmount: text("final_amount"), amount: text("amount"), scheduledAt: timestamp("scheduled_at", { withTimezone: true }), acceptedAt: timestamp("accepted_at", { withTimezone: true }), startedAt: timestamp("started_at", { withTimezone: true }), completedAt: timestamp("completed_at", { withTimezone: true }), cancelledAt: timestamp("cancelled_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow() }, (table) => [index("bookings_customer_index").on(table.customerId), index("bookings_provider_index").on(table.providerId), index("bookings_service_index").on(table.serviceId), index("bookings_status_index").on(table.status)]);

export const customerLocations = pgTable("customer_locations", { id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), latitude: text("latitude").notNull(), longitude: text("longitude").notNull(), formattedAddress: text("formatted_address"), area: text("area"), city: text("city"), state: text("state"), postalCode: text("postal_code"), country: text("country"), label: text("label"), isDefault: boolean("is_default").notNull().default(true), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow() }, (table) => [index("customer_locations_user_index").on(table.userId)]);
export const providerLocations = pgTable("provider_locations", { providerId: uuid("provider_id").primaryKey().references(() => users.id, { onDelete: "cascade" }), latitude: text("latitude").notNull(), longitude: text("longitude").notNull(), serviceRadiusKm: text("service_radius_km").notNull().default("10"), sharingBookingId: uuid("sharing_booking_id").references(() => bookings.id, { onDelete: "set null" }), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow() });
export const bookingLocationUpdates = pgTable("booking_location_updates", { bookingId: uuid("booking_id").primaryKey().references(() => bookings.id, { onDelete: "cascade" }), providerId: uuid("provider_id").notNull().references(() => users.id), latitude: text("latitude").notNull(), longitude: text("longitude").notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow() });
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

export const usersRelations = relations(users, ({ one, many }) => ({
  customer: one(customers), provider: one(providers), studentProvider: one(studentProviders), sessions: many(authSessions),
}));
export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(users, { fields: [authSessions.userId], references: [users.id] }),
}));

export type Service = typeof services.$inferSelect;
export type User = typeof users.$inferSelect;
export type UserRole = (typeof userRoleEnum.enumValues)[number];
