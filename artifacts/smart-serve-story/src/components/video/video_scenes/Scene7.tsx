import { motion } from 'framer-motion';
import { ArrowDownRight, Check, HeartHandshake, Sparkles } from 'lucide-react';
import { BrandMark, SceneFrame, ease } from './Shared';

export function Scene7() {
  return (
    <SceneFrame reveal="zoom" className="bg-[var(--ink-deep)] text-[var(--cream)]">
      <motion.div className="absolute -right-[13vw] -top-[15vw] h-[49vw] w-[49vw] rounded-full border border-[rgba(131,201,190,.26)]" initial={{ scale: .7, opacity: .3 }} animate={{ scale: [1, 1.08, 1], opacity: [.3, .5, .3], rotate: 360 }} transition={{ scale: { duration: 7, repeat: Infinity }, opacity: { duration: 7, repeat: Infinity }, rotate: { duration: 36, repeat: Infinity, ease: 'linear' } }} />
      <motion.div className="absolute left-[17vw] top-[12vw] h-[22vw] w-[22vw] rounded-full bg-[var(--teal)] opacity-20 blur-[5vw]" animate={{ x: ['0vw', '2vw', '0vw'], y: ['0vw', '-1vw', '0vw'] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} />
      <div className="grid-lines absolute inset-0 opacity-35" />
      <div className="absolute left-[8vw] top-[4.5vw]"><BrandMark /></div>
      <div className="absolute right-[7vw] top-[5vw] type-mono text-[.57vw] uppercase tracking-[.2em] text-[rgba(243,237,225,.5)]">06 / THE DIFFERENCE</div>
      <div className="absolute left-[16vw] top-[12.2vw]">
        <motion.div className="flex items-center gap-[.85vw]" initial={{ opacity: 0, y: '-1vw' }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .15, duration: .65, ease }}><span className="flex h-[2.4vw] w-[2.4vw] items-center justify-center rounded-full bg-[var(--apricot)] text-[var(--ink)]"><HeartHandshake className="h-[1.2vw] w-[1.2vw]" /></span><span className="type-mono text-[.63vw] uppercase tracking-[.18em] text-[var(--teal-light)]">Local help, made human</span></motion.div>
        <motion.h2 className="type-display mt-[1.8vw] text-[7vw] font-semibold leading-[.83] tracking-[-.075em]" initial={{ opacity: 0, scale: .82, y: '2vw' }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: .35, duration: 1.2, ease }}>See.<br /><span className="text-[var(--apricot)]">Understand.</span><br />Trust.<br /><span className="text-[var(--teal-light)]">Serve.</span></motion.h2>
      </div>
      <motion.div className="absolute right-[12vw] bottom-[10vw] w-[20vw]" initial={{ opacity: 0, x: '2vw' }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.15, duration: .8, ease }}>
        <div className="flex items-start gap-[.8vw] border-l-[.15vw] border-[var(--apricot)] pl-[1.1vw]"><Sparkles className="mt-[.2vw] h-[1vw] w-[1vw] text-[var(--apricot)]" /><p className="text-[1.05vw] leading-[1.4] text-[rgba(243,237,225,.74)]">The confidence to get the right help — without the guesswork.</p></div>
        <div className="mt-[2vw] flex items-center gap-[.6vw] text-[.6vw] uppercase tracking-[.15em] text-[rgba(243,237,225,.5)]"><Check className="h-[.8vw] w-[.8vw] text-[var(--teal-light)]" /> Trust in, stress out.</div>
      </motion.div>
      <motion.div className="absolute bottom-[4.8vw] left-[8vw] flex items-center gap-[.55vw] text-[.56vw] uppercase tracking-[.2em] text-[rgba(243,237,225,.48)]" animate={{ x: [0, 6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}><ArrowDownRight className="h-[.8vw] w-[.8vw] text-[var(--teal-light)]" /> Smart Serve / for the moments between “oh no” and “all sorted”</motion.div>
    </SceneFrame>
  );
}