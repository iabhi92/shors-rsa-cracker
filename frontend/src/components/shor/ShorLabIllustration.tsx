import { motion, useReducedMotion } from 'motion/react'

// Three orbits sharing one base period T=6s, at exactly 1x/2x/3x its angular speed -- not
// arbitrary numbers. At t=0 all three start aligned at the top; at every multiple of 6s they
// land back there simultaneously (6s / 1 rev, 3s / 1 rev = 2 revs by 6s, 2s / 1 rev = 3 revs by
// 6s), so the "everything lines up" flash is a genuine periodic recurrence happening on screen,
// the same shape as the real interference math elsewhere on this page (a signal that survives
// only where phases that were rotating at different rates come back into agreement) -- just
// atmosphere here rather than the live per-run numbers, the way the harbour bridge scene on the
// homepage is atmosphere rather than a data readout.
//
// Animated via explicit cx/cy keyframe arrays (sampling the circle at fixed steps), the same
// technique QuantumOrbitLayer.tsx already uses -- not a `rotate` transform on a `<g>`, which for
// an SVG scaled by viewBox needs its transform-origin in the SVG's own user-unit coordinate
// space, not raw CSS pixels; getting that mismatched is exactly what silently froze the first
// version of this animation in place with no console error to catch it.
const STEPS = 48
function orbitKeyframes(radius: number) {
  const cx: number[] = []
  const cy: number[] = []
  for (let i = 0; i <= STEPS; i++) {
    const angle = (i / STEPS) * 2 * Math.PI - Math.PI / 2 // start at the top (12 o'clock)
    cx.push(200 + Math.cos(angle) * radius)
    cy.push(100 + Math.sin(angle) * radius)
  }
  return { cx, cy }
}

const ORBITS = [
  { radius: 34, duration: 6, color: '#e3b45e' },
  { radius: 56, duration: 3, color: '#c99545' },
  { radius: 78, duration: 2, color: '#8065b8' },
].map((o) => ({ ...o, ...orbitKeyframes(o.radius) }))

/** Shor's Lab gets its own signature scene, the way the homepage has the harbour bridge and the
 * RSA Lab has its key -- three orbits at different speeds that periodically re-align, with a
 * constructive flash exactly when they do. Purely atmospheric (this is not a plot of any live
 * N/a), but the timing itself is real periodic math, not a random flicker. */
export default function ShorLabIllustration() {
  const reduceMotion = useReducedMotion()

  return (
    <div className="relative mb-6 h-40 overflow-hidden rounded-sm border border-line bg-navy sm:h-48">
      <svg viewBox="0 0 400 200" className="h-full w-full" aria-hidden="true">
        <defs>
          <radialGradient id="shor-hero-glow" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#e3b45e" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#e3b45e" stopOpacity="0" />
          </radialGradient>
          <filter id="shor-hero-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        <rect width="400" height="200" fill="url(#shor-hero-glow)" />

        {/* faint orbit paths */}
        {ORBITS.map((o) => (
          <circle key={o.radius} cx="200" cy="100" r={o.radius} fill="none" stroke="#1b2430" strokeWidth="1" />
        ))}

        {/* the constructive flash -- fires once per 6s cycle, right as every orbit returns to
            the top simultaneously */}
        {!reduceMotion && (
          <motion.circle
            cx="200"
            cy="100"
            r="10"
            fill="none"
            stroke="#e3b45e"
            strokeWidth="2"
            filter="url(#shor-hero-blur)"
            initial={{ r: 10, opacity: 0 }}
            animate={{ r: [10, 10, 90], opacity: [0, 0.9, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeOut', times: [0, 0.02, 0.4] }}
          />
        )}

        <circle cx="200" cy="100" r="6" fill="#e3b45e" />

        {ORBITS.map((o) => (
          <motion.circle
            key={o.radius}
            r="4.5"
            fill={o.color}
            initial={{ cx: 200, cy: 100 - o.radius }}
            animate={reduceMotion ? undefined : { cx: o.cx, cy: o.cy }}
            transition={reduceMotion ? undefined : { duration: o.duration, repeat: Infinity, ease: 'linear' }}
          />
        ))}
      </svg>
      <p className="absolute right-3 bottom-2 left-3 text-center font-mono text-[0.65rem] text-ink-muted/70 sm:text-xs">
        three orbits, three speeds -- periodically they land in the same place at the same time. that's the signal a
        period-finding measurement is built to catch.
      </p>
    </div>
  )
}
