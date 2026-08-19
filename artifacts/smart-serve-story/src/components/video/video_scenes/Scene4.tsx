import { motion } from 'framer-motion';
import { BadgeCheck, Clock3, Star, Wrench } from 'lucide-react';
import { baseAsset, Kicker, SceneFrame, StatusCheck, ease } from './Shared';

export function Scene4() {
  return (
    <SceneFrame reveal="wipe" className="bg-[var(--teal)] text-[var(--cream)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(243,237,225,.2),transparent_22%),linear-gradient(120deg,var(--teal),#17635f)]" />
      <motion.div className="absolute right-[3vw] top-[5vw] h-[39vw] w-[39vw] rounded-full border border-[rgba(243,237,225,.18)]" animate={{ rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }} />
      <div className="absolute left-[8vw] top-[8.5vw] w-[32vw]">
        <Kicker light>Not just five stars</Kicker>
        <motion.h2
          className="type-display text-[4.35vw] font-semibold leading-[.94] tracking-[-.06em]"
          initial={{ opacity: 0, x: '-2vw' }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25, duration: 0.85, ease }}
        >
          Trust is<br /><span className="text-[var(--apricot)]">earned.</span>
        </motion.h2>
        <motion.p
          className="mt-[1.65vw] max-w-[24vw] text-[1vw] leading-[1.5] text-[rgba(243,237,225,.72)]"
          initial={{ opacity: 0, y: '1vw' }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.72, duration: 0.7, ease }}
        >
          Smart matching looks past a rating to the signals that make a good visit feel inevitable.
        </motion.p>
      </div>
      <motion.div
        className="absolute left-[8vw] bottom-[5.2vw] flex items-center gap-[.75vw] text-[.62vw] font-semibold uppercase tracking-[.14em] text-[rgba(243,237,225,.75)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        <span className="h-[.55vw] w-[.55vw] rounded-full bg-[var(--apricot)]" /> Recommended for your home, your time, your problem.
      </motion.div>

      <motion.div
        className="absolute right-[11vw] top-[5.3vw] h-[37vw] w-[28vw] overflow-hidden rounded-[1.8vw] border-[.4vw] border-[rgba(243,237,225,.45)] bg-[var(--ink)] device-shadow"
        initial={{ opacity: 0, y: '3vw', rotate: -4 }}
        animate={{ opacity: 1, y: 0, rotate: -2 }}
        transition={{ delay: 0.22, duration: 1.05, ease }}
      >
        <img src={baseAsset('provider-portrait.png')} alt="" className="absolute inset-0 h-full w-full object-cover opacity-[.83]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent 12%,rgba(10,29,44,.14) 40%,rgba(10,29,44,.95) 88%)]" />
        <div className="absolute left-[1.4vw] right-[1.4vw] top-[1.2vw] flex items-center justify-between"><span className="type-mono rounded-full bg-[rgba(10,29,44,.62)] px-[.7vw] py-[.4vw] text-[.53vw] uppercase tracking-[.12em] text-[var(--cream)]">SMART MATCH</span><BadgeCheck className="h-[1.25vw] w-[1.25vw] text-[var(--apricot)]" /></div>
        <motion.div
          className="absolute bottom-[1.1vw] left-[1.1vw] right-[1.1vw] rounded-[1.1vw] bg-[rgba(243,237,225,.96)] p-[1.25vw] text-[var(--ink)] paper-shadow"
          initial={{ opacity: 0, y: '2vw' }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05, duration: 0.7, ease }}
        >
          <div className="flex items-start justify-between">
            <div><div className="type-display text-[1.35vw] font-semibold">Asha Menon</div><div className="mt-[.25vw] flex items-center gap-[.35vw] text-[.58vw] text-[rgba(16,40,58,.6)]"><Wrench className="h-[.75vw] w-[.75vw] text-[var(--teal)]" /> Verified electrician</div></div>
            <div className="text-right"><div className="type-display text-[2.25vw] font-semibold leading-none text-[var(--teal)]">92</div><div className="type-mono mt-[.2vw] text-[.47vw] uppercase tracking-[.12em] text-[rgba(16,40,58,.48)]">trust score</div></div>
          </div>
          <div className="my-[1vw] h-[.08vw] bg-[rgba(16,40,58,.12)]" />
          <div className="grid grid-cols-2 gap-[.65vw]">
            <StatusCheck>186 jobs</StatusCheck>
            <StatusCheck>96% on time</StatusCheck>
            <StatusCheck>Skill verified</StatusCheck>
            <div className="flex items-center gap-[.45vw] text-[.78vw]"><Star className="h-[1vw] w-[1vw] fill-[var(--apricot)] text-[var(--apricot)]" /> 4.8 average</div>
          </div>
          <div className="mt-[.95vw] flex items-center gap-[.4vw] text-[.58vw] font-semibold uppercase tracking-[.12em] text-[var(--teal)]"><Clock3 className="h-[.8vw] w-[.8vw]" /> Available today · 1.8 km away</div>
        </motion.div>
      </motion.div>
    </SceneFrame>
  );
}