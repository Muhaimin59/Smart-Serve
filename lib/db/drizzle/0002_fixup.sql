-- ===========================================================================
-- SmartServe 0002 - schema fixup (idempotent)
-- Aligns the 0001 marketplace schema with the drizzle schema in
-- lib/db/src/schema/index.ts: missing columns and tables that the
-- application code relies on. Every statement is safe to run twice.
-- ===========================================================================

-- ---- bookings: state-machine timestamps -----------------------------------
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- ---- provider_profiles: search radius --------------------------------------
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS service_radius_km text NOT NULL DEFAULT '10';

-- ---- customer_locations: saved home/office addresses ------------------------
CREATE TABLE IF NOT EXISTS customer_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  latitude text NOT NULL,
  longitude text NOT NULL,
  formatted_address text,
  area text,
  city text,
  state text,
  postal_code text,
  country text NOT NULL DEFAULT 'India',
  label text,
  is_default boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_locations_user_index ON customer_locations (user_id);

-- ---- provider_locations: live GPS for maps + matching radius ----------------
CREATE TABLE IF NOT EXISTS provider_locations (
  provider_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  latitude text NOT NULL,
  longitude text NOT NULL,
  service_radius_km text NOT NULL DEFAULT '10',
  sharing_booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---- booking_location_updates: provider ETA feed for an active booking ------
CREATE TABLE IF NOT EXISTS booking_location_updates (
  booking_id uuid PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES users(id),
  latitude text NOT NULL,
  longitude text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
