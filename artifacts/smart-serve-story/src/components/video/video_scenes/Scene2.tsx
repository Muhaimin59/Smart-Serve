import { motion } from 'framer-motion';
import { Camera, Check, ScanLine, Sparkles } from 'lucide-react';
import { baseAsset, Kicker, SceneFrame, ease } from './Shared';

export function Scene2() {
  return (
    <SceneFrame reveal="circle" className="bg-[var(--cream)] text-[var(--ink)]">
      <div className="absolute left-0 top-0 h-full w-[53%] bg-[radial-gradient(circle_at_18%_18%,rgba(131,201,190,.36),transparent_33%),linear-gradient(140deg,#f3ede1,#e8dece)]" />
      <motion.div
        className="absolute -bottom-[18vw] -left-[8vw] h-[44vw] w-[44vw] rounded-full border border-[rgba(43,139,131,.18)]"
        animate={{ rotate: -360, scale: [1, 1.04, 1] }}
        transition={{ rotate: { duration: 28, repeat: Infinity, ease: 'linear' }, scale: { duration: 8, repeat: Infinity, ease: 'easeInOut' } }}
      />
      <div className="absolute left-[8vw] top-[8.5vw] w-[33vw]">
        <Kicker>First, make the unknown visible</Kicker>
        <motion.h2
          className="type-display text-[4.5vw] font-semibold leading-[.96] tracking-[-.06em]"
          initial={{ opacity: 0, x: '-2vw' }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.28, duration: 0.9, ease }}
        >
          See the<br /><span className="text-[var(--teal)]">real problem.</span>
        </motion.h2>
        <motion.p
          className="mt-[1.65vw] max-w-[25vw] text-[1vw] leading-[1.5] text-[rgba(16,40,58,.68)]"
          initial={{ opacity: 0, y: '1vw' }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.72, duration: 0.7, ease }}
        >
          Point your camera at the mess. Smart Serve turns a hard-to-explain moment into a clear next step.
        </motion.p>
        <motion.div
          className="mt-[2.1vw] flex items-center gap-[.65vw] text-[.62vw] font-semibold uppercase tracking-[.16em] text-[var(--teal)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.15, duration: 0.5 }}
        >
          <span className="flex h-[1.7vw] w-[1.7vw] items-center justify-center rounded-full bg-[var(--teal)] text-[var(--cream)]"><Camera className="h-[.85vw] w-[.85vw]" /></span>
          Scan my problem
        </motion.div>
      </div>

      <motion.div
        className="device-shadow absolute right-[13vw] top-[5.2vw] h-[39vw] w-[22vw] rounded-[2.2vw] border-[.55vw] border-[var(--ink)] bg-[var(--ink)] p-[.45vw]"
        initial={{ opacity: 0, y: '4vw', rotate: 4 }}
        animate={{ opacity: 1, y: 0, rotate: 2 }}
        transition={{ delay: 0.18, duration: 1.15, ease }}
      >
        <div className="relative h-full overflow-hidden rounded-[1.55vw] bg-[var(--ink-deep)]">
          <img src={baseAsset('leak-detail.png')} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,29,44,.1),rgba(10,29,44,.86))]" />
          <div className="absolute left-[1.1vw] right-[1.1vw] top-[1.2vw] flex items-center justify-between text-[.55vw] text-[var(--cream)]">
            <span className="type-mono tracking-[.12em]">SMART SCAN</span>
            <span className="rounded-full bg-[rgba(243,237,225,.14)] px-[.55vw] py-[.3vw]">LIVE</span>
          </div>
          <motion.div
            className="scan-line absolute left-[1.05vw] right-[1.05vw] top-[14vw] h-[.11vw] bg-[var(--apricot)] shadow-[0_0_1.2vw_rgba(244,162,97,.85)]"
          />
          <div className="absolute left-[1.1vw] right-[1.1vw] top-[11vw] h-[10vw] rounded-[1vw] border-[.12vw] border-dashed border-[rgba(131,201,190,.85)]">
            <span className="absolute -left-[.12vw] -top-[.12vw] h-[1.1vw] w-[1.1vw] border-l-[.16vw] border-t-[.16vw] border-[var(--apricot)]" />
            <span className="absolute -right-[.12vw] -top-[.12vw] h-[1.1vw] w-[1.1vw] border-r-[.16vw] border-t-[.16vw] border-[var(--apricot)]" />
            <span className="absolute -bottom-[.12vw] -left-[.12vw] h-[1.1vw] w-[1.1vw] border-b-[.16vw] border-l-[.16vw] border-[var(--apricot)]" />
            <span className="absolute -bottom-[.12vw] -right-[.12vw] h-[1.1vw] w-[1.1vw] border-b-[.16vw] border-r-[.16vw] border-[var(--apricot)]" />
          </div>
          <motion.div
            className="absolute bottom-[1vw] left-[.75vw] right-[.75vw] rounded-[1vw] bg-[rgba(243,237,225,.96)] p-[1vw] text-[var(--ink)] paper-shadow"
            initial={{ opacity: 0, y: '2vw' }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.75, ease }}
          >
            <div className="flex items-center gap-[.45vw] text-[.58vw] font-semibold uppercase tracking-[.1em] text-[var(--teal)]"><Sparkles className="h-[.8vw] w-[.8vw]" /> AI read</div>
            <div className="mt-[.6vw] text-[1.05vw] font-semibold leading-[1.1]">Possible pipe leakage</div>
            <div className="mt-[.5vw] flex items-center justify-between text-[.58vw] text-[rgba(16,40,58,.63)]">
              <span className="flex items-center gap-[.3vw]"><Check className="h-[.7vw] w-[.7vw] text-[var(--teal)]" /> Medium severity</span>
              <span>₹500–₹1,500</span>
            </div>
          </motion.div>
        </div>
      </motion.div>
      <div className="absolute bottom-[4.3vw] right-[6vw] type-mono text-[.53vw] uppercase tracking-[.2em] text-[rgba(16,40,58,.48)]">01 / SEE</div>
    </SceneFrame>
  );
}