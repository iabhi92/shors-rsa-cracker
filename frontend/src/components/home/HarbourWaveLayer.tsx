import { useMemo } from 'react'
import { motion, useReducedMotion } from 'motion/react'

/** The harbour water, drawn as one continuous mathematically-real waveform rather than a
 * generic ripple texture: on the left it's a plain sine (classical, regular); moving right,
 * more harmonics are summed in (a real Dirichlet-kernel-style sum, same idea as
 * InterferenceCanvas.tsx), so the shape itself sharpens from smooth swell into the tight
 * interference peaks that period-finding produces. Left→right is "classical wave" →
 * "quantum period-finding," made literal in the water instead of just stated in a caption. */

function buildWavePath(width: number, height: number, samples: number): string {
  const midY = height * 0.55
  let d = ''
  for (let i = 0; i <= samples; i++) {
    const u = i / samples
    const x = u * width
    const harmonics = 1 + Math.floor(u * 6)
    let sum = 0
    for (let n = 1; n <= harmonics; n++) {
      sum += Math.sin(u * Math.PI * 10 * n + n * 0.4) / n
    }
    const amplitude = height * 0.16 * (1 - u * 0.35)
    const y = midY - (sum / harmonics) * amplitude
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`
  }
  return d
}

export default function HarbourWaveLayer({ width = 1200, height = 100 }: { width?: number; height?: number }) {
  const reduceMotion = useReducedMotion()
  const mainPath = useMemo(() => buildWavePath(width, height, 240), [width, height])

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" preserveAspectRatio="none" aria-hidden="true">
      {/* faint echo lines for a sense of continuous drift */}
      <g className={reduceMotion ? '' : 'animate-drift'} opacity="0.25" stroke="#204a66" strokeWidth="1" fill="none">
        <path d={mainPath} transform={`translate(0, ${height * 0.09})`} />
      </g>
      <g className={reduceMotion ? '' : 'animate-drift'} style={{ animationDuration: '34s', animationDirection: 'reverse' }} opacity="0.18" stroke="#8065b8" strokeWidth="1" fill="none">
        <path d={mainPath} transform={`translate(0, ${height * 0.16})`} />
      </g>

      {/* the main waveform */}
      <motion.path
        d={mainPath}
        fill="none"
        stroke="#c99545"
        strokeWidth="1.75"
        initial={reduceMotion ? undefined : { pathLength: 0, opacity: 0 }}
        animate={
          reduceMotion
            ? { opacity: 1 }
            : { pathLength: 1, opacity: 1, scaleY: [1, 1.06, 1] }
        }
        transition={
          reduceMotion
            ? { duration: 0.4 }
            : {
                pathLength: { duration: 1.6, delay: 0.4, ease: 'easeInOut' },
                opacity: { duration: 0.6, delay: 0.4 },
                scaleY: { duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 },
              }
        }
        style={{ transformOrigin: `${width / 2}px ${height / 2}px` }}
      />
    </svg>
  )
}
