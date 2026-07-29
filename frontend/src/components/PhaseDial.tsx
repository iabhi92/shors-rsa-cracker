import { motion } from 'motion/react'

/** A single complex amplitude, drawn as a rotating arrow (angle = phase, length = magnitude)
 * rather than letting a bar's height stand in for |amplitude|^2 alone -- a bar chart of
 * probabilities is blind to phase entirely, which is exactly the part of a QFT amplitude that
 * actually does the work: the "same magnitude everywhere, but rotated" state before an inverse
 * QFT, and the "large arrows at the peaks, tiny arrows everywhere else" state after one, are two
 * completely different pictures a probability-only view can't tell apart. In 'active' mode the
 * dial points at its real computed angle/length; inactive (or reduced-motion) renders it parked
 * flat, full-length, to signal "not yet meaningful" rather than a misleading real-looking angle. */
export default function PhaseDial({
  magnitude,
  phase,
  maxMagnitude,
  color,
  active,
}: {
  magnitude: number
  phase: number
  maxMagnitude: number
  color: string
  active: boolean
}) {
  const len = active ? 2 + (maxMagnitude > 0 ? (magnitude / maxMagnitude) * 7 : 0) : 7
  const angle = active ? phase : 0
  const x2 = 10 + Math.cos(angle) * len
  const y2 = 10 - Math.sin(angle) * len
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-5 w-5"
      role="img"
      aria-label={
        active
          ? `phase ${(phase * (180 / Math.PI)).toFixed(0)} degrees, relative magnitude ${(maxMagnitude > 0 ? magnitude / maxMagnitude : 0).toFixed(2)}`
          : 'in phase, uniform amplitude'
      }
    >
      <circle cx={10} cy={10} r={9} fill="none" stroke="#1b2430" strokeWidth={1} />
      <motion.line
        x1={10}
        y1={10}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        initial={{ x2: 17, y2: 10 }}
        animate={{ x2, y2 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      />
      <circle cx={10} cy={10} r={1} fill={color} />
    </svg>
  )
}
