/* Booking wizard: AI analysis -> provider choice -> location -> time -> confirm. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle, Camera, Check, ChevronLeft, ChevronRight, Clock,
  Image as ImageIcon, Loader2, MapPin, Sparkles, Trash2, User, Zap,
} from "lucide-react";
import { get, post, uploadImage } from "../lib/api";
import { useLang, useToast } from "../lib/store";
import { inrRange } from "../lib/format";
import { Badge, Button, Card, Field, Input, Skeleton, Textarea, Toggle, WarningNote } from "../components/ui";
import { AIResultCard, ProviderCard } from "../components/booking";
import { LocationPicker } from "../components/map";

type Step = "describe" | "analyze" | "provider" | "location" | "time" | "confirm";

export default function BookWizard() {
  const { t } = useLang();
  const { push } = useToast();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const presetProvider = params.get("provider") ?? "";
  const presetService = params.get("service") ?? "";
  const repeatId = params.get("repeat") ?? "";

  const [step, setStep] = useState<Step>(presetService && presetProvider ? "location" : "describe");
  const [services, setServices] = useState<any[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [text, setText] = useState(params.get("text") ?? "");
  const [photo, setPhoto] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [disclaimer, setDisclaimer] = useState("");
  const [providers, setProviders] = useState<any[]>([]);
  const [provider, setProvider] = useState<any | null>(null);
  const [loc, setLoc] = useState<{ lat: number; lon: number } | null>(null);
  const [addr, setAddr] = useState({ address: "", area: "", city: "", state: "", postalCode: "" });
  const [savedLoc, setSavedLoc] = useState<any>(null);
  const [mode, setMode] = useState<"asap" | "schedule" | "emergency">("asap");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    get("/services").then((r) => setServices(r.services ?? [])).catch(() => {});
    get("/customer/location").then((r) => {
      setSavedLoc(r.location ?? null);
      if (r.location) setLoc({ lat: Number(r.location.latitude), lon: Number(r.location.longitude) });
    }).catch(() => {});
  }, []);

  // resolve preset service slug -> id
  useEffect(() => {
    if (!presetService || services.length === 0) return;
    const s = services.find((x) => x.slug === presetService || x.id === presetService);
    if (s) setServiceId(s.id);
  }, [presetService, services]);

  // repeat booking: prefill from a previous booking
  useEffect(() => {
    if (!repeatId || services.length === 0) return;
    post("/customer/repeat-booking", { bookingId: repeatId })
      .then(async (r) => {
        const pf = r.prefill;
        if (!pf) return;
        if (pf.service?.id) setServiceId(pf.service.id);
        if (pf.problemDescription) setText(pf.problemDescription);
        if (pf.providerId) {
          try {
            const pr = await get("/providers" + (pf.service?.id ? "?service=" + pf.service.id : ""));
            const p = (pr.providers ?? []).find((x: any) => x.id === pf.providerId);
            if (p) setProvider(p);
          } catch { /* ignore */ }
        }
        if (pf.location?.latitude) {
          setLoc({ lat: Number(pf.location.latitude), lon: Number(pf.location.longitude) });
          setAddr({
            address: pf.location.address ?? "",
            area: pf.location.area ?? "",
            city: pf.location.city ?? "",
            state: pf.location.state ?? "",
            postalCode: pf.location.postalCode ?? "",
          });
        }
        setStep("location");
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeatId, services.length]);

  // preset provider (direct booking)
  useEffect(() => {
    if (!presetProvider || services.length === 0) return;
    const sid = serviceId || undefined;
    get("/providers" + (sid ? "?service=" + sid : ""))
      .then((r) => {
        const p = (r.providers ?? []).find((x: any) => x.id === presetProvider);
        if (p) setProvider(p);
      })
      .catch(() => {});
  }, [presetProvider, serviceId]);

  const service = useMemo(() => services.find((s) => s.id === serviceId), [services, serviceId]);

  /* ------------------------------ AI analyze ------------------------------ */
  async function analyze() {
    if (!service) return setErr(t("selectServiceFirst"));
    if (!text.trim() && !photo) return setErr(t("describeOrPhoto"));
    setBusy(true);
    setErr("");
    try {
      const res = await post("/ai/analyze", {
        text: text.trim(),
        serviceId: service.id,
        ...(photo ? { imageUrl: photo } : {}),
      });
      setDiagnosis(res.diagnosis);
      setDisclaimer(res.disclaimer);
      // load providers that offer this service
      const pr = await get("/providers?service=" + service.id).catch(() => ({ providers: [] }));
      setProviders(pr.providers ?? []);
      setStep("analyze");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI analysis failed");
    } finally {
      setBusy(false);
    }
  }

  async function attachPhoto(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const url = await uploadImage(file, "problem-photo");
      setPhoto(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  /* ------------------------------- submit --------------------------------- */
  async function submit() {
    if (!service || !loc) return;
    setBusy(true);
    setErr("");
    const scheduledAt = mode === "schedule" && when ? new Date(when).toISOString() : undefined;
    const body = {
      serviceId: service.id,
      latitude: loc.lat,
      longitude: loc.lon,
      problemDescription: text.trim() || undefined,
      isEmergency: mode === "emergency",
      scheduledAt,
      notes: undefined,
      locationAddress: addr.address || undefined,
      locationArea: addr.area || undefined,
      locationCity: addr.city || undefined,
      locationState: addr.state || undefined,
      locationPostalCode: addr.postalCode || undefined,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
    };
    try {
      let bookingId: string;
      if (provider) {
        // direct booking with chosen provider
        const res = await post("/bookings", { ...body, providerId: provider.id });
        bookingId = res.booking.id;
      } else {
        const res = await post("/service-requests", {
          ...body,
          aiDiagnosisId: diagnosis?.id ?? undefined,
          source: diagnosis ? "ai" : "manual",
        });
        bookingId = res.booking.id;
      }
      // save the location for next time
      if (loc) {
        put("/customer/location", {
          latitude: loc.lat,
          longitude: loc.lon,
          formattedAddress: [addr.address, addr.area, addr.city].filter(Boolean).join(", ") || undefined,
          area: addr.area || undefined,
          city: addr.city || undefined,
          state: addr.state || undefined,
          postalCode: addr.postalCode || undefined,
        }).catch(() => {});
      }
      nav("/bookings/" + bookingId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Booking failed");
      setBusy(false);
    }
  }

  /* ------------------------------- render --------------------------------- */
  const steps: { id: Step; label: string }[] = [
    { id: "describe", label: t("describeProblem") },
    { id: "analyze", label: t("aiDiagnosis") },
    { id: "provider", label: t("findProviders") },
    { id: "location", label: t("location") },
    { id: "time", label: t("timeSlot") },
    { id: "confirm", label: t("confirm") },
  ];
  const idx = steps.findIndex((s) => s.id === step);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* step header */}
      <div className="flex items-center gap-1 mb-8 overflow-x-auto no-scrollbar">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center shrink-0">
            <div className="flex items-center gap-2">
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
                style={{
                  background: i < idx ? "var(--primary)" : i === idx ? "var(--primary-soft)" : "var(--surface-2)",
                  color: i < idx ? "var(--primary-text)" : i === idx ? "var(--primary)" : "var(--text-muted)",
                  border: i === idx ? "1.5px solid var(--primary)" : "1.5px solid var(--border)",
                }}
              >
                {i < idx ? <Check size={13} /> : i + 1}
              </span>
              <span className="text-xs font-bold hidden sm:block" style={{ color: i <= idx ? "var(--text)" : "var(--text-muted)" }}>{s.label}</span>
            </div>
            {i < steps.length - 1 && <div className="w-5 sm:w-8 h-0.5 mx-1" style={{ background: i < idx ? "var(--primary)" : "var(--border)" }} />}
          </div>
        ))}
      </div>

      {err && (
        <div className="flex items-center gap-2 rounded-xl p-3 mb-4 text-sm font-semibold" style={{ background: "var(--danger-soft, rgba(220,38,38,.1))", color: "var(--danger)" }}>
          <AlertTriangle size={15} /> {err}
        </div>
      )}

      {/* ------------------------------ describe ------------------------------ */}
      {step === "describe" && (
        <Card tilt className="!p-6 fade-up">
          <h1 className="text-2xl font-extrabold m-0 mb-1 flex items-center gap-2">
            <Sparkles size={22} style={{ color: "var(--primary)" }} /> {t("describeProblem")}
          </h1>
          <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>{t("describeHint")}</p>
          <div className="space-y-4">
            <Field label={t("service")}>
              <select className="input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                <option value="">Select a service…</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label={t("yourProblem")}>
              <Textarea rows={4} placeholder="e.g. My split AC is running but not cooling since last night" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
            </Field>
            <div>
              <p className="label mb-2 flex items-center gap-1.5"><Camera size={13} /> {t("attachPhoto")} (optional)</p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => attachPhoto(e.target.files?.[0])} />
              <div className="flex items-center gap-3 flex-wrap">
                <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} loading={busy && !photo}>
                  <ImageIcon size={14} /> {photo ? t("replacePhoto") : t("uploadPhoto")}
                </Button>
                {photo && (
                  <span className="inline-flex items-center gap-2">
                    <img src={photo} alt="problem" className="w-16 h-16 rounded-xl object-cover" />
                    <button className="badge" style={{ cursor: "pointer", color: "var(--danger)" }} onClick={() => setPhoto(null)}>
                      <Trash2 size={12} /> Remove
                    </button>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-6">
            <Button size="lg" className="flex-1" onClick={analyze} loading={busy}>
              <Sparkles size={16} /> {t("analyzeWithAI")}
            </Button>
          </div>
        </Card>
      )}

      {/* ------------------------------- analyze ------------------------------- */}
      {step === "analyze" && diagnosis && (
        <div className="fade-up">
          <AIResultCard
            diagnosis={diagnosis}
            disclaimer={disclaimer}
            busy={busy}
            onEdit={() => setStep("describe")}
            onFind={() => setStep("provider")}
            onBook={providers.length > 0 ? () => setStep("provider") : undefined}
          />
        </div>
      )}

      {/* ------------------------------- provider ------------------------------- */}
      {step === "provider" && (
        <Card tilt className="!p-6 fade-up">
          <h2 className="text-xl font-extrabold m-0 mb-1">{t("findProviders")}</h2>
          <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
            {providers.length > 0
              ? `${providers.length} ${t("providers").toLowerCase()} near you offer ${service?.name}`
              : t("noProvidersFound")}
          </p>
          {providers.length > 0 ? (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {providers.map((p) => (
                <ProviderCard
                  key={p.id}
                  p={{ ...p, selected: provider?.id === p.id }}
                  showDistance={false}
                  onBook={() => setProvider(p)}
                  onProfile={() => window.location.assign("/providers/" + p.id)}
                />
              ))}
            </div>
          ) : (
            <Emptyish text={t("noProvidersFound")} sub={t("aiMatchingNote")} />
          )}
          <div className="flex gap-2 mt-6 flex-wrap">
            <Button size="lg" className="flex-1" disabled={!provider && providers.length > 0} onClick={() => setStep("location")}>
              {provider ? t("continue") : t("matchMe")} <ChevronRight size={15} />
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setStep("analyze")}><ChevronLeft size={15} /> {t("back")}</Button>
          </div>
        </Card>
      )}

      {/* ------------------------------- location ------------------------------- */}
      {step === "location" && (
        <Card tilt className="!p-6 fade-up">
          <h2 className="text-xl font-extrabold m-0 mb-1 flex items-center gap-2"><MapPin size={20} style={{ color: "var(--primary)" }} /> {t("serviceLocation")}</h2>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>{t("locationHint")}</p>
          <div className="mb-4">
            <LocationPicker marker={loc ? [loc.lat, loc.lon] : null} onPick={(lat, lon) => setLoc({ lat, lon })} />
            {loc && (
              <p className="text-xs mt-2 mb-0 font-mono" style={{ color: "var(--text-muted)" }}>{lat2(loc.lat)}, {lat2(loc.lon)}</p>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={t("address")}><Input value={addr.address} onChange={(e) => setAddr({ ...addr, address: e.target.value })} placeholder="Flat / House no, Street" /></Field>
            <Field label={t("area")}><Input value={addr.area} onChange={(e) => setAddr({ ...addr, area: e.target.value })} placeholder="Area / Landmark" /></Field>
            <Field label={t("city")}><Input value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} placeholder="City" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("state")}><Input value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} placeholder="State" /></Field>
              <Field label={t("pincode")}><Input value={addr.postalCode} onChange={(e) => setAddr({ ...addr, postalCode: e.target.value })} placeholder="PIN" maxLength={6} /></Field>
            </div>
          </div>
          {savedLoc && (
            <button className="text-xs font-bold mt-3" style={{ color: "var(--primary)", background: "none", border: "none", cursor: "pointer" }} onClick={() => {
              setLoc({ lat: Number(savedLoc.latitude), lon: Number(savedLoc.longitude) });
              setAddr({ address: savedLoc.formattedAddress ?? "", area: savedLoc.area ?? "", city: savedLoc.city ?? "", state: savedLoc.state ?? "", postalCode: savedLoc.postalCode ?? "" });
            }}>
              Use saved location ({savedLoc.area ?? savedLoc.formattedAddress ?? savedLoc.city ?? "saved"})
            </button>
          )}
          <div className="flex gap-2 mt-6">
            <Button size="lg" className="flex-1" disabled={!loc} onClick={() => setStep("time")}>{t("continue")} <ChevronRight size={15} /></Button>
            <Button variant="ghost" size="lg" onClick={() => setStep("provider")}><ChevronLeft size={15} /></Button>
          </div>
        </Card>
      )}

      {/* -------------------------------- time -------------------------------- */}
      {step === "time" && (
        <Card tilt className="!p-6 fade-up">
          <h2 className="text-xl font-extrabold m-0 mb-1 flex items-center gap-2"><Clock size={20} style={{ color: "var(--primary)" }} /> {t("whenDoYouNeedIt")}</h2>
          <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>{t("timeHint")}</p>
          <div className="space-y-3">
            <TimeOption active={mode === "asap"} onClick={() => setMode("asap")} title={t("asap")} sub={t("asapHint")} icon={<Zap size={18} />} />
            <TimeOption active={mode === "schedule"} onClick={() => setMode("schedule")} title={t("schedule")} sub={t("scheduleHint")} icon={<Clock size={18} />} />
            {mode === "schedule" && (
              <div className="pl-2">
                <Input type="datetime-local" value={when} min={new Date(Date.now() + 15 * 60000).toISOString().slice(0, 16)} onChange={(e) => setWhen(e.target.value)} />
              </div>
            )}
            <TimeOption active={mode === "emergency"} onClick={() => setMode("emergency")} title={t("emergency")} sub={t("emergencyHint")} icon={<AlertTriangle size={18} />} danger />
          </div>
          {mode === "emergency" && (
            <WarningNote className="mt-4">
              {t("emergencyNote")}
            </WarningNote>
          )}
          <div className="flex gap-2 mt-6">
            <Button size="lg" className="flex-1" disabled={mode === "schedule" && !when} onClick={() => setStep("confirm")}>{t("continue")} <ChevronRight size={15} /></Button>
            <Button variant="ghost" size="lg" onClick={() => setStep("location")}><ChevronLeft size={15} /></Button>
          </div>
        </Card>
      )}

      {/* ------------------------------- confirm ------------------------------- */}
      {step === "confirm" && (
        <Card tilt className="!p-6 fade-up">
          <h2 className="text-xl font-extrabold m-0 mb-4">{t("reviewBooking")}</h2>
          <div className="space-y-3 text-sm">
            <ConfirmRow k={t("service")} v={service?.name} />
            {diagnosis && <ConfirmRow k={t("priceEstimate")} v={<b style={{ color: "var(--primary)" }}>{inrRange(diagnosis.estimated_price_min, diagnosis.estimated_price_max)}</b>} />}
            <ConfirmRow k={t("provider")} v={provider ? provider.name : <Badge tone="info">{t("aiMatching")}</Badge>} />
            <ConfirmRow k={t("location")} v={[addr.address, addr.area, addr.city].filter(Boolean).join(", ") || (loc ? `${lat2(loc.lat)}, ${lat2(loc.lon)}` : "—")} />
            <ConfirmRow k={t("timeSlot")} v={mode === "asap" ? t("asap") : mode === "emergency" ? <Badge tone="danger">{t("emergency")}</Badge> : when ? new Date(when).toLocaleString() : "—"} />
            {text && <ConfirmRow k={t("yourProblem")} v={text.length > 140 ? text.slice(0, 140) + "…" : text} />}
          </div>
          <WarningNote className="mt-4">{t("finalPriceNote")}</WarningNote>
          <div className="flex gap-2 mt-6">
            <Button size="lg" className="flex-1" onClick={submit} loading={busy}>
              {provider ? t("bookNow") : t("startMatching")} <ChevronRight size={15} />
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setStep("time")} disabled={busy}><ChevronLeft size={15} /></Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function lat2(n: number) {
  return n.toFixed(5);
}

function TimeOption({ active, onClick, title, sub, icon, danger }: { active: boolean; onClick: () => void; title: string; sub: string; icon: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      className="w-full flex items-center gap-3 rounded-2xl border p-4 text-left transition-all"
      style={{
        borderColor: active ? (danger ? "var(--danger)" : "var(--primary)") : "var(--border-strong)",
        background: active ? (danger ? "rgba(220,38,38,.07)" : "var(--primary-soft)") : "transparent",
        cursor: "pointer",
      }}
      onClick={onClick}
    >
      <span className="shrink-0" style={{ color: active ? (danger ? "var(--danger)" : "var(--primary)") : "var(--text-muted)" }}>{icon}</span>
      <span className="min-w-0">
        <span className="font-bold block" style={{ color: danger && active ? "var(--danger)" : "var(--text)" }}>{title}</span>
        <span className="text-xs block" style={{ color: "var(--text-muted)" }}>{sub}</span>
      </span>
      {active && <Check size={18} className="ml-auto shrink-0" style={{ color: danger ? "var(--danger)" : "var(--primary)" }} />}
    </button>
  );
}

function ConfirmRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl px-3 py-2.5" style={{ background: "var(--surface-2)" }}>
      <span className="shrink-0" style={{ color: "var(--text-muted)" }}>{k}</span>
      <span className="font-semibold text-right">{v}</span>
    </div>
  );
}

function Emptyish({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: "var(--border-strong)" }}>
      <p className="font-bold m-0">{text}</p>
      {sub && <p className="text-sm m-0 mt-1" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}
