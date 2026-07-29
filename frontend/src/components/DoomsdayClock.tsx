import { motion } from 'motion/react'
import {
  LARGEST_ANNOUNCED_CHIP_QUBITS as LARGEST_ANNOUNCED,
  QUBITS_NEEDED_2019_ESTIMATE as NEEDED_2019,
  QUBITS_NEEDED_2025_ESTIMATE as NEEDED_2025,
} from '../lib/quantumHardwareFacts'

// Two real, published, citable numbers -- not this project's own estimate (see
// ResourceEstimatePage's own unoptimized figures for that), the actual state of the art for
// breaking RSA-2048 specifically. See lib/quantumHardwareFacts.ts for the full citations --
// shared with WhatBreaksFirst.tsx so both stay in sync with one source of truth.
const gapOrders = Math.log10(NEEDED_2025 / LARGEST_ANNOUNCED)
// Editorial mapping, stated as such below (exactly as honest as the real Bulletin of the Atomic
// Scientists clock is about its own hand position being a judgment call, not a formula): 0
// orders of magnitude gap -> midnight (hands together, straight up); a 6-orders-of-magnitude gap
// (a million-fold short) -> hands 12 hours apart (as far from midnight as this clock face gets).
// clamped so a nonsensical/negative gap can't point the hands somewhere meaningless.
const clampedOrders = Math.max(0, Math.min(6, gapOrders))
const hourAngle = (clampedOrders / 6) * 360

function ClockHand({ angle, length, width, color }: { angle: number; length: number; width: number; color: string }) {
  return (
    <motion.line
      x1={100}
      y1={100}
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      initial={{ x2: 100, y2: 100 - length }}
      animate={{
        x2: 100 + Math.sin((angle * Math.PI) / 180) * length,
        y2: 100 - Math.cos((angle * Math.PI) / 180) * length,
      }}
      transition={{ type: 'spring', stiffness: 60, damping: 14 }}
    />
  )
}

/** Reframes this page's own numbers (and two real published estimates) as a Doomsday-Clock-style
 * dial -- "minutes to midnight" being a genuine, real-world editorial device (the Bulletin of
 * the Atomic Scientists), not invented for this site, borrowed here because it's the correct
 * emotional register for "how close is the thing this whole project demonstrates the mechanism
 * of." The hand position is explicitly labeled as this project's own illustrative framing of
 * the real gap, not a formula -- exactly as honest as the real clock is about its own judgment
 * calls, and exactly as this project treats every other number it hasn't independently verified. */
export default function DoomsdayClock() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-sm border border-line bg-navy p-6 sm:flex-row sm:items-center sm:gap-8">
      <svg viewBox="0 0 200 200" className="h-40 w-40 shrink-0" role="img" aria-label="A doomsday-clock-style dial showing the illustrative distance between today's largest announced quantum processor and the qubit count published estimates say would be needed to factor a real RSA-2048 key">
        <circle cx={100} cy={100} r={92} fill="#0b1018" stroke="#1b2430" strokeWidth={2} />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * 2 * Math.PI
          const inner = { x: 100 + Math.sin(a) * 78, y: 100 - Math.cos(a) * 78 }
          const outer = { x: 100 + Math.sin(a) * 88, y: 100 - Math.cos(a) * 88 }
          return <line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="#3a4048" strokeWidth={i % 3 === 0 ? 2.5 : 1.5} />
        })}
        <text x={100} y={22} textAnchor="middle" className="font-mono" fontSize={11} fill="#e3b45e">12</text>
        <ClockHand angle={hourAngle * 0.4} length={42} width={4} color="#8c919b" />
        <ClockHand angle={hourAngle} length={64} width={2.5} color="#e3b45e" />
        <circle cx={100} cy={100} r={4} fill="#e3b45e" />
      </svg>

      <div className="flex-1 text-center sm:text-left">
        <p className="font-mono text-xs tracking-[0.15em] text-gold uppercase">Illustrative, not a formula</p>
        <h3 className="mt-1 font-medium text-ink">
          About {clampedOrders.toFixed(1)} orders of magnitude short of factoring a real RSA-2048 key
        </h3>
        <p className="mt-2 text-sm text-ink-muted">
          The best published estimate for factoring RSA-2048 now stands at{' '}
          <strong className="text-ink">{NEEDED_2025.toLocaleString()} noisy physical qubits</strong> (Gidney, 2025,
          arXiv:2505.15917) -- down from <strong className="text-ink">{NEEDED_2019.toLocaleString()}</strong> in the
          original 2019 estimate (Gidney &amp; Ekera, arXiv:1905.09749). The largest gate-model quantum processor
          publicly announced is IBM's <strong className="text-ink">{LARGEST_ANNOUNCED.toLocaleString()}-qubit</strong>{' '}
          Condor chip (2023).
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          Raw qubit count is necessary but nowhere near sufficient -- nobody has demonstrated fault-tolerant error
          correction at anywhere close to this scale yet, at any qubit count. The clock hand's exact position is this
          project's own editorial framing of that gap, not a derived formula -- exactly as the real Bulletin of the
          Atomic Scientists' clock is a judgment call, not an equation.
        </p>
      </div>
    </div>
  )
}
