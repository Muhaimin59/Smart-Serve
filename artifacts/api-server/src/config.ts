import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
/** Repo root: src/ (or dist/) -> api-server -> artifacts -> root */
export const repoRoot = path.resolve(here, "..", "..", "..");

function str(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}
function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return !["false", "0", "no", "off"].includes(v.toLowerCase());
}

export const config = {
  env: str("NODE_ENV", "development"),
  isProduction: str("NODE_ENV", "development") === "production",
  port: num("PORT", 5000),
  databaseUrl: str("DATABASE_URL"),
  corsOrigin: str("CORS_ORIGIN"),
  demoMode: bool("DEMO_MODE", true),

  geminiApiKey: str("GEMINI_API_KEY"),
  geminiModel: str("GEMINI_MODEL", "gemini-2.0-flash"),

  googleClientId: str("GOOGLE_CLIENT_ID"),
  googleClientSecret: str("GOOGLE_CLIENT_SECRET"),

  razorpayKeyId: str("RAZORPAY_KEY_ID"),
  razorpayKeySecret: str("RAZORPAY_KEY_SECRET"),
  razorpayCurrency: str("RAZORPAY_CURRENCY", "INR"),
  /** Public origin used to build payment redirect links. */
  publicOrigin: str("PUBLIC_ORIGIN", `http://localhost:${num("PORT", 5000)}`),

  smtpHost: str("SMTP_HOST"),
  smtpPort: num("SMTP_PORT", 587),
  smtpUsername: str("SMTP_USERNAME"),
  smtpPassword: str("SMTP_PASSWORD"),
  smtpFrom: str("SMTP_FROM", "SmartServe <no-reply@smartserve.local>"),

  mapsApiKey: str("MAPS_API_KEY"),

  requestTimeoutSec: num("REQUEST_TIMEOUT_SEC", 45),
  maxMatchBatches: num("MAX_MATCH_BATCHES", 3),
  matchBatchSize: num("MATCH_BATCH_SIZE", 5),

  uploadDir: path.resolve(repoRoot, str("UPLOAD_DIR", "uploads")),
  maxUploadMb: num("MAX_UPLOAD_MB", 5),

  /** Platform fee taken from provider earnings (percent). */
  platformFeePercent: 10,
};

export function paymentGatewayConfigured(): boolean {
  return Boolean(config.razorpayKeyId && config.razorpayKeySecret);
}
export function smtpConfigured(): boolean {
  return Boolean(config.smtpHost);
}
export function googleOAuthConfigured(): boolean {
  return Boolean(config.googleClientId && config.googleClientSecret);
}
export function geminiConfigured(): boolean {
  return Boolean(config.geminiApiKey);
}
