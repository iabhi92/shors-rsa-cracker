import { useMemo } from 'react'
import { motion, useReducedMotion } from 'motion/react'

/** A wave packet -- a Gaussian envelope modulating a fast oscillation, sampled with visible
 * dots at its antinodes -- rendered in violet (the palette's "quantum-specific visuals only"
 * colour) to sit visually apart from the gold harbour water. Not arbitrary: a localized wave
 * packet is the textbook picture of "a particle's position is a probability wave," the same
 * quantum-mechanical idea underneath superposition and the QFT step shown further down the
 * page. */
function buildPacketPath(width: number, height: number, samples: number) {
  const midY = height * 0.5
  const points: { x: number; y: number }[] = []
  let d = ''
  for (let i = 0; i <= samples; i++) {
    const u = i / samples
    const x = u * width
    const envelope = Math.exp(-Math.pow((u - 0.5) * 3.2, 2))
    const y = midY - Math.sin(u * Math.PI * 22) * envelope * height * 0.42
    points.push({ x, y })
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`
  }
  return { d, points }
}

export default function QuantumWavefunctionLayer({ width = 1200, height = 90 }: { width?: number; height?: number }) {
  const reduceMotion = useReducedMotion()
  const { d, points } = useMemo(() => buildPacketPath(width, height, 200), [width, height])
  const dots = [0.28, 0.4, 0.5, 0.6, 0.72].map((u) => points[Math.round(u * (points.length - 1))])

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" aria-hidden="true">
      <motion.path
        d={d}
        fill="none"
        stroke="#8065b8"
        strokeWidth="1.5"
        initial={reduceMotion ? undefined : { pathLength: 0, opacity: 0 }}
        animate={reduceMotion ? { opacity: 0.75 } : { pathLength: 1, opacity: 0.75 }}
        transition={reduceMotion ? { duration: 0.4 } : { duration: 1.6, delay: 1.8, ease: 'easeInOut' }}
      />
      {dots.map((p, i) => (
        <motion.circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="2"
          fill="#8065b8"
          initial={reduceMotion ? undefined : { opacity: 0 }}
          animate={
            reduceMotion
              ? { opacity: 0.8 }
              : { opacity: [0.4, 0.9, 0.4] }
          }
          transition={
            reduceMotion
              ? { duration: 0.4 }
              : { duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 2.4 + i * 0.3 }
          }
        />
      ))}
    </svg>
  )
}
