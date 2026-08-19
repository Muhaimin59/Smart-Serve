import { useVideoPlayer } from '@/lib/video';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BrandMark,
  Scene1,
  Scene2,
  Scene3,
  Scene4,
  Scene5,
  Scene6,
  Scene7,
} from './index';

const SCENE_DURATIONS = {
  opening: 4300,
  scan: 4700,
  price: 4700,
  trust: 5100,
  tracking: 5100,
  resolve: 4700,
  lockup: 5000,
};

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({
    durations: SCENE_DURATIONS,
  });

  const scene = [
    <Scene1 key="scene-1" />,
    <Scene2 key="scene-2" />,
    <Scene3 key="scene-3" />,
    <Scene4 key="scene-4" />,
    <Scene5 key="scene-5" />,
    <Scene6 key="scene-6" />,
    <Scene7 key="scene-7" />,
  ][currentScene];

  return (
    <div
      className="video-root bg-[var(--ink-deep)]"
    >
      <motion.div
        className="pointer-events-none absolute -left-[10vw] -top-[20vw] z-[1] h-[44vw] w-[44vw] rounded-full bg-[var(--teal)] opacity-[.14] blur-[4vw]"
        animate={{
          x: currentScene === 0 ? '0vw' : currentScene < 3 ? '12vw' : currentScene < 6 ? '-4vw' : '8vw',
          y: currentScene === 1 ? '7vw' : currentScene === 4 ? '-3vw' : '0vw',
          scale: currentScene === 6 ? 1.18 : 1,
        }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.div
        className="pointer-events-none absolute -right-[10vw] -bottom-[22vw] z-[1] h-[48vw] w-[48vw] rounded-full bg-[var(--apricot)] opacity-[.1] blur-[5vw]"
        animate={{
          x: currentScene === 2 ? '-8vw' : currentScene === 5 ? '4vw' : '0vw',
          y: currentScene === 3 ? '-4vw' : '0vw',
          scale: currentScene === 0 ? 1.1 : 1,
        }}
        transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
      />

      <AnimatePresence mode="sync" initial={false}>
        {scene}
      </AnimatePresence>
      <div className="noise" />

      <div className="pointer-events-none absolute bottom-[1.55vw] left-[6vw] right-[6vw] z-[20] flex items-center gap-[1vw]">
        <div className="h-[.12vw] flex-1 overflow-hidden rounded-full bg-[rgba(243,237,225,.18)]">
          <motion.div
            className="h-full origin-left rounded-full bg-[var(--apricot)]"
            animate={{ scaleX: (currentScene + 1) / 7 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        <div className="type-mono w-[4vw] text-right text-[.5vw] tracking-[.16em] text-[rgba(243,237,225,.5)]">
          {String(currentScene + 1).padStart(2, '0')} / 07
        </div>
      </div>
      <div className="pointer-events-none absolute right-[6vw] bottom-[4vw] z-[20] opacity-80">
        <BrandMark compact />
      </div>
    </div>
  );
}
