/* Customer: dashboard, services catalog, providers directory, provider profile, bookings list. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Banknote, Calendar, ChevronRight, Clock, Heart, MapPin, MessageCircle,
  Phone, Search, ShieldCheck, Sparkles, Star, Truck, User, Zap,
} from "lucide-react";
import { del, get, post } from "../lib/api";
import { useAuth, useLang, useToast } from "../lib/store";
import { socketOn } from "../lib/socket";
import { fmtDate, fmtTime, inr, inrRange, timeAgo, STATUS_LABELS } from "../lib/format";
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, Reveal, Select, Skeleton, Stars, StatusBadge, WarningNote } from "../components/ui";
import { MapView } from "../components/map";
import { MatchingProgress, ProviderCard, QuickStat, StatusTimeline, TimeChip } from "../components/booking";

const ACTIVE = ["matching", "provider_invited", "accepted", "confirmed", "on_the_way", "arrived", "in_progress", "payment_pending"];
const DONE = ["completed", "paid", "review_pending", "closed"];

/* ------------------------------ dashboard ------------------------------- */
export function CustomerDashboard() {
  const { t } = useLang();
  const { user } = useAuth();
  const nav = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    get("/customer/bookings").then((r) => setBookings(r.bookings ?? [])).catch(() => {});
    get("/customer/requests").then((r) => setRequests(r.requests ?? [])).catch(() => {});
    get("/customer/favorites").then((r) => setFavorites(r.favorites ?? [])).catch(() => {});
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    return socketOn("booking:updated", () => refresh());
  }, [refresh]);

  const active = bookings.filter((b) => ACTIVE.includes(b.status));
  const done = bookings.filter((b) => DONE.includes(b.status)).slice(0, 4);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
        <div>
          <h1 className="text-3xl font-extrabold m-0">{t("hello")}, {(user?.displayName ?? user?.email ?? "").split("@")[0]}</h1>
          <p className="mt-1 mb-0" style={{ color: "var(--text-muted)" }}>{t("welcomeBack")}</p>
        </div>
        <Button onClick={() => nav("/book")}><Sparkles size={16} /> {t("book")}</Button>
      </div>

      {/* AI quick bar */}
      <Card tilt className="!p-5 mb-6 !bg-gradient-to-r" >
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
            <Sparkles size={20} />
          </div>
          <div className="flex-1 min-w-[220px]">
            <p className="font-bold m-0">{t("aiAssistant")}</p>
            <p className="text-sm m-0" style={{ color: "var(--text-muted)" }}>{t("searchPlaceholder")}</p>
          </div>
          <Button variant="secondary" onClick={() => nav("/book")}>
            {t("describeProblem")} <ChevronRight size={15} />
          </Button>
        </div>
      </Card>

      {/* stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <QuickStat icon={<Zap size={18} />} label={t("active")} value={String(active.length)} />
        <QuickStat icon={<CheckIcon />} label={t("completed")} value={String(done.length)} />
        <QuickStat icon={<Heart size={18} />} label={t("favorites")} value={String(favorites.length)} />
        <QuickStat icon={<ShieldCheck size={18} />} label={t("safety")} value={requests.length ? "24/7" : "24/7"} sub={t("sosReady")} />
      </div>

      {/* live matching */}
      {requests.length > 0 && (
        <Card className="mb-6 border-2" >
          <div className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
              <h2 className="text-xl font-extrabold m-0">{t("matching")}</h2>
              <Badge tone="primary" className="st-live">LIVE</Badge>
            </div>
            <MatchingProgress bookingId={requests[0].id} t={t} />
            <div className="text-center">
              <Button onClick={() => nav("/bookings/" + requests[0].id)}>
                {t("track")} <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* active bookings */}
      <h2 className="text-xl font-extrabold m-0 mb-3">{t("active")}</h2>
      {loading ? (
        <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : active.length === 0 ? (
        <EmptyState
          icon={<Truck size={26} />}
          title={t("noActive")}
          subtitle={t("bookFirst")}
          action={<Button onClick={() => nav("/book")}>{t("book")}</Button>}
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {active.map((b) => (
            <BookingRow key={b.id} b={b} />
          ))}
        </div>
      )}

      {/* recent + favorites */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="text-xl font-extrabold m-0 mb-3">{t("recentBookings")}</h2>
          {done.length === 0 ? (
            <EmptyState icon={<Calendar size={24} />} title={t("noBookings")} subtitle={t("bookFirst")} />
          ) : (
            <Card>
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {done.map((b) => (
                  <Link key={b.id} to={"/bookings/" + b.id} className="flex items-center gap-4 p-4 no-underline hover:bg-black/5 dark:hover:bg-white/5" style={{ color: "inherit" }}>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold m-0 truncate">{b.service?.name}</p>
                      <p className="text-xs m-0" style={{ color: "var(--text-muted)" }}>{fmtDate(b.createdAt)} · {b.provider?.name}</p>
                    </div>
                    <StatusBadge status={b.status} />
                    {b.finalAmount ? <span className="font-bold text-sm">{inr(Number(b.finalAmount))}</span> : null}
                    <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>
        <div>
          <h2 className="text-xl font-extrabold m-0 mb-3">{t("favorites")}</h2>
          {favorites.length === 0 ? (
            <EmptyState icon={<Heart size={24} />} title={t("noFavorites")} subtitle={t("favoritesHint")} />
          ) : (
            <Card>
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {favorites.map((f) => (
                  <Link key={f.providerId} to={"/providers/" + f.providerId} className="flex items-center gap-3 p-3.5 no-underline hover:bg-black/5 dark:hover:bg-white/5" style={{ color: "inherit" }}>
                    <Avatar name={f.name} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold m-0 truncate text-sm">{f.name}</p>
                      <p className="text-xs m-0" style={{ color: "var(--text-muted)" }}>{f.email?.split("@")[0]}</p>
                    </div>
                    <ChevronRight size={15} style={{ color: "var(--text-muted)" }} />
                  </Link>
                ))}
              </div>
              <div className="p-3">
                <Link to="/favorites" className="text-sm font-bold" style={{ color: "var(--primary)" }}>{t("viewAll")} →</Link>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return <span className="inline-flex w-[18px] h-[18px] rounded-full items-center justify-center" style={{ background: "var(--success)", color: "#fff", fontSize: 11, fontWeight: 800 }}>✓</span>;
}

function BookingRow({ b }: { b: any }) {
  const { t } = useLang();
  return (
    <Card tilt className="!p-5 h-full">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="font-bold m-0 truncate">{b.service?.name}</p>
        <StatusBadge status={b.status} live={["on_the_way", "arrived", "in_progress"].includes(b.status)} />
      </div>
      <div className="text-sm space-y-1 mb-4" style={{ color: "var(--text-muted)" }}>
        {b.provider?.name && <p className="m-0 flex items-center gap-1.5"><User size={13} /> {b.provider.name}</p>}
        {b.location?.address && <p className="m-0 flex items-center gap-1.5"><MapPin size={13} /> {b.location.address}</p>}
        {b.scheduledAt ? <p className="m-0 flex items-center gap-1.5"><Clock size={13} /> {fmtDate(b.scheduledAt)} {fmtTime(b.scheduledAt)}</p> : null}
        {b.providerLocation?.distanceKm != null && <p className="m-0 font-semibold" style={{ color: "var(--primary)" }}>{b.providerLocation.distanceKm} km · ETA {b.providerLocation.etaMinutes ?? "—"} min</p>}
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" onClick={() => window.location.assign("/bookings/" + b.id)}>
          {["matching", "provider_invited"].includes(b.status) ? t("track") : t("track")} <ChevronRight size={14} />
        </Button>
        {b.status === "payment_pending" && (
          <Button size="sm" variant="secondary" onClick={() => window.location.assign("/bookings/" + b.id + "#pay")}>
            <Banknote size={14} /> {t("payNow")}
          </Button>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------- services ------------------------------- */
export function ServicesPage() {
  const { t } = useLang();
  const [services, setServices] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get("/services?category=" + encodeURIComponent(cat)).then((r) => {
      setServices(r.services ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [cat]);

  const cats = useMemo(() => Array.from(new Set(services.map((s) => s.category).filter(Boolean))), [services]);
  const list = q ? services.filter((s) => (s.name + " " + s.description).toLowerCase().includes(q.toLowerCase())) : services;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-extrabold m-0 mb-1">{t("services")}</h1>
      <p className="mb-6" style={{ color: "var(--text-muted)" }}>{t("chooseService")}</p>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <Input className="!pl-10" placeholder={t("searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button className="badge" style={{ cursor: "pointer", background: !cat ? "var(--primary)" : undefined, color: !cat ? "var(--primary-text)" : undefined }} onClick={() => setCat("")}>All</button>
          {cats.map((c) => (
            <button key={c} className="badge" style={{ cursor: "pointer" }} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="grid md:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState icon={<Search size={24} />} title={t("noResults")} subtitle={q} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((s, i) => (
            <Reveal key={s.id} delay={Math.min(i * 30, 240)}>
              <Link to={"/book?service=" + s.slug} className="block no-underline" style={{ color: "inherit" }}>
                <Card tilt className="h-full !p-5 group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold m-0 text-[15px]">{s.name}</p>
                      <p className="text-xs m-0 mt-1 line-clamp-2" style={{ color: "var(--text-muted)" }}>{s.description}</p>
                    </div>
                    <Badge tone="primary">{inrRange(s.basePriceMin, s.basePriceMax)}+</Badge>
                  </div>
                  <div className="flex items-center justify-between mt-4 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span className="font-semibold">{s.warrantyDays ? `${s.warrantyDays}d ${t("warranty")}` : "—"}</span>
                    <span className="font-bold" style={{ color: "var(--primary)" }}>{t("bookNow")} →</span>
                  </div>
                </Card>
              </Link>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- providers ------------------------------- */
export function ProvidersPage() {
  const { t } = useLang();
  const nav = useNavigate();
  const { user } = useAuth();
  const { push } = useToast();
  const [providers, setProviders] = useState<any[]>([]);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [verified, setVerified] = useState(false);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  const isCustomer = user?.role === "customer";

  const refresh = useCallback(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (verified) params.set("verified", "true");
    if (available) params.set("available", "true");
    get("/providers?" + params.toString())
      .then((r) => {
        setProviders(r.providers ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [q, verified, available]);

  useEffect(() => {
    const id = setTimeout(refresh, q ? 350 : 0);
    return () => clearTimeout(id);
  }, [refresh, q]);

  useEffect(() => {
    if (!isCustomer) return;
    get("/customer/favorites").then((r) => setFavIds(new Set((r.favorites ?? []).map((f: any) => f.providerId)))).catch(() => {});
  }, [isCustomer]);

  async function toggleFav(p: any) {
    if (favIds.has(p.id)) {
      await del("/customer/favorites/" + p.id).catch(() => {});
      setFavIds((s) => { const n = new Set(s); n.delete(p.id); return n; });
    } else {
      await post("/customer/favorites", { providerId: p.id }).catch(() => {});
      setFavIds((s) => { const n = new Set(s); n.add(p.id); return n; });
      push(t("favoriteAdded"), "success");
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-extrabold m-0 mb-1">{t("providers")}</h1>
      <p className="mb-6" style={{ color: "var(--text-muted)" }}>{t("verifiedProviders")}</p>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <Input className="!pl-10" placeholder="Search providers…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="badge" style={{ cursor: "pointer", background: verified ? "var(--primary)" : undefined, color: verified ? "var(--primary-text)" : undefined }} onClick={() => setVerified(!verified)}>
          <ShieldCheck size={12} className="inline mr-1" /> {t("verified")}
        </button>
        <button className="badge" style={{ cursor: "pointer", background: available ? "var(--primary)" : undefined, color: available ? "var(--primary-text)" : undefined }} onClick={() => setAvailable(!available)}>
          {t("online")}
        </button>
      </div>
      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : providers.length === 0 ? (
        <EmptyState icon={<Search size={24} />} title={t("noResults")} />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {providers.map((p) => (
            <ProviderCard
              key={p.id}
              p={{ ...p, isFavorite: favIds.has(p.id), favorite: favIds.has(p.id) }}
              showDistance={false}
              onProfile={() => nav("/providers/" + p.id)}
              onBook={() => nav("/book?provider=" + p.id)}
              onFavorite={isCustomer ? () => toggleFav(p) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------- provider profile ---------------------------- */
export function ProviderProfile() {
  const { id } = useParams();
  const { t } = useLang();
  const nav = useNavigate();
  const { user } = useAuth();
  const { push } = useToast();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const [bookModal, setBookModal] = useState(false);
  const [service, setService] = useState("");
  const [services, setServices] = useState<any[]>([]);

  useEffect(() => {
    get("/providers/" + id)
      .then((r) => setData(r))
      .catch((e) => setErr(e instanceof Error ? e.message : "Not found"));
  }, [id]);

  useEffect(() => {
    get("/services").then((r) => setServices(r.services ?? [])).catch(() => {});
  }, []);

  if (err) return <div className="max-w-3xl mx-auto px-4 py-16"><EmptyState title={err} action={<Button onClick={() => nav("/providers")}>{t("providers")}</Button>} /></div>;
  if (!data) return <div className="max-w-4xl mx-auto px-4 py-8"><Skeleton className="h-48 mb-4" /><div className="grid md:grid-cols-2 gap-4"><Skeleton className="h-64" /><Skeleton className="h-64" /></div></div>;

  const p = data.provider;
  const isCustomer = user?.role === "customer";

  async function toggleFav() {
    if (p.isFavorite) {
      await del("/customer/favorites/" + p.id).catch(() => {});
      setData((d: any) => ({ ...d, provider: { ...d.provider, isFavorite: false } }));
    } else {
      await post("/customer/favorites", { providerId: p.id }).catch(() => {});
      setData((d: any) => ({ ...d, provider: { ...d.provider, isFavorite: true } }));
      push(t("favoriteAdded"), "success");
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <button className="text-sm font-bold mb-4" style={{ color: "var(--primary)", background: "none", border: "none", cursor: "pointer" }}>← {t("providers")}</button>
      <div className="grid lg:grid-cols-3 gap-6">
        <Card tilt className="!p-6 lg:col-span-2">
          <div className="flex items-start gap-4 flex-wrap">
            <Avatar name={p.name} src={p.avatarUrl} size={72} />
            <div className="flex-1 min-w-[220px]">
              <h1 className="text-2xl font-extrabold m-0 flex items-center gap-2 flex-wrap">
                {p.name}
                {p.verificationStatus === "verified" && <ShieldCheck size={20} style={{ color: "var(--success)" }} />}
                {p.role === "student_provider" && <Badge tone="info">{t("studentBadge")}</Badge>}
              </h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap text-sm">
                <span className="flex items-center gap-1 font-bold"><Star size={14} style={{ fill: "var(--warning)", color: "var(--warning)" }} /> {p.rating || "New"} <span style={{ color: "var(--text-muted)" }}>({p.reviewCount})</span></span>
                <span className="badge" style={{ color: p.available ? "var(--success)" : "var(--text-muted)", background: "var(--surface-2)" }}>{p.available ? t("online") : t("offline")}</span>
                {p.city && <span className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}><MapPin size={13} /> {p.city}</span>}
              </div>
              {p.bio && <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>{p.bio}</p>}
            </div>
            <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-2xl" style={{ background: "var(--surface-2)" }}>
              <span className="text-3xl font-extrabold" style={{ color: "var(--primary)" }}>{p.trustScore}</span>
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{t("trustScore")} · {p.trustGrade}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-5">
            <Button onClick={() => setBookModal(true)}>{t("bookNow")}</Button>
            {isCustomer && (
              <Button variant="secondary" onClick={toggleFav}>
                <Heart size={15} style={{ fill: p.isFavorite ? "var(--danger)" : "none", color: p.isFavorite ? "var(--danger)" : undefined }} />
                {p.isFavorite ? t("removeFavorite") : t("addFavorite")}
              </Button>
            )}
            {p.phone && (
              <a href={"tel:" + p.phone} className="inline-flex">
                <Button variant="ghost"><Phone size={15} /> {p.phone}</Button>
              </a>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6">
            {[
              { v: data.stats.closedJobs, l: t("jobsDone") },
              { v: p.experienceYears ?? "—", l: t("experienceYears") },
              { v: p.startingPrice ? inr(Number(p.startingPrice)) + "+" : "—", l: t("startingPrice") },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl p-3 text-center" style={{ background: "var(--surface-2)" }}>
                <p className="font-extrabold text-lg m-0">{s.v}</p>
                <p className="text-xs m-0" style={{ color: "var(--text-muted)" }}>{s.l}</p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <p className="label mb-2">{t("skills")}</p>
            <div className="flex flex-wrap gap-2">
              {p.skills?.map((s: any) => <Badge key={s.id}>{s.name}</Badge>)}
            </div>
          </div>

          {(p as any).trust && (
            <details className="mt-6" open={false}>
              <summary className="cursor-pointer font-bold text-sm" style={{ color: "var(--primary)" }}>{t("trustBreakdown")}</summary>
              <div className="grid sm:grid-cols-2 gap-2 mt-3">
                {(p as any).trust.factors?.map((f: any) => (
                  <div key={f.label ?? f.key} className="flex items-center justify-between text-sm rounded-xl px-3 py-2" style={{ background: "var(--surface-2)" }}>
                    <span style={{ color: "var(--text-muted)" }}>{f.label ?? f.key}</span>
                    <b>{f.points ?? f.value}/100</b>
                  </div>
                ))}
              </div>
            </details>
          )}
        </Card>

        <div className="space-y-6">
          {p.distanceKm != null && (
            <Card className="!p-5">
              <p className="label mb-2">{t("distance")}</p>
              <p className="font-extrabold text-2xl m-0" style={{ color: "var(--primary)" }}>{p.distanceKm} km</p>
              <MapView height={200} points={[{ lat: Number(p.latitude ?? p.lat), lon: Number(p.longitude ?? p.lon), label: p.name, kind: "provider" }]} />
            </Card>
          )}
          <Card className="!p-5">
            <p className="label mb-3">{t("reviews")} ({p.reviewCount})</p>
            {(!data.reviews || data.reviews.length === 0) ? (
              <p className="text-sm m-0" style={{ color: "var(--text-muted)" }}>{t("noReviews")}</p>
            ) : (
              <div className="space-y-4">
                {data.reviews.slice(0, 5).map((r: any) => (
                  <div key={r.id} className="border-b pb-3 last:border-0" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">{r.customerName}</span>
                      <Stars value={r.rating} size={13} />
                    </div>
                    {r.comment && <p className="text-sm mt-1 mb-0" style={{ color: "var(--text-muted)" }}>{r.comment}</p>}
                    <p className="text-[11px] m-0 mt-1" style={{ color: "var(--text-muted)" }}>{timeAgo(r.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* book modal */}
      {bookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.5)" }} onClick={() => setBookModal(false)}>
          <Card className="!p-6 w-full max-w-sm fade-up" >
            <div onClick={(e) => e.stopPropagation()}>
              <h3 className="font-extrabold text-lg m-0 mb-4">{t("bookService")}</h3>
              <Field label={t("service")}>
                <Select value={service} onChange={(e) => setService(e.target.value)}>
                  <option value="">Select…</option>
                  {p.skills?.map((s: any) => (
                    <option key={s.id} value={s.slug}>{s.name}</option>
                  ))}
                </Select>
              </Field>
              <div className="flex gap-2 mt-5">
                <Button className="flex-1" disabled={!service} onClick={() => nav("/book?provider=" + p.id + "&service=" + service)}>
                  {t("continue")} <ChevronRight size={15} />
                </Button>
                <Button variant="ghost" onClick={() => setBookModal(false)}>{t("cancel")}</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ bookings list ------------------------------ */
export function BookingsList() {
  const { t } = useLang();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const isProvider = user?.role === "provider" || user?.role === "student_provider";
    const endpoint = user?.role === "admin" ? "/admin/bookings" : isProvider ? "/provider/jobs" : "/customer/bookings";
    get(endpoint)
      .then((r) => {
        const list = r.bookings ?? r.jobs ?? r.requests ?? [];
        setBookings(list);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user?.role, filter]);

  const list = filter === ACTIVE.join(",") ? bookings.filter((b) => ACTIVE.includes(b.status)) : filter ? bookings.filter((b) => b.status === filter) : bookings;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-extrabold m-0 mb-1">{t("myBookings")}</h1>
      <p className="mb-5" style={{ color: "var(--text-muted)" }}>{bookings.length} {t("bookings")}</p>
      <div className="flex gap-1.5 flex-wrap mb-6">
        <button className="badge" style={{ cursor: "pointer", background: !filter ? "var(--primary)" : undefined, color: !filter ? "var(--primary-text)" : undefined }} onClick={() => setFilter("")}>All</button>
        {["active", ...Object.keys(STATUS_LABELS)].map((s) => {
          if (s === "active") {
            return (
              <button key={s} className="badge" style={{ cursor: "pointer" }} onClick={() => setFilter(ACTIVE.join(","))}>
                {t("active")}
              </button>
            );
          }
          return (
            <button key={s} className="badge" style={{ cursor: "pointer" }} onClick={() => setFilter(s)}>
              {STATUS_LABELS[s as keyof typeof STATUS_LABELS]}
            </button>
          );
        })}
      </div>
      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState icon={<Calendar size={24} />} title={t("noBookings")} subtitle={t("bookFirst")} action={<Button onClick={() => window.location.assign("/book")}>{t("book")}</Button>} />
      ) : (
        <Card>
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {list.map((b) => (
              <Link key={b.id} to={"/bookings/" + b.id} className="flex items-center gap-4 p-4 no-underline hover:bg-black/5 dark:hover:bg-white/5" style={{ color: "inherit" }}>
                <div className="min-w-0 flex-1">
                  <p className="font-bold m-0 truncate flex items-center gap-2">
                    {b.service?.name}
                    {b.isEmergency && <Badge tone="danger">{t("emergency")}</Badge>}
                  </p>
                  <p className="text-xs m-0 mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {fmtDate(b.createdAt)} {b.provider?.name ? "· " + b.provider.name : ""} {b.customer ? "· " + b.customer.name : ""}
                  </p>
                  <div className="mt-1.5"><StatusBadge status={b.status} /></div>
                </div>
                <TimeChip d={b.scheduledAt ?? b.createdAt} />
                {b.finalAmount ? <span className="font-bold">{inr(Number(b.finalAmount))}</span> : b.estimatedPriceMin ? <span className="text-sm" style={{ color: "var(--text-muted)" }}>{inrRange(b.estimatedPriceMin, b.estimatedPriceMax)}</span> : null}
                <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
