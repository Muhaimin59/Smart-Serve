/* Premium landing page: hero with live AI demo, services, how it works, providers. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, BadgeCheck, Banknote, Camera, Clock, Cpu, Droplets, Gauge, Home,
  Laptop, Leaf, MessageCircle, Paintbrush, Plug, Radio, ShieldCheck, Sparkles,
  Star, Truck, Users, Wrench, Zap,
} from "lucide-react";
import { get } from "../lib/api";
import { useLang } from "../lib/store";
import { Badge, Button, Card, Reveal } from "../components/ui";
import { inrRange } from "../lib/format";

const ICONS: Record<string, any> = {
  zap: Zap, droplets: Droplets, hammer: Wrench, wind: Gauge, "plug-zap": Plug, washer: Plug,
  snowflake: Droplets, "paint-roller": Paintbrush, sparkles: Sparkles, bug: ShieldCheck,
  laptop: Laptop, smartphone: Cpu, cctv: Radio, wifi: Radio, droplet: Droplets, truck: Truck,
  scissors: Sparkles, leaf: Leaf, key: ShieldCheck, sun: Clock, car: Truck, wrench: Wrench,
  monitor: Laptop, "book-open": Home,
};

function serviceIcon(icon?: string) {
  const C = (ICONS[icon ?? ""] ?? Wrench) as any;
  return <C size={22} />;
}

export default function Landing() {
  const { t } = useLang();
  const [services, setServices] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [demo, setDemo] = useState<{ q: string; result?: any }>({ q: "" });

  useEffect(() => {
    get<{ services: any[] }>("/services").then((r) => setServices(r.services ?? [])).catch(() => setServices([]));
    // landing page shows top providers anonymously via a sanitized public snapshot
    fetch("/api/providers/public")
      .then((r) => (r.ok ? r.json() : { providers: [] }))
      .then((r) => setProviders((r.providers ?? []).slice(0, 3)))
      .catch(() => setProviders([]));
  }, []);

  return (
    <div>
      {/* ------------------------------ hero ------------------------------ */}
      <section className="max-w-7xl mx-auto px-4 pt-14 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <Reveal>
            <Badge tone="primary" className="mb-5">
              <Sparkles size={13} /> {t("aiPowered")} · {t("liveTracking")} · {t("transparentPricing")}
            </Badge>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-extrabold leading-[1.08] m-0" style={{ letterSpacing: "-0.02em" }}>
              {t("heroTitle").split(" ").slice(0, -2).join(" ")}{" "}
              <span className="gradient-text">{t("heroTitle").split(" ").slice(-2).join(" ")}</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-5 text-lg max-w-xl" style={{ color: "var(--text-muted)" }}>
              {t("heroSub")}
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link to="/signup">
                <Button size="lg">{t("getStarted")} <ArrowRight size={18} /></Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="ghost">
                  {t("tryDemo")}
                </Button>
              </Link>
            </div>
          </Reveal>
          <Reveal delay={320}>
            <div className="flex flex-wrap gap-x-7 gap-y-2 mt-10 text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
              <span className="flex items-center gap-2"><BadgeCheck size={16} style={{ color: "var(--primary)" }} /> {t("verifiedProviders")}</span>
              <span className="flex items-center gap-2"><Banknote size={16} style={{ color: "var(--primary)" }} /> {t("securePayments")}</span>
              <span className="flex items-center gap-2"><Clock size={16} style={{ color: "var(--primary)" }} /> {t("liveTracking")}</span>
            </div>
          </Reveal>
        </div>
        {/* live AI demo card */}
        <Reveal delay={200}>
          <Card tilt className="!p-6">
            <div className="flex items-center gap-2 mb-4">
              <Cpu size={18} style={{ color: "var(--primary)" }} />
              <p className="font-bold m-0">{t("aiAssistant")}</p>
              <Badge tone="info" className="ml-auto">live demo</Badge>
            </div>
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!demo.q.trim()) return;
                setDemo({ q: demo.q });
                try {
                  const res = await fetch("/api/ai/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: demo.q }) });
                  if (res.ok) {
                    const json = await res.json();
                    setDemo((d) => ({ ...d, result: json.diagnosis }));
                  }
                } catch {
                  /* offline */
                }
              }}
            >
              <input className="input" placeholder={t("searchPlaceholder")} value={demo.q} onChange={(e) => setDemo({ q: e.target.value })} maxLength={300} />
              <Button type="submit" aria-label={t("askAI")}>
                <Sparkles size={16} /> {t("askAI")}
              </Button>
            </form>
            {demo.result ? (
              <div className="mt-4 space-y-2.5 fade-up">
                <Row k={t("services")} v={demo.result.service_category} />
                <Row k={t("urgency")} v={demo.result.urgency} />
                <Row k={t("priceEstimate")} v={<b style={{ color: "var(--primary)" }}>{inrRange(demo.result.estimated_price_min, demo.result.estimated_price_max)}</b>} />
                <p className="text-xs m-0" style={{ color: "var(--text-muted)" }}>{demo.result.recommended_action}</p>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {["My AC is not cooling", "Leaking pipe in the kitchen", "Laptop won't turn on", "Fridge stopped cooling"].map((s) => (
                  <button key={s} className="badge text-left !font-medium" style={{ cursor: "pointer" }} onClick={() => setDemo({ q: s })}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[11px] mt-4 mb-0" style={{ color: "var(--text-muted)" }}>
              {t("finalPriceNote")}
            </p>
          </Card>
        </Reveal>
      </section>

      {/* ---------------------------- services ---------------------------- */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <Reveal>
          <h2 className="text-3xl font-extrabold m-0">{t("chooseService")}</h2>
          <p className="mt-2 mb-6" style={{ color: "var(--text-muted)" }}>{services.length}+ {t("services").toLowerCase()} · {t("transparentPricing")}</p>
        </Reveal>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {(services.length ? services : seedServices).slice(0, 12).map((s, i) => (
            <Reveal key={s.id ?? s.slug} delay={i * 40}>
              <Link to={s.slug === "book" ? "/book" : "/book?service=" + (s.slug ?? "")}>
                <Card tilt className="h-full !p-4 group">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
                    {serviceIcon(s.icon)}
                  </div>
                  <p className="font-bold m-0 text-[15px] leading-snug">{s.name}</p>
                  <p className="text-xs m-0 mt-1" style={{ color: "var(--text-muted)" }}>
                    {inrRange(s.basePriceMin ?? s.min, s.basePriceMax ?? s.max)}+
                  </p>
                </Card>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* --------------------------- how it works --------------------------- */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <Reveal>
          <h2 className="text-3xl font-extrabold m-0 mb-6">{t("howItWorks")}</h2>
        </Reveal>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { icon: <MessageCircle size={20} />, title: t("describeProblem"), sub: t("heroSub").split(".")[0] + "." },
            { icon: <Sparkles size={20} />, title: t("aiAnalysis"), sub: t("possibleCauses") + " · " + t("priceEstimate") },
            { icon: <Users size={20} />, title: t("findProviders"), sub: `${t("matching")} → ${t("accept")}` },
            { icon: <Radio size={20} />, title: t("liveTracking"), sub: `${t("track")} → ${t("payNow")} → ${t("review")}` },
          ].map((s, i) => (
            <Reveal key={i} delay={i * 80}>
              <Card className="h-full !p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
                    {s.icon}
                  </div>
                  <span className="text-2xl font-extrabold" style={{ color: "var(--border-strong)" }}>{i + 1}</span>
                </div>
                <p className="font-bold m-0">{s.title}</p>
                <p className="text-sm m-0 mt-1" style={{ color: "var(--text-muted)" }}>{s.sub}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------------------- top providers ---------------------------- */}
      {providers.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 pb-16">
          <Reveal>
            <h2 className="text-3xl font-extrabold m-0 mb-6">{t("verifiedProviders")}</h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-4">
            {providers.map((p, i) => (
              <Reveal key={p.id} delay={i * 80}>
                <Card className="!p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
                      {(p.name ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold m-0 truncate flex items-center gap-1.5">
                        {p.name}
                        {p.verificationStatus === "verified" && <ShieldCheck size={15} style={{ color: "var(--success)" }} />}
                      </p>
                      <p className="text-xs m-0 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                        <Star size={12} style={{ fill: "var(--warning)", color: "var(--warning)" }} /> {p.rating > 0 ? p.rating : "New"} · <Truck size={12} /> {p.city}
                      </p>
                    </div>
                    <Badge tone="primary">{p.trustScore}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {(p.skills ?? []).slice(0, 3).map((s: any) => (
                      <Badge key={s.slug}>{s.name}</Badge>
                    ))}
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------- CTA ------------------------------- */}
      <section className="max-w-5xl mx-auto px-4 pb-8">
        <Reveal>
          <Card className="!p-10 text-center !bg-gradient-to-br" >
            <h2 className="text-3xl font-extrabold m-0">{t("tagline")}</h2>
            <p className="mt-3 mb-6" style={{ color: "var(--text-muted)" }}>{t("getStarted")} — {t("tryDemo")}</p>
            <div className="flex justify-center gap-3 flex-wrap">
              <Link to="/signup">
                <Button size="lg">{t("getStarted")} <ArrowRight size={17} /></Button>
              </Link>
            </div>
          </Card>
        </Reveal>
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span style={{ color: "var(--text-muted)" }}>{k}</span>
      <span className="font-semibold text-right">{v}</span>
    </div>
  );
}

const seedServices = [
  { slug: "electrician", name: "Electrician", icon: "zap", min: 300, max: 1200 },
  { slug: "plumber", name: "Plumber", icon: "droplets", min: 350, max: 1500 },
  { slug: "ac-repair", name: "AC Repair & Service", icon: "wind", min: 500, max: 2500 },
  { slug: "cleaner", name: "Deep Cleaner", icon: "sparkles", min: 999, max: 4999 },
  { slug: "laptop-repair", name: "Laptop & Computer Repair", icon: "laptop", min: 500, max: 3500 },
  { slug: "refrigerator-repair", name: "Refrigerator Repair", icon: "snowflake", min: 600, max: 2600 },
  { slug: "carpenter", name: "Carpenter", icon: "hammer", min: 400, max: 1800 },
  { slug: "pest-control", name: "Pest Control", icon: "bug", min: 800, max: 3500 },
];
