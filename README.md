# Smart Serve

**Smart Serve** is a full-stack, real-time marketplace for booking local service
providers (plumbers, electricians, AC / appliance repair, housekeeping, CCTV,
and more). Customers request a service, nearby verified providers are matched in
real time, quote and accept, the job is tracked door-to-door on a live map,
paid (with server-side payment verification), and reviewed.

Everything on this screen is backed by a real PostgreSQL database and a
Socket.IO real-time layer — there is no hardcoded demo data in the live flows.

---

## Features

- **Real-time matching engine** — a new request is broadcast to the best
  available nearby providers over Socket.IO (no polling). First-to-accept wins;
  the others are released. Includes a matching timeout with automatic
  re-broadcast to the next batch.
- **Controlled booking state machine** —
  `matching → accepted → on_the_way → arrived → in_progress → payment_pending →
  paid → review_pending`, with an arrival OTP verified on the customer side.
- **Three dashboards** — customer, provider, and admin, each with live stats
  (earnings, trust score, on-time rate, open/active jobs, platform KPIs,
  reports).
- **Live job tracking** — provider location updates stream to the customer map
  (Leaflet / OpenStreetMap) in real time.
- **In-app chat** per booking (with image attachments), delivered over Socket.IO.
- **Payments** — sandbox gateway by default; when Razorpay keys are configured,
  payments are verified server-side (never trust the client).
- **AI assistance** — Gemini-powered estimates and guidance when a key is
  configured; falls back to a labeled heuristic engine otherwise. AI output is
  always validated and labeled as an estimate.
- **Trust & safety** — document verification (ID / business proof), trust
  scoring, reviews, disputes, warranty, SOS / emergency, and trusted contacts.
- **Multi-language** (en / hi / ta / te / kn / mr) and **dark / light themes**.
- **Installable PWA** (mobile web) and a **React Native (Expo) mobile app**.
- **Security** — scrypt password hashing, bearer tokens, per-route rate
  limiting, role-based access control, and secrets kept in environment
  variables only (never in the frontend bundle).

---

## Tech stack

| Layer     | Technology                                                        |
| --------- | ----------------------------------------------------------------- |
| Frontend  | Vite 7 + React 19 + TypeScript, react-router, socket.io-client, Leaflet |
| API       | Node.js, Express 5, Socket.IO, Drizzle ORM, pino                  |
| Database  | PostgreSQL (embedded Postgres for zero-setup local dev)           |
| Mobile    | React Native + Expo (expo-router)                                |
| Monorepo  | pnpm workspaces + TypeScript project references                  |

---

## Repository layout

```
artifacts/
  api-server/          Express 5 + Socket.IO + Drizzle API (the backend)
  smart-serve-web/     React PWA (customer / provider / admin UIs)
  smart-serve/         Expo React Native mobile app
  mockup-sandbox/      UI design exploration (not part of the product)
  smart-serve-story/   Storybook-style UI exploration
lib/
  db/                  Drizzle schema + SQL migrations + pg pool
  integrations/        Shared integrations (e.g. api-client-react)
scripts/
  pg-dev.mjs           Embedded Postgres bootstrap for local dev
```

---

## Quick start (local)

Requires **Node 20+** and **pnpm** (`corepack enable`).

```bash
# 1. Install dependencies
pnpm install

# 2. Start an embedded PostgreSQL (zero-setup; stores data in .data/)
pnpm pg:dev            # runs in the foreground; or run it in a separate terminal

# 3. Start the API (builds nothing on boot; migrations + seed run automatically)
cd artifacts/api-server
DATABASE_URL="postgres://smartserve:smartserve@127.0.0.1:5432/smartserve" \
PORT=5000 DEMO_MODE=true pnpm dev
```

The API listens on **http://localhost:5000** and serves the built web app at
`/`. Migrations (`lib/db/drizzle/0000..0002`) are applied automatically on boot,
and demo data is seeded when `DEMO_MODE=true` and the database is empty.

To run the web app in Vite dev mode (hot reload) instead of the built bundle:

```bash
cd artifacts/smart-serve-web
VITE_API_URL="http://localhost:5000/api" pnpm dev
```

### Demo logins

When seeded, these accounts exist (password in parentheses). Demo accounts use
the `@demo.in` domain so real signups can never collide with them.

| Role     | Email           | Password      |
| -------- | --------------- | ------------- |
| Admin    | admin@demo.in   | Admin@12345   |
| Provider | arjun@demo.in   | Demo@12345    |
| Customer | rahul@demo.in   | Demo@12345    |

