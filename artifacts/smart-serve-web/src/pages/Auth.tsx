/* Auth pages: login, signup (customer/provider), forgot/reset password, verify email, Google. */
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, ShieldCheck, User } from "lucide-react";
import { get, post } from "../lib/api";
import { useAuth, useLang, useToast } from "../lib/store";
import { Button, Card, Field, Input, Spinner, WarningNote } from "../components/ui";

/** Perform a credential login against /api/auth/login and persist the session. */
async function loginUser(
  setToken: (t: string | null) => void,
  email: string,
  password: string,
): Promise<{ id: string; role: string }> {
  const res = await post<{ token: string; expiresAt: string; user: { id: string; role: string } }>("/auth/login", { email, password });
  localStorage.setItem("ss-token", res.token);
  localStorage.setItem("ss-user", JSON.stringify(res.user));
  setToken(res.token);
  return res.user;
}

function AuthCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <Card tilt className="!p-7">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold m-0">{title}</h1>
          {sub && <p className="text-sm mt-1 mb-0" style={{ color: "var(--text-muted)" }}>{sub}</p>}
        </div>
        {children}
      </Card>
    </div>
  );
}

/* ------------------------------- login ------------------------------- */
export function Login() {
  const { t, lang } = useLang();
  const { setToken } = useAuth();
  const { push } = useToast();
  const nav = useNavigate();
  const [f, setF] = useState({ email: "admin@demo.in", password: "Admin@12345" });
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const user = await loginUser(setToken, f.email, f.password);
      push(t("loggedIn"), "success");
      nav(user.role === "admin" ? "/admin" : user.role === "customer" ? "/app" : "/provider");
    } catch (err) {
      push(err instanceof Error ? err.message : "Login failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title={t("signIn")} sub={t("welcomeBack")}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t("email")}>
          <Input type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@example.com" />
        </Field>
        <Field label={t("password")}>
          <div className="relative">
            <Input type={showPw ? "text" : "password"} required autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className="pr-10" placeholder="••••••••" />
            <button type="button" aria-label="toggle password" className="absolute top-1/2 right-3 -translate-y-1/2" style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }} onClick={() => setShowPw(!showPw)}>
              {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </Field>
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" defaultChecked className="accent-[var(--primary)]" /> {t("rememberMe")}
          </label>
          <Link to="/forgot-password" className="font-semibold" style={{ color: "var(--primary)" }}>{t("forgotPassword")}</Link>
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={busy}>
          {busy ? <Spinner size={16} /> : t("signIn")}
        </Button>
        <GoogleButton />
        <p className="text-sm text-center m-0" style={{ color: "var(--text-muted)" }}>
          {t("noAccount")} <Link to="/signup" className="font-bold" style={{ color: "var(--primary)" }}>{t("createAccount")}</Link>
        </p>
      </form>
      <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
        <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>{t("tryDemo")} — {t("click")}</p>
        <div className="flex gap-2 flex-wrap">
          {["admin@demo.in/Admin@12345", "customer@demo.in/Demo@12345", "provider@demo.in/Demo@12345"].map((d) => (
            <button key={d} type="button" className="badge font-mono !text-[11px]" style={{ cursor: "pointer" }} onClick={() => setF({ email: d.split("/")[0], password: d.split("/")[1] })}>
              {d.split("/")[0]}
            </button>
          ))}
        </div>
        {lang !== "en" && (
          <p className="text-[11px] mt-2 mb-0" style={{ color: "var(--text-muted)" }}>
            Demo accounts (same credentials): admin@demo.in, customer@demo.in, provider@demo.in
          </p>
        )}
      </div>
    </AuthCard>
  );
}

function GoogleButton() {
  const { t } = useLang();
  const { push } = useToast();
  return (
    <button
      type="button"
      className="w-full flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-bold transition-colors"
      style={{ borderColor: "var(--border-strong)", cursor: "pointer" }}
      onClick={async () => {
        try {
          const st = await get("/auth/google/status");
          if (st.configured) {
            window.location.href = "/api/auth/google";
          } else {
            push(t("googleOAuthNote"), "info");
          }
        } catch {
          push(t("googleOAuthNote"), "info");
        }
      }}
    >
      <svg width="17" height="17" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 5.9 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 5.9 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
      {t("continueWithGoogle")}
    </button>
  );
}

