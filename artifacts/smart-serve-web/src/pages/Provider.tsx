/* Provider: dashboard (requests + jobs), profile setup, earnings. */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Banknote, Building2, Camera, Check, ChevronRight, Clock, GraduationCap,
  MapPin, ShieldCheck, Star, Timer, ToggleRight, Truck, Upload, X,
} from "lucide-react";
import { get, post, put, uploadImage } from "../lib/api";
import { useAuth, useLang, useToast } from "../lib/store";
import { socketOn } from "../lib/socket";
import { fmtDate, fmtTime, inr, inrRange, timeAgo } from "../lib/format";
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Skeleton, Spinner, StatusBadge, Textarea, Toggle, WarningNote } from "../components/ui";
import { QuickStat } from "../components/booking";
import { BarChart } from "../components/charts";

/* ------------------------------- dashboard ------------------------------- */
export function ProviderDashboard() {
  const { t } = useLang();
  const { user } = useAuth();
  const { push } = useToast();
  const nav = useNavigate();
  const [dash, setDash] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [online, setOnline] = useState(false);
  const [quoteFor, setQuoteFor] = useState<any | null>(null);
  const [quote, setQuote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(() => {
    get("/provider/dashboard").then((r) => {
      setDash(r);
      setOnline(r.availability === true);
    }).catch(() => {});
    get("/provider/requests").then((r) => setRequests(r.requests ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const s1 = socketOn("provider:request", (p) => {
      if (p?.invite?.id) setRequests((r) => [p, ...r.filter((x) => x.inviteId !== p.invite.id)]);
      push(t("newRequest"), "success");
    });
    const s2 = socketOn("provider:accepted", (p) => {
      if (p?.bookingId) {
        setRequests((r) => r.filter((x) => x.bookingId !== p.bookingId));
        push(t("requestAccepted"), "success");
      }
    });
    const s3 = socketOn("provider:request_gone", (p) => {
      if (p?.bookingId) setRequests((r) => r.filter((x) => x.bookingId !== p.bookingId));
    });
    const s4 = socketOn("provider:request_expired", (p) => {
      if (p?.inviteId) setRequests((r) => r.filter((x) => x.inviteId !== p.inviteId));
    });
    const s5 = socketOn("booking:updated", () => refresh());
    return () => { s1(); s2(); s3(); s4(); s5(); };
  }, [refresh, push, t]);

  async function setAvailability(v: boolean) {
    setOnline(v);
    try {
      await put("/provider/availability", { available: v });
    } catch {
      setOnline(!v);
    }
  }

  async function accept(req: any) {
    setBusy(req.inviteId);
    try {
      await post(`/provider/requests/${req.inviteId}/accept`, quoteFor?.inviteId === req.inviteId ? { quote } : {});
      push(t("requestAccepted"), "success");
      setRequests((r) => r.filter((x) => x.inviteId !== req.inviteId));
      setQuoteFor(null);
      refresh();
    } catch (e) {
      push(e instanceof Error ? e.message : "Accept failed", "error");
      refresh();
    } finally {
      setBusy(null);
    }
  }

  async function decline(req: any, reason?: string) {
    setBusy(req.inviteId);
    try {
      await post(`/provider/requests/${req.inviteId}/reject`, { reason });
      setRequests((r) => r.filter((x) => x.inviteId !== req.inviteId));
      setQuoteFor(null);
    } catch (e) {
      push(e instanceof Error ? e.message : "Decline failed", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-3xl font-extrabold m-0">{user?.displayName ?? t("providerDashboard")}</h1>
          <p className="mt-1 mb-0 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
            {dash?.verificationStatus === "verified" ? (
              <><ShieldCheck size={14} style={{ color: "var(--success)" }} /> {t("verified")}</>
            ) : dash?.verificationStatus === "rejected" ? (
              <><X size={14} style={{ color: "var(--danger)" }} /> {t("verificationRejected")}</>
            ) : (
              <><ShieldCheck size={14} /> {t("verificationPending")}</>
            )}
            {dash?.rating ? <><Star size={13} style={{ fill: "var(--warning)", color: "var(--warning)" }} /> {dash.rating} ({dash.reviewCount})</> : ""}
          </p>
        </div>
        <Card className="!p-4 flex items-center gap-3">
          <div>
            <p className="font-bold text-sm m-0">{t("availability")}</p>
            <p className="text-xs m-0" style={{ color: online ? "var(--success)" : "var(--text-muted)" }}>{online ? t("online") : t("offline")}</p>
          </div>
          <Toggle on={online} onChange={setAvailability} />
        </Card>
      </div>

      {dash ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <QuickStat icon={<Banknote size={18} />} label={t("earningsMonth")} value={inr(Number(dash.earningsThisMonth))} sub={`${t("prevMonth")}: ${inr(Number(dash.earningsPreviousMonth))}`} />
          <QuickStat icon={<Check size={18} />} label={t("jobsDone")} value={String(dash.completedJobs)} />
          <QuickStat icon={<Timer size={18} />} label={t("trustScore")} value={`${dash.trustScore} · ${dash.trustGrade}`} />
          <QuickStat icon={<Star size={18} />} label={t("rating")} value={dash.rating ? String(dash.rating) : "New"} sub={`${dash.reviewCount} ${t("reviews")}`} />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      )}

      {/* incoming requests */}
      <h2 className="text-xl font-extrabold m-0 mb-3 flex items-center gap-2">
        {t("incomingRequests")}
        {requests.length > 0 && <Badge tone="primary" className="st-live">{requests.length}</Badge>}
      </h2>
      {!online && requests.length === 0 ? (
        <EmptyState
          icon={<ToggleRight size={24} />}
          title={t("goOnline")}
          subtitle={t("onlineHint")}
          action={<Button onClick={() => setAvailability(true)}>{t("goOnline")}</Button>}
        />
      ) : requests.length === 0 ? (
        <Card className="!p-8 text-center">
          <Spinner label={t("waitingRequests")} />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {requests.map((r) => (
            <Card key={r.inviteId} tilt className="!p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold m-0 flex items-center gap-2 flex-wrap">
                    {r.service?.name}
                    {r.emergency && <Badge tone="danger">{t("emergency")}</Badge>}
                  </p>
                  <p className="text-xs m-0 mt-1" style={{ color: "var(--text-muted)" }}>
                    {r.customer?.name} · {timeAgo(r.invitedAt)}
                    {r.distanceKm != null ? ` · ${r.distanceKm} km` : ""}
                  </p>
                </div>
                <Countdown expiresAt={r.invitedAt} expiresInSec={r.expiresInSec} />
              </div>
              {r.problem && <p className="text-sm mt-2 mb-1 line-clamp-2" style={{ color: "var(--text-muted)" }}>{r.problem}</p>}
              {r.location && <p className="text-xs m-0 mb-2 flex items-center gap-1" style={{ color: "var(--text-muted)" }}><MapPin size={12} /> {r.location}</p>}
              <div className="flex items-center justify-between mt-3">
                <span className="font-extrabold" style={{ color: "var(--primary)" }}>{r.estimate ? inrRange(r.estimate.min, r.estimate.max) : "—"}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" loading={busy === r.inviteId} onClick={() => decline(r)}>{t("reject")}</Button>
                  <Button size="sm" loading={busy === r.inviteId} onClick={() => (r.estimate ? setQuoteFor(r) : accept(r))}>
                    {t("accept")} <ChevronRight size={13} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* active + upcoming jobs */}
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-extrabold m-0 mb-3">{t("activeJobs")}</h2>
          {dash?.activeJobs?.length ? (
            <Card>
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {dash.activeJobs.map((j: any) => (
                  <Link key={j.id} to={"/bookings/" + j.id} className="flex items-center gap-3 p-4 no-underline hover:bg-black/5 dark:hover:bg-white/5" style={{ color: "inherit" }}>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold m-0 truncate text-sm">{j.service}</p>
                      <StatusBadge status={j.status} live={["on_the_way", "arrived", "in_progress"].includes(j.status)} />
                    </div>
                    {j.finalAmount ? <b>{inr(Number(j.finalAmount))}</b> : null}
                    <Truck size={15} style={{ color: "var(--primary)" }} />
                  </Link>
                ))}
              </div>
            </Card>
          ) : (
            <EmptyState icon={<Truck size={24} />} title={t("noActiveJobs")} />
          )}
        </div>
        <div>
          <h2 className="text-xl font-extrabold m-0 mb-3">{t("upcoming")}</h2>
          {dash?.upcoming?.length ? (
            <Card>
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {dash.upcoming.map((j: any) => (
                  <Link key={j.id} to={"/bookings/" + j.id} className="flex items-center gap-3 p-4 no-underline hover:bg-black/5 dark:hover:bg-white/5" style={{ color: "inherit" }}>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold m-0 truncate text-sm">{j.service}</p>
                      <p className="text-xs m-0 mt-1" style={{ color: "var(--text-muted)" }}>{j.scheduledAt ? fmtDate(j.scheduledAt) + " " + fmtTime(j.scheduledAt) : "—"}</p>
                    </div>
                    <StatusBadge status={j.status} />
                  </Link>
                ))}
              </div>
            </Card>
          ) : (
            <EmptyState icon={<Clock size={24} />} title={t("noUpcoming")} />
          )}
        </div>
      </div>

      {/* quote modal */}
      <Modal open={!!quoteFor} onClose={() => setQuoteFor(null)} title={t("acceptWithQuote")}>
        <Field label={t("quoteOptional") + " (₹)"}>
          <Input type="number" min={1} value={quote} onChange={(e) => setQuote(e.target.value)} placeholder={quoteFor?.estimate ? inrRange(quoteFor.estimate.min, quoteFor.estimate.max).replace(/[^0-9]/g, "") : ""} />
        </Field>
        <div className="flex gap-2 mt-5">
          <Button className="flex-1" loading={busy === quoteFor?.inviteId} onClick={() => quoteFor && accept(quoteFor)}>
            {t("accept")}
          </Button>
          <Button variant="ghost" onClick={() => setQuoteFor(null)}>{t("cancel")}</Button>
        </div>
      </Modal>
    </div>
  );
}

function Countdown({ expiresAt, expiresInSec }: { expiresAt: string; expiresInSec?: number }) {
  const [left, setLeft] = useState(Math.max(0, expiresInSec ?? 45));
  useEffect(() => {
    const target = new Date(expiresAt).getTime() + (expiresInSec ?? 45) * 1000;
    const iv = setInterval(() => setLeft(Math.max(0, Math.round((target - Date.now()) / 1000))), 1000);
    return () => clearInterval(iv);
  }, [expiresAt, expiresInSec]);
  const sec = Math.min(59, Math.floor(left / 60));
  const s = left % 60;
  return (
    <span className="badge" style={{ color: left < 15 ? "var(--danger)" : "var(--primary)", background: "var(--surface-2)" }}>
      <Timer size={11} className="inline mr-1" /> {sec > 0 ? `${sec}m ` : ""}{s}s
    </span>
  );
}

/* ------------------------------- profile ------------------------------- */
export function ProviderProfilePage() {
  const { t } = useLang();
  const { user } = useAuth();
  const { push } = useToast();
  const [f, setF] = useState({
    name: user?.displayName ?? "", phone: "", bio: "", experienceYears: "", serviceArea: "",
    city: "", pincode: "", startingPrice: "", serviceRadiusKm: "10", emergencyAvailable: false,
  });
  const [skills, setSkills] = useState<Set<string>>(new Set());
  const [allServices, setAllServices] = useState<any[]>([]);
  const [hours, setHours] = useState<Record<number, string>>({});
  const [docs, setDocs] = useState<any[]>([]);
  const [docType, setDocType] = useState("id_proof");
  const [busy, setBusy] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isStudent = user?.role === "student_provider";
  const [student, setStudent] = useState({ college: "", degree: "", semester: "", partTimeHours: "" });

  useEffect(() => {
    get("/provider/profile").then((r) => {
      const p = r.profile;
      if (p) setF((x) => ({
        ...x,
        phone: p.phone ?? x.phone,
        bio: p.bio ?? "",
        experienceYears: p.experienceYears ?? "",
        serviceArea: p.serviceArea ?? "",
        city: p.city ?? "",
        pincode: p.pincode ?? "",
        startingPrice: p.startingPrice ?? "",
        serviceRadiusKm: p.serviceRadiusKm ?? "10",
        emergencyAvailable: p.emergencyAvailable === true,
      }));
      setSkills(new Set((r.skills ?? []).map((s: any) => s.id)));
      for (const h of r.workingHours ?? []) setHours((x) => ({ ...x, [h.day]: `${String(h.startHour).padStart(2, "0")}:00-${String(h.endHour).padStart(2, "0")}:00` }));
      if (r.studentProfile) setStudent((x) => ({ ...x, college: r.studentProfile.college ?? "", degree: r.studentProfile.degree ?? "", semester: r.studentProfile.semester ? String(r.studentProfile.semester) : "", partTimeHours: r.studentProfile.partTimeHours ?? "" }));
    }).catch(() => {});
    get("/services").then((r) => setAllServices(r.services ?? [])).catch(() => {});
    get("/provider/documents").then((r) => setDocs(r.documents ?? [])).catch(() => {});
    get("/provider/location").then((r) => r.location ? push(r.location.city ? "" : t("locationSet"), "success") : null).catch(() => {});
  }, [t, push]);

  async function saveProfile() {
    setBusy("profile");
    try {
      await put("/provider/profile", {
        displayName: f.name,
        ...f,
        experienceYears: f.experienceYears || undefined,
        startingPrice: f.startingPrice || undefined,
      });
      if (skills.size > 0) {
        await put("/provider/services", { services: [...skills].map((serviceId) => ({ serviceId })) });
      }
      const hList = Object.entries(hours).flatMap(([day, range]) => {
        const m = /^(\d{1,2}):\d{2}-(\d{1,2}):\d{2}$/.exec(range ?? "");
        return m ? [{ day: Number(day), startHour: Number(m[1]), endHour: Number(m[2]) }] : [];
      });
      if (hList.length) await put("/provider/working-hours", { hours: hList });
      if (isStudent) await put("/provider/student-profile", student).catch(() => {});
      push(t("profileSaved"), "success");
    } catch (e) {
      push(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setBusy("");
    }
  }

  async function uploadDoc(file: File | null) {
    if (!file) return;
    setBusy("doc");
    try {
      const url = await uploadImage(file, "document");
      await post("/provider/documents", { docType, imageUrl: url });
      const r = await get("/provider/documents");
      setDocs(r.documents ?? []);
      push(t("docSubmitted"), "success");
    } catch (e) {
      push(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setBusy("");
    }
  }

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-extrabold m-0 mb-6">{t("providerProfile")}</h1>
      <div className="space-y-6">
        <Card className="!p-6">
          <div className="flex items-center gap-4 mb-5">
            <Avatar name={f.name || user?.email || "P"} src={user?.avatarUrl ?? avatar ?? undefined} size={64} />
            <div className="flex-1">
              <p className="font-bold m-0">{f.name}</p>
              <p className="text-xs m-0" style={{ color: "var(--text-muted)" }}>{isStudent ? t("studentBadge") + " provider" : t("provider")}</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBusy("avatar");
              try {
                const url = await uploadImage(file, "avatar");
                setAvatar(url);
                await put("/provider/profile", { avatarUrl: url });
                push(t("avatarUpdated"), "success");
              } catch { /* ignore */ }
              finally { setBusy(""); }
            }} />
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} loading={busy === "avatar"}>
              <Camera size={14} /> {t("avatar")}
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={t("name")}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label={t("phone")}><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+91…" /></Field>
            <div className="sm:col-span-2">
              <Field label={t("bio")}><Textarea rows={3} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder={t("bioHint")} /></Field>
            </div>
            <Field label={t("experienceYears") + " (yrs)"}><Input type="number" min={0} value={f.experienceYears} onChange={(e) => setF({ ...f, experienceYears: e.target.value })} /></Field>
            <Field label={t("serviceArea")}><Input value={f.serviceArea} onChange={(e) => setF({ ...f, serviceArea: e.target.value })} placeholder="e.g. Indiranagar + 5 km" /></Field>
            <Field label={t("city")}><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
            <Field label={t("pincode")}><Input value={f.pincode} onChange={(e) => setF({ ...f, pincode: e.target.value })} maxLength={6} /></Field>
            <Field label={t("startingPrice") + " (₹)"}><Input type="number" min={0} value={f.startingPrice} onChange={(e) => setF({ ...f, startingPrice: e.target.value })} /></Field>
            <Field label={t("serviceRadius") + " (km)"}><Input type="number" min={1} max={100} value={f.serviceRadiusKm} onChange={(e) => setF({ ...f, serviceRadiusKm: e.target.value })} /></Field>
          </div>
          <div className="flex items-center justify-between mt-4 rounded-2xl p-3" style={{ background: "var(--surface-2)" }}>
            <div>
              <p className="font-bold text-sm m-0">{t("emergencyAvailable")}</p>
              <p className="text-xs m-0" style={{ color: "var(--text-muted)" }}>{t("emergencyAvailableHint")}</p>
            </div>
            <Toggle on={f.emergencyAvailable} onChange={(v) => setF({ ...f, emergencyAvailable: v })} />
          </div>
          <Button className="mt-5" loading={busy === "profile"} onClick={saveProfile}><Check size={15} /> {t("save")}</Button>
        </Card>

        {/* skills */}
        <Card className="!p-6">
          <p className="font-bold m-0 mb-1">{t("skills")}</p>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>{t("skillsHint")}</p>
          <div className="flex flex-wrap gap-2">
            {allServices.map((s) => (
              <button
                key={s.id}
                type="button"
                className="badge"
                style={{
                  cursor: "pointer",
                  background: skills.has(s.id) ? "var(--primary)" : undefined,
                  color: skills.has(s.id) ? "var(--primary-text)" : undefined,
                }}
                onClick={() => setSkills((x) => { const n = new Set(x); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })}
              >
                {skills.has(s.id) && <Check size={11} className="inline mr-1" />}{s.name}
              </button>
            ))}
          </div>
        </Card>

        {/* working hours */}
        <Card className="!p-6">
          <p className="font-bold m-0 mb-4">{t("workingHours")}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {DAY_NAMES.map((d, i) => (
              <div key={d} className="flex items-center gap-3">
                <span className="w-10 text-sm font-bold" style={{ color: "var(--text-muted)" }}>{d}</span>
                <Input type="time" value={hours[i]?.split("-")[0] ?? ""} onChange={(e) => {
                  const range = hours[i] ?? "09:00-18:00";
                  const end = range.split("-")[1] ?? "18:00";
                  setHours({ ...hours, [i]: `${e.target.value}-${end}` });
                }} />
                <Input type="time" value={hours[i]?.split("-")[1] ?? ""} onChange={(e) => {
                  const range = hours[i] ?? "09:00-18:00";
                  const start = range.split("-")[0] ?? "09:00";
                  setHours({ ...hours, [i]: `${start}-${e.target.value}` });
                }} />
              </div>
            ))}
          </div>
        </Card>

        {/* student profile */}
        {isStudent && (
          <Card className="!p-6">
            <p className="font-bold m-0 mb-4 flex items-center gap-2"><GraduationCap size={17} style={{ color: "var(--primary)" }} /> {t("studentDetails")}</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={t("college")}><Input value={student.college} onChange={(e) => setStudent({ ...student, college: e.target.value })} /></Field>
              <Field label={t("degree")}><Input value={student.degree} onChange={(e) => setStudent({ ...student, degree: e.target.value })} /></Field>
              <Field label={t("semester")}><Input type="number" min={1} max={12} value={student.semester} onChange={(e) => setStudent({ ...student, semester: e.target.value })} /></Field>
              <Field label={t("partTimeHours") + " (hrs/wk)"}><Input type="number" min={0} value={student.partTimeHours} onChange={(e) => setStudent({ ...student, partTimeHours: e.target.value })} /></Field>
            </div>
          </Card>
        )}

        {/* verification documents */}
        <Card className="!p-6">
          <p className="font-bold m-0 mb-1 flex items-center gap-2"><ShieldCheck size={17} style={{ color: "var(--primary)" }} /> {t("verification")}</p>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>{t("verificationHint")}</p>
          <div className="flex gap-2 flex-wrap items-center">
            <Select value={docType} onChange={(e) => setDocType(e.target.value)} className="!w-auto">
              <option value="id_proof">ID proof</option>
              <option value="business_proof">Business proof</option>
              <option value="certificate">Certificate</option>
              <option value="other">Other</option>
            </Select>
            <input
              type="file" accept="image/*"
              onChange={(e) => uploadDoc(e.target.files?.[0] ?? null)}
              style={{ display: "none" }} id="doc-upload"
            />
            <label htmlFor="doc-upload" className="inline-flex">
              <Button variant="secondary" loading={busy === "doc"}>
                <Upload size={14} /> {t("uploadDocument")}
              </Button>
            </label>
          </div>
          {docs.length > 0 && (
            <div className="mt-4 space-y-2">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-xl px-3 py-2 text-sm" style={{ background: "var(--surface-2)" }}>
                  <span className="flex items-center gap-2"><Building2 size={14} /> {d.docType} · {d.filename}</span>
                  <Badge tone={d.verificationStatus === "verified" ? "success" : d.verificationStatus === "rejected" ? "danger" : "warning"}>
                    {d.verificationStatus}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------- earnings ------------------------------- */
export function ProviderEarnings() {
  const { t } = useLang();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    get(`/provider/earnings?days=${days}`).then(setData).catch(() => {});
  }, [days]);

  const gross = data?.total?.gross ?? 0;
  const fee = data?.total?.fee ?? 0;
  const net = data?.total?.net ?? 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-3xl font-extrabold m-0">{t("earnings")}</h1>
        <div className="flex gap-1.5">
          {[7, 30, 90].map((d) => (
            <button key={d} className="badge" style={{ cursor: "pointer", background: days === d ? "var(--primary)" : undefined, color: days === d ? "var(--primary-text)" : undefined }} onClick={() => setDays(d)}>
              {d}d
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <QuickStat icon={<Banknote size={18} />} label={t("grossEarnings")} value={inr(Math.round(gross / 100))} />
        <QuickStat icon={<Building2 size={18} />} label={t("platformFee")} value={inr(Math.round(fee / 100))} />
        <QuickStat icon={<Check size={18} />} label={t("netPayout")} value={inr(Math.round(net / 100))} />
      </div>
      {data?.earnings?.length ? (
        <>
          <Card className="!p-5 mb-6">
            <BarChart data={data.earnings.slice(0, 14).map((e: any) => ({ label: fmtDate(e.createdAt), value: Math.round(e.netPaise / 100) }))} />
          </Card>
          <Card>
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {data.earnings.map((e: any) => (
                <div key={e.id} className="flex items-center gap-4 p-4 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold m-0 truncate">{e.service}</p>
                    <p className="text-xs m-0" style={{ color: "var(--text-muted)" }}>{fmtDate(e.createdAt)}</p>
                  </div>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>-{inr(Math.round(e.feePaise / 100))} fee</span>
                  <b className="w-24 text-right">{inr(Math.round(e.netPaise / 100))}</b>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : (
        <EmptyState icon={<Banknote size={24} />} title={t("noEarningsYet")} subtitle={t("earningsHint")} />
      )}
    </div>
  );
}
