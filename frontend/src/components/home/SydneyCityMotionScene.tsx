import { motion, useReducedMotion } from 'motion/react'

/** A second, compact Sydney vignette -- a control tower and a plane climbing out above a road
 * carrying one car. Kept the same restrained hand-drawn line style as the rest of the site, and
 * the same reduced height as its neighbour (SydneyTrainScene) so the pair sits side by side as
 * one section rather than each claiming a full-height band of its own. */
export default function SydneyCityMotionScene() {
  const reduceMotion = useReducedMotion()

  return (
    <svg viewBox="0 0 1200 165" className="h-24 w-full sm:h-28" preserveAspectRatio="xMidYMax meet" role="img" aria-label="An illustrated control tower with a plane taking off, above a road with a car driving past">
      <g opacity="0.9">
        <rect x="140" y="35" width="14" height="70" fill="none" stroke="#8c919b" strokeWidth="1.5" />
        <ellipse cx="147" cy="31" rx="20" ry="10" fill="#101722" stroke="#c99545" strokeWidth="1.5" />
        <rect x="139" y="25" width="16" height="10" rx="2" fill="#204a66" opacity="0.7" />
        <motion.circle
          cx="147"
          cy="23"
          r="1.6"
          fill="#e3b45e"
          animate={reduceMotion ? { opacity: 0.8 } : { opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </g>

      <g opacity="0.16" stroke="#8c919b" strokeWidth="1" fill="none">
        <rect x="980" y="55" width="18" height="50" />
        <rect x="1005" y="40" width="14" height="65" />
        <rect x="1028" y="62" width="20" height="43" />
      </g>

      <line x1="0" y1="105" x2="1200" y2="105" stroke="#1b2430" strokeWidth="1" opacity="0.6" />
      <motion.g
        initial={reduceMotion ? undefined : { x: -60, y: 0 }}
        animate={reduceMotion ? { x: 520, y: -30 } : { x: [-60, 300, 620, 1260], y: [0, -8, -42, -110] }}
        transition={reduceMotion ? { duration: 0.4 } : { duration: 9, repeat: Infinity, ease: 'easeIn' }}
      >
        <g transform="rotate(-14)">
          <path d="M 0 103 L 30 99 L 46 101 L 30 105 Z" fill="#eee8da" opacity="0.9" />
          <path d="M 14 100 L 10 90 L 16 100 Z" fill="#eee8da" opacity="0.75" />
          <path d="M 20 105 L 16 112 L 22 105 Z" fill="#eee8da" opacity="0.75" />
        </g>
      </motion.g>

      <rect x="0" y="130" width="1200" height="35" fill="#0b1018" />
      <line x1="0" y1="131" x2="1200" y2="131" stroke="#204a66" strokeWidth="1" opacity="0.5" />
      {Array.from({ length: 40 }).map((_, i) => (
        <rect key={i} x={i * 32} y="147" width="16" height="2.5" fill="#8c919b" opacity="0.5" />
      ))}

      <motion.g
        initial={reduceMotion ? undefined : { x: -60 }}
        animate={reduceMotion ? { x: 560 } : { x: [-60, 1260] }}
        transition={reduceMotion ? { duration: 0.4 } : { duration: 7, repeat: Infinity, ease: 'linear' }}
      >
        <g transform="translate(0,135)">
          <rect x="0" y="6" width="44" height="12" rx="3" fill="#c99545" />
          <path d="M 8 6 L 14 -4 L 32 -4 L 36 6 Z" fill="#c99545" />
          <rect x="15" y="-2" width="16" height="7" fill="#0b1018" opacity="0.6" />
          <circle cx="10" cy="19" r="3.5" fill="#0b1018" stroke="#8c919b" strokeWidth="1" />
          <circle cx="34" cy="19" r="3.5" fill="#0b1018" stroke="#8c919b" strokeWidth="1" />
        </g>
      </motion.g>
    </svg>
  )
}
