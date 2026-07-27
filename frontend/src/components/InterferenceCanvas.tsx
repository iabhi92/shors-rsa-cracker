import { useEffect, useRef } from 'react'

/** Not decoration -- a real Dirichlet kernel, sum_{k=0}^{H-1} cos(2*pi*k*x/r), the same
 * constructive/destructive interference sum the QFT step of Shor's algorithm produces:
 * amplitude nearly cancels everywhere except at integer multiples of the period r, which is
 * exactly why measuring the post-QFT register yields (with high probability) a value close to
 * a multiple of N/r -- the signal continued fractions then recovers the period from. r=4 here
 * is illustrative (chosen for a clean-looking multi-peak pattern), not decoded from any one
 * live run -- see quantum/qft.py and notes/02-qft-and-period-finding.md for the real thing. */

const PERIOD = 4
const HARMONICS = 9
const PERIODS_SHOWN = 5

export default function InterferenceCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let t = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    function resize() {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
    }
    resize()
    window.addEventListener('resize', resize)

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function frame() {
      if (!canvas || !ctx) return
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)
      const mid = h * 0.62
      const samples = 420
      const span = PERIOD * PERIODS_SHOWN

      // faint individual harmonics -- the terms being summed
      for (let k = 1; k <= 4; k++) {
        ctx.beginPath()
        ctx.strokeStyle = 'rgba(128,101,184,0.22)'
        ctx.lineWidth = 1
        for (let i = 0; i <= samples; i++) {
          const xu = (i / samples) * span
          const y = mid - Math.sin((2 * Math.PI * k * xu) / PERIOD + t * 0.15 * k) * (h * 0.05)
          const x = (i / samples) * w
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      // the interference sum -- peaks at integer multiples of the period, everywhere else
      // destructively cancels toward zero. This IS the Dirichlet kernel.
      ctx.beginPath()
      ctx.strokeStyle = '#c99545'
      ctx.lineWidth = 2 * dpr
      for (let i = 0; i <= samples; i++) {
        const xu = (i / samples) * span
        let sum = 0
        for (let k = 0; k < HARMONICS; k++) {
          sum += Math.cos((2 * Math.PI * k * xu) / PERIOD + t * 0.04 * k)
        }
        const amplitude = sum / HARMONICS
        const y = mid - amplitude * (h * 0.42)
        const x = (i / samples) * w
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // baseline reference (the "zero" the peaks rise from, monitor-trace style)
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(140,145,155,0.18)'
      ctx.lineWidth = 1
      ctx.moveTo(0, mid)
      ctx.lineTo(w, mid)
      ctx.stroke()

      // dashed drop-lines + pulsing dot markers at the peaks -- what a measurement would land on
      for (let p = 0; p <= PERIODS_SHOWN; p++) {
        const xu = p * PERIOD
        if (xu > span) continue
        const x = (xu / span) * w
        const peakY = mid - h * 0.42
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.4 + p)

        ctx.save()
        ctx.setLineDash([3 * dpr, 3 * dpr])
        ctx.beginPath()
        ctx.strokeStyle = 'rgba(227,180,94,0.3)'
        ctx.lineWidth = 1
        ctx.moveTo(x, peakY)
        ctx.lineTo(x, mid)
        ctx.stroke()
        ctx.restore()

        ctx.beginPath()
        ctx.fillStyle = `rgba(227,180,94,${0.5 + 0.4 * pulse})`
        ctx.arc(x, peakY, (2.2 + 1.4 * pulse) * dpr, 0, Math.PI * 2)
        ctx.fill()
      }

      if (!prefersReducedMotion) t += 1
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="h-full w-full" role="img" aria-label="Animated diagram of constructive and destructive wave interference at a period, the mechanism the quantum Fourier transform uses for period-finding" />
}
