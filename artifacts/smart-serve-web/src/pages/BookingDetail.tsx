/* Booking detail: live tracking, chat, payments, review, dispute, warranty — role-aware. */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle, Banknote, Camera, Check, ChevronLeft, Clock, Flag, MapPin,
  MessageCircle, Phone, RotateCcw, ShieldCheck, Sparkles, Star, ThumbsUp, Truck,
} from "lucide-react";
import { get, post, put, uploadImage } from "../lib/api";
import { useAuth, useLang, useToast } from "../lib/store";
import { socketOn } from "../lib/socket";
import { fmtDate, fmtTime, inr, inrRange, timeAgo } from "../lib/format";
import { Avatar, Badge, Button, Card, Field, Input, Modal, Skeleton, Stars, StatusBadge, Textarea, Toggle, WarningNote } from "../components/ui";
import { MapView } from "../components/map";
import { ChatPanel } from "../components/chat";
import { DisputeForm, MatchingProgress, PaymentSheet, ReviewForm, StatusTimeline, WarrantyCard } from "../components/booking";

const LIVE = ["on_the_way", "arrived", "in_progress"];
const MATCHING = ["matching", "provider_invited"];
const CAN_CANCEL = ["matching", "provider_invited", "accepted", "confirmed", "on_the_way"];
const CHAT_OPEN = ["accepted", "confirmed", "on_the_way", "arrived", "in_progress", "completed", "payment_pending"];

