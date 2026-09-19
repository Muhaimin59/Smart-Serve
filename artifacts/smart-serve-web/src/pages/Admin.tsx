/* Admin: dashboard, analytics, manage (users/providers/docs/bookings/disputes/reports/services/audit), settings. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity, AlertTriangle, Banknote, Check, FileText, Gavel, MessageSquareWarning,
  Plus, Search, Settings2, ShieldCheck, Trash2, Users, X,
} from "lucide-react";
import { get, patch, post, put } from "../lib/api";
import { useLang, useToast } from "../lib/store";
import { socketOn } from "../lib/socket";
import { fmtDate, fmtTime, inr, timeAgo } from "../lib/format";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Skeleton, StatusBadge, Textarea, Toggle } from "../components/ui";
import { BarChart, DonutChart, LineChart } from "../components/charts";
import { QuickStat } from "../components/booking";

/* ------------------------------- dashboard ------------------------------- */
export function AdminDashboard() {
  const { t } = useLang();
  const { push } = useToast();
  const nav = useNavigate();
  const [s, setS] = useState<any>(null);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [sos, setSos] = useState<any[]>([]);

  const refresh = useCallback(() => {
    get("/admin/stats").then(setS).catch(() => {});
    get("/admin/disputes?status=open").then((r) => setDisputes(r.disputes ?? [])).catch(() => {});
    get("/admin/reports").then((r) => setReports(r.reports ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const s1 = socketOn("sos:alert", (p) => {
      push(`SOS: ${p.name} triggered SOS`, "error");
      setSos((x) => [p, ...x].slice(0, 20));
    });
    const s2 = socketOn("report:new", () => refresh());
    const s3 = socketOn("dispute:updated", () => refresh());
    return () => { s1(); s2(); s3(); };
  }, [refresh, push]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-extrabold m-0 mb-6">{t("adminDashboard")}</h1>
      {s ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <QuickStat icon={<Users size={18} />} label={t("users")} value={String(s.users.total)} sub={`${s.users.customers} ${t("customers")} · ${s.providers.total} ${t("providers")}`} />
          <QuickStat icon={<Activity size={18} />} label={t("bookings")} value={String(s.bookings.total)} sub={`${s.bookings.active} ${t("active")}`} />
          <QuickStat icon={<Banknote size={18} />} label={t("revenue")} value={s.revenueDisplay} />
          <QuickStat icon={<ShieldCheck size={18} />} label={t("verifiedProviders")} value={`${s.providers.verified}/${s.providers.total}`} sub={`${s.providers.online} ${t("online")}`} />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      )}

      {s && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MiniStat label={t("openDisputes")} v={s.openDisputes} onClick={() => nav("/admin/manage/disputes")} />
          <MiniStat label={t("pendingVerification")} v={s.pendingVerification} onClick={() => nav("/admin/manage/documents")} />
          <MiniStat label={t("sosLast7d")} v={s.sosLast7d} onClick={() => nav("/admin/manage/reports")} />
          <MiniStat label={t("openReports")} v={s.openReports} onClick={() => nav("/admin/manage/reports")} />
        </div>
      )}

      {/* live SOS feed */}
      {sos.length > 0 && (
        <Card className="!p-5 mb-6">
          <p className="font-bold m-0 mb-3 flex items-center gap-2" style={{ color: "var(--danger)" }}><AlertTriangle size={16} /> SOS {t("alerts")}</p>
          <div className="space-y-2">
            {sos.map((x) => (
              <div key={x.at} className="text-sm rounded-xl px-3 py-2" style={{ background: "rgba(220,38,38,.07)" }}>
                <b>{x.name}</b> {x.note ? `— ${x.note}` : ""} <span style={{ color: "var(--text-muted)" }}>{timeAgo(x.at)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="!p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold m-0 flex items-center gap-2"><Gavel size={16} style={{ color: "var(--primary)" }} /> {t("openDisputes")}</p>
            <Button size="sm" variant="ghost" onClick={() => nav("/admin/manage/disputes")}>{t("manage")} →</Button>
          </div>
          {disputes.length === 0 ? (
            <p className="text-sm m-0" style={{ color: "var(--text-muted)" }}>{t("none")}</p>
          ) : (
            <div className="space-y-2">
              {disputes.slice(0, 5).map((d) => (
                <div key={d.id} className="rounded-xl px-3 py-2.5 text-sm" style={{ background: "var(--surface-2)" }}>
                  <div className="flex justify-between gap-2">
                    <b>{d.service}</b>
                    <Badge tone="danger">{d.status}</Badge>
                  </div>
                  <p className="text-xs m-0 mt-1" style={{ color: "var(--text-muted)" }}>{d.customerName} vs {d.providerName} · {timeAgo(d.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="!p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold m-0 flex items-center gap-2"><MessageSquareWarning size={16} style={{ color: "var(--primary)" }} /> {t("reports")}</p>
            <Button size="sm" variant="ghost" onClick={() => nav("/admin/manage/reports")}>{t("manage")} →</Button>
          </div>
          {reports.length === 0 ? (
            <p className="text-sm m-0" style={{ color: "var(--text-muted)" }}>{t("none")}</p>
          ) : (
            <div className="space-y-2">
              {reports.slice(0, 5).map((r) => (
                <div key={r.id} className="rounded-xl px-3 py-2.5 text-sm" style={{ background: "var(--surface-2)" }}>
                  <div className="flex justify-between gap-2">
                    <b>{r.category}</b>
                    <Badge tone={r.status === "open" ? "warning" : "muted"}>{r.status}</Badge>
                  </div>
                  <p className="text-xs m-0 mt-1" style={{ color: "var(--text-muted)" }}>{r.reporterName} → {r.targetEmail?.split("@")[0]} · {timeAgo(r.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {s && (
        <Card className="!p-5 mt-6">
          <p className="font-bold m-0 mb-3">{t("bookingsByStatus")}</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(s.bookings.byStatus).map(([k, v]) => (
              <Badge key={k} tone={k === "disputed" ? "danger" : k === "cancelled" || k === "expired" ? "muted" : "primary"}>
                {k}: {String(v)}
              </Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function MiniStat({ label, v, onClick }: { label: string; v: number; onClick: () => void }) {
  return (
    <button className="text-left rounded-2xl p-4 transition-colors" style={{ background: "var(--surface-2)", cursor: "pointer", border: "1px solid var(--border)" }} onClick={onClick}>
      <p className="text-2xl font-extrabold m-0">{v}</p>
      <p className="text-xs m-0 mt-1" style={{ color: "var(--text-muted)" }}>{label}</p>
    </button>
  );
}

/* -------------------------------- analytics ------------------------------- */
export function AdminPage({ section }: { section: "analytics" | "manage" }) {
  if (section === "analytics") return <AnalyticsPage />;
  return <ManagePage />;
}

function AnalyticsPage() {
  const { t } = useLang();
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    get("/admin/analytics?days=30").then(setData).catch(() => {});
  }, []);
  if (!data) return <div className="max-w-6xl mx-auto px-4 py-8"><Skeleton className="h-96" /></div>;
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-extrabold m-0 mb-6">{t("analytics")}</h1>
      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="!p-5">
          <p className="font-bold m-0 mb-3">{t("bookingsPerDay")}</p>
          <LineChart data={data.bookingsByDay.map((x: any) => ({ label: x.day, value: x.total }))} />
        </Card>
        <Card className="!p-5">
          <p className="font-bold m-0 mb-3">{t("revenuePerDay")}</p>
          <BarChart data={data.revenueByDay.map((x: any) => ({ label: x.day, value: Math.round(x.paise / 100) }))} />
        </Card>
        <Card className="!p-5 lg:col-span-2">
          <p className="font-bold m-0 mb-3">{t("topServices")}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {data.byCategory.map((c: any) => (
              <div key={c.name} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: "var(--surface-2)" }}>
                <span className="font-semibold text-sm">{c.name}</span>
                <b style={{ color: "var(--primary)" }}>{c.total}</b>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* --------------------------------- manage --------------------------------- */
const TABS = [
  { id: "users", label: "Users", icon: <Users size={14} /> },
  { id: "providers", label: "Providers", icon: <ShieldCheck size={14} /> },
  { id: "documents", label: "Documents", icon: <FileText size={14} /> },
  { id: "bookings", label: "Bookings", icon: <Activity size={14} /> },
  { id: "disputes", label: "Disputes", icon: <Gavel size={14} /> },
  { id: "reports", label: "Reports", icon: <MessageSquareWarning size={14} /> },
  { id: "services", label: "Services", icon: <Plus size={14} /> },
  { id: "audit", label: "Audit log", icon: <Settings2 size={14} /> },
];

export function ManagePage() {
  const { t } = useLang();
  const [tab, setTab] = useState("users");
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-extrabold m-0 mb-5">{t("manage")}</h1>
      <div className="flex gap-1.5 flex-wrap mb-6">
        {TABS.map((x) => (
          <button key={x.id} className="badge !py-2 !px-3" style={{ cursor: "pointer", background: tab === x.id ? "var(--primary)" : undefined, color: tab === x.id ? "var(--primary-text)" : undefined }} onClick={() => setTab(x.id)}>
            <span className="inline mr-1.5">{x.icon}</span>{x.label}
          </button>
        ))}
      </div>
      {tab === "users" && <UsersTab />}
      {tab === "providers" && <ProvidersTab />}
      {tab === "documents" && <DocumentsTab />}
      {tab === "bookings" && <BookingsTab />}
      {tab === "disputes" && <DisputesTab />}
      {tab === "reports" && <ReportsTab />}
      {tab === "services" && <ServicesTab />}
      {tab === "audit" && <AuditTab />}
    </div>
  );
}

function UsersTab() {
  const { t } = useLang();
  const { push } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  useEffect(() => {
    get(`/admin/users?page=${page}&limit=25&q=${encodeURIComponent(q)}`).then((r) => { setUsers(r.users ?? []); setTotal(r.total ?? 0); }).catch(() => {});
  }, [page, q]);
  return (
    <Card>
      <div className="p-4 flex gap-3 items-center border-b" style={{ borderColor: "var(--border)" }}>
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <Input className="!pl-9" placeholder={t("search")} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <span className="text-sm ml-auto" style={{ color: "var(--text-muted)" }}>{total} {t("users").toLowerCase()}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left" style={{ color: "var(--text-muted)" }}>
            <th className="p-3 font-bold">User</th><th className="p-3 font-bold">Role</th><th className="p-3 font-bold">Joined</th><th className="p-3 font-bold">Status</th><th className="p-3 font-bold" />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t" style={{ borderColor: "var(--border)" }}>
              <td className="p-3"><b>{u.displayName ?? u.email.split("@")[0]}</b><br /><span className="text-xs" style={{ color: "var(--text-muted)" }}>{u.email}</span></td>
              <td className="p-3"><Badge tone={u.role === "admin" ? "primary" : "muted"}>{u.role}</Badge></td>
              <td className="p-3 text-xs" style={{ color: "var(--text-muted)" }}>{fmtDate(u.createdAt)}</td>
              <td className="p-3"><Badge tone={u.isActive ? "success" : "danger"}>{u.isActive ? "active" : "suspended"}</Badge></td>
              <td className="p-3 text-right">
                {u.role !== "admin" && (
                  <Button size="sm" variant={u.isActive ? "ghost" : "secondary"} onClick={async () => {
                    try {
                      await patch(`/admin/users/${u.id}`, { isActive: !u.isActive });
                      push("Updated", "success");
                      get(`/admin/users?page=${page}&limit=25&q=${encodeURIComponent(q)}`).then((r) => setUsers(r.users ?? [])).catch(() => {});
                    } catch (e) { push(e instanceof Error ? e.message : "Failed", "error"); }
                  }}>
                    {u.isActive ? t("suspend") : t("activate")}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager page={page} total={total} per={25} onPage={setPage} />
    </Card>
  );
}

function ProvidersTab() {
  const { t } = useLang();
  const { push } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    get("/admin/providers").then((r) => setRows(r.providers ?? [])).catch(() => {});
  }, []);
  return (
    <Card>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left" style={{ color: "var(--text-muted)" }}>
            <th className="p-3 font-bold">Provider</th><th className="p-3 font-bold">City</th><th className="p-3 font-bold">Rating</th><th className="p-3 font-bold">Verification</th><th className="p-3 font-bold" />
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t" style={{ borderColor: "var(--border)" }}>
              <td className="p-3"><b>{p.name}</b><br /><span className="text-xs" style={{ color: "var(--text-muted)" }}>{p.email}</span></td>
              <td className="p-3">{p.city ?? "—"}</td>
              <td className="p-3">{p.rating || "New"}</td>
              <td className="p-3"><Badge tone={p.verificationStatus === "verified" ? "success" : p.verificationStatus === "rejected" ? "danger" : "warning"}>{p.verificationStatus}</Badge></td>
              <td className="p-3 text-right">
                <div className="flex gap-1.5 justify-end">
                  {p.verificationStatus !== "verified" && (
                    <Button size="sm" onClick={async () => {
                      try { await patch(`/admin/providers/${p.id}/verification`, { status: "verified" }); push("Verified", "success"); get("/admin/providers").then((r) => setRows(r.providers ?? [])).catch(() => {}); }
                      catch (e) { push(e instanceof Error ? e.message : "Failed", "error"); }
                    }}><Check size={13} /> {t("verify")}</Button>
                  )}
                  {p.verificationStatus === "verified" && (
                    <Button size="sm" variant="ghost" onClick={async () => {
                      try { await patch(`/admin/providers/${p.id}/verification`, { status: "pending" }); push("Reverted", "success"); get("/admin/providers").then((r) => setRows(r.providers ?? [])).catch(() => {}); }
                      catch (e) { push(e instanceof Error ? e.message : "Failed", "error"); }
                    }}><X size={13} /> {t("revert")}</Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function DocumentsTab() {
  const { t } = useLang();
  const { push } = useToast();
  const [docs, setDocs] = useState<any[]>([]);
  const [view, setView] = useState<any | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = () => get("/admin/documents").then((r) => setDocs(r.documents ?? [])).catch(() => {});
  useEffect(() => { refresh(); }, []);
  const pending = docs.filter((d) => d.verificationStatus === "pending");
  const rest = docs.filter((d) => d.verificationStatus !== "pending");
  return (
    <Card className="!p-5">
      <p className="font-bold m-0 mb-3">{t("pendingVerification")} ({pending.length})</p>
      {pending.length === 0 ? <p className="text-sm m-0" style={{ color: "var(--text-muted)" }}>{t("none")}</p> : (
        <div className="space-y-3">
          {pending.map((d) => (
            <div key={d.id} className="flex items-center gap-4 rounded-2xl p-3 flex-wrap" style={{ background: "var(--surface-2)" }}>
              <img src={d.storedPath} alt="doc" className="w-16 h-16 rounded-xl object-cover" />
              <div className="flex-1 min-w-[160px]">
                <b className="text-sm">{d.name}</b>
                <p className="text-xs m-0" style={{ color: "var(--text-muted)" }}>{d.docType} · {fmtDate(d.uploadedAt)}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setView(d); setNote(""); }}>View</Button>
              <Button size="sm" variant="danger" loading={busy && view?.id === d.id} onClick={async () => { setBusy(true); try { await patch(`/admin/documents/${d.id}`, { approve: false, note: "Rejected from list" }); push("Rejected", "info"); refresh(); } catch (e) { push(e instanceof Error ? e.message : "Failed", "error"); } finally { setBusy(false); } }}>
                <X size={13} />
              </Button>
              <Button size="sm" loading={busy && view?.id === d.id} onClick={async () => { setBusy(true); try { await patch(`/admin/documents/${d.id}`, { approve: true, note: "Approved from list" }); push("Approved — provider verified", "success"); refresh(); } catch (e) { push(e instanceof Error ? e.message : "Failed", "error"); } finally { setBusy(false); } }}>
                <Check size={13} />
              </Button>
            </div>
          ))}
        </div>
      )}
      {rest.length > 0 && (
        <>
          <p className="font-bold m-0 mt-6 mb-3">Reviewed</p>
          <div className="space-y-2">
            {rest.slice(0, 10).map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm rounded-xl px-3 py-2" style={{ background: "var(--surface-2)" }}>
                <span>{d.name} · {d.docType} · {d.filename}</span>
                <Badge tone={d.verificationStatus === "approved" ? "success" : "danger"}>{d.verificationStatus}</Badge>
              </div>
            ))}
          </div>
        </>
      )}
      <Modal open={!!view} onClose={() => setView(null)} title={view ? `${view.docType} — ${view.name}` : ""} wide>
        {view && (
          <div>
            <img src={view.storedPath} alt="document" className="w-full max-h-[420px] object-contain rounded-2xl" />
            <Field label={t("note")}>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <div className="flex gap-2 mt-4">
              <Button className="flex-1" loading={busy} onClick={async () => { setBusy(true); try { await patch(`/admin/documents/${view.id}`, { approve: true, note: note || undefined }); push("Approved", "success"); setView(null); refresh(); } catch (e) { push(e instanceof Error ? e.message : "Failed", "error"); } finally { setBusy(false); } }}>
                <Check size={14} /> {t("approve")}
              </Button>
              <Button variant="danger" className="flex-1" loading={busy} onClick={async () => { setBusy(true); try { await patch(`/admin/documents/${view.id}`, { approve: false, note: note || undefined }); push("Rejected", "info"); setView(null); refresh(); } catch (e) { push(e instanceof Error ? e.message : "Failed", "error"); } finally { setBusy(false); } }}>
                <X size={14} /> {t("reject")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}

function BookingsTab() {
  const { t } = useLang();
  const { push } = useToast();
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    get(`/admin/bookings?status=${status}&page=${page}&limit=25`).then((r) => { setRows(r.bookings ?? []); setTotal(r.total ?? 0); }).catch(() => {});
  }, [status, page]);
  return (
    <Card>
      <div className="p-4 flex gap-3 border-b" style={{ borderColor: "var(--border)" }}>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="!w-auto">
          <option value="">All statuses</option>
          {["matching", "provider_invited", "accepted", "on_the_way", "arrived", "in_progress", "completed", "payment_pending", "paid", "closed", "cancelled", "expired", "disputed"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
        <span className="text-sm ml-auto" style={{ color: "var(--text-muted)" }}>{total}</span>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((b) => (
            <tr key={b.id} className="border-t" style={{ borderColor: "var(--border)" }}>
              <td className="p-3 min-w-[160px]"><b>{b.service}</b>{b.isEmergency && <Badge tone="danger" className="ml-2">{t("emergency")}</Badge>}<br /><span className="text-xs" style={{ color: "var(--text-muted)" }}>{b.customer}</span></td>
              <td className="p-3"><StatusBadge status={b.status} /></td>
              <td className="p-3 text-xs" style={{ color: "var(--text-muted)" }}>{fmtDate(b.createdAt)} {fmtTime(b.createdAt)}</td>
              <td className="p-3 text-right">{b.finalAmount ? <b>{inr(Number(b.finalAmount))}</b> : "—"}</td>
              <td className="p-3 text-right">
                <a href={"/bookings/" + b.id} className="font-bold text-sm" style={{ color: "var(--primary)" }}>Open →</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager page={page} total={total} per={25} onPage={setPage} />
    </Card>
  );
}

function DisputesTab() {
  const { t } = useLang();
  const { push } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [view, setView] = useState<any | null>(null);
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [refund, setRefund] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = () => get("/admin/disputes").then((r) => setRows(r.disputes ?? [])).catch(() => {});
  useEffect(() => {
    refresh();
    const s1 = socketOn("dispute:updated", () => refresh());
    return () => { s1(); };
  }, []);
  return (
    <Card className="!p-5">
      {rows.length === 0 ? <EmptyState icon={<Gavel size={24} />} title={t("none")} /> : (
        <div className="space-y-3">
          {rows.map((d) => (
            <div key={d.id} className="rounded-2xl p-4" style={{ background: "var(--surface-2)" }}>
              <div className="flex items-center gap-3 flex-wrap">
                <b className="text-sm">{d.service}</b>
                <Badge tone={["open", "under_review", "provider_response", "escalated"].includes(d.status) ? "danger" : d.status === "resolved" ? "success" : "muted"}>{d.status}</Badge>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{d.customerName} vs {d.providerName} · {timeAgo(d.createdAt)}</span>
                <div className="ml-auto flex gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => { setView(d); setNote(""); setResolution(""); setRefund(""); }}>Open</Button>
                  {d.bookingId && <a href={"/bookings/" + d.bookingId}><Button size="sm" variant="secondary">Booking</Button></a>}
                </div>
              </div>
              <p className="text-sm mt-2 mb-0" style={{ color: "var(--text-muted)" }}><b>{d.reason}</b> — {d.description}</p>
              {d.resolution && <p className="text-xs mt-1 mb-0" style={{ color: "var(--success)" }}>Resolution: {d.resolution}</p>}
            </div>
          ))}
        </div>
      )}
      <Modal open={!!view} onClose={() => setView(null)} title="Dispute details" wide>
        {view && (
          <div className="space-y-4">
            <div>
              <p className="label mb-1">{t("events")}</p>
              <div className="space-y-1.5">
                {view.events.map((e: any) => (
                  <div key={e.id} className="text-sm rounded-xl px-3 py-2" style={{ background: "var(--surface-2)" }}>
                    <b>{e.action}</b> — {e.note ?? ""} <span className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtDate(e.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={t("status")}>
                <Select value={view.status} onChange={async (e) => {
                  setBusy(true);
                  try {
                    const r = await post(`/admin/disputes/${view.id}/response`, { status: e.target.value, note: note || undefined });
                    setView({ ...view, status: r.status });
                    push("Status updated", "success"); refresh();
                  } catch (er) { push(er instanceof Error ? er.message : "Failed", "error"); }
                  finally { setBusy(false); }
                }}>
                  {["open", "under_review", "provider_response", "escalated"].map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label={t("note")}>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note…" />
              </Field>
            </div>
            <div className="rounded-2xl p-4" style={{ background: "var(--surface-2)" }}>
              <p className="label mb-2">{t("resolution")}</p>
              <Textarea rows={2} value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder={t("resolutionPlaceholder")} />
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <Field label={t("refund") + " (₹)"}>
                  <Input type="number" min={0} value={refund} onChange={(e) => setRefund(e.target.value)} placeholder="0" className="!w-32" />
                </Field>
                <div className="flex gap-2 mt-5">
                  <Button loading={busy} disabled={!resolution} onClick={async () => {
                    setBusy(true);
                    try {
                      await post(`/admin/disputes/${view.id}/resolve`, { outcome: "resolve", resolution, refundPaise: refund ? Math.round(Number(refund) * 100) : undefined });
                      push("Dispute resolved", "success"); setView(null); refresh();
                    } catch (e) { push(e instanceof Error ? e.message : "Failed", "error"); }
                    finally { setBusy(false); }
                  }}><Check size={14} /> {t("resolve")}</Button>
                  <Button variant="danger" loading={busy} disabled={!resolution} onClick={async () => {
                    setBusy(true);
                    try {
                      await post(`/admin/disputes/${view.id}/resolve`, { outcome: "reject", resolution });
                      push("Dispute rejected", "info"); setView(null); refresh();
                    } catch (e) { push(e instanceof Error ? e.message : "Failed", "error"); }
                    finally { setBusy(false); }
                  }}><X size={14} /> {t("rejectDispute")}</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}

function ReportsTab() {
  const { t } = useLang();
  const { push } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const refresh = () => get("/admin/reports").then((r) => setRows(r.reports ?? [])).catch(() => {});
  useEffect(() => {
    refresh();
    const s1 = socketOn("report:new", () => refresh());
    return () => { s1(); };
  }, []);
  async function setStatus(id: string, status: string) {
    setBusyId(id);
    try {
      await patch(`/admin/reports/${id}`, { status });
      push(status === "closed" ? "Report closed" : "Marked investigating", "success");
      refresh();
    } catch (e) {
      push(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setBusyId(null);
    }
  }
  return (
    <Card className="!p-5">
      {rows.length === 0 ? <EmptyState icon={<MessageSquareWarning size={24} />} title={t("none")} /> : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl p-4" style={{ background: "var(--surface-2)" }}>
              <div className="flex items-center gap-3 flex-wrap">
                <b className="text-sm">{r.category}</b>
                <Badge tone={r.status === "open" ? "warning" : "muted"}>{r.status}</Badge>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{r.reporterName} → {r.targetEmail} · {timeAgo(r.createdAt)}</span>
                <div className="ml-auto flex gap-1.5">
                  {r.status === "open" && (
                    <>
                      <Button size="sm" variant="secondary" loading={busyId === r.id} onClick={() => setStatus(r.id, "investigating")}>{t("investigate")}</Button>
                      <Button size="sm" variant="ghost" loading={busyId === r.id} onClick={() => setStatus(r.id, "closed")}>{t("closeReport")}</Button>
                    </>
                  )}
                </div>
              </div>
              {r.description && <p className="text-sm mt-2 mb-0" style={{ color: "var(--text-muted)" }}>{r.description}</p>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ServicesTab() {
  const { t } = useLang();
  const { push } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [f, setF] = useState({ name: "", description: "", category: "home", basePriceMin: "300", basePriceMax: "1500", warrantyDays: "7", icon: "wrench" });
  const [edit, setEdit] = useState<any | null>(null);
  const refresh = () => get("/admin/services").then((r) => setRows(r.services ?? [])).catch(() => {});
  useEffect(() => { refresh(); }, []);
  return (
    <Card className="!p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="font-bold m-0">{rows.length} services</p>
        <Button size="sm" onClick={() => setShowNew(true)}><Plus size={14} /> {t("addService")}</Button>
      </div>
      <div className="space-y-2">
        {rows.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 flex-wrap" style={{ background: "var(--surface-2)" }}>
            <div className="flex-1 min-w-[160px]">
              <b className="text-sm">{s.name}</b> <span className="text-xs" style={{ color: "var(--text-muted)" }}>· {s.slug} · {s.category}</span>
              <p className="text-xs m-0 mt-0.5" style={{ color: "var(--text-muted)" }}>₹{s.basePriceMin}–₹{s.basePriceMax} · {s.warrantyDays}d {t("warranty")}</p>
            </div>
            <Badge tone={s.status === "active" ? "success" : "muted"}>{s.status}</Badge>
            <Button size="sm" variant="ghost" onClick={() => setEdit(s)}>Edit</Button>
            <Button size="sm" variant={s.status === "active" ? "ghost" : "secondary"} onClick={async () => {
              try { await patch(`/admin/services/${s.id}`, { status: s.status === "active" ? "inactive" : "active" }); push("Updated", "success"); refresh(); }
              catch (e) { push(e instanceof Error ? e.message : "Failed", "error"); }
            }}>
              {s.status === "active" ? t("deactivate") : t("activate")}
            </Button>
          </div>
        ))}
      </div>
      <Modal open={showNew} onClose={() => setShowNew(false)} title={t("addService")}>
        <div className="space-y-3">
          <Field label={t("name")}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label={t("description")}><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("category")}><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></Field>
            <Field label={t("icon")}><Input value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })} /></Field>
            <Field label={t("basePriceMin") + " (₹)"}><Input type="number" value={f.basePriceMin} onChange={(e) => setF({ ...f, basePriceMin: e.target.value })} /></Field>
            <Field label={t("basePriceMax") + " (₹)"}><Input type="number" value={f.basePriceMax} onChange={(e) => setF({ ...f, basePriceMax: e.target.value })} /></Field>
          </div>
          <Button className="w-full" disabled={!f.name} onClick={async () => {
            try {
              await post("/admin/services", { ...f, basePriceMin: Number(f.basePriceMin), basePriceMax: Number(f.basePriceMax), warrantyDays: Number(f.warrantyDays) });
              push("Service added", "success"); setShowNew(false); refresh();
            } catch (e) { push(e instanceof Error ? e.message : "Failed", "error"); }
          }}>{t("addService")}</Button>
        </div>
      </Modal>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.name}>
        {edit && (
          <div className="space-y-3">
            <Field label={t("name")}><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label={t("description")}><Textarea rows={2} value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("basePriceMin") + " (₹)"}><Input type="number" value={edit.basePriceMin} onChange={(e) => setEdit({ ...edit, basePriceMin: Number(e.target.value) })} /></Field>
              <Field label={t("basePriceMax") + " (₹)"}><Input type="number" value={edit.basePriceMax} onChange={(e) => setEdit({ ...edit, basePriceMax: Number(e.target.value) })} /></Field>
            </div>
            <Field label={t("warranty") + " (days)"}><Input type="number" value={edit.warrantyDays} onChange={(e) => setEdit({ ...edit, warrantyDays: Number(e.target.value) })} /></Field>
            <Button className="w-full" onClick={async () => {
              try { await patch(`/admin/services/${edit.id}`, edit); push("Saved", "success"); setEdit(null); refresh(); }
              catch (e) { push(e instanceof Error ? e.message : "Failed", "error"); }
            }}>{t("save")}</Button>
          </div>
        )}
      </Modal>
    </Card>
  );
}

function AuditTab() {
  const { t } = useLang();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { get("/admin/audit").then((r) => setRows(r.logs ?? [])).catch(() => {}); }, []);
  return (
    <Card className="!p-5">
      <div className="space-y-1.5">
        {rows.slice(0, 60).map((l) => (
          <div key={l.id} className="flex items-center gap-3 text-sm rounded-xl px-3 py-2" style={{ background: "var(--surface-2)" }}>
            <b>{l.action}</b>
            <span style={{ color: "var(--text-muted)" }}>{l.entityType} {l.entityId?.slice(0, 8)}</span>
            <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>{l.adminName} · {timeAgo(l.createdAt)}</span>
          </div>
        ))}
        {rows.length === 0 && <EmptyState title={t("none")} />}
      </div>
    </Card>
  );
}

function Pager({ page, total, per, onPage }: { page: number; total: number; per: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / per));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between p-4 text-sm" style={{ color: "var(--text-muted)" }}>
      <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>←</Button>
      <span>{page} / {pages}</span>
      <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>→</Button>
    </div>
  );
}

/* -------------------------------- settings -------------------------------- */
export function AdminSettings() {
  const { t } = useLang();
  const { push } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [outbox, setOutbox] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get("/admin/settings").then((r) => setSettings(r.settings ?? {})).catch(() => {});
    get("/admin/outbox").then((r) => setOutbox(r.emails ?? [])).catch(() => {});
  }, []);

  const FIELDS: { key: string; label: string }[] = [
    { key: "platform_fee_percent", label: "Platform fee %" },
    { key: "match_radius_km", label: "Match radius (km)" },
    { key: "request_timeout_sec", label: "Request timeout (sec)" },
    { key: "support_email", label: "Support email" },
    { key: "support_phone", label: "Support phone" },
    { key: "warranty_default_days", label: "Default warranty (days)" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-extrabold m-0 mb-6">{t("settings")}</h1>
      <Card className="!p-6 mb-6">
        <p className="font-bold m-0 mb-4">Platform settings</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {FIELDS.map((x) => (
            <Field key={x.key} label={x.label}>
              <Input value={settings[x.key] ?? ""} onChange={(e) => setSettings({ ...settings, [x.key]: e.target.value })} />
            </Field>
          ))}
        </div>
        <Button className="mt-5" loading={busy} onClick={async () => {
          setBusy(true);
          try {
            await patch("/admin/settings", settings);
            push(t("settingsSaved"), "success");
          } catch (e) {
            push(e instanceof Error ? e.message : "Failed", "error");
          } finally { setBusy(false); }
        }}>
          {t("save")}
        </Button>
      </Card>
      <Card className="!p-6">
        <p className="font-bold m-0 mb-1">Email outbox (dev)</p>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>{t("outboxHint")}</p>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {outbox.length === 0 ? <p className="text-sm m-0" style={{ color: "var(--text-muted)" }}>{t("none")}</p> : outbox.map((m) => (
            <div key={m.id} className="rounded-xl px-3 py-2.5 text-sm" style={{ background: "var(--surface-2)" }}>
              <div className="flex justify-between gap-2">
                <b>{m.subject}</b>
                <Badge tone={m.status === "sent" ? "success" : "warning"}>{m.status}</Badge>
              </div>
              <p className="text-xs m-0 mt-1" style={{ color: "var(--text-muted)" }}>{m.to} · {fmtDate(m.createdAt)}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