/* ------------------------------- signup ------------------------------- */
export function Signup() {
  const { t } = useLang();
  const { setToken } = useAuth();
  const { push } = useToast();
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "", password2: "", role: "customer" as "customer" | "provider" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (f.password.length < 12) return setErr(t("passwordHint"));
    if (f.password !== f.password2) return setErr(t("passwordsMustMatch"));
    setBusy(true);
    try {
      const res = await post<{ token?: string; user?: { role?: string }; devVerification?: { token: string } }>("/auth/signup", {
        name: f.name,
        email: f.email,
        phone: f.phone || undefined,
        password: f.password,
        role: f.role,
      });
      if (res && res.token && res.user) {
        localStorage.setItem("ss-token", res.token);
        localStorage.setItem("ss-user", JSON.stringify(res.user));
        setToken(res.token);
        push(t("welcome") + (f.name ? `, ${f.name}` : ""), "success");
        if (res.devVerification) {
          push(`Verify your email: /verify-email?token=${res.devVerification.token}`, "info");
        }
        nav(f.role === "provider" ? "/provider/profile" : "/app");
      } else {
        push("Account created — check your email to verify.", "success");
        nav("/login");
      }
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title={t("createAccount")} sub={t("getStarted")}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(["customer", "provider"] as const).map((r) => (
            <button
              key={r}
              type="button"
              className="rounded-xl border p-3 text-sm font-bold transition-all"
              style={{
                borderColor: f.role === r ? "var(--primary)" : "var(--border-strong)",
                background: f.role === r ? "var(--primary-soft)" : "transparent",
                cursor: "pointer",
              }}
              onClick={() => setF({ ...f, role: r })}
            >
              {r === "customer" ? <User size={16} className="inline mr-1.5" /> : <ShieldCheck size={16} className="inline mr-1.5" />}
              {r === "customer" ? t("iAmCustomer") : t("iAmProvider")}
            </button>
          ))}
        </div>
        <Field label={t("name")}>
          <Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Asha R." />
        </Field>
        <Field label={t("email")}>
          <Input type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@example.com" />
        </Field>
        <Field label={t("phone")}>
          <Input required pattern="[0-9+ -]{10,15}" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+91 98765 43210" />
        </Field>
        <Field label={t("password")}>
          <Input type="password" required autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="••••••••••••" />
        </Field>
        <Field label={t("confirmPassword")}>
          <Input type="password" required autoComplete="new-password" value={f.password2} onChange={(e) => setF({ ...f, password2: e.target.value })} placeholder="••••••••••••" />
        </Field>
        {f.role === "provider" && (
          <WarningNote>
            {t("providerProfileNote")}
          </WarningNote>
        )}
        {err && <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--danger)" }}><AlertTriangle size={14} /> {err}</p>}
        <Button type="submit" className="w-full" size="lg" disabled={busy}>
          {busy ? <Spinner size={16} /> : t("createAccount")}
        </Button>
        <p className="text-sm text-center m-0" style={{ color: "var(--text-muted)" }}>
          {t("haveAccount")} <Link to="/login" className="font-bold" style={{ color: "var(--primary)" }}>{t("signIn")}</Link>
        </p>
      </form>
    </AuthCard>
  );
}

