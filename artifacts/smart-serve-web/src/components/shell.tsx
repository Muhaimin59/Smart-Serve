/* App shell: navbar (with notifications, theme, language), footer, guards. */
import { useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Bell, Globe, LayoutDashboard, LogOut, Menu, Moon, Search, Settings, Sparkles, Sun, Wifi, WifiOff, X, Zap } from "lucide-react";
import { useAuth, useLang, useNotifications, useTheme } from "../lib/store";
import { LANGS } from "../lib/i18n";
import { timeAgo } from "../lib/format";
import { cn } from "../lib/cn";
import { Avatar, Badge } from "./ui";
import { useSocketConnected } from "../lib/socket";

export function Logo({ small }: { small?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 font-extrabold" style={{ fontSize: small ? "1.1rem" : "1.25rem" }}>
      <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, var(--primary), var(--secondary))", color: "#fff" }}>
        <Zap size={19} />
      </span>
      <span>
        Smart<span className="gradient-text">Serve</span>
      </span>
    </Link>
  );
}

export function Navbar() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useLang();
  const { notifications, unread, markRead } = useNotifications();
  const connected = useSocketConnected();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const links = user
    ? user.role === "admin"
      ? [
          { to: "/admin", icon: <LayoutDashboard size={17} />, label: t("adminPanel") },
          { to: "/admin/analytics", icon: <Globe size={17} />, label: t("analytics") },
          { to: "/admin/settings", icon: <Settings size={17} />, label: t("settings") },
        ]
      : user.role === "provider" || user.role === "student_provider"
        ? [
            { to: "/provider", icon: <LayoutDashboard size={17} />, label: t("dashboard") },
            { to: "/provider/profile", icon: <Settings size={17} />, label: t("profile") },
            { to: "/provider/earnings", icon: <Zap size={17} />, label: t("earnings") },
          ]
        : [
            { to: "/app", icon: <LayoutDashboard size={17} />, label: t("dashboard") },
            { to: "/services", icon: <Search size={17} />, label: t("services") },
            { to: "/providers", icon: <Globe size={17} />, label: t("providers") },
            { to: "/bookings", icon: <Sparkles size={17} />, label: t("myBookings") },
            { to: "/safety", icon: <Bell size={17} />, label: t("safety") },
          ]
    : [];

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-xl border-b"
      style={{ background: "color-mix(in srgb, var(--background) 78%, transparent)", borderColor: "var(--border)" }}
    >
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-3">
        <button className="lg:hidden btn btn-ghost btn-sm !min-h-10 !px-2.5" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <Logo small />
        {user && (
          <span className={cn("hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full", connected ? "badge badge-success" : "badge")} style={connected ? {} : { color: "var(--text-muted)" }}>
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />} {connected ? "Live" : "Reconnecting…"}
          </span>
        )}
        <nav className="hidden lg:flex items-center gap-1 ml-4">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => cn("nav-link", isActive && "active")}>
              {l.icon} {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-1.5 ml-auto">
          {user && user.role === "customer" && (
            <Link to="/book" className="hidden sm:inline-flex">
              <span className="btn btn-primary btn-sm">{t("book")}</span>
            </Link>
          )}
          {/* language */}
          <div className="relative">
            <button className="btn btn-ghost btn-sm !min-h-10 !px-2.5" onClick={() => { setLangOpen(!langOpen); setNotifOpen(false); setUserOpen(false); }} aria-label={t("language")}>
              <Globe size={17} />
              <span className="hidden sm:inline uppercase">{lang}</span>
            </button>
            {langOpen && (
              <div className="absolute right-0 mt-2 glass-solid p-2 w-44 z-50">
                {LANGS.map((l) => (
                  <button key={l.code} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:opacity-80" style={{ background: lang === l.code ? "var(--primary-soft)" : "transparent" }} onClick={() => { setLang(l.code); setLangOpen(false); }}>
                    {l.native}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* theme */}
          <button className="btn btn-ghost btn-sm !min-h-10 !px-2.5" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? t("lightMode") : t("darkMode")}>
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          {user && (
            <>
              {/* notifications */}
              <div className="relative">
                <button className="btn btn-ghost btn-sm !min-h-10 !px-2.5 relative" onClick={() => { setNotifOpen(!notifOpen); setUserOpen(false); setLangOpen(false); }} aria-label={t("notifications")}>
                  <Bell size={17} />
                  {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: "var(--danger)", color: "#fff" }}>
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="absolute right-0 mt-2 glass-solid w-[340px] max-w-[90vw] z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                      <p className="font-bold m-0 text-sm">{t("notifications")}</p>
                      {unread > 0 && (
                        <button className="text-xs underline" style={{ color: "var(--primary)" }} onClick={() => markRead()}>
                          {t("markAllRead")}
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto chat-scroll">
                      {notifications.length === 0 && <p className="text-sm p-4 text-center" style={{ color: "var(--text-muted)" }}>{t("noNotifications")}</p>}
                      {notifications.slice(0, 15).map((n) => (
                        <button
                          key={n.id}
                          className="w-full text-left px-4 py-3 border-b last:border-0 hover:opacity-80"
                          style={{ borderColor: "var(--border)", background: n.readAt ? "transparent" : "var(--primary-soft)" }}
                          onClick={() => {
                            markRead(n.id);
                            const bid = n.data?.bookingId as string | undefined;
                            setNotifOpen(false);
                            if (bid) navigate(`/bookings/${bid}`);
                            else if (n.type === "sos_alert" || n.type === "report:new") navigate("/admin");
                          }}
                        >
                          <p className="m-0 text-sm font-semibold leading-snug">{n.title}</p>
                          {n.body && <p className="m-0 mt-0.5 text-xs line-clamp-2" style={{ color: "var(--text-muted)" }}>{n.body}</p>}
                          <p className="m-0 mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>{timeAgo(n.createdAt)}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {/* user menu */}
              <div className="relative">
                <button className="flex items-center gap-2" onClick={() => { setUserOpen(!userOpen); setNotifOpen(false); setLangOpen(false); }} aria-label="Account menu">
                  <Avatar name={user.displayName} src={user.avatarUrl} size={34} />
                </button>
                {userOpen && (
                  <div className="absolute right-0 mt-2 glass-solid w-56 z-50 p-2">
                    <div className="px-3 py-2">
                      <p className="font-bold m-0 text-sm truncate">{user.displayName}</p>
                      <p className="text-xs m-0 truncate" style={{ color: "var(--text-muted)" }}>{user.email}</p>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        <Badge tone={user.role === "admin" ? "danger" : user.role === "customer" ? "primary" : "success"}>{user.role.replace("_", " ")}</Badge>
                        {user.isDemo && <Badge tone="warning">{t("demo")}</Badge>}
                      </div>
                    </div>
                    <div className="divider my-1.5" />
                    <Link to="/settings" className="block px-3 py-2 rounded-lg text-sm hover:opacity-80" onClick={() => setUserOpen(false)}>
                      {t("settings")}
                    </Link>
                    <button
                      className="w-full text-left px-3 py-2 rounded-lg text-sm hover:opacity-80 flex items-center gap-2"
                      style={{ color: "var(--danger)" }}
                      onClick={() => {
                        logout();
                        navigate("/");
                      }}
                    >
                      <LogOut size={15} /> {t("logout")}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
          {!user && (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">
                {t("login")}
              </Link>
              <Link to="/signup" className="btn btn-primary btn-sm">
                {t("signup")}
              </Link>
            </>
          )}
        </div>
      </div>
      {/* mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,.4)" }} onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[290px] glass-solid p-4 flex flex-col gap-1">
            <div className="flex items-center justify-between mb-3">
              <Logo small />
              <button className="btn btn-ghost btn-sm !min-h-9 !px-2" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            {user ? (
              links.map((l) => (
                <NavLink key={l.to} to={l.to} className={({ isActive }) => cn("nav-link", isActive && "active")} onClick={() => setMobileOpen(false)}>
                  {l.icon} {l.label}
                </NavLink>
              ))
            ) : (
              <>
                <Link to="/services" className="nav-link" onClick={() => setMobileOpen(false)}>
                  {t("services")}
                </Link>
                <Link to="/providers" className="nav-link" onClick={() => setMobileOpen(false)}>
                  {t("providers")}
                </Link>
              </>
            )}
            {user && user.role === "customer" && (
              <Link to="/book" className="nav-link" style={{ color: "var(--primary)", background: "var(--primary-soft)" }} onClick={() => setMobileOpen(false)}>
                <Sparkles size={17} /> {t("book")}
              </Link>
            )}
            <div className="mt-auto">
              {user ? (
                <button className="w-full btn btn-ghost" onClick={() => { logout(); setMobileOpen(false); navigate("/"); }}>
                  <LogOut size={16} /> {t("logout")}
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link to="/login" className="btn btn-ghost" onClick={() => setMobileOpen(false)}>
                    {t("login")}
                  </Link>
                  <Link to="/signup" className="btn btn-primary" onClick={() => setMobileOpen(false)}>
                    {t("signup")}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { t } = useLang();
  return (
    <footer className="mt-16 border-t" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-7xl mx-auto px-4 py-10 grid sm:grid-cols-3 gap-8">
        <div>
          <Logo small />
          <p className="text-sm mt-3" style={{ color: "var(--text-muted)" }}>
            {t("tagline")}
          </p>
        </div>
        <div className="text-sm">
          <p className="font-bold mb-2">{t("services")}</p>
          {["AC Repair & Service", "Electrician", "Plumber", "Deep Cleaner", "Laptop & Computer Repair"].map((s) => (
            <p key={s} style={{ color: "var(--text-muted)", margin: "0.25rem 0" }}>{s}</p>
          ))}
        </div>
        <div className="text-sm">
          <p className="font-bold mb-2">{t("safety")}</p>
          <p style={{ color: "var(--text-muted)", margin: "0.25rem 0" }}>{t("sosHint")}</p>
          <p style={{ color: "var(--text-muted)", margin: "0.25rem 0" }}>© {new Date().getFullYear()} SmartServe</p>
        </div>
      </div>
    </footer>
  );
}

export function Protected({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { user, ready } = useAuth();
  const { t } = useLang();
  const [pending, setPending] = useState(!ready);
  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="skeleton w-64 h-40" />
      </div>
    );
  }
  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-20 glass p-8 text-center">
        <p className="font-bold text-xl">Please log in</p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>{t("iHaveAccount")}</p>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Link to="/login" className="btn btn-ghost">{t("login")}</Link>
          <Link to="/signup" className="btn btn-primary">{t("signup")}</Link>
        </div>
      </div>
    );
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="max-w-md mx-auto mt-20 glass p-8 text-center">
        <p className="font-bold text-xl">403</p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>This area is restricted to {roles.join(" / ")} accounts.</p>
      </div>
    );
  }
  void pending;
  return <>{children}</>;
}
