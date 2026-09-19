/* Global app state: auth, theme, language, low-bandwidth, toasts, notifications. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { clearSession, getStoredUser, getToken, setSession } from "./api";
import { translate, type LangCode } from "./i18n";

/* ------------------------------- theme ------------------------------------ */

type ThemeCtx = {
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
  lowBw: boolean;
  setLowBw: (v: boolean) => void;
};
const ThemeContext = createContext<ThemeCtx>(null as never);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<"light" | "dark">(() => {
    try {
      const saved = localStorage.getItem("ss-theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      /* noop */
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [lowBw, setLowBwState] = useState<boolean>(() => {
    try {
      return localStorage.getItem("ss-bandwidth") === "low";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("ss-theme", theme);
    } catch {
      /* noop */
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#09090b" : "#fdf2f6");
  }, [theme]);
  useEffect(() => {
    if (lowBw) document.documentElement.setAttribute("data-bandwidth", "low");
    else document.documentElement.removeAttribute("data-bandwidth");
    try {
      localStorage.setItem("ss-bandwidth", lowBw ? "low" : "high");
    } catch {
      /* noop */
    }
  }, [lowBw]);
  const value = useMemo(
    () => ({
      theme,
      setTheme: (t: "light" | "dark") => setThemeState(t),
      lowBw,
      setLowBw: (v: boolean) => setLowBwState(v),
    }),
    [theme, lowBw],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);

/* ------------------------------ language ---------------------------------- */

type LangCtx = { lang: LangCode; setLang: (l: LangCode) => void; t: (key: string) => string };
const LangContext = createContext<LangCtx>(null as never);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(() => {
    try {
      const saved = (localStorage.getItem("ss-lang") ?? "en") as LangCode;
      return ["en", "hi", "kn", "ta", "te", "mr"].includes(saved) ? saved : "en";
    } catch {
      return "en";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("ss-lang", lang);
    } catch {
      /* noop */
    }
  }, [lang]);
  const t = useCallback((key: string) => translate(lang, key), [lang]);
  const value = useMemo(() => ({ lang, setLang: (l: LangCode) => setLangState(l), t }), [lang, t]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}
export const useLang = () => useContext(LangContext);

/* -------------------------------- toasts ----------------------------------- */

export type Toast = { id: number; kind: "success" | "error" | "info"; text: string };
type ToastCtx = {
  toasts: Toast[];
  toast: (kind: Toast["kind"], text: string) => void;
  push: (text: string, kind?: Toast["kind"]) => void;
  dismiss: (id: number) => void;
};
const ToastContext = createContext<ToastCtx>(null as never);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);
  const toast = useCallback((kind: Toast["kind"], text: string) => {
    const id = idRef.current++;
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((text: string, kind: Toast["kind"] = "info") => toast(kind, text), [toast]);
  const value = useMemo(() => ({ toasts, toast, push, dismiss }), [toasts, toast, push, dismiss]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}
export const useToast = () => useContext(ToastContext);

/* --------------------------------- auth ------------------------------------ */

export type SessionUser = {
  id: string;
  email: string;
  role: string;
  displayName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  language?: string;
  emailVerifiedAt?: string | null;
  createdAt: string;
  isDemo?: boolean;
};

type AuthCtx = {
  user: SessionUser | null;
  setUser: (u: SessionUser | null) => void;
  token: string | null;
  setToken: (t: string | null) => void;
  logout: () => void;
  ready: boolean;
};
const AuthContext = createContext<AuthCtx>(null as never);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(getStoredUser());
  const [token, setTokenState] = useState<string | null>(getToken());
  const [ready, setReady] = useState(!getToken());
  const { t } = useLang();
  useEffect(() => {
    if (token && user) return;
    setReady(false);
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        if (!res.ok) {
          clearSession();
          setUser(null);
          setTokenState(null);
          return;
        }
        const json = await res.json();
        setUser(json.user);
        setSession(token!, json.user);
        localStorage.setItem(USER_KEY_SAFE, JSON.stringify(json.user));
      } catch {
        /* offline: keep stored session */
      } finally {
        setReady(true);
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  const setToken = useCallback((t: string | null) => {
    setTokenState(t);
    if (t === null) {
      clearSession();
      setUser(null);
    }
  }, []);
  const logout = useCallback(() => {
    const tk = getToken();
    if (tk) fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${tk}` } }).catch(() => {});
    clearSession();
    setUser(null);
    setTokenState(null);
  }, []);
  const value = useMemo(() => ({ user, setUser, token, setToken, logout, ready }), [user, token, logout, setToken, ready]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
const USER_KEY_SAFE = "ss-user";

/* ----------------------------- notifications ------------------------------- */

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
  readAt?: string | null;
  createdAt: string;
};
type NotifCtx = {
  notifications: NotificationItem[];
  unread: number;
  refresh: () => Promise<void>;
  markRead: (id?: string) => Promise<void>;
  live: (n: NotificationItem) => void;
};
const NotifContext = createContext<NotifCtx>(null as never);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const { toast } = useToast();
  const { t } = useLang();

  const refresh = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnread(0);
      return;
    }
    try {
      const res = await (await fetch("/api/customer/notifications", { headers: { Authorization: `Bearer ${getToken()}` } })).json();
      setNotifications(res.notifications ?? []);
      setUnread(res.unread ?? 0);
    } catch {
      /* offline */
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const live = useCallback(
    (n: NotificationItem) => {
      setNotifications((list) => [n, ...list.filter((x) => x.id !== n.id)].slice(0, 50));
      setUnread((u) => u + 1);
      toast("info", n.title);
    },
    [toast],
  );

  const markRead = useCallback(async (id?: string) => {
    try {
      const res = await (
        await fetch("/api/customer/notifications/read", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify(id ? { id } : {}),
        })
      ).json();
      setUnread(res.unread ?? 0);
      if (id) setNotifications((list) => list.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
      else setNotifications((list) => list.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })));
    } catch {
      /* offline */
    }
  }, []);

  const value = useMemo(() => ({ notifications, unread, refresh, markRead, live }), [notifications, unread, refresh, markRead, live]);
  return <NotifContext.Provider value={value}>{children}</NotifContext.Provider>;
}
export const useNotifications = () => useContext(NotifContext);
