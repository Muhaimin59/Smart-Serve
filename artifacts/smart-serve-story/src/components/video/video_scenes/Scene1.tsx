import { motion } from 'framer-motion';
import { ArrowUpRight, Droplets, MapPin } from 'lucide-react';
import { baseAsset, BrandMark, GlassLabel, Kicker, SceneFrame, ease } from './Shared';

export function Scene1() {
  return (
    <SceneFrame reveal="zoom" className="bg-[var(--ink-deep)] text-[var(--cream)]">
      <motion.img
        src={baseAsset('leak-detail.png')}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-[.34]"
        initial={{ scale: 1.12, x: '2vw' }}
        animate={{ scale: 1.02, x: '-1vw' }}
        transition={{ duration: 6, ease: 'easeOut' }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,29,44,.97)_0%,rgba(10,29,44,.82)_38%,rgba(10,29,44,.25)_78%,rgba(10,29,44,.8)_100%)]" />
      <div className="grid-lines absolute inset-0 opacity-50" />
      <motion.div
        className="absolute -right-[8vw] -top-[16vw] h-[42vw] w-[42vw] rounded-full border border-[rgba(131,201,190,.26)]"
        animate={{ rotate: 360, scale: [1, 1.06, 1] }}
        transition={{ rotate: { duration: 22, repeat: Infinity, ease: 'linear' }, scale: { duration: 6, repeat: Infinity, ease: 'easeInOut' } }}
      />
      <div className="absolute left-[6vw] top-[4.5vw]">
        <BrandMark />
      </div>
      <div className="absolute right-[6vw] top-[5vw]">
        <GlassLabel><span className="mr-[.55vw] text-[var(--apricot)]">●</span> A PRODUCT STORY / 01—07</GlassLabel>
      </div>

      <div className="absolute left-[8vw] top-[16.2vw] w-[46vw]">
        <Kicker light>When the everyday goes sideways</Kicker>
        <motion.h1
          className="type-display max-w-[45vw] text-[6.2vw] font-semibold leading-[.92] tracking-[-.065em]"
          initial={{ opacity: 0, y: '2vw' }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 1.1, ease }}
        >
          Something<br />
          <span className="text-[var(--apricot)]">breaks.</span>
        </motion.h1>
        <motion.p
          className="mt-[1.8vw] max-w-[28vw] text-[1.18vw] leading-[1.45] text-[rgba(243,237,225,.72)]"
          initial={{ opacity: 0, y: '1vw' }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.72, duration: 0.8, ease }}
        >
          The hard part isn’t finding a number. It’s knowing who to trust on the other side of it.
        </motion.p>
      </div>

      <motion.div
        className="absolute bottom-[5.4vw] left-[8vw] flex items-center gap-[.8vw] text-[.68vw] uppercase tracking-[.18em] text-[rgba(243,237,225,.55)]"
        initial={{ opacity: 0, x: '-1vw' }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.1, duration: 0.7, ease }}
      >
        <MapPin className="h-[1vw] w-[1vw] text-[var(--apricot)]" />
        <span>One neighborhood. A thousand small emergencies.</span>
        <ArrowUpRight className="ml-[1.8vw] h-[1vw] w-[1vw] text-[var(--teal-light)]" />
      </motion.div>
      <div className="absolute bottom-[5.15vw] right-[10vw] flex items-center gap-[.7vw] rounded-full border border-[rgba(243,237,225,.16)] px-[1vw] py-[.7vw] text-[.72vw] text-[rgba(243,237,225,.7)]">
        <Droplets className="h-[1vw] w-[1vw] text-[var(--coral)]" />
        <span>Kitchen sink / 08:42</span>
      </div>
    </SceneFrame>
  );
}