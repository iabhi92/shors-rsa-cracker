import { motion, useReducedMotion } from 'motion/react'

/** Small illustrated vignettes for HistoryPage.tsx -- one real character-based scene per
 * milestone instead of a bare text card, in the same ink-line-art style and palette as the
 * homepage's harbour bridge cast (small circle heads, real eyes, simple bodies), just more
 * compact. Each is a self-contained ~120x100 SVG so the timeline reads as illustrated history,
 * not a bulleted changelog. */

function Person({ cx, cy, color = '#c99545', armUp = false }: { cx: number; cy: number; color?: string; armUp?: boolean }) {
  return (
    <g>
      <path d={`M ${cx - 9} ${cy + 28} L ${cx - 7} ${cy + 8} Q ${cx} ${cy + 4}, ${cx + 7} ${cy + 8} L ${cx + 9} ${cy + 28} Z`} fill="#1b2430" stroke={color} strokeWidth={0.8} />
      {armUp ? (
        <path d={`M ${cx + 6} ${cy + 12} Q ${cx + 14} ${cy + 6}, ${cx + 15} ${cy - 4}`} fill="none" stroke={color} strokeWidth={0.9} strokeLinecap="round" />
      ) : (
        <path d={`M ${cx + 6} ${cy + 12} Q ${cx + 13} ${cy + 14}, ${cx + 15} ${cy + 20}`} fill="none" stroke={color} strokeWidth={0.9} strokeLinecap="round" />
      )}
      <circle cx={cx} cy={cy} r={7} fill="#1b2430" stroke={color} strokeWidth={0.8} />
      <circle cx={cx - 2.3} cy={cy - 0.5} r={0.9} fill="#eee8da" />
      <circle cx={cx + 2.3} cy={cy - 0.5} r={0.9} fill="#eee8da" />
      <circle cx={cx - 2.25} cy={cy - 0.3} r={0.45} fill="#0b1018" />
      <circle cx={cx + 2.35} cy={cy - 0.3} r={0.45} fill="#0b1018" />
      <path d={`M ${cx - 2} ${cy + 3} Q ${cx} ${cy + 4.2}, ${cx + 2} ${cy + 3}`} fill="none" stroke={color} strokeWidth={0.5} strokeLinecap="round" />
    </g>
  )
}

