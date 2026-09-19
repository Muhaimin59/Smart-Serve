/* Formatting helpers (all display-localized via Intl). */

export function inr(amount?: string | number | null, paise = false): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (n === undefined || n === null || !Number.isFinite(n)) return "—";
  const value = paise ? n / 100 : n;
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function inrRange(min?: string | number | null, max?: string | number | null): string {
  const a = Number(min);
  const b = Number(max);
  if (!Number.isFinite(a) && !Number.isFinite(b)) return "—";
  if (!Number.isFinite(b) || a === b) return inr(min);
  return `₹${a.toLocaleString("en-IN")} – ₹${b.toLocaleString("en-IN")}`;
}

export function fmtDate(d?: string | Date | null, opts?: Intl.DateTimeFormatOptions): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", opts ?? { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function fmtTime(d?: string | Date | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).format(date);
}

export function fmtDateTime(d?: string | Date | null): string {
  if (!d) return "—";
  return `${fmtDate(d)} · ${fmtTime(d)}`;
}

export function timeAgo(d?: string | Date | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const s = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.replace(/@.*/, "").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "Pending",
  matching: "Finding provider",
  provider_invited: "Waiting for response",
  scheduled: "Scheduled",
  accepted: "Provider assigned",
  confirmed: "Confirmed",
  on_the_way: "On the way",
  arrived: "Provider arrived",
  in_progress: "In progress",
  completed: "Service completed",
  payment_pending: "Payment due",
  paid: "Paid",
  review_pending: "Review pending",
  closed: "Closed",
  cancelled: "Cancelled",
  expired: "Expired",
  disputed: "Disputed",
  failed: "Failed",
};

export const STATUS_TONES: Record<string, "info" | "primary" | "success" | "warning" | "danger" | "muted"> = {
  matching: "info",
  provider_invited: "info",
  scheduled: "info",
  pending: "info",
  accepted: "primary",
  confirmed: "primary",
  on_the_way: "warning",
  arrived: "warning",
  in_progress: "primary",
  completed: "success",
  payment_pending: "warning",
  paid: "success",
  review_pending: "info",
  closed: "success",
  cancelled: "muted",
  expired: "muted",
  disputed: "danger",
  failed: "danger",
  draft: "muted",
};

export const LIVE_STATUSES = ["matching", "provider_invited", "on_the_way", "arrived", "in_progress", "accepted"];

export function serviceIconName(icon?: string | null): string {
  return icon || "wrench";
}