export default function BookingDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { t } = useLang();
  const { push } = useToast();

  const role = user?.role ?? "";
  const isProvider = role === "provider" || role === "student_provider";
  const isCustomer = role === "customer";
  const isAdmin = role === "admin";

  const [b, setB] = useState<any>(null);
  const [err, setErr] = useState("");
  const [liveLoc, setLiveLoc] = useState<any>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [complete, setComplete] = useState({ finalAmount: "", notes: "", parts: "", proof: "" as string | null });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const proofRef = useRef<HTMLInputElement>(null);
  const [response, setResponse] = useState("");

  const refresh = useCallback(() => {
    get("/bookings/" + id)
      .then((r) => {
        setB(r.booking);
        setErr("");
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Not found"));
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const s1 = socketOn("booking:updated", (p) => {
      if (p?.bookingId === id) refresh();
    });
    const s2 = socketOn("provider:location", (p) => {
      if (p?.bookingId === id) setLiveLoc(p);
    });
    const s3 = socketOn("provider:accepted", (p) => {
      if (p?.bookingId === id) {
        push(t("providerFound") + (p.providerName ? ": " + p.providerName : ""), "success");
        refresh();
      }
    });
    const s4 = socketOn("matching:progress", (p) => {
      if (p?.bookingId === id) refresh();
    });
    const s5 = socketOn("booking_cancelled", (p) => {
      if (p?.bookingId === id) refresh();
    });
    return () => { s1(); s2(); s3(); s4(); s5(); };
  }, [id, refresh, push, t]);

  /* provider: share live location while on the trip (before arrival) */
  const sharingLoc = isProvider && b?.providerId === user?.id && ["accepted", "confirmed", "on_the_way"].includes(b.status);
  useEffect(() => {
    if (!sharingLoc) return;
    const send = () => {
      if (!("geolocation" in navigator)) return;
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          put("/bookings/" + id + "/provider-location", {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }).catch(() => {}),
        () => {},
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 },
      );
    };
    send();
    const iv = setInterval(send, 15000);
    return () => clearInterval(iv);
  }, [sharingLoc, id]);

  async function act(fn: () => Promise<any>, okMsg?: string) {
    setBusy(true);
    setErr("");
    try {
      const res = await fn();
      if (okMsg) push(okMsg, "success");
      if (res?.booking) setB(res.booking);
      else refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (err) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Card className="!p-8 text-center">
          <AlertTriangle size={40} className="mx-auto mb-3" style={{ color: "var(--danger)" }} />
          <p className="font-bold">{err}</p>
          <Button variant="ghost" onClick={() => nav("/bookings")}>{t("back")}</Button>
        </Card>
      </div>
    );
  }
  if (!b) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Skeleton className="h-14 mb-4" />
        <div className="grid lg:grid-cols-3 gap-5"><Skeleton className="h-96 lg:col-span-2" /><Skeleton className="h-96" /></div>
      </div>
    );
  }

  const providerLoc = liveLoc && ["on_the_way", "accepted", "confirmed"].includes(b.status)
    ? { lat: Number(liveLoc.latitude), lon: Number(liveLoc.longitude), dist: liveLoc.distanceKm, eta: liveLoc.etaMinutes, at: liveLoc.updatedAt }
    : b.providerLocation
      ? { lat: Number(b.providerLocation.latitude), lon: Number(b.providerLocation.longitude), dist: b.providerLocation.distanceKm, eta: b.providerLocation.etaMinutes, at: b.providerLocation.updatedAt }
      : null;
  const custLoc = b.location?.latitude ? { lat: Number(b.location.latitude), lon: Number(b.location.longitude) } : null;
  const canChat = CHAT_OPEN.includes(b.status) && b.chatOpen;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <button className="text-sm font-bold mb-4" style={{ color: "var(--primary)", background: "none", border: "none", cursor: "pointer" }} onClick={() => nav(-1)}>
        <ChevronLeft size={14} className="inline mr-1" /> {t("back")}
      </button>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-2xl font-extrabold m-0">{b.service?.name}</h1>
        <StatusBadge status={b.status} live={LIVE.includes(b.status)} />
        {b.isEmergency && <Badge tone="danger">{t("emergency")}</Badge>}
        {b.scheduledAt && <Badge tone="muted"><Clock size={12} className="inline mr-1" /> {fmtDate(b.scheduledAt)} {fmtTime(b.scheduledAt)}</Badge>}
        <span className="ml-auto text-sm" style={{ color: "var(--text-muted)" }}>#{b.id.slice(0, 8)}</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card className="!p-5"><StatusTimeline status={b.status} t={t} /></Card>

          {/* matching */}
          {MATCHING.includes(b.status) && (
            <Card tilt className="!p-6">
              <MatchingProgress bookingId={b.id} t={t} />
              <div className="text-center">
                {isCustomer && (
                  <Button variant="ghost" onClick={() => setShowCancel(true)} disabled={busy}>
                    <AlertTriangle size={14} /> {t("cancel")}
                  </Button>
                )}
              </div>
            </Card>
          )}

          {/* provider card */}
          {b.provider && (
            <Card tilt className="!p-5">
              <div className="flex items-center gap-4 flex-wrap">
                <Avatar name={b.provider.name} src={b.provider.avatarUrl} size={54} />
                <div className="flex-1 min-w-[180px]">
                  <p className="font-extrabold m-0 flex items-center gap-2">
                    {b.provider.name}
                    {b.provider.verificationStatus === "verified" && <ShieldCheck size={16} style={{ color: "var(--success)" }} />}
                  </p>
                  <p className="text-xs m-0 mt-0.5" style={{ color: "var(--text-muted)" }}>
                    <Star size={11} className="inline" style={{ fill: "var(--warning)", color: "var(--warning)" }} /> {b.provider.rating || "New"}
                    {b.provider.experienceYears ? ` · ${b.provider.experienceYears}y exp` : ""}
                  </p>
                  <div className="flex gap-3 mt-1.5 text-xs font-bold">
                    <Link to={"/providers/" + b.provider.id} style={{ color: "var(--primary)" }}>{t("profile")} →</Link>
                    {b.provider.phone && <a href={"tel:" + b.provider.phone} className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}><Phone size={11} /> {b.provider.phone}</a>}
                  </div>
                </div>
                {b.status === "payment_pending" && (
                  <div className="text-right">
                    <p className="label mb-1">{t("finalAmount")}</p>
                    <p className="text-2xl font-extrabold m-0" style={{ color: "var(--primary)" }}>{inr(Number(b.finalAmount))}</p>
                  </div>
                )}
              </div>
              {b.completionNotes && <p className="text-sm mt-3 mb-0" style={{ color: "var(--text-muted)" }}><b>{t("completionNotes")}:</b> {b.completionNotes}</p>}
              {b.partsMaterials && <p className="text-xs mt-1 mb-0" style={{ color: "var(--text-muted)" }}><b>{t("partsMaterials")}:</b> {b.partsMaterials}</p>}
              {b.completionPhoto && <img src={b.completionPhoto} alt="proof" className="mt-3 rounded-xl max-h-48 object-cover" />}
            </Card>
          )}

          {/* live tracking */}
          {custLoc && (providerLoc || ["accepted", "confirmed"].includes(b.status)) && (
            <Card className="!p-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <p className="font-bold m-0 flex items-center gap-2"><Truck size={17} style={{ color: "var(--primary)" }} /> {t("liveTracking")}</p>
                {providerLoc && (
                  <div className="flex gap-4 text-sm">
                    <span><b style={{ color: "var(--primary)" }}>{providerLoc.dist ?? "—"}</b> km</span>
                    <span>ETA <b>{providerLoc.eta ?? "—"}</b> min</span>
                    <span className="hidden sm:inline" style={{ color: "var(--text-muted)" }}>{timeAgo(providerLoc.at)}</span>
                  </div>
                )}
              </div>
              <MapView
                height={300}
                center={custLoc ? [custLoc.lat, custLoc.lon] : undefined}
                points={[
                  { lat: custLoc.lat, lon: custLoc.lon, label: b.location?.address ?? t("yourLocation"), kind: "customer" },
                  ...(providerLoc ? [{ lat: providerLoc.lat, lon: providerLoc.lon, label: b.provider?.name ?? "Provider", kind: "provider" as const }] : []),
                ]}
                route={providerLoc && custLoc ? { from: { lat: providerLoc.lat, lon: providerLoc.lon, label: "p" }, to: { lat: custLoc.lat, lon: custLoc.lon, label: "c" } } : null}
              />
              {b.arrivalOtp && LIVE.includes(b.status) && (
                <div className="mt-3 rounded-2xl p-4 flex items-center justify-between" style={{ background: "var(--primary-soft)" }}>
                  <div>
                    <p className="label mb-1">{t("arrivalOtp")}</p>
                    <p className="text-3xl font-extrabold m-0 tracking-[.35em]" style={{ color: "var(--primary)" }}>{b.arrivalOtp}</p>
                  </div>
                  <p className="text-xs max-w-[180px]" style={{ color: "var(--text-muted)" }}>{t("otpHint")}</p>
                </div>
              )}
            </Card>
          )}

          {/* customer: confirm + pay */}
          {isCustomer && (b.status === "completed" || b.status === "payment_pending") && (
            <Card tilt className="!p-6">
              <h3 className="font-extrabold text-lg m-0 mb-3 flex items-center gap-2"><Banknote size={19} style={{ color: "var(--primary)" }} /> {t("payToComplete")}</h3>
              <div className="flex items-center justify-between rounded-2xl p-4 mb-4" style={{ background: "var(--surface-2)" }}>
                <span style={{ color: "var(--text-muted)" }}>{t("finalAmount")}</span>
                <b className="text-2xl" style={{ color: "var(--primary)" }}>{inr(Number(b.finalAmount))}</b>
              </div>
              {!b.customerConfirmedAt ? (
                <Button className="w-full" size="lg" onClick={() => act(() => post(`/bookings/${b.id}/confirm-completion`), t("confirmed"))} disabled={busy}>
                  <ThumbsUp size={16} /> {t("confirmCompletion")}
                </Button>
              ) : (
                <div className="mb-4">
                  <PaymentSheet booking={b} onPaid={(nb) => setB(nb)} />
                </div>
              )}
            </Card>
          )}

          {/* provider: complete flow */}
          {isProvider && b.providerId === user?.id && (
            <Card className="!p-5 space-y-3">
              <p className="label mb-0">{t("providerActions")}</p>
              {b.status === "accepted" && (
                <Button className="w-full" size="lg" loading={busy} onClick={() => act(() => post(`/bookings/${b.id}/on-the-way`), t("onTheWay"))}>
                  <Truck size={16} /> {t("startTrip")}
                </Button>
              )}
              {b.status === "on_the_way" && (
                <Button className="w-full" size="lg" loading={busy} onClick={() => act(() => post(`/bookings/${b.id}/arrived`), t("arrived"))}>
                  <Flag size={16} /> {t("markArrived")}
                </Button>
              )}
              {b.status === "arrived" && (
                <Button className="w-full" size="lg" loading={busy} onClick={() => act(() => post(`/bookings/${b.id}/start`), t("serviceStarted"))}>
                  <Sparkles size={16} /> {t("startService")}
                </Button>
              )}
              {b.status === "in_progress" && (
                <div className="space-y-3">
                  <Field label={t("finalAmount") + " (₹)"}>
                    <Input type="number" min={1} value={complete.finalAmount} onChange={(e) => setComplete({ ...complete, finalAmount: e.target.value })} placeholder={b.estimatedPriceMin ? inrRange(b.estimatedPriceMin, b.estimatedPriceMax).replace(/[^0-9]/g, "") : ""} />
                  </Field>
                  <Field label={t("completionNotes")}>
                    <Textarea rows={2} value={complete.notes} onChange={(e) => setComplete({ ...complete, notes: e.target.value })} placeholder="What was done…" />
                  </Field>
                  <Field label={t("partsMaterials")}>
                    <Input value={complete.parts} onChange={(e) => setComplete({ ...complete, parts: e.target.value })} placeholder="Parts used (optional)" />
                  </Field>
                  <div>
                    <input ref={proofRef} type="file" accept="image/*" className="hidden" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)} />
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => proofRef.current?.click()} loading={busy && !complete.proof}>
                        <Camera size={14} /> {complete.proof ? t("photoAttached") : t("attachProof")}
                      </Button>
                      {complete.proof && <img src={complete.proof} alt="proof" className="w-14 h-14 rounded-lg object-cover" />}
                    </div>
                  </div>
                  <Button
                    className="w-full" size="lg" loading={busy}
                    disabled={!(Number(complete.finalAmount) > 0)}
                    onClick={async () => {
                      if (proofFile && !complete.proof) {
                        try {
                          const url = await uploadImage(proofFile, "completion-proof");
                          setComplete((c) => ({ ...c, proof: url }));
                        } catch { /* optional */ }
                      }
                      await act(
                        () => post(`/bookings/${b.id}/complete`, {
                          finalAmount: Number(complete.finalAmount),
                          notes: complete.notes || undefined,
                          parts: complete.parts || undefined,
                          proofImage: complete.proof || undefined,
                        }),
                        t("serviceComplete"),
                      );
                    }}
                  >
                    <Check size={16} /> {t("markComplete")}
                  </Button>
                </div>
              )}
              {b.status === "completed" && (
                <Button className="w-full" loading={busy} onClick={() => act(() => post(`/bookings/${b.id}/request-payment`), t("paymentRequested"))}>
                  <Banknote size={15} /> {t("requestPayment")}
                </Button>
              )}
              {b.status === "payment_pending" && (
                <WarningNote>{t("awaitingPayment")} {b.customerConfirmedAt ? "✓" : t("awaitingConfirm")}</WarningNote>
              )}
            </Card>
          )}

          {/* review stage */}
          {b.status === "review_pending" && isCustomer && (
            <Card className="!p-5">
              <ReviewForm bookingId={b.id} onDone={(nb) => setB(nb)} />
            </Card>
          )}
          {b.status === "review_pending" && isProvider && b.providerId === user?.id && (
            <Card className="!p-5">
              <p className="font-bold m-0 mb-2">{t("customerReview")}:</p>
              {b.review ? (
                <div>
                  <Stars value={b.review.rating} size={16} />
                  {b.review.comment && <p className="text-sm mt-1 mb-2" style={{ color: "var(--text-muted)" }}>{b.review.comment}</p>}
                  <Field label={t("respondReview")}>
                    <Textarea rows={2} value={response} onChange={(e) => setResponse(e.target.value)} placeholder={t("respondPlaceholder")} />
                  </Field>
                  <Button size="sm" loading={busy} disabled={!response} onClick={() => act(() => put(`/bookings/${b.id}/review-response`, { response }), t("reviewResponded"))}>
                    {t("sendResponse")}
                  </Button>
                </div>
              ) : (
                <p className="text-sm m-0" style={{ color: "var(--text-muted)" }}>{t("noReviewYet")}</p>
              )}
            </Card>
          )}

          {/* paid / closed: warranty + dispute + repeat */}
          {["paid", "closed", "review_pending"].includes(b.status) && isCustomer && (
            <>
              <WarrantyCard booking={b} />
              <Card className="!p-5 flex flex-wrap gap-3 items-center">
                <div className="flex-1 min-w-[200px]">
                  <p className="font-bold m-0">{t("notSatisfied")}</p>
                  <p className="text-sm m-0" style={{ color: "var(--text-muted)" }}>{t("disputeHint")}</p>
                </div>
                <Button variant="ghost" onClick={() => setShowDispute(true)}><AlertTriangle size={14} /> {t("raiseDispute")}</Button>
                <Button variant="secondary" onClick={() => nav(`/book?repeat=${b.id}`)}><RotateCcw size={14} /> {t("repeatBooking")}</Button>
              </Card>
            </>
          )}

          {/* dispute state */}
          {b.status === "disputed" && (
            <Card className="!p-5">
              <p className="font-bold m-0 flex items-center gap-2" style={{ color: "var(--danger)" }}><AlertTriangle size={16} /> {t("disputeOpen")}</p>
              {b.dispute && <p className="text-sm mt-1 mb-0" style={{ color: "var(--text-muted)" }}>{b.dispute.reason}</p>}
            </Card>
          )}

          {/* terminal states */}
          {["cancelled", "expired", "failed"].includes(b.status) && (
            <Card className="!p-6 text-center">
              <p className="font-extrabold text-lg m-0">{b.status === "cancelled" ? t("bookingCancelled") : b.status === "expired" ? t("noProvidersFound") : t("error")}</p>
              <p className="text-sm mt-1 mb-4" style={{ color: "var(--text-muted)" }}>
                {b.status === "expired" ? t("matchExpiredHint") : t("cancelledHint")}
              </p>
              <Button onClick={() => nav(`/book?service=${b.service?.slug ?? ""}`)}><RotateCcw size={14} /> {t("tryAgain")}</Button>
            </Card>
          )}

          {/* AI diagnosis context */}
          {b.diagnosis && MATCHING.includes(b.status) && (
            <Card className="!p-5">
              <p className="label mb-2 flex items-center gap-1.5"><Sparkles size={13} /> {t("aiDiagnosis")}</p>
              <p className="text-sm m-0" style={{ color: "var(--text-muted)" }}>{b.diagnosis.problemSummary}</p>
              <div className="flex gap-4 mt-2 text-sm">
                <span>{t("urgency")}: <b>{b.diagnosis.urgency}</b></span>
                {b.estimatedPriceMin && <span>{t("priceEstimate")}: <b style={{ color: "var(--primary)" }}>{inrRange(b.estimatedPriceMin, b.estimatedPriceMax)}</b></span>}
              </div>
            </Card>
          )}

          {/* admin */}
          {isAdmin && (
            <Card className="!p-5">
              <p className="label mb-2">{t("adminTools")}</p>
              <Button variant="ghost" size="sm" onClick={() => setShowCancel(true)} disabled={busy}><AlertTriangle size={14} /> {t("cancelBooking")}</Button>
            </Card>
          )}
        </div>

        {/* right column */}
        <div className="space-y-5">
          {canChat && (
            <Card className="!p-0 overflow-hidden">
              <button className="w-full flex items-center justify-between p-4" style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }} onClick={() => setShowChat(!showChat)}>
                <span className="font-bold flex items-center gap-2"><MessageCircle size={16} style={{ color: "var(--primary)" }} /> {t("chat")}</span>
                <ChevronLeft size={15} className="transition-transform" style={{ transform: showChat ? "rotate(0deg)" : "rotate(90deg)", color: "var(--text-muted)" }} />
              </button>
              {showChat && <ChatPanel bookingId={b.id} openStatus={b.status} />}
            </Card>
          )}

          <Card className="!p-5">
            <p className="label mb-3">{t("details")}</p>
            <div className="space-y-2.5 text-sm">
              {b.problemDescription && <DetailRow k={t("yourProblem")} v={b.problemDescription} />}
              {b.location?.address && <DetailRow k={t("location")} v={b.location.address} />}
              {b.estimatedPriceMin && <DetailRow k={t("priceEstimate")} v={inrRange(b.estimatedPriceMin, b.estimatedPriceMax)} />}
              {b.amount && <DetailRow k={t("finalAmount")} v={inr(Number(b.amount))} />}
              {b.payment && (
                <DetailRow
                  k={t("payment")}
                  v={
                    <span className="flex items-center gap-2">
                      <StatusBadge status={b.payment.status === "paid" ? "paid" : b.payment.status === "failed" ? "failed" : "payment_pending"} />
                      {inr(Math.round(Number(b.payment.amountPaise) / 100))}
                    </span>
                  }
                />
              )}
              <DetailRow k={t("warranty")} v={b.warrantyDays ? `${b.warrantyDays} ${t("days")}` : "—"} />
              <DetailRow k={t("created")} v={fmtDate(b.createdAt)} />
            </div>
            {b.status === "cancelled" && (
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => setShowCancel(true)} disabled={busy}>{t("cancel")}</Button>
            )}
          </Card>
        </div>
      </div>

      {/* cancel modal */}
      <Modal open={showCancel} onClose={() => setShowCancel(false)} title={t("cancelBooking")}>
        <Field label={t("reason")}>
          <Textarea rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder={t("reasonPlaceholder")} />
        </Field>
        <div className="flex gap-2 mt-5">
          <Button variant="danger" loading={busy} onClick={() => act(() => post(`/bookings/${b.id}/cancel`, { reason: cancelReason || undefined }), t("bookingCancelled")).then(() => setShowCancel(false))}>
            {t("cancel")}
          </Button>
          <Button variant="ghost" onClick={() => setShowCancel(false)}>{t("keepBooking")}</Button>
        </div>
      </Modal>

      <Modal open={showDispute} onClose={() => setShowDispute(false)} title={t("raiseDispute")} wide>
        <DisputeForm bookingId={b.id} onDone={() => { setShowDispute(false); refresh(); }} />
      </Modal>
    </div>
  );
}

function DetailRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="shrink-0" style={{ color: "var(--text-muted)" }}>{k}</span>
      <span className="font-semibold text-right min-w-0 break-words">{v}</span>
    </div>
  );
}