export function DiffieHellmanScene() {
  const reduceMotion = useReducedMotion()
  return (
    <svg viewBox="0 0 120 90" className="h-24 w-32" role="img" aria-label="Two figures exchanging a key across a gap, without meeting">
      <Person cx={28} cy={40} color="#c99545" />
      <Person cx={92} cy={40} color="#204a66" />
      <line x1={44} y1={38} x2={76} y2={38} stroke="#3a4048" strokeWidth={0.6} strokeDasharray="2 3" />
      <motion.g
        initial={{ x: 0 }}
        animate={reduceMotion ? undefined : { x: [0, 32, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <path d="M 44 38 L 50 38 M 50 35 L 53 35 L 53 41 L 50 41" fill="none" stroke="#e3b45e" strokeWidth={1.2} strokeLinecap="round" />
      </motion.g>
    </svg>
  )
}

export function RsaFoundersScene() {
  return (
    <svg viewBox="0 0 120 90" className="h-24 w-32" role="img" aria-label="Three figures at MIT, a shared vault below them">
      <Person cx={30} cy={32} color="#c99545" />
      <Person cx={60} cy={30} color="#e3b45e" />
      <Person cx={90} cy={32} color="#c99545" />
      <g transform="translate(60,66)">
        <circle cx={0} cy={0} r={13} fill="#1b2430" stroke="#54c89a" strokeWidth={1} />
        <circle cx={0} cy={0} r={5} fill="none" stroke="#54c89a" strokeWidth={0.8} />
        <line x1={0} y1={0} x2={0} y2={-4} stroke="#54c89a" strokeWidth={0.8} />
      </g>
      <text x={60} y={90} textAnchor="middle" className="font-mono" fontSize={6} fill="#8c919b">N = pq</text>
    </svg>
  )
}

export function ShorInsightScene() {
  const reduceMotion = useReducedMotion()
  return (
    <svg viewBox="0 0 120 90" className="h-24 w-32" role="img" aria-label="A figure with a sudden insight, a wave pattern inside a lightbulb above their head">
      <Person cx={60} cy={50} color="#8065b8" armUp />
      <g transform="translate(78,18)">
        <motion.circle
          cx={0}
          cy={0}
          r={12}
          fill="#1b2430"
          stroke="#e3b45e"
          strokeWidth={1}
          animate={reduceMotion ? undefined : { opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
        <path d="M -5 4 L -5 8 L 5 8 L 5 4" fill="none" stroke="#e3b45e" strokeWidth={0.8} />
        <path d="M -6 -3 Q -3 3, 0 -3 Q 3 3, 6 -3" fill="none" stroke="#8065b8" strokeWidth={1} />
      </g>
    </svg>
  )
}

export function FirstDemoScene() {
  return (
    <svg viewBox="0 0 120 90" className="h-24 w-32" role="img" aria-label="A small quantum chip successfully factoring 15 into 3 times 5">
      <g transform="translate(38,40)">
        <rect x={-20} y={-16} width={40} height={32} rx={3} fill="#1b2430" stroke="#c99545" strokeWidth={1} />
        {[-12, -4, 4, 12].map((x) => (
          <g key={x}>
            <line x1={x} y1={-16} x2={x} y2={-22} stroke="#c99545" strokeWidth={0.8} />
            <line x1={x} y1={16} x2={x} y2={22} stroke="#c99545" strokeWidth={0.8} />
          </g>
        ))}
        <circle cx={0} cy={0} r={7} fill="none" stroke="#e3b45e" strokeWidth={1} />
        <circle cx={0} cy={0} r={2} fill="#e3b45e" />
      </g>
      <g transform="translate(90,40)">
        <path d="M -14 -8 L 14 -8 M -14 8 L 14 8" stroke="none" />
        <text x={0} y={0} textAnchor="middle" className="font-mono font-semibold" fontSize={11} fill="#eee8da">
          15
        </text>
        <text x={0} y={14} textAnchor="middle" className="font-mono" fontSize={9} fill="#54c89a">
          3 &times; 5
        </text>
        <path d="M -10 20 L -4 26 L 10 12" fill="none" stroke="#54c89a" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

export function CommitteeScene() {
  return (
    <svg viewBox="0 0 120 90" className="h-24 w-32" role="img" aria-label="A committee of figures around a table, a shield at the center">
      <ellipse cx={60} cy={55} rx={38} ry={12} fill="none" stroke="#8c919b" strokeWidth={0.8} opacity={0.6} />
      <Person cx={22} cy={38} color="#204a66" />
      <Person cx={60} cy={28} color="#c99545" />
      <Person cx={98} cy={38} color="#204a66" />
      <path d="M 60 46 L 68 49 L 68 58 Q 60 66, 60 66 Q 60 66, 52 58 L 52 49 Z" fill="#1b2430" stroke="#e3b45e" strokeWidth={1} />
    </svg>
  )
}

export function StandardsShippedScene() {
  const reduceMotion = useReducedMotion()
  return (
    <svg viewBox="0 0 120 90" className="h-24 w-32" role="img" aria-label="A shield with a lock, already standing, with a small checkmark">
      <Person cx={34} cy={44} color="#54c89a" />
      <g transform="translate(80,44)">
        <path d="M 0 -22 L 18 -16 L 18 -2 Q 18 16, 0 26 Q -18 16, -18 -2 L -18 -16 Z" fill="#1b2430" stroke="#54c89a" strokeWidth={1.2} />
        <rect x={-6} y={-4} width={12} height={9} rx={1.5} fill="none" stroke="#e3b45e" strokeWidth={1} />
        <path d="M -4 -4 L -4 -8 Q 0 -12, 4 -8 L 4 -4" fill="none" stroke="#e3b45e" strokeWidth={1} />
        <motion.path
          d="M -10 6 L -3 13 L 11 -3"
          fill="none"
          stroke="#54c89a"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduceMotion ? undefined : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        />
      </g>
    </svg>
  )
}

/** Where the line this whole timeline traces actually stands right now -- a figure at a "you are
 * here" marker, looking down a road toward a goalpost still meaningfully further off, with the
 * real orders-of-magnitude gap (computed live from lib/quantumHardwareFacts.ts, the same numbers
 * DoomsdayClock.tsx and WhatBreaksFirst.tsx already use) labelled on it rather than asserted in
 * prose alone. */
export function TodayScene({ gapOrders }: { gapOrders: number }) {
  const reduceMotion = useReducedMotion()
  return (
    <svg viewBox="0 0 120 90" className="h-24 w-32" role="img" aria-label={`A figure standing at "you are here" on a road, looking toward a goalpost still ${gapOrders.toFixed(1)} orders of magnitude off`}>
      <line x1={6} y1={64} x2={114} y2={64} stroke="#204a66" strokeWidth={1} opacity={0.5} />
      <Person cx={26} cy={44} color="#c99545" />
      <motion.circle
        cx={26}
        cy={65}
        fill="none"
        stroke="#e3b45e"
        strokeWidth={1}
        initial={{ r: 2.2 }}
        animate={reduceMotion ? { opacity: 0.7 } : { r: [2.2, 5, 2.2], opacity: [0.7, 0, 0.7] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <text x={26} y={80} textAnchor="middle" className="font-mono" fontSize={6} fill="#8c919b">you are here</text>
      <g transform="translate(96,50)" opacity={0.75}>
        <line x1={0} y1={0} x2={0} y2={14} stroke="#3a4048" strokeWidth={1.4} />
        <path d="M 0 0 L 10 3 L 0 6 Z" fill="#1b2430" stroke="#8065b8" strokeWidth={0.8} />
      </g>
      <text x={96} y={80} textAnchor="middle" className="font-mono" fontSize={6} fill="#8065b8">
        ~10^{gapOrders.toFixed(0)}&times; short
      </text>
    </svg>
  )
}
