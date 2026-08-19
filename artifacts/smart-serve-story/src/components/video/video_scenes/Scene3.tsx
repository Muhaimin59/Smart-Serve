import { motion } from 'framer-motion';
import { Check, Mic2, ReceiptText, Sparkles } from 'lucide-react';
import { SceneFrame, Kicker, ease } from './Shared';

export function Scene3() {
  const bars = [42, 68, 54, 84, 62, 38, 74, 92, 64, 52, 78, 46];
  return (
    <SceneFrame reveal="split" className="bg-[var(--ink)] text-[var(--cream)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_35%,rgba(43,139,131,.24),transparent_31%),radial-gradient(circle_at_15%_90%,rgba(244,162,97,.11),transparent_28%)]" />
      <div className="grid-lines absolute inset-0 opacity-40" />
      <motion.div
        className="absolute -right-[11vw] -top-[16vw] h-[46vw] w-[46vw] rounded-full border border-[rgba(244,162,97,.2)]"
        animate={{ rotate: [0, 10, 0], scale: [1, 1.07, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="absolute left-[8vw] top-[8.5vw] w-[31vw]">
        <Kicker light>Clarity before commitment</Kicker>
        <motion.h2
          className="type-display text-[4.4vw] font-semibold leading-[.95] tracking-[-.06em]"
          initial={{ opacity: 0, y: '1.5vw' }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.9, ease }}
        >
          Understand<br /><span className="text-[var(--apricot)]">the cost.</span>
        </motion.h2>
        <motion.p
          className="mt-[1.7vw] max-w-[25vw] text-[1vw] leading-[1.5] text-[rgba(243,237,225,.64)]"
          initial={{ opacity: 0, y: '1vw' }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75, duration: 0.7, ease }}
        >
          A calm voice, a transparent range, and a quote you can compare — before anyone reaches your door.
        </motion.p>
      </div>

      <motion.div
        className="absolute left-[8vw] bottom-[5vw] flex items-center gap-[.85vw] rounded-[1vw] border border-[rgba(243,237,225,.16)] bg-[rgba(243,237,225,.06)] px-[1.05vw] py-[.85vw] backdrop-blur-md"
        initial={{ opacity: 0, x: '-1.5vw' }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.25, duration: 0.65, ease }}
      >
        <div className="flex h-[2.2vw] w-[2.2vw] items-center justify-center rounded-full bg-[var(--apricot)] text-[var(--ink)]"><Mic2 className="h-[1vw] w-[1vw]" /></div>
        <div>
          <div className="type-mono text-[.52vw] uppercase tracking-[.14em] text-[var(--teal-light)]">Voice booking</div>
          <div className="mt-[.28vw] text-[.82vw] text-[var(--cream)]">“Kitchen sink leakage, tomorrow morning.”</div>
        </div>
      </motion.div>

      <motion.div
        className="paper-shadow absolute right-[10vw] top-[8vw] w-[24.5vw] rotate-[2deg] rounded-[1.35vw] bg-[var(--cream)] p-[1.6vw] text-[var(--ink)]"
        initial={{ opacity: 0, y: '2.8vw', rotate: 8 }}
        animate={{ opacity: 1, y: 0, rotate: 2 }}
        transition={{ delay: 0.45, duration: 1.05, ease }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[.5vw]"><ReceiptText className="h-[1.15vw] w-[1.15vw] text-[var(--teal)]" /><span className="type-mono text-[.57vw] font-semibold uppercase tracking-[.12em] text-[var(--teal)]">AI COST ESTIMATE</span></div>
          <span className="rounded-full bg-[rgba(43,139,131,.12)] px-[.6vw] py-[.35vw] text-[.52vw] font-semibold text-[var(--teal)]">MEDIUM CONFIDENCE</span>
        </div>
        <div className="mt-[1.25vw] type-display text-[3.2vw] font-semibold tracking-[-.06em]">₹800–₹1,200</div>
        <div className="mt-[.3vw] text-[.68vw] text-[rgba(16,40,58,.56)]">Estimated range · not a guaranteed price</div>
        <div className="my-[1.35vw] h-[.08vw] bg-[rgba(16,40,58,.14)]" />
        <div className="space-y-[.8vw] text-[.73vw]">
          <div className="flex justify-between"><span>Estimated labor</span><strong>₹600</strong></div>
          <div className="flex justify-between"><span>Materials</span><strong>₹180</strong></div>
          <div className="flex justify-between"><span>Visit charge</span><strong>₹120</strong></div>
        </div>
        <div className="mt-[1.25vw] flex items-end gap-[.22vw]">
          {bars.map((height, index) => (
            <motion.span
              key={index}
              className={`w-[.55vw] rounded-t-[.25vw] ${index === 7 ? 'bg-[var(--coral)]' : 'bg-[var(--teal-light)]'}`}
              initial={{ height: 0 }}
              animate={{ height: `${height / 7}vw` }}
              transition={{ delay: 1 + index * 0.04, duration: 0.55, ease }}
            />
          ))}
          <span className="ml-[.55vw] type-mono text-[.5vw] text-[rgba(16,40,58,.48)]">LOCAL<br />RANGE</span>
        </div>
      </motion.div>
      <motion.div
        className="absolute right-[7.5vw] bottom-[5.2vw] flex items-center gap-[.6vw] text-[.66vw] text-[rgba(243,237,225,.55)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.45, duration: 0.5 }}
      >
        <Sparkles className="h-[.85vw] w-[.85vw] text-[var(--apricot)]" /> Every line item stays visible.
      </motion.div>
    </SceneFrame>
  );
}