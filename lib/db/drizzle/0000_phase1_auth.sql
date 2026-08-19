CREATE TYPE "user_role" AS ENUM ('customer', 'provider', 'student_provider', 'admin');
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL, "password_hash" text NOT NULL, "role" "user_role" NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");
CREATE TABLE "customers" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "display_name" text NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "providers" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "display_name" text NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "student_providers" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "display_name" text NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "auth_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "token_hash" text NOT NULL, "expires_at" timestamp with time zone NOT NULL,
  "last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone, "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "auth_sessions_token_hash_unique" ON "auth_sessions" USING btree ("token_hash");
CREATE INDEX "auth_sessions_user_id_index" ON "auth_sessions" USING btree ("user_id");
CREATE INDEX "auth_sessions_expires_at_index" ON "auth_sessions" USING btree ("expires_at");

CREATE TYPE "service_status" AS ENUM ('active', 'inactive');
CREATE TYPE "booking_status" AS ENUM ('requested', 'accepted', 'on_the_way', 'in_progress', 'completed', 'cancelled');
CREATE TYPE "verification_status" AS ENUM ('pending', 'verified', 'rejected');
CREATE TABLE "services" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "slug" text NOT NULL, "name" text NOT NULL, "description" text, "icon" text, "status" "service_status" DEFAULT 'active' NOT NULL, "created_at" timestamptz DEFAULT now() NOT NULL);
CREATE UNIQUE INDEX "services_slug_unique" ON "services" ("slug");
CREATE TABLE "provider_profiles" ("user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE cascade, "phone" text, "experience_years" text, "service_area" text, "city" text, "pincode" text, "starting_price" text, "verification_status" "verification_status" DEFAULT 'pending' NOT NULL, "emergency_available" boolean DEFAULT false NOT NULL, "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL);
CREATE TABLE "provider_services" ("provider_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade, "service_id" uuid NOT NULL REFERENCES "services"("id") ON DELETE cascade, "skill" text, "created_at" timestamptz DEFAULT now() NOT NULL);
CREATE UNIQUE INDEX "provider_services_unique" ON "provider_services" ("provider_id", "service_id");
CREATE TABLE "provider_availability" ("provider_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE cascade, "available" boolean DEFAULT false NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL);
CREATE TABLE "bookings" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "customer_id" uuid NOT NULL REFERENCES "users"("id"), "provider_id" uuid REFERENCES "users"("id"), "service_id" uuid NOT NULL REFERENCES "services"("id"), "status" "booking_status" DEFAULT 'requested' NOT NULL, "amount" text, "scheduled_at" timestamptz, "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL);
INSERT INTO "services" ("slug", "name", "description", "icon") VALUES ('plumbing','Plumbing','Pipes, taps, drains and water systems','droplet'), ('electrical','Electrical','Wiring, lights and power issues','zap'), ('cleaning','Cleaning','Home and office cleaning','sparkles'), ('ac-repair','AC Repair','Air conditioner service and repair','wind'), ('vehicle','Vehicle Repair','Car and bike service','truck'), ('computer','Computer Repair','Computer and laptop support','monitor'), ('tutoring','Tutoring','Local tutoring and lessons','book-open'), ('more','More services','Explore all services','grid') ON CONFLICT ("slug") DO NOTHING;
