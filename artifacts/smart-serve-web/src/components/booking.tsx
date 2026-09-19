/* Booking-flow components: status timeline, matching radar, payment sheet,
   review form, dispute + warranty forms, AI result card, provider card. */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Banknote, CalendarClock, Check, ChevronRight, Clock, CreditCard, FileText, Flag,
  Gauge, MapPin, MessageSquare, ShieldCheck, Sparkles, Star, ThumbsUp, Timer,
} from "lucide-react";
import { useLang, useToast } from "../lib/store";
import { inr, inrRange, fmtDateTime, timeAgo } from "../lib/format";
import { cn } from "../lib/cn";
import { Badge, Button, Card, Field, Input, Modal, Select, Stars, Textarea, WarningNote } from "./ui";
import { post, get } from "../lib/api";

/* ------------------------------ status timeline ----------------------------- */

const FLOW = ["matching", "accepted", "on_the_way", "arrived", "in_progress", "completed", "payment_pending", "paid", "closed"];

export function StatusTimeline({ status, t }: { status: string; t: (k: string) => string }) {
  const idx = FLOW.indexOf(status);
  const cancelled = ["cancelled", "expired", "failed"].includes(status);
  const disputed = status === "disputed";
  const steps = useMemo(
    () => [
      { key: "matching", icon: <Gauge size={15} />, label: t("matching") },
      { key: "accepted", icon: <Check size={15} />, label: t("bookingConfirmed") },
      { key: "on_the_way", icon: <MapPin size={15} />, label: t("onTheWay") },
      { key: "arrived", icon: <Flag size={15} />, label: t("arrived") },
      { key: "in_progress", icon: <Sparkles size={15} />, label: t("inProgress") },
      { key: "completed", icon: <ThumbsUp size={15} />, label: t("serviceComplete") },
      { key: "payment_pending", icon: <CreditCard size={15} />, label: t("payToComplete") },
      { key: "paid", icon: <Banknote size={15} />, label: t("paid") },
      { key: "closed", icon: <ShieldCheck size={15} />, label: "Done" },
    ],
    [t],
  );
  return (
    <div>
      {cancelled && (
        <Badge tone="muted" className="mb-3">
          {status === "cancelled" ? t("cancel") : status === "expired" ? t("noResults") : t("error")}
        </Badge>
      )}
      {disputed && (
        <Badge tone="danger" className="mb-3">
          {t("disputes")}
        </Badge>
      )}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
        {steps.map((s, i) => {
          const done = !cancelled && idx >= i;
          const current = !cancelled && idx === i;
          return (
            <div key={s.key} className="flex items-center shrink-0">
              <div className="flex flex-col items-center gap-1 min-w-[64px]">
                <div
                  className={cn("step-dot w-8 h-8 rounded-full flex items-center justify-center border", current && "st-live")}
                  style={{
                    background: done ? "var(--primary)" : "var(--surface-2)",
                    color: done ? "var(--primary-text)" : "var(--text-muted)",
                    borderColor: done ? "var(--primary)" : "var(--border)",
                    boxShadow: current ? "0 0 0 4px var(--primary-soft)" : undefined,
                  }}
                >
                  {s.icon}
                </div>
                <span className="text-[11px] font-semibold text-center leading-tight" style={{ color: done ? "var(--text)" : "var(--text-muted)" }}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && <div className="w-6 h-0.5 rounded mb-4" style={{ background: done ? "var(--primary)" : "var(--border)" }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ matching radar ------------------------------ */

export function MatchingProgress({ bookingId, t }: { bookingId: string; t: (k: string) => string }) {
  const { live } = useMatchingState(bookingId);
  const steps = [t("matchingStep1"), t("matchingStep2"), t("matchingStep3"), t("matchingStep4"), t("matchingStep5")];
  const step = Math.min(4, Math.max(0, Math.floor(live / 25)));
  return (
    <div className="flex flex-col items-center py-6">
      <div className="radar mb-5">
        <div className="radar-sweep" />
        <span className="radar-dot" style={{ left: "62%", top: "30%" }} />
        <span className="radar-dot" style={{ left: "28%", top: "58%", animationDelay: "0.7s" }} />
        <span className="radar-dot" style={{ left: "48%", top: "70%", animationDelay: "1.3s" }} />
      </div>
      <div className="w-full max-w-sm space-y-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-3 text-sm">
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
              style={{
                background: i < step ? "var(--primary)" : i === step ? "var(--primary-soft)" : "var(--surface-2)",
                color: i < step ? "var(--primary-text)" : "var(--text-muted)",
                border: i === step ? "1.5px solid var(--primary)" : "1.5px solid var(--border)",
              }}
            >
              {i < step ? <Check size={12} /> : i + 1}
            </span>
            <span style={{ color: i <= step ? "var(--text)" : "var(--text-muted)", fontWeight: i === step ? 700 : 500 }}>{s}</span>
            {i === step && <span className="ml-auto" />}
          </div>
        ))}
      </div>
      {live >= 100 ? (
        <p className="mt-4 font-semibold" style={{ color: "var(--primary)" }}>{t("providerFound")}</p>
      ) : (
        <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
          {live < 40 ? t("waitingProvider") : `${Math.max(1, Math.floor(live / 25)) + 1} · ${t("awaitingResponse")}`}
        </p>
      )}
    </div>
  );
}

function useMatchingState(bookingId: string) {
  const [live, setLive] = useState(8);
  useEffect(() => {
    let p = 8;
    const id = setInterval(() => {
      p = Math.min(96, p + Math.random() * 9 + 3);
      setLive(p);
    }, 1600);
    return () => clearInterval(id);
  }, [bookingId]);
  return { live, setLive };
}

/* ------------------------------ payment sheet ------------------------------ */

export function PaymentSheet({ booking, onPaid }: { booking: any; onPaid: (b: any) => void }) {
  const { t } = useLang();
  const { toast } = useToast();
  const [payment, setPayment] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [testingFail, setTestingFail] = useState(false);

  async function createAndPay(failMode: boolean) {
    setBusy(true);
    try {
      const created = await post("/payments", { bookingId: booking.id });
      setPayment(created.payment);
      const outcome = failMode ? "fail" : "success";
      const res = await post(`/payments/${created.payment.id}/charge`, { outcome });
      setPayment(res.payment);
      if (res.payment.status === "paid") {
        toast("success", t("paySuccess"));
        const fresh = await get(`/bookings/${booking.id}`);
        onPaid(fresh.booking);
      } else {
        toast("error", t("payFailed"));
      }
    } catch (e: any) {
      toast("error", e?.message ?? t("error"));
    } finally {
      setBusy(false);
    }
  }

  const amount = booking.finalAmount || booking.providerQuote || booking.estimatedPriceMax || booking.amount || null;

  if (booking.status === "paid" || booking.payment?.status === "paid") {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <ShieldCheck size={26} style={{ color: "var(--success)" }} />
          <div>
            <p className="font-bold m-0">{t("paid")} · {inr(booking.payment?.amountPaise ?? amount, !!booking.payment?.amountPaise)}</p>
            <p className="text-sm m-0" style={{ color: "var(--text-muted)" }}>
              {t("transactionId")}: {booking.payment?.transactionId ?? "—"}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <p className="font-bold m-0 mb-1">{t("payForBooking")}</p>
      <p className="text-2xl font-extrabold m-0" style={{ color: "var(--primary)" }}>
        {inr(amount)}
        {amount && Number(amount) <= (Number(booking.estimatedPriceMax) || Infinity) && <span className="text-sm font-medium ml-2" style={{ color: "var(--text-muted)" }}>({t("finalPriceNote").slice(0, 40)}…)</span>}
      </p>
      {!payment ? (
        <Button className="mt-4 w-full" onClick={() => createAndPay(false)} loading={busy}>
          <CreditCard size={17} /> {t("payNow")} · {inr(amount)}
        </Button>
      ) : (
        payment.status === "failed" && (
          <div className="mt-3 space-y-2">
            <WarningNote>{payment.failureReason ?? t("payFailed")}</WarningNote>
            <Button className="w-full" onClick={() => createAndPay(false)} loading={busy}>
              {t("retry")}
            </Button>
          </div>
        )
      )}
      <p className="text-[11px] mt-3 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
        <CreditCard size={12} /> {t("markPaid")} — {t("securePayments")}. {t("testFail")}:{" "}
        <button className="underline" style={{ color: "var(--danger)" }} onClick={() => createAndPay(true)} disabled={busy}>
          {testingFail ? "..." : t("testFail")}
        </button>
      </p>
    </Card>
  );
}

/* ------------------------------- review form -------------------------------- */

export function ReviewForm({ bookingId, onDone }: { bookingId: string; onDone: (b: any) => void }) {
  const { t } = useLang();
  const { toast } = useToast();
  const [rating, setRating] = useState(5);
  const [quality, setQuality] = useState(5);
  const [pro, setPro] = useState(5);
  const [time, setTime] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await post(`/bookings/${bookingId}/review`, { rating, serviceQuality: quality, professionalism: pro, timeliness: time, comment: comment.trim() || undefined });
      toast("success", "Thank you for your review!");
      const fresh = await get(`/bookings/${bookingId}`);
      onDone(fresh.booking);
    } catch (e: any) {
      toast("error", e?.message ?? t("error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <p className="font-bold m-0 mb-3">{t("reviewService")}</p>
      <div className="flex items-center gap-3 mb-4">
        <Stars value={rating} onChange={setRating} size={26} />
        <span className="font-bold text-lg">{rating}/5</span>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: t("service"), value: quality, set: setQuality },
          { label: t("providers"), value: pro, set: setPro },
          { label: t("time"), value: time, set: setTime },
        ].map((f) => (
          <div key={f.label}>
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>{f.label}</p>
            <Stars value={f.value} onChange={f.set} size={17} />
          </div>
        ))}
      </div>
      <Field label={t("description")}>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} rows={3} />
      </Field>
      <Button onClick={submit} loading={busy} className="w-full">
        <Star size={16} /> {t("review")}
      </Button>
    </Card>
  );
}

/* ---------------------------- dispute / warranty ---------------------------- */

export function DisputeForm({ bookingId, onDone }: { bookingId: string; onDone: () => void }) {
  const { t } = useLang();
  const { toast } = useToast();
  const [reason, setReason] = useState("incorrect_service");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const reasons = [
    ["incorrect_service", "Incorrect service"],
    ["excessive_charge", "Excessive charge"],
    ["incomplete_service", "Incomplete service"],
    ["damaged_property", "Damaged property"],
    ["misconduct", "Provider misconduct"],
    ["payment_issue", "Payment issue"],
  ];
  async function submit() {
    setBusy(true);
    try {
      await post(`/bookings/${bookingId}/dispute`, { reason, description: description.trim() });
      toast("success", "Dispute raised. Our support team will review it.");
      onDone();
    } catch (e: any) {
      toast("error", e?.message ?? t("error"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <p className="font-bold m-0 mb-3">{t("raiseDispute")}</p>
      <Field label={t("disputeReason")}>
        <Select value={reason} onChange={(e) => setReason(e.target.value)}>
          {reasons.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("description")}>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} minLength={10} placeholder="Describe what went wrong (min 10 characters)..." />
      </Field>
      <Button variant="danger" onClick={submit} loading={busy} disabled={description.trim().length < 10} className="w-full">
        <Flag size={15} /> {t("raiseDispute")}
      </Button>
    </Card>
  );
}

export function WarrantyCard({ booking }: { booking: any }) {
  const { t } = useLang();
  const [claimOpen, setClaimOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const warrantyDays = booking.warrantyDays ?? 0;
  const completedAt = booking.completedAt ?? booking.updatedAt;
  const expiresAt = completedAt ? new Date(new Date(completedAt).getTime() + warrantyDays * 86_400_000) : null;
  const active = warrantyDays > 0 && expiresAt && expiresAt.getTime() > Date.now() && ["paid", "closed", "review_pending", "payment_pending", "disputed"].includes(booking.status);

  async function raise() {
    setBusy(true);
    try {
      await post(`/bookings/${booking.id}/warranty-claim`, { description: desc.trim() });
      toast("success", "Warranty claim raised. The provider and support will review it.");
      setClaimOpen(false);
      setDesc("");
    } catch (e: any) {
      toast("error", e?.message ?? t("error"));
    } finally {
      setBusy(false);
    }
  }

  if (warrantyDays === 0) return null;
  return (
    <>
      <Card className={cn(active && "!border-2")} >
        <div className="flex items-start gap-3">
          <ShieldCheck size={24} style={{ color: active ? "var(--success)" : "var(--text-muted)" }} className="mt-0.5" />
          <div className="flex-1">
            <p className="font-bold m-0">
              {t("warranty")} · {warrantyDays} {t("warrantyDays")}
            </p>
            <p className="text-sm m-0" style={{ color: "var(--text-muted)" }}>
              {active ? `${t("warrantyActive")} — until ${fmtDateTime(expiresAt)}` : t("warrantyInfo")}
            </p>
            {booking.warrantyClaim && (
              <Badge tone={booking.warrantyClaim.status === "approved" ? "success" : "warning"} className="mt-2">
                {t("claim")}: {booking.warrantyClaim.status}
              </Badge>
            )}
          </div>
          {active && !booking.warrantyClaim && (
            <Button size="sm" variant="secondary" onClick={() => setClaimOpen(true)}>
              {t("raiseWarranty")}
            </Button>
          )}
        </div>
      </Card>
      <Modal open={claimOpen} onClose={() => setClaimOpen(false)} title={t("raiseWarranty")}>
        <Field label={t("description")}>
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} placeholder="What happened again? When?" />
        </Field>
        <div className="flex gap-2 justify-end mt-2">
          <Button variant="ghost" onClick={() => setClaimOpen(false)}>
            {t("close")}
          </Button>
          <Button onClick={raise} loading={busy} disabled={desc.trim().length < 10}>
            {t("raiseClaim")}
          </Button>
        </div>
      </Modal>
    </>
  );
}

/* ------------------------------- AI result card ----------------------------- */

export function AIResultCard({ diagnosis, disclaimer, onFind, onBook, onEdit, busy }: {
  diagnosis: any;
  disclaimer?: string;
  onFind?: () => void;
  onBook?: () => void;
  onEdit?: () => void;
  busy?: boolean;
}) {
  const { t } = useLang();
  return (
    <Card tilt className="fade-up">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={19} style={{ color: "var(--primary)" }} />
        <h3 className="font-bold text-lg m-0">
          {t("aiDiagnosis")}
          <span className="text-xs font-semibold ml-2 badge badge-info align-middle">{diagnosis.engine === "gemini" ? "Google Gemini" : "SmartServe AI engine"}</span>
        </h3>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <InfoRow label={t("services")} value={diagnosis.service_category} />
        <InfoRow label={t("urgency")} value={<UrgencyBadge urgency={diagnosis.urgency} />} />
        <div className="sm:col-span-2">
          <InfoRow label={t("yourProblem")} value={<span className="whitespace-pre-wrap">{diagnosis.problem_summary}</span>} />
        </div>
        <div className="sm:col-span-2">
          <p className="label !mb-1">{t("possibleCauses")}</p>
          <ul className="m-0 pl-5">
            {(diagnosis.possible_causes ?? []).slice(0, 4).map((c: string, i: number) => (
              <li key={i} style={{ color: "var(--text-muted)" }}>
                {c}
              </li>
            ))}
          </ul>
        </div>
        <InfoRow label={t("priceEstimate")} value={<span className="font-extrabold text-lg" style={{ color: "var(--primary)" }}>{inrRange(diagnosis.estimated_price_min, diagnosis.estimated_price_max)}</span>} />
        <div className="sm:col-span-2">
          <p className="label !mb-1 flex items-center gap-1.5">
            <Timer size={13} /> {t("recommendedAction")}
          </p>
          <p className="m-0" style={{ color: "var(--text-muted)" }}>{diagnosis.recommended_action}</p>
        </div>
      </div>
      {disclaimer && (
        <p className="text-xs mt-4 mb-0 flex items-start gap-1.5" style={{ color: "var(--text-muted)" }}>
          <ShieldCheck size={13} className="mt-0.5 shrink-0" /> {disclaimer}
        </p>
      )}
      <div className="flex flex-wrap gap-2 mt-5">
        {onFind && (
          <Button onClick={onFind} loading={busy}>
            {t("findProvider")} <ChevronRight size={15} />
          </Button>
        )}
        {onBook && (
          <Button variant="secondary" onClick={onBook} disabled={busy}>
            {t("book")}
          </Button>
        )}
        {onEdit && (
          <Button variant="ghost" onClick={onEdit}>
            {t("edit")}
          </Button>
        )}
      </div>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="label !mb-1">{label}</p>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function UrgencyBadge({ urgency }: { urgency?: string }) {
  const map: Record<string, "info" | "warning" | "danger" | "success"> = { low: "success", medium: "info", high: "warning", critical: "danger" };
  return <Badge tone={map[urgency ?? "medium"] ?? "info"}>{urgency ?? "—"}</Badge>;
}

/* -------------------------------- provider card ----------------------------- */

export function ProviderCard({ p, onBook, onProfile, onFavorite, showDistance = true, selected }: {
  p: any;
  onBook?: () => void;
  onProfile?: () => void;
  onFavorite?: () => void;
  showDistance?: boolean;
  selected?: boolean;
}) {
  const { t } = useLang();
  return (
    <Card tilt className={cn(selected && "ring-2 ring-[var(--primary)]")}>
      <div className="flex items-start gap-3">
        <div className="relative">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
            {(p.name ?? "?").slice(0, 1).toUpperCase()}
          </div>
          {p.available ? (
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2" style={{ background: "var(--success)", borderColor: "var(--surface-solid)" }} title="Online" />
          ) : (
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2" style={{ background: "var(--text-muted)", borderColor: "var(--surface-solid)" }} title="Offline" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button className="font-bold text-base m-0 hover:underline cursor-pointer" style={{ background: "none", border: "none" }} onClick={onProfile}>
              {p.name}
            </button>
            {p.verificationStatus === "verified" && (
              <Badge tone="success">
                <ShieldCheck size={12} /> {t("verified")}
              </Badge>
            )}
            {p.role === "student_provider" && <Badge tone="info">{t("student")}</Badge>}
            {p.isDemo && <Badge tone="warning">{t("demo")}</Badge>}
          </div>
          <div className="flex items-center gap-2 mt-1 text-sm flex-wrap" style={{ color: "var(--text-muted)" }}>
            <span className="flex items-center gap-1">
              <Star size={13} style={{ color: "var(--warning)", fill: "var(--warning)" }} /> {p.rating > 0 ? p.rating : "New"}
              {p.reviewCount > 0 && <span>({p.reviewCount})</span>}
            </span>
            {p.experienceYears && <span>· {p.experienceYears}y {t("experience")}</span>}
            {showDistance && p.distanceKm !== null && p.distanceKm !== undefined && (
              <span className="flex items-center gap-1">
                · <MapPin size={13} /> {p.distanceKm} km
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <Badge tone="primary">{p.trustScore} {t("trustScore")}</Badge>
            {(p.skills ?? []).slice(0, 3).map((s: any) => (
              <Badge key={s.slug ?? s.name}>{s.name}</Badge>
            ))}
          </div>
        </div>
      </div>
      {(onBook || onFavorite) && (
        <div className="flex gap-2 mt-4">
          {onBook && (
            <Button size="sm" onClick={onBook} className="flex-1">
              {selected ? t("confirmed") : t("bookWithProvider")}
            </Button>
          )}
          {onFavorite && (
            <Button size="sm" variant={p.isFavorite ? "secondary" : "ghost"} onClick={onFavorite} aria-label={p.isFavorite ? t("favoriteRemove") : t("favoriteAdd")}>
              <Star size={15} style={{ fill: p.isFavorite ? "var(--warning)" : "transparent", color: "var(--warning)" }} />
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

/* --------------------------------- misc ------------------------------------- */

export function QuickStat({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card className="!p-4">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold m-0 truncate" style={{ color: "var(--text-muted)" }}>{label}</p>
          <p className="text-xl font-extrabold m-0 truncate">{value}</p>
          {sub && <p className="text-[11px] m-0 truncate" style={{ color: "var(--text-muted)" }}>{sub}</p>}
        </div>
      </div>
    </Card>
  );
}

export function TimeChip({ d }: { d?: string | null }) {
  if (!d) return null;
  return (
    <Badge tone="muted">
      <Clock size={12} /> {fmtDateTime(d)} · {timeAgo(d)}
    </Badge>
  );
}
