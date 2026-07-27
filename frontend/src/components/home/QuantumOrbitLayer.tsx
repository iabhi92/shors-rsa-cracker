import { motion, useReducedMotion } from 'motion/react'

/** Thin phase arcs above the bridge, each carrying one travelling point -- a visual stand-in
 * for modular exponentiation / phase evolution (a^x mod N cycling, which is exactly what the
 * period r is hiding inside). Not literal orbit physics; just a restrained way to put "cyclic,
 * evolving phase" on screen without another dashboard gauge. */
export default function QuantumOrbitLayer() {
  const reduceMotion = useReducedMotion()
  const arcs = [
    { cx: 600, cy: 90, rx: 480, ry: 70, duration: 22 },
    { cx: 600, cy: 65, rx: 360, ry: 46, duration: 16 },
    { cx: 600, cy: 110, rx: 560, ry: 90, duration: 30 },
  ]

  return (
    <svg viewBox="0 0 1200 220" className="h-full w-full" preserveAspectRatio="xMidYMin meet" aria-hidden="true">
      {arcs.map((arc, i) => (
        <g key={i}>
          <path
            d={`M ${arc.cx - arc.rx} ${arc.cy} A ${arc.rx} ${arc.ry} 0 0 1 ${arc.cx + arc.rx} ${arc.cy}`}
            fill="none"
            stroke="#c99545"
            strokeWidth="1"
            opacity="0.22"
          />
          {!reduceMotion && (
            <motion.circle
              r="2.4"
              fill="#e3b45e"
              animate={{
                cx: [arc.cx - arc.rx, arc.cx, arc.cx + arc.rx, arc.cx, arc.cx - arc.rx],
                cy: [arc.cy, arc.cy - arc.ry, arc.cy, arc.cy - arc.ry, arc.cy],
              }}
              transition={{ duration: arc.duration, repeat: Infinity, ease: 'linear' }}
            />
          )}
        </g>
      ))}
    </svg>
  )
}
