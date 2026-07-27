import { motion, useReducedMotion } from 'motion/react'

/** UNSW's Scientia Building, drawn as its real signature: a fan of overlapping tiled shell
 * panels cascading over a curved glass facade, not a generic academic icon or a plain set of
 * nested arcs. Each panel is its own bezier-curved petal, in the same hand-drawn-line-art family
 * as HarbourBridgeIllustration.tsx (varying opacity for depth, not a flat architectural diagram). */
export default function UnswBuildingIllustration() {
  const reduceMotion = useReducedMotion()
  const finished = !!reduceMotion

  const cx = 100
  const cy = 92
  const rOuter = 80
  const rInner = 50
  const startDeg = 172
  const endDeg = 8
  const panels = 7
  const colors = ['#204a66', '#2c5a78', '#3a6a8a', '#c99545', '#3a6a8a', '#2c5a78', '#204a66']

  const pt = (r: number, deg: number) => {
    const rad = (deg * Math.PI) / 180
    return [cx + r * Math.cos(rad), cy - r * Math.sin(rad) * 0.78]
  }

  return (
    <div className="mt-5 border-t border-line pt-4">
      <svg viewBox="0 0 200 96" className="h-16 w-full" role="img" aria-label="Line-art sketch of UNSW's Scientia Building, showing its fanned shell roof">
        {Array.from({ length: panels }).map((_, i) => {
          const a1 = startDeg - (i * (startDeg - endDeg)) / panels
          const a2 = startDeg - ((i + 1.15) * (startDeg - endDeg)) / panels
          const [ox1, oy1] = pt(rOuter, a1)
          const [ox2, oy2] = pt(rOuter, a2)
          const [ix1, iy1] = pt(rInner, a1)
          const [ix2, iy2] = pt(rInner, a2)
          const [mx, my] = pt((rOuter + rInner) / 2 + 4, (a1 + a2) / 2)
          const d = `M ${ix1} ${iy1} Q ${mx} ${my - 6} ${ox1} ${oy1} L ${ox2} ${oy2} Q ${mx} ${my + 4} ${ix2} ${iy2} Z`
          return (
            <motion.path
              key={i}
              d={d}
              fill={colors[i]}
              fillOpacity={i === 3 ? 0.85 : 0.55 + (i % 2) * 0.1}
              stroke="#0b1018"
              strokeWidth="0.75"
              initial={finished ? undefined : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06, ease: 'easeOut' }}
            />
          )
        })}

        {/* glass curtain wall beneath the shells */}
        <path d={`M 14 ${cy} A ${rInner + 6} ${(rInner + 6) * 0.78} 0 0 1 186 ${cy}`} fill="#0e1620" stroke="#8c919b" strokeWidth="1" opacity="0.7" />
        {Array.from({ length: 13 }).map((_, i) => {
          const deg = 172 - i * (164 / 12)
          const [x1, y1] = pt(rInner + 6, deg)
          return <line key={i} x1={x1} y1={y1} x2={x1} y2={cy} stroke="#8c919b" strokeWidth="0.6" opacity="0.5" />
        })}

        <line x1="8" y1={cy} x2="192" y2={cy} stroke="#eee8da" strokeWidth="1" opacity="0.5" />

        <motion.circle
          cx={cx}
          cy={cy - rOuter * 0.78 - 4}
          r="1.6"
          fill="#e3b45e"
          animate={reduceMotion ? { opacity: 0.85 } : { opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </svg>
    </div>
  )
}
