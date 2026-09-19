/* SmartServe UI kit - buttons, cards, inputs, modals, badges, loaders, toasts. */
import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AlertTriangle, Check, Info, Loader2, Star, X, XCircle } from "lucide-react";
import { useToast } from "../lib/store";
import { STATUS_LABELS, STATUS_TONES } from "../lib/format";
import { cn } from "../lib/cn";

/* --------------------------------- button --------------------------------- */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "lg"; loading?: boolean };

export function Button({ variant = "primary", size = "md", loading, className, children, onClick, disabled, ...rest }: BtnProps) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      onClick={(e) => {
        const el = ref.current;
        if (el && !disabled && !loading) {
          const rect = el.getBoundingClientRect();
          const span = document.createElement("span");
          const d = Math.max(rect.width, rect.height);
          span.className = "ripple";
          span.style.width = span.style.height = `${d}px`;
          span.style.left = `${e.clientX - rect.left - d / 2}px`;
          span.style.top = `${e.clientY - rect.top - d / 2}px`;
          el.appendChild(span);
          setTimeout(() => span.remove(), 600);
        }
        onClick?.(e);
      }}
      className={cn("btn", `btn-${variant}`, size === "sm" && "btn-sm", size === "lg" && "btn-lg", className)}
      {...rest}
    >
      {loading && <Loader2 size={17} className="spin-slow" />}
      {children}
    </button>
  );
}

/* --------------------------------- inputs ---------------------------------- */

export function Field({ label, hint, children }: { label?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      {label && <label className="label">{label}</label>}
      {children}
      {hint && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{hint}</p>}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("input", className)} {...rest} />;
}
export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("textarea", className)} {...rest} />;
}
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn("select", className)} {...rest}>
      {children}
    </select>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={cn("switch", on && "on")} onClick={() => onChange(!on)} />
  );
}

/* ---------------------------------- card ------------------------------------ */

export function Card({ className, children, tilt }: { className?: string; children: ReactNode; tilt?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.getAttribute("data-bandwidth") === "low") return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${px * 5}deg) rotateX(${-py * 5}deg) translateY(-2px)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = "";
  };
  return (
    <div ref={ref} onMouseMove={tilt ? onMove : undefined} onMouseLeave={tilt ? onLeave : undefined} className={cn("glass p-5", tilt && "tilt", className)}>
      {children}
    </div>
  );
}

/* --------------------------------- badges ----------------------------------- */

export function Badge({ tone = "muted", children, className }: { tone?: "muted" | "primary" | "success" | "warning" | "danger" | "info"; children: ReactNode; className?: string }) {
  return <span className={cn("badge", tone !== "muted" && `badge-${tone}`, className)}>{children}</span>;
}

const toneMap: Record<string, string> = {
  info: "var(--info)",
  primary: "var(--primary)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  muted: "var(--text-muted)",
};

export function StatusBadge({ status, live }: { status: string; live?: boolean }) {
  const tone = STATUS_TONES[status] ?? "muted";
  return (
    <span className={cn("st", (live || ["matching", "provider_invited", "on_the_way", "in_progress"].includes(status)) && "st-live")} style={{ color: toneMap[tone], background: `color-mix(in srgb, ${toneMap[tone]} 12%, transparent)` }}>
      <span className="st-dot" />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

/* --------------------------------- stars ------------------------------------- */

export function Stars({ value, onChange, size = 18 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={cn("star", onChange && "cursor-pointer")}
          style={{ color: i <= Math.round(value) ? "var(--warning)" : "var(--border-strong)", fill: i <= Math.round(value) ? "currentColor" : "transparent" }}
          onClick={onChange ? () => onChange(i) : undefined}
        />
      ))}
    </span>
  );
}

/* -------------------------------- loaders ------------------------------------ */

export function Spinner({ label, size = 26, className }: { label?: string; size?: number; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${label ? "py-10" : ""} ${className ?? ""}`}>
      <Loader2 size={size} className="spin-slow" style={{ color: "var(--primary)" }} />
      {label && <p className="text-sm" style={{ color: "var(--text-muted)" }}>{label}</p>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function EmptyState({ icon, title, subtitle, action }: { icon?: ReactNode; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="text-4xl opacity-60">{icon ?? "🛠️"}</div>
      <p className="font-semibold text-lg">{title}</p>
      {subtitle && <p className="text-sm max-w-sm" style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* --------------------------------- modal -------------------------------------- */

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className={cn("modal-panel glass-solid p-6", wide && "!max-w-3xl")} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          {title && <h3 className="text-xl font-bold m-0">{title}</h3>}
          <button className="btn btn-ghost btn-sm !min-h-9 !px-2.5" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* --------------------------------- toasts ------------------------------------- */

export function Toasts() {
  const { toasts, dismiss } = useToast();
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-auto">
      {toasts.map((t) => (
        <div key={t.id} className="toast glass-solid px-4 py-3 flex items-start gap-3" style={{ borderLeft: `4px solid ${t.kind === "success" ? "var(--success)" : t.kind === "error" ? "var(--danger)" : "var(--info)"}` }}>
          {t.kind === "success" ? <Check size={18} className="mt-0.5 shrink-0" style={{ color: "var(--success)" }} /> : t.kind === "error" ? <XCircle size={18} className="mt-0.5 shrink-0" style={{ color: "var(--danger)" }} /> : <Info size={18} className="mt-0.5 shrink-0" style={{ color: "var(--info)" }} />}
          <p className="m-0 text-sm flex-1">{t.text}</p>
          <button onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ scroll reveal --------------------------------- */

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      },
      { threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={cn("reveal", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* -------------------------------- particles ----------------------------------- */

export function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let running = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);
    const N = 36;
    const parts = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: (Math.random() * 2 + 0.6) * dpr,
      vx: (Math.random() - 0.5) * 0.25 * dpr,
      vy: (Math.random() - 0.5) * 0.25 * dpr,
      a: Math.random() * 0.5 + 0.15,
    }));
    const step = () => {
      if (!running) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const dark = document.documentElement.getAttribute("data-theme") === "dark";
      const color = dark ? "249,115,22" : "236,72,153";
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color},${p.a * 0.5})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(step);
    };
    const onBw = () => {
      running = document.documentElement.getAttribute("data-bandwidth") !== "low";
      if (running) raf = requestAnimationFrame(step);
    };
    onBw();
    new MutationObserver(onBw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-bandwidth"] });
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas id="fx-particles" ref={ref} aria-hidden="true" />;
}

/* ------------------------------- misc helpers ---------------------------------- */

export function Avatar({ name, src, size = 40 }: { name?: string | null; src?: string | null; size?: number }) {
  const init = (name ?? "?")
    .replace(/@.*/, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  if (src) return <img src={src} alt={name ?? ""} width={size} height={size} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold shrink-0"
      style={{ width: size, height: size, background: "var(--primary-soft)", color: "var(--primary)", fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {init || "?"}
    </div>
  );
}

export function WarningNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm ${className ?? ""}`} style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>
      <AlertTriangle size={17} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
