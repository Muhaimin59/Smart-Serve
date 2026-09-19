-- ===========================================================================
-- SmartServe 0001 - full marketplace schema (idempotent)
-- Upgrades the phase-1 database (0000_phase1_auth.sql) to the complete
-- marketplace schema. Every statement is safe to run twice.
-- ===========================================================================

-- ---- new enums -------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status_v2') THEN
    CREATE TYPE booking_status_v2 AS ENUM (
      'draft','pending','matching','provider_invited','scheduled','accepted',
      'confirmed','on_the_way','arrived','in_progress','completed',
      'payment_pending','paid','review_pending','closed','cancelled','expired',
      'disputed','failed'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invite_status') THEN
    CREATE TYPE invite_status AS ENUM ('invited','accepted','rejected','expired');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('created','pending','paid','failed','refunded');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispute_status') THEN
    CREATE TYPE dispute_status AS ENUM ('open','under_review','provider_response','resolved','rejected','escalated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'warranty_status') THEN
    CREATE TYPE warranty_status AS ENUM ('open','under_review','approved','rejected','resolved');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
    CREATE TYPE report_status AS ENUM ('open','investigating','closed');
  END IF;
END $$;

-- ---- upgrade bookings.status to the full state machine ---------------------
ALTER TABLE bookings ALTER COLUMN status DROP DEFAULT;
ALTER TABLE bookings ALTER COLUMN status TYPE booking_status_v2
  USING CASE status::text WHEN 'requested' THEN 'matching' ELSE status::text END::booking_status_v2;
ALTER TABLE bookings ALTER COLUMN status SET NOT NULL;
ALTER TABLE bookings ALTER COLUMN status SET DEFAULT 'matching';
DROP TYPE IF EXISTS booking_status;

-- ---- extend existing tables -------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE services ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'home';
ALTER TABLE services ADD COLUMN IF NOT EXISTS base_price_min integer NOT NULL DEFAULT 300;
ALTER TABLE services ADD COLUMN IF NOT EXISTS base_price_max integer NOT NULL DEFAULT 1500;
ALTER TABLE services ADD COLUMN IF NOT EXISTS emergency_multiplier real NOT NULL DEFAULT 1.4;
ALTER TABLE services ADD COLUMN IF NOT EXISTS distance_per_km integer NOT NULL DEFAULT 15;
ALTER TABLE services ADD COLUMN IF NOT EXISTS warranty_days integer NOT NULL DEFAULT 7;
ALTER TABLE services ADD COLUMN IF NOT EXISTS emergency_supported boolean NOT NULL DEFAULT true;

ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS profile_image_url text;
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Kolkata';

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_emergency boolean NOT NULL DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS urgency text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS problem_description text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS latitude text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS longitude text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS location_address text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS location_area text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS location_city text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS location_state text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS location_postal_code text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Kolkata';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS estimated_price_min text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS estimated_price_max text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS provider_quote text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS final_amount text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ai_diagnosis_id uuid;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS matched_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS arrived_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS arrival_otp text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completion_notes text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completion_photo text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS parts_materials text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_confirmed_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS warranty_days integer NOT NULL DEFAULT 7;
CREATE INDEX IF NOT EXISTS bookings_scheduled_index ON bookings (scheduled_at);
CREATE INDEX IF NOT EXISTS bookings_created_index ON bookings (created_at);

-- ---- auth support ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS password_resets_user_index ON password_resets (user_id);

CREATE TABLE IF NOT EXISTS email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS email_outbox_created_index ON email_outbox (created_at);

-- ---- provider extensions -------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE cascade,
  college text,
  degree text,
  semester integer,
  part_time_hours text,
  bio text,
  is_student_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_working_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  day integer NOT NULL,
  start_hour integer NOT NULL,
  end_hour integer NOT NULL,
  UNIQUE (provider_id, day)
);

CREATE TABLE IF NOT EXISTS provider_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  doc_type text NOT NULL,
  filename text NOT NULL,
  stored_path text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL DEFAULT 0,
  verification_status text NOT NULL DEFAULT 'pending',
  note text,
  uploaded_at timestamptz DEFAULT now() NOT NULL,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS provider_documents_provider_index ON provider_documents (provider_id);

CREATE TABLE IF NOT EXISTS provider_portfolio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  title text NOT NULL,
  description text,
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS provider_portfolio_provider_index ON provider_portfolio (provider_id);

-- ---- matching engine -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE cascade,
  from_status text,
  to_status text NOT NULL,
  actor_id uuid REFERENCES users(id),
  reason text,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS booking_status_history_booking_index ON booking_status_history (booking_id);

CREATE TABLE IF NOT EXISTS provider_request_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE cascade,
  provider_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  batch integer NOT NULL DEFAULT 1,
  status invite_status NOT NULL DEFAULT 'invited',
  quote text,
  reject_reason text,
  invited_at timestamptz DEFAULT now() NOT NULL,
  responded_at timestamptz,
  UNIQUE (booking_id, provider_id, batch)
);
CREATE INDEX IF NOT EXISTS provider_request_invites_provider_index ON provider_request_invites (provider_id, status);
CREATE INDEX IF NOT EXISTS provider_request_invites_booking_index ON provider_request_invites (booking_id, status);

