import { motion, useReducedMotion } from 'motion/react'

/** Just a train on a track -- no bridge (that's the hero's job), kept deliberately compact so it
 * reads as one vignette among several rather than its own oversized section. Overhead catenary
 * wire and a pantograph actually touching it, and yellow-outlined doors, are the one real,
 * specific detail of Sydney's electrified rolling stock this sketch leans on. */
export default function SydneyTrainScene() {
  const reduceMotion = useReducedMotion()
  const carriages = [0, 1, 2]

  return (
    <svg viewBox="0 0 1200 150" className="h-24 w-full sm:h-28" preserveAspectRatio="xMidYMax meet" role="img" aria-label="An illustrated electric train running along a track">
      <line x1="0" y1="20" x2="1200" y2="22" stroke="#1b2430" strokeWidth="1.5" />
      {Array.from({ length: 9 }).map((_, i) => {
        const x = 40 + i * 145
        return (
          <g key={x}>
            <line x1={x} y1="20" x2={x} y2="100" stroke="#3a4048" strokeWidth="2" />
            <line x1={x - 14} y1="22" x2={x + 14} y2="22" stroke="#3a4048" strokeWidth="1.5" />
          </g>
        )
      })}

      <rect x="0" y="100" width="1200" height="50" fill="#0b1018" />
      <line x1="0" y1="100" x2="1200" y2="100" stroke="#204a66" strokeWidth="1" opacity="0.4" />
      {Array.from({ length: 60 }).map((_, i) => (
        <line key={i} x1={i * 20 + 4} y1="103" x2={i * 20 + 14} y2="113" stroke="#2a3138" strokeWidth="3" />
      ))}
      <line x1="0" y1="104" x2="1200" y2="104" stroke="#8c919b" strokeWidth="1.5" opacity="0.55" />
      <line x1="0" y1="112" x2="1200" y2="112" stroke="#8c919b" strokeWidth="1.5" opacity="0.55" />

      <motion.g
        initial={reduceMotion ? undefined : { x: -160 }}
        animate={reduceMotion ? { x: 480 } : { x: [-160, 1240] }}
        transition={reduceMotion ? { duration: 0.4 } : { duration: 12, repeat: Infinity, ease: 'linear' }}
      >
        <line x1="26" y1="62" x2="34" y2="22" stroke="#8c919b" strokeWidth="1.5" />
        <line x1="34" y1="22" x2="46" y2="22" stroke="#c99545" strokeWidth="2" />

        <g transform="translate(0,62)">
          <rect x="0" y="0" width="60" height="38" rx="4" fill="#1b2430" stroke="#8c919b" strokeWidth="1.25" />
          <rect x="4" y="4" width="52" height="14" rx="2" fill="#204a66" opacity="0.85" />
          <rect x="6" y="7" width="16" height="8" rx="1" fill="#cfe3ee" opacity="0.8" />
          <rect x="42" y="20" width="14" height="16" rx="1.5" fill="none" stroke="#e8c94a" strokeWidth="2" />
          <circle cx="12" cy="39" r="4.5" fill="#0b1018" stroke="#8c919b" strokeWidth="1" />
          <circle cx="48" cy="39" r="4.5" fill="#0b1018" stroke="#8c919b" strokeWidth="1" />
          <circle cx="58" cy="10" r="2.2" fill="#e3b45e" />
        </g>

        {carriages.map((c) => (
          <g key={c} transform={`translate(${70 + c * 64},66)`}>
            <rect x="0" y="0" width="56" height="32" rx="3" fill="#101722" stroke="#8c919b" strokeWidth="1" />
            <rect x="4" y="4" width="48" height="12" rx="1.5" fill="#204a66" opacity="0.7" />
            {[8, 20, 32].map((wx) => (
              <rect key={wx} x={wx} y="6" width="8" height="8" rx="1" fill="#cfe3ee" opacity={0.7} />
            ))}
            <rect x="42" y="16" width="10" height="14" rx="1.25" fill="none" stroke="#e8c94a" strokeWidth="1.5" />
            <circle cx="10" cy="33" r="4" fill="#0b1018" stroke="#8c919b" strokeWidth="1" />
            <circle cx="46" cy="33" r="4" fill="#0b1018" stroke="#8c919b" strokeWidth="1" />
          </g>
        ))}
      </motion.g>
    </svg>
  )
}