/* ------------------------- forgot / reset ------------------------- */
export function ForgotPassword() {
  const { t } = useLang();
  const { push } = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  return (
    <AuthCard title={t("forgotPassword")} sub={t("resetSent")}>
      {sent ? (
        <div className="text-center">
          <CheckCircle2 size={44} className="mx-auto mb-3" style={{ color: "var(--success)" }} />
          <p className="font-semibold">{email}</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {t("resetLinkNote")}
          </p>
          <Link to="/login"><Button variant="ghost">{t("backToSignIn")}</Button></Link>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await post("/auth/forgot-password", { email });
              setSent(true);
            } catch {
              /* always report sent to avoid account enumeration */
              setSent(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label={t("email")}>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy ? <Spinner size={16} /> : t("sendResetLink")}
          </Button>
          <Link to="/login" className="block text-center text-sm font-semibold" style={{ color: "var(--primary)" }}>{t("backToSignIn")}</Link>
        </form>
      )}
    </AuthCard>
  );
}

export function ResetPassword() {
  const { t } = useLang();
  const { push } = useToast();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [f, setF] = useState({ password: "", password2: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  return (
    <AuthCard title={t("resetPassword")} sub={t("passwordHint")}>
      {!token && (
        <WarningNote className="mb-4">
          {t("resetLinkNote")}
        </WarningNote>
      )}
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr("");
          if (f.password.length < 12) return setErr(t("passwordHint"));
          if (f.password !== f.password2) return setErr(t("passwordsMustMatch"));
          setBusy(true);
          try {
            await post("/auth/reset-password", { token, password: f.password });
            push(t("passwordUpdated"), "success");
            nav("/login");
          } catch (e2) {
            setErr(e2 instanceof Error ? e2.message : "Reset failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label={t("newPassword")}>
          <Input type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="••••••••••••" />
        </Field>
        <Field label={t("confirmPassword")}>
          <Input type="password" required value={f.password2} onChange={(e) => setF({ ...f, password2: e.target.value })} placeholder="••••••••••••" />
        </Field>
        {err && <p className="text-sm font-semibold" style={{ color: "var(--danger)" }}>{err}</p>}
        <Button type="submit" className="w-full" size="lg" disabled={busy || !token}>
          {busy ? <Spinner size={16} /> : t("updatePassword")}
        </Button>
      </form>
    </AuthCard>
  );
}

export function VerifyEmail() {
  const { t } = useLang();
  const { push } = useToast();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [state, setState] = useState<"checking" | "ok" | "bad">("checking");

  useEffect(() => {
    const token = params.get("token");
    if (!token) return setState("bad");
    post("/auth/verify-email", { token })
      .then(() => setState("ok"))
      .catch(() => setState("bad"));
  }, [params]);

  return (
    <AuthCard title={t("verifyEmail")}>
      <div className="text-center py-4">
        {state === "checking" && <Spinner size={32} />}
        {state === "ok" && (
          <>
            <CheckCircle2 size={48} className="mx-auto mb-3" style={{ color: "var(--success)" }} />
            <p className="font-bold">{t("emailVerified")}</p>
            <Button className="mt-2" onClick={() => nav("/login")}>{t("backToSignIn")}</Button>
          </>
        )}
        {state === "bad" && (
          <>
            <AlertTriangle size={48} className="mx-auto mb-3" style={{ color: "var(--danger)" }} />
            <p className="font-bold">{t("verifyLinkInvalid")}</p>
            <Button className="mt-2" onClick={() => nav("/login")}>{t("backToSignIn")}</Button>
          </>
        )}
      </div>
    </AuthCard>
  );
}

export function GoogleLogin() {
  const { t } = useLang();
  const { push } = useToast();
  const nav = useNavigate();
  const { user, setToken } = useAuth();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  useEffect(() => {
    if (!token) return;
    try {
      localStorage.setItem("ss-token", token);
      setToken(token);
      push(t("loggedIn"), "success");
    } catch {
      push(t("googleOAuthNote"), "info");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (user) nav(user.role === "admin" ? "/admin" : user.role === "customer" ? "/app" : "/provider", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <AuthCard title={t("continueWithGoogle")}>
      {token ? (
        <div className="text-center py-6"><Spinner size={30} /></div>
      ) : (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {t("googleOAuthNote")}{" "}
          <Link to="/login" className="font-bold" style={{ color: "var(--primary)" }}>{t("backToSignIn")}</Link>
        </p>
      )}
    </AuthCard>
  );
}