-- ---- AI ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  input_text text,
  image_url text,
  service_id uuid REFERENCES services(id),
  service_category text,
  problem_summary text,
  possible_causes jsonb NOT NULL DEFAULT '[]',
  urgency text,
  price_min integer,
  price_max integer,
  recommended_action text,
  questions_for_customer jsonb NOT NULL DEFAULT '[]',
  engine text NOT NULL DEFAULT 'heuristic',
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_diagnoses_user_index ON ai_diagnoses (user_id);

CREATE TABLE IF NOT EXISTS price_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  service_id uuid REFERENCES services(id),
  problem_text text,
  is_emergency boolean NOT NULL DEFAULT false,
  distance_km real,
  price_min integer NOT NULL,
  price_max integer NOT NULL,
  factors jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS price_estimates_user_index ON price_estimates (user_id);

-- ---- payments --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE cascade,
  customer_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  provider_id uuid REFERENCES users(id) ON DELETE SET NULL,
  gateway text NOT NULL DEFAULT 'sandbox',
  gateway_order_id text,
  amount_paise integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status payment_status NOT NULL DEFAULT 'pending',
  transaction_id text,
  failure_reason text,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS payments_booking_index ON payments (booking_id);
CREATE INDEX IF NOT EXISTS payments_customer_index ON payments (customer_id);
CREATE INDEX IF NOT EXISTS payments_status_index ON payments (status);

CREATE TABLE IF NOT EXISTS provider_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  amount_paise integer NOT NULL,
  fee_paise integer NOT NULL DEFAULT 0,
  net_paise integer NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS provider_earnings_provider_index ON provider_earnings (provider_id, created_at);

-- ---- social ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE cascade,
  customer_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  provider_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  rating integer NOT NULL,
  service_quality integer NOT NULL DEFAULT 0,
  professionalism integer NOT NULL DEFAULT 0,
  timeliness integer NOT NULL DEFAULT 0,
  comment text,
  provider_response text,
  responded_at timestamptz,
  status text NOT NULL DEFAULT 'visible',
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (booking_id)
);
CREATE INDEX IF NOT EXISTS reviews_provider_index ON reviews (provider_id, status);

CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  provider_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (customer_id, provider_id)
);
CREATE INDEX IF NOT EXISTS favorites_provider_index ON favorites (provider_id);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE cascade,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  text text,
  image_url text,
  read_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_booking_index ON messages (booking_id, created_at);
CREATE INDEX IF NOT EXISTS messages_sender_index ON messages (sender_id);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS notifications_user_index ON notifications (user_id, read_at);

-- ---- safety & disputes ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trusted_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  name text NOT NULL,
  phone text NOT NULL,
  relation text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS trusted_contacts_user_index ON trusted_contacts (user_id);

CREATE TABLE IF NOT EXISTS sos_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  latitude text,
  longitude text,
  note text,
  contacts_notified integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS sos_events_user_index ON sos_events (user_id, created_at);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  target_type text NOT NULL,
  target_id text NOT NULL,
  category text NOT NULL,
  description text,
  status report_status NOT NULL DEFAULT 'open',
  action_taken text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS reports_status_index ON reports (status);

CREATE TABLE IF NOT EXISTS disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE cascade,
  customer_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  provider_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  description text NOT NULL,
  evidence_images jsonb NOT NULL DEFAULT '[]',
  status dispute_status NOT NULL DEFAULT 'open',
  provider_response text,
  provider_responded_at timestamptz,
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS disputes_booking_index ON disputes (booking_id);
CREATE INDEX IF NOT EXISTS disputes_status_index ON disputes (status);

CREATE TABLE IF NOT EXISTS dispute_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL REFERENCES disputes(id) ON DELETE cascade,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  note text,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS dispute_events_dispute_index ON dispute_events (dispute_id);

CREATE TABLE IF NOT EXISTS warranty_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE cascade,
  customer_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  provider_id uuid REFERENCES users(id) ON DELETE SET NULL,
  description text NOT NULL,
  evidence_images jsonb NOT NULL DEFAULT '[]',
  status warranty_status NOT NULL DEFAULT 'open',
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS warranty_claims_booking_index ON warranty_claims (booking_id);
CREATE INDEX IF NOT EXISTS warranty_claims_status_index ON warranty_claims (status);

-- ---- admin --------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  detail jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_logs_created_index ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS audit_logs_target_index ON audit_logs (target_type, target_id);

CREATE TABLE IF NOT EXISTS platform_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
