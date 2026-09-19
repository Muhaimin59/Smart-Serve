/* Favorites, Safety (SOS + trusted contacts + reports), Settings, 404. */
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle, ChevronRight, Globe, Heart, LifeBuoy, LogOut, MapPin,
  Moon, Phone, Plus, ShieldCheck, Siren, Sun, Trash2, User, Volume2, Wifi,
} from "lucide-react";
import { del, get, post, put } from "../lib/api";
import { LANGS } from "../lib/i18n";
import { useAuth, useLang, useTheme, useToast } from "../lib/store";
import { socketOn } from "../lib/socket";
import { fmtDate, timeAgo } from "../lib/format";
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Skeleton, Textarea, Toggle } from "../components/ui";

/* ------------------------------- favorites ------------------------------- */
export function FavoritesPage() {
  const { t } = useLang();
  const nav = useNavigate();
  const { push } = useToast();
  const [favs, setFavs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get("/customer/favorites")
      .then(async (r) => {
        const list = r.favorites ?? [];
        // enrich with ratings via public provider lookups
        const enriched = await Promise.all(
          list.map(async (f: any) => {
            try {
              const p = await get("/providers/" + f.providerId);
              return { ...f, ...p.provider, reviews: p.reviews };
            } catch {
              return f;
            }
          }),
        );
        setFavs(enriched);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function remove(id: string) {
    await del("/customer/favorites/" + id).catch(() => {});
    setFavs((x) => x.filter((f) => f.providerId !== id));
    push("Removed from favorites", "info");
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-extrabold m-0 mb-1">{t("favorites")}</h1>
      <p className="mb-6" style={{ color: "var(--text-muted)" }}>{t("favoritesHint")}</p>
      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : favs.length === 0 ? (
        <EmptyState icon={<Heart size={24} />} title={t("noFavorites")} subtitle={t("favoritesHint")} action={<Button onClick={() => nav("/providers")}>{t("browseProviders")}</Button>} />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {favs.map((f) => (
            <Card key={f.providerId} tilt className="!p-5">
              <div className="flex items-center gap-3">
                <Avatar name={f.name} src={f.avatarUrl} size={48} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold m-0 truncate flex items-center gap-1.5">
                    {f.name}
                    {f.verificationStatus === "verified" && <ShieldCheck size={14} style={{ color: "var(--success)" }} />}
                  </p>
                  <p className="text-xs m-0 mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {f.rating ? `★ ${f.rating} (${f.reviewCount})` : "New"} {f.city ? "· " + f.city : ""}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(f.skills ?? []).slice(0, 2).map((s: any) => <Badge key={s.id}>{s.name}</Badge>)}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button size="sm" className="flex-1" onClick={() => nav(`/book?provider=${f.providerId}`)}>{t("book")}</Button>
                <Button size="sm" variant="ghost" onClick={() => nav(`/providers/${f.providerId}`)}>Profile</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(f.providerId)}><Trash2 size={14} /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- safety --------------------------------- */
export function SafetyPage() {
  const { t } = useLang();
  const { push } = useToast();
  const { user } = useAuth();
  const [contacts, setContacts] = useState<any[]>([]);
  const [fc, setFc] = useState({ name: "", phone: "", relation: "" });
  const [sosBusy, setSosBusy] = useState(false);
  const [sosSent, setSosSent] = useState<any>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [report, setReport] = useState({ targetId: "", category: "safety", description: "" });
  const [disputes, setDisputes] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);

  const isCustomer = user?.role === "customer";

  const refresh = useCallback(() => {
    if (!isCustomer) return;
    get("/customer/trusted-contacts").then((r) => setContacts(r.contacts ?? [])).catch(() => {});
    get("/customer/disputes").then((r) => setDisputes(r.disputes ?? [])).catch(() => {});
    get("/customer/warranty-claims").then((r) => setClaims(r.claims ?? [])).catch(() => {});
  }, [isCustomer]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const s1 = socketOn("notification", (n) => {
      if (n?.type === "sos_sent") refresh();
    });
    return () => { s1(); };
  }, [refresh]);

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    try {
      await post("/customer/trusted-contacts", fc);
      push("Contact added", "success");
      setFc({ name: "", phone: "", relation: "" });
      refresh();
    } catch (e2) {
      push(e2 instanceof Error ? e2.message : "Failed", "error");
    }
  }

  async function sendSos() {
    setSosBusy(true);
    setSosSent(null);
    let lat: number | undefined;
    let lon: number | undefined;
    if ("geolocation" in navigator) {
      await new Promise<void>((resolve) => {
        const to = setTimeout(resolve, 5000);
        navigator.geolocation.getCurrentPosition(
          (p) => { clearTimeout(to); lat = p.coords.latitude; lon = p.coords.longitude; resolve(); },
          () => { clearTimeout(to); resolve(); },
          { timeout: 4500 },
        );
      });
    }
    try {
      const r = await post("/customer/sos", { latitude: lat, longitude: lon });
      setSosSent(r.sos);
      push(t("sosSent"), "success");
    } catch (e) {
      push(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setSosBusy(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-extrabold m-0 mb-6 flex items-center gap-2"><ShieldCheck size={28} style={{ color: "var(--primary)" }} /> {t("safety")}</h1>

      <div className="grid md:grid-cols-2 gap-5 mb-6">
        {/* SOS */}
        <Card tilt className="!p-6 text-center">
          <Siren size={40} className="mx-auto mb-3" style={{ color: "var(--danger)" }} />
          <h2 className="text-xl font-extrabold m-0">{t("sos")}</h2>
          <p className="text-sm my-3" style={{ color: "var(--text-muted)" }}>{t("sosHint")}</p>
          <Button variant="danger" size="lg" className="w-full" loading={sosBusy} onClick={sendSos}>
            <Siren size={17} /> {t("sendSos")}
          </Button>
          {sosSent && (
            <div className="mt-4 rounded-2xl p-3 text-left text-sm" style={{ background: "var(--surface-2)" }}>
              <p className="font-bold m-0">{t("sosSent")}</p>
              <p className="m-0 mt-1" style={{ color: "var(--text-muted)" }}>{sosSent.hint}</p>
              <p className="m-0 mt-1 text-xs">{t("contactsNotified")}: {sosSent.contactsNotified}</p>
            </div>
          )}
          <div className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
            <b className="flex items-center gap-1.5 justify-center"><Phone size={13} /> {t("emergencyNumber")}: <a className="font-bold" style={{ color: "var(--primary)" }} href="tel:112">112</a></b>
          </div>
        </Card>

        {/* trusted contacts */}
        <Card className="!p-6">
          <h2 className="font-extrabold text-lg m-0 mb-3 flex items-center gap-2"><LifeBuoy size={17} style={{ color: "var(--primary)" }} /> {t("trustedContacts")}</h2>
          {isCustomer ? (
            <>
              <div className="space-y-2 mb-4 max-h-44 overflow-y-auto">
                {contacts.length === 0 ? (
                  <p className="text-sm m-0" style={{ color: "var(--text-muted)" }}>{t("noContacts")}</p>
                ) : (
                  contacts.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm" style={{ background: "var(--surface-2)" }}>
                      <User size={14} style={{ color: "var(--text-muted)" }} />
                      <div className="flex-1 min-w-0">
                        <b>{c.name}</b> {c.relation && <span style={{ color: "var(--text-muted)" }}>· {c.relation}</span>}
                        <p className="text-xs m-0" style={{ color: "var(--text-muted)" }}>{c.phone}</p>
                      </div>
                      {c.isPrimary && <Badge tone="primary">primary</Badge>}
                      <a href={"tel:" + c.phone} className="font-bold" style={{ color: "var(--primary)" }}><Phone size={14} /></a>
                      <button className="badge" style={{ cursor: "pointer", color: "var(--danger)" }} onClick={async () => {
                        await del("/customer/trusted-contacts/" + c.id).catch(() => {});
                        refresh();
                      }}><Trash2 size={12} /></button>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={addContact} className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <Input placeholder={t("name")} value={fc.name} onChange={(e) => setFc({ ...fc, name: e.target.value })} required />
                  <Input placeholder={t("relation")} value={fc.relation} onChange={(e) => setFc({ ...fc, relation: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <Input placeholder={t("phone")} value={fc.phone} onChange={(e) => setFc({ ...fc, phone: e.target.value })} required pattern="[+0-9][0-9 -]{7,15}" />
                  <Button type="submit"><Plus size={15} /> {t("add")}</Button>
                </div>
              </form>
            </>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{t("safetyProviderNote")}</p>
          )}
        </Card>
      </div>

      {/* disputes & claims history */}
      {isCustomer && (disputes.length > 0 || claims.length > 0) && (
        <div className="grid md:grid-cols-2 gap-5 mb-6">
          <Card className="!p-5">
            <p className="font-bold m-0 mb-3">{t("myDisputes")}</p>
            <div className="space-y-2">
              {disputes.map((d) => (
                <Link key={d.id} to={"/bookings/" + d.bookingId} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm no-underline hover:bg-black/5 dark:hover:bg-white/5" style={{ background: "var(--surface-2)", color: "inherit" }}>
                  <div className="flex-1 min-w-0"><b>{d.service}</b><p className="text-xs m-0" style={{ color: "var(--text-muted)" }}>{timeAgo(d.createdAt)}</p></div>
                  <Badge tone={["open", "under_review", "provider_response", "escalated"].includes(d.status) ? "warning" : "success"}>{d.status}</Badge>
                </Link>
              ))}
            </div>
          </Card>
          <Card className="!p-5">
            <p className="font-bold m-0 mb-3">{t("warrantyClaims")}</p>
            <div className="space-y-2">
              {claims.map((c) => (
                <Link key={c.id} to={"/bookings/" + c.bookingId} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm no-underline hover:bg-black/5 dark:hover:bg-white/5" style={{ background: "var(--surface-2)", color: "inherit" }}>
                  <div className="flex-1 min-w-0"><b>{c.service}</b><p className="text-xs m-0" style={{ color: "var(--text-muted)" }}>{timeAgo(c.createdAt)}</p></div>
                  <Badge tone={c.status === "resolved" ? "success" : "warning"}>{c.status}</Badge>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* safety tips */}
      <Card className="!p-6">
        <p className="font-bold m-0 mb-3">{t("safetyTips")}</p>
        <ul className="m-0 pl-5 space-y-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
          <li>{t("tip1")}</li>
          <li>{t("tip2")}</li>
          <li>{t("tip3")}</li>
          <li>{t("tip4")}</li>
        </ul>
        <div className="flex gap-2 mt-4">
          {user && (
            <Button variant="ghost" size="sm" onClick={() => setReportOpen(true)}>
              <AlertTriangle size={14} /> {t("reportUser")}
            </Button>
          )}
        </div>
      </Card>

      {/* report modal */}
      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title={t("reportUser")}>
        <div className="space-y-3">
          <Field label={t("targetId")}>
            <Input value={report.targetId} onChange={(e) => setReport({ ...report, targetId: e.target.value })} placeholder="User or provider ID" />
          </Field>
          <Field label={t("category")}>
            <Select value={report.category} onChange={(e) => setReport({ ...report, category: e.target.value })}>
              {["safety", "fraud", "abuse", "quality", "other"].map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label={t("description")}>
            <Textarea rows={3} value={report.description} onChange={(e) => setReport({ ...report, description: e.target.value })} />
          </Field>
          <Button className="w-full" disabled={!report.targetId} onClick={async () => {
            try {
              await post("/customer/reports", { targetType: "provider", ...report });
              push(t("reportSent"), "success");
              setReportOpen(false);
              setReport({ targetId: "", category: "safety", description: "" });
            } catch (e) {
              push(e instanceof Error ? e.message : "Failed", "error");
            }
          }}>{t("submitReport")}</Button>
        </div>
      </Modal>
    </div>
  );
}

/* -------------------------------- settings -------------------------------- */
export function SettingsPage() {
  const { t, lang, setLang } = useLang();
  const { theme, setTheme, lowBw, setLowBw } = useTheme();
  const { user, logout } = useAuth();
  const { push } = useToast();
  const nav = useNavigate();
  const [name, setName] = useState(user?.displayName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [busy, setBusy] = useState(false);
  const isCustomer = user?.role === "customer";

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isCustomer) {
        await put("/customer/profile", { displayName: name, phone: phone || undefined, language: lang });
      } else if (user) {
        await put("/provider/profile", { phone: phone || undefined }).catch(() => {});
      }
      push(t("profileSaved"), "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-extrabold m-0 mb-6">{t("settings")}</h1>
      <div className="space-y-5">
        <Card className="!p-6">
          <p className="font-bold m-0 mb-4 flex items-center gap-2"><User size={16} style={{ color: "var(--primary)" }} /> {t("profile")}</p>
          <div className="flex items-center gap-4 mb-4">
            <Avatar name={name || user?.email} size={56} />
            <div>
              <p className="font-bold m-0">{user?.email}</p>
              <p className="text-xs m-0" style={{ color: "var(--text-muted)" }}>{user?.role}</p>
            </div>
          </div>
          {isCustomer ? (
            <form onSubmit={saveProfile} className="space-y-3">
              <Field label={t("name")}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label={t("phone")}><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" /></Field>
              <Button loading={busy}>{t("save")}</Button>
            </form>
          ) : (
            <Button onClick={() => nav("/provider/profile")} disabled={!user}>
              {t("providerProfile")} <ChevronRight size={15} />
            </Button>
          )}
        </Card>

        <Card className="!p-6 space-y-4">
          <p className="font-bold m-0 flex items-center gap-2"><Globe size={16} style={{ color: "var(--primary)" }} /> {t("language")}</p>
          <div className="flex gap-1.5 flex-wrap">
            {LANGS.map((l) => (
              <button key={l.code} className="badge" style={{ cursor: "pointer", background: lang === l.code ? "var(--primary)" : undefined, color: lang === l.code ? "var(--primary-text)" : undefined }} onClick={() => setLang(l.code)}>
                {l.native}
              </button>
            ))}
          </div>
        </Card>

        <Card className="!p-6 space-y-4">
          <p className="font-bold m-0">{t("appearance")}</p>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold">{theme === "dark" ? <Moon size={15} /> : <Sun size={15} />} {t("theme")}</span>
            <Toggle on={theme === "dark"} onChange={(v) => setTheme(v ? "dark" : "light")} />
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold"><Wifi size={15} /> {t("lowBandwidth")}</span>
            <Toggle on={lowBw} onChange={setLowBw} />
          </div>
        </Card>

        <Card className="!p-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-bold m-0">{t("account")}</p>
            <p className="text-sm m-0" style={{ color: "var(--text-muted)" }}>{t("logoutHint")}</p>
          </div>
          <Button variant="danger" onClick={() => { logout(); nav("/"); }}>
            <LogOut size={15} /> {t("logout")}
          </Button>
        </Card>
      </div>
    </div>
  );
}

/* --------------------------------- 404 ------------------------------------ */
export function NotFoundPage() {
  const { t } = useLang();
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <p className="text-7xl font-extrabold m-0" style={{ color: "var(--primary)" }}>404</p>
      <h1 className="text-2xl font-extrabold mt-3 m-0">{t("pageNotFound")}</h1>
      <p className="mt-2" style={{ color: "var(--text-muted)" }}>{t("pageNotFoundHint")}</p>
      <Link to="/">
        <Button className="mt-6">{t("home")}</Button>
      </Link>
    </div>
  );
}