You can also create a fresh account from the app's **Sign up** screen — the
account is created immediately and you can log in right away.

---

## Configuration

All configuration is via environment variables (see `.env.example`). **No
secret is ever sent to the frontend.** Every variable is optional — the app
gracefully degrades when a service is unconfigured:

| Variable            | Purpose                                                        |
| ------------------- | -------------------------------------------------------------- |
| `PORT`              | API port (default `5000`)                                       |
| `DATABASE_URL`      | PostgreSQL connection string                                    |
| `DEMO_MODE`         | Seed demo data on an empty DB (disable in production)          |
| `CORS_ORIGIN`       | Allowed origins (empty = all, for local dev)                    |
| `GEMINI_API_KEY`    | Enables the Gemini AI engine (else labeled heuristic fallback)  |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Enable real payments (else sandbox) |
| `SMTP_*`            | Enable real email (else in-app dev outbox)                      |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | Enable Google sign-in (else hidden) |
| `MAPS_KEY`          | Enables Google Maps tiles (else OpenStreetMap)                  |

---

## Deploying for production

1. **Database** — point `DATABASE_URL` at a managed PostgreSQL
   (Neon / Supabase / RDS / Cloud SQL / a self-hosted instance). Run the
   migrations on boot (they are idempotent). Set `DEMO_MODE=false`.
2. **API** — any Node 20+ host (Render, Railway, Fly.io, a VPS, or a
   container). Set the environment variables above and run
   `pnpm --filter @workspace/api-server build && pnpm --filter
   @workspace/api-server start`.
3. **Web** — build with `pnpm --filter @workspace/smart-serve-web build`
   (outputs a static `dist/`) and serve it from any static host / CDN
   (Vercel, Netlify, Cloudflare Pages). Set `VITE_API_URL` to your API origin.
   The site is a PWA — users can "Install" it from their browser.
4. **Lock down CORS** (`CORS_ORIGIN`) and use HTTPS everywhere.

The API serves the built web app from `artifacts/smart-serve-web/dist` when it
exists, so a single process can host both — convenient for a quick, cheap
deployment.

---

## Building the mobile app (Android / iOS)

The mobile app lives in `artifacts/smart-serve` (Expo / React Native). To build
a signed **APK / AAB**:

1. Sign in / create an account at [expo.dev](https://expo.dev) and run
   `npx eas-cli login`.
2. From `artifacts/smart-serve`:
   ```bash
   npx eas build -p android --profile production
   # for a quick .apk (uncompressed) you can use a profile with
   # "buildType": "apk" in eas.json
   ```
3. EAS builds in the cloud (it has the Android SDK / Gradle / Java toolchain)
   and returns a downloadable `.apk` / `.aab` plus an Expo Go QR code for
   instant testing on a device.

> Note: building an APK requires the Android toolchain (SDK, Java, Gradle),
> which is provided by EAS in the cloud. The app's API URL is set with
> `EXPO_PUBLIC_API_URL` at build time.

---

## Real-time architecture

- Each authenticated user gets a private Socket.IO room (`user:<id>`). A
  provider socket is additionally fanned out to matching broadcast.
- When a customer creates a request, the matching engine selects the best
  available candidates and emits `provider:request` to their rooms. The first
  provider to `accept` wins; the rest are notified the request was filled.
- A matching timeout emits a re-broadcast to the next batch; if no one is
  available the request is closed with a friendly message.
- Location updates, chat, and status changes are all pushed over the socket,
  so every dashboard and the tracking map update live without refreshing.

---

## API surface (high level)

- `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/services`, `GET /api/services/:id`
- `POST /api/service-requests` (creates + starts matching), `GET /api/bookings/:id`
- Provider lifecycle: `/api/provider/requests/:inviteId/accept`,
  `/api/bookings/:id/on-the-way`, `/arrived`, `/start`, `/complete`
- `POST /api/payments`, `POST /api/payments/:id/charge`
- `POST /api/bookings/:id/review`
- `GET /api/customer/*` (bookings, notifications, profile, favorites, …)
- `GET /api/provider/dashboard`, `/api/provider/requests`, …
- `GET /api/admin/stats`, `/api/admin/reports`, `/api/admin/analytics`,
  `GET /api/admin/users`, …
- `GET /api/healthz`

All routes are role-protected and rate-limited. See
`artifacts/api-server/src/routes/` for the full implementation.
