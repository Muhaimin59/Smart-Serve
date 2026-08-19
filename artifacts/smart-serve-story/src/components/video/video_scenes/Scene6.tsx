import { motion } from 'framer-motion';
import { CheckCircle2, LockKeyhole, ShieldCheck, Star, Wrench } from 'lucide-react';
import { baseAsset, Kicker, SceneFrame, ease } from './Shared';

export function Scene6() {
  return (
    <SceneFrame reveal="split" className="bg-[var(--cream)] text-[var(--ink)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(244,162,97,.2),transparent_29%),linear-gradient(130deg,var(--cream),#ebe1d1)]" />
      <motion.div className="absolute -left-[12vw] -bottom-[21vw] h-[50vw] w-[50vw] rounded-full border border-[rgba(43,139,131,.18)]" animate={{ rotate: -360 }} transition={{ duration: 24, repeat: Infinity, ease: 'linear' }} />
      <div className="absolute left-[8vw] top-[8.5vw] w-[33vw]">
        <Kicker>The last mile matters</Kicker>
        <motion.h2 className="type-display text-[4.35vw] font-semibold leading-[.95] tracking-[-.06em]" initial={{ opacity: 0, x: '-1.8vw' }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .25, duration: .9, ease }}>
          Good work<br /><span className="text-[var(--teal)]">leaves proof.</span>
        </motion.h2>
        <motion.p className="mt-[1.65vw] max-w-[25vw] text-[1vw] leading-[1.5] text-[rgba(16,40,58,.68)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .75, duration: .7 }}>
          Completion photos, a clear receipt, and revisit protection when the job calls for it.
        </motion.p>
        <motion.div className="mt-[2vw] flex items-center gap-[.7vw] text-[.62vw] font-semibold uppercase tracking-[.15em] text-[var(--teal)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.12 }}><LockKeyhole className="h-[.9vw] w-[.9vw]" /> Payment released after confirmation</motion.div>
      </div>
      <motion.div className="paper-shadow absolute right-[12vw] top-[8vw] w-[24vw] rounded-[1.4vw] bg-[var(--white)] p-[1.5vw]" initial={{ opacity: 0, y: '2.5vw', rotate: 3 }} animate={{ opacity: 1, y: 0, rotate: 1 }} transition={{ delay: .4, duration: .95, ease }}>
        <div className="flex items-center justify-between"><div className="flex items-center gap-[.5vw] text-[var(--teal)]"><CheckCircle2 className="h-[1.15vw] w-[1.15vw]" /><span className="type-mono text-[.56vw] font-semibold uppercase tracking-[.13em]">SERVICE COMPLETE</span></div><span className="type-mono text-[.54vw] text-[rgba(16,40,58,.46)]">#SS-0842</span></div>
        <div className="mt-[1.35vw] flex items-center gap-[.8vw]"><img src={baseAsset('provider-portrait.png')} alt="" className="h-[3.25vw] w-[3.25vw] rounded-full object-cover" /><div><div className="type-display text-[1.15vw] font-semibold">Asha Menon</div><div className="mt-[.25vw] flex items-center gap-[.3vw] text-[.63vw] text-[rgba(16,40,58,.57)]"><Wrench className="h-[.7vw] w-[.7vw] text-[var(--teal)]" /> Kitchen pipe repair</div></div></div>
        <div className="my-[1.3vw] h-[.08vw] bg-[rgba(16,40,58,.12)]" />
        <div className="space-y-[.8vw] text-[.74vw]"><div className="flex justify-between"><span>Final amount</span><strong>₹960</strong></div><div className="flex justify-between"><span>Visit protection</span><strong className="text-[var(--teal)]">7 days</strong></div></div>
        <div className="mt-[1.35vw] rounded-[.8vw] bg-[rgba(43,139,131,.1)] px-[.85vw] py-[.8vw]"><div className="flex items-center gap-[.5vw] text-[.7vw] font-semibold text-[var(--teal)]"><ShieldCheck className="h-[.9vw] w-[.9vw]" /> Work verified by both sides</div><div className="mt-[.55vw] flex items-center gap-[.25vw]">{[0,1,2,3,4].map((i) => <Star key={i} className="h-[.8vw] w-[.8vw] fill-[var(--apricot)] text-[var(--apricot)]" />)}<span className="ml-[.35vw] text-[.58vw] text-[rgba(16,40,58,.56)]">Your review updates trust</span></div></div>
      </motion.div>
      <div className="absolute bottom-[4.7vw] right-[12vw] type-mono text-[.54vw] uppercase tracking-[.2em] text-[rgba(16,40,58,.48)]">05 / RESOLVE</div>
    </SceneFrame>
  );
}