import type { CSSProperties, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import logo from '@assets/smart-serve/assets/images/icon.png';

export const baseAsset = (name: string) =>
  `${import.meta.env.BASE_URL}assets/${name}`;

export const ease = [0.16, 1, 0.3, 1] as const;

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center ${compact ? 'gap-[.55vw]' : 'gap-[.8vw]'}`}>
      <img
        src={logo}
        alt="Smart Serve"
        className={compact ? 'h-[3.1vw] w-[3.1vw] rounded-[.65vw]' : 'h-[5.2vw] w-[5.2vw] rounded-[1vw]'}
      />
      <div className="leading-none">
        <div className="type-display text-[1.18vw] font-bold tracking-[.08em] text-[var(--white)]">
          SMART<span className="text-[var(--apricot)]">.</span>SERVE
        </div>
        {!compact && (
          <div className="type-mono mt-[.42vw] text-[.48vw] tracking-[.24em] text-[var(--teal-light)]">
            LOCAL HELP / MADE CLEAR
          </div>
        )}
      </div>
    </div>
  );
}

export function Kicker({
  children,
  light = false,
}: {
  children: ReactNode;
  light?: boolean;
}) {
  return (
    <div className={`type-mono mb-[1.4vw] flex items-center gap-[.7vw] text-[.62vw] font-semibold uppercase tracking-[.22em] ${light ? 'text-[var(--teal-light)]' : 'text-[var(--teal)]'}`}>
      <span className={`h-[.45vw] w-[.45vw] rounded-full ${light ? 'bg-[var(--apricot)]' : 'bg-[var(--coral)]'}`} />
      {children}
    </div>
  );
}

export function SceneFrame({
  children,
  reveal = 'wipe',
  className = '',
}: {
  children: ReactNode;
  reveal?: 'wipe' | 'circle' | 'split' | 'zoom';
  className?: string;
}) {
  const variants = {
    wipe: {
      initial: { clipPath: 'inset(0 100% 0 0)' },
      animate: { clipPath: 'inset(0 0% 0 0)' },
      exit: { clipPath: 'inset(0 0 0 100%)' },
    },
    circle: {
      initial: { clipPath: 'circle(0% at 84% 48%)' },
      animate: { clipPath: 'circle(100% at 84% 48%)' },
      exit: { clipPath: 'circle(0% at 16% 50%)' },
    },
    split: {
      initial: { clipPath: 'inset(50% 0 50% 0)' },
      animate: { clipPath: 'inset(0% 0 0% 0)' },
      exit: { clipPath: 'inset(50% 0 50% 0)' },
    },
    zoom: {
      initial: { opacity: 0, scale: 0.62 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 1.32 },
    },
  } as const;

  return (
    <motion.section
      className={`absolute inset-0 overflow-hidden ${className}`}
      initial={variants[reveal].initial}
      animate={variants[reveal].animate}
      exit={variants[reveal].exit}
      transition={{ duration: 0.95, ease }}
    >
      {children}
    </motion.section>
  );
}

export function GlassLabel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`type-mono inline-flex items-center rounded-full border border-[rgba(243,237,225,.2)] bg-[rgba(16,40,58,.55)] px-[1vw] py-[.55vw] text-[.56vw] uppercase tracking-[.14em] text-[var(--cream)] backdrop-blur-md ${className}`}>
      {children}
    </div>
  );
}

export function StatusCheck({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-[.55vw] text-[.78vw] text-[var(--ink)]">
      <ShieldCheck className="h-[1.05vw] w-[1.05vw] text-[var(--teal)]" strokeWidth={2.4} />
      <span>{children}</span>
    </div>
  );
}

export function cssVars(vars: Record<string, string>): CSSProperties {
  return vars as CSSProperties;
}