import { motion } from 'framer-motion';
import { CarFront, Check, MapPin, Navigation, Radio } from 'lucide-react';
import { baseAsset, GlassLabel, Kicker, SceneFrame, ease } from './Shared';

export function Scene5() {
  return (
    <SceneFrame reveal="circle" className="bg-[var(--ink-deep)] text-[var(--cream)]">
      <img src={baseAsset('city-map.png')} alt="" className="absolute inset-0 h-full w-full object-cover opacity-[.32]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,29,44,.96)_0%,rgba(10,29,44,.72)_43%,rgba(10,29,44,.32)_100%)]" />
      <div className="grid-lines absolute inset-0 opacity-30" />
      <motion.div className="absolute left-[47%] top-[18%] h-[.75vw] w-[.75vw] rounded-full bg-[var(--apricot)] shadow-[0_0_0_0.4vw_rgba(244,162,97,.2)]" animate={{ scale: [1, 1.3, 1], boxShadow: ['0 0 0 .4vw rgba(244,162,97,.2)', '0 0 0 1.4vw rgba(244,162,97,0)', '0 0 0 .4vw rgba(244,162,97,.2)'] }} transition={{ duration: 2.2, repeat: Infinity }} />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 562" preserveAspectRatio="none" aria-hidden="true">
        <motion.path d="M 465 100 C 530 180 450 245 560 290 S 690 335 728 412" fill="none" stroke="#f4a261" strokeWidth="3" strokeDasharray="10 10" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ delay: .45, duration: 1.7, ease }} />
      </svg>
      <div className="absolute left-[8vw] top-[8.5vw] w-[34vw]">
        <Kicker light>Once you say yes</Kicker>
        <motion.h2 className="type-display text-[4.3vw] font-semibold leading-[.95] tracking-[-.06em]" initial={{ opacity: 0, y: '1.5vw' }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .25, duration: .9, ease }}>
          Help is<br /><span className="text-[var(--apricot)]">on the way.</span>
        </motion.h2>
        <motion.p className="mt-[1.65vw] max-w-[25vw] text-[1vw] leading-[1.5] text-[rgba(243,237,225,.68)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .75, duration: .75 }}>
          Track the arrival, share the details, and keep every update in one calm place.
        </motion.p>
      </div>
      <motion.div className="absolute right-[10vw] top-[8vw] w-[23.5vw] rounded-[1.3vw] border border-[rgba(243,237,225,.18)] bg-[rgba(16,40,58,.84)] p-[1.35vw] backdrop-blur-md device-shadow" initial={{ opacity: 0, x: '2.5vw', y: '1vw' }} animate={{ opacity: 1, x: 0, y: 0 }} transition={{ delay: .55, duration: .9, ease }}>
        <div className="flex items-center justify-between"><GlassLabel><Radio className="mr-[.45vw] h-[.7vw] w-[.7vw] text-[var(--apricot)]" /> LIVE TRACKING</GlassLabel><span className="type-mono text-[.52vw] text-[var(--teal-light)]">08:57 AM</span></div>
        <div className="mt-[1.3vw] flex items-center gap-[.8vw]"><div className="flex h-[3.3vw] w-[3.3vw] items-center justify-center rounded-full bg-[var(--apricot)] text-[var(--ink)]"><CarFront className="h-[1.45vw] w-[1.45vw]" /></div><div><div className="type-display text-[1.2vw] font-semibold">Asha is driving</div><div className="mt-[.3vw] text-[.66vw] text-[rgba(243,237,225,.6)]">White scooter · KA 03 MK 218</div></div></div>
        <div className="mt-[1.35vw] h-[.35vw] overflow-hidden rounded-full bg-[rgba(243,237,225,.13)]"><motion.div className="h-full rounded-full bg-[var(--teal-light)]" initial={{ width: '14%' }} animate={{ width: '68%' }} transition={{ delay: .8, duration: 1.4, ease }} /></div>
        <div className="mt-[.7vw] flex justify-between text-[.58vw] uppercase tracking-[.1em] text-[rgba(243,237,225,.52)]"><span>Accepted</span><span>Arriving</span><span>At your door</span></div>
        <div className="mt-[1.25vw] flex items-center justify-between rounded-[.75vw] bg-[rgba(43,139,131,.22)] px-[.85vw] py-[.75vw]"><div className="flex items-center gap-[.55vw] text-[.78vw]"><Navigation className="h-[.95vw] w-[.95vw] text-[var(--teal-light)]" /> ETA <strong className="text-[var(--apricot)]">12 min</strong></div><MapPin className="h-[1vw] w-[1vw] text-[var(--teal-light)]" /></div>
      </motion.div>
      <div className="absolute bottom-[5vw] right-[10vw] flex items-center gap-[.55vw] text-[.62vw] text-[rgba(243,237,225,.58)]"><Check className="h-[.85vw] w-[.85vw] text-[var(--teal-light)]" /> Location shared only for this active booking</div>
    </SceneFrame>
  );
}