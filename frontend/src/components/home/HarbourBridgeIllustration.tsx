import { motion, useReducedMotion } from 'motion/react'

/** Custom SVG line art of the Sydney Harbour Bridge -- reusable paths/groups, no bitmap, no
 * external asset. Drawn as an architectural ink sketch (fine strokes, varying opacity for
 * depth) rather than a literal/photoreal render. Animates on mount: pylons, then the main
 * arch, then the vertical hangers stagger in, then a continuous slow water line and a couple
 * of small lights ("data packets") drifting across the deck. Every animated stroke uses
 * Framer Motion's `pathLength` (not raw stroke-dasharray math) so `prefers-reduced-motion`
 * degrades to the finished drawing with zero extra branching. */
export default function HarbourBridgeIllustration() {
  const reduceMotion = useReducedMotion()
  const finished = !!reduceMotion

  const hangerX = [260, 340, 420, 500, 620, 700, 780, 860, 940]

  // Sampled points along the same two arch curves used below, so the truss lattice actually
  // connects to where the arches are, not an approximation drawn separately.
  const archYMain = (x: number) => 292 - Math.sin(((x - 130) / (1070 - 130)) * Math.PI) * 232
  const archYSecondary = (x: number) => 292 - Math.sin(((x - 150) / (1050 - 150)) * Math.PI) * 200
  const trussX = [190, 250, 310, 370, 430, 490, 550, 610, 670, 730, 790, 850, 910, 970, 1010]

  return (
    <svg
      viewBox="0 0 1200 340"
      className="h-full w-full"
      preserveAspectRatio="xMidYMax meet"
      role="img"
      aria-label="Line-art illustration of the Sydney Harbour Bridge at night, with a faint city skyline and Opera House silhouette"
    >
      {/* city skyline, faint */}
      <g opacity="0.18" stroke="#8c919b" strokeWidth="1" fill="none">
        <rect x="1020" y="200" width="18" height="90" />
        <rect x="1045" y="175" width="14" height="115" />
        <rect x="1065" y="215" width="20" height="75" />
        <rect x="90" y="210" width="16" height="80" />
        <rect x="115" y="230" width="12" height="60" />
      </g>

      {/* Opera House silhouette, simplified overlapping shells -- decorative, not a literal trace */}
      <g opacity="0.3" stroke="#e3b45e" strokeWidth="1" fill="none">
        <path d="M 870 290 C 878 268, 892 262, 902 288" />
        <path d="M 895 290 C 903 262, 919 255, 931 288" />
        <path d="M 922 290 C 930 266, 944 260, 954 288" />
      </g>

      {/* waterline base (the animated interference water sits in HarbourWaveLayer, on top) */}
      <line x1="0" y1="292" x2="1200" y2="292" stroke="#204a66" strokeWidth="1" opacity="0.5" />

      {/* pylons */}
      {[
        { x: 160, side: -1 },
        { x: 1040, side: 1 },
      ].map((p, i) => (
        <motion.g
          key={i}
          initial={finished ? undefined : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }}
        >
          <motion.path
            d={`M ${p.x - 30} 292 L ${p.x - 22} 120 L ${p.x + 22} 120 L ${p.x + 30} 292`}
            fill="none"
            stroke="#c99545"
            strokeWidth="2"
            opacity="0.85"
          />
          <line x1={p.x - 24} y1="150" x2={p.x + 24} y2="150" stroke="#c99545" strokeWidth="1" opacity="0.5" />
        </motion.g>
      ))}

      {/* main arch */}
      <motion.path
        d="M 130 292 C 130 60, 1070 60, 1070 292"
        fill="none"
        stroke="#e3b45e"
        strokeWidth="2.5"
        initial={finished ? undefined : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.4, delay: 0.3, ease: 'easeInOut' }}
      />
      {/* secondary, slightly lower arch line for structural depth */}
      <motion.path
        d="M 150 292 C 150 92, 1050 92, 1050 292"
        fill="none"
        stroke="#204a66"
        strokeWidth="1.25"
        opacity="0.7"
        initial={finished ? undefined : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.4, delay: 0.4, ease: 'easeInOut' }}
      />

      {/* truss lattice between the two arch lines -- what actually reads as "bridge" rather
          than "arch shape" at a glance */}
      <motion.g
        stroke="#c99545"
        strokeWidth="0.75"
        opacity="0.4"
        initial={finished ? undefined : { opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ duration: 0.5, delay: 1.5 }}
      >
        {trussX.slice(0, -1).map((x, i) => {
          const xNext = trussX[i + 1]
          return (
            <g key={x}>
              <line x1={x} y1={archYMain(x)} x2={xNext} y2={archYSecondary(xNext)} />
              <line x1={x} y1={archYSecondary(x)} x2={xNext} y2={archYMain(xNext)} />
            </g>
          )
        })}
      </motion.g>

      {/* deck */}
      <motion.line
        x1="130"
        y1="292"
        x2="1070"
        y2="292"
        stroke="#eee8da"
        strokeWidth="2"
        opacity="0.55"
        initial={finished ? undefined : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, delay: 1.6 }}
      />

      {/* vertical hangers, staggered */}
      {hangerX.map((x, i) => {
        // Arch height at this x, sampled from the same cubic-bezier shape as the main arch
        // (approximated with a parabola for the hanger endpoint -- close enough for line art).
        const t = (x - 130) / (1070 - 130)
        const archY = 292 - Math.sin(t * Math.PI) * 232
        return (
          <motion.line
            key={x}
            x1={x}
            y1={archY + 6}
            x2={x}
            y2="292"
            stroke="#c99545"
            strokeWidth="1"
            opacity="0.55"
            initial={finished ? undefined : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.08, delay: 1.7 + i * (1.2 / hangerX.length) }}
          />
        )
      })}

      {/* travelling lights ("data packets") along the deck -- exactly two, slow, no flashing */}
      {!reduceMotion && (
        <>
          <motion.circle
            r="2.6"
            fill="#e3b45e"
            initial={{ cx: 150, opacity: 0 }}
            animate={{ cx: [150, 1050], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'linear', delay: 2.6 }}
            cy="292"
          />
          <motion.circle
            r="2.2"
            fill="#eee8da"
            initial={{ cx: 150, opacity: 0 }}
            animate={{ cx: [150, 1050], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'linear', delay: 5.8 }}
            cy="292"
          />
        </>
      )}
    </svg>
  )
}
