import { useEffect, useRef } from 'react'

/** A full-viewport, real (not stock-loop) animated backdrop instead of flat black -- three
 * things, all tied to the site's actual subject rather than generic decoration:
 *  1. Layered interference waves (the same constructive/destructive-interference idea as
 *     InterferenceCanvas.tsx, stretched across the whole page).
 *  2. A field of slowly drifting specks that pulse -- meant to read as "candidate numbers being
 *     tested," the mental model behind every classical factoring attack on this site.
 *  3. Occasional expanding-ring "measurement" bursts -- a nod to what happens when a quantum
 *     state gets measured and collapses to one outcome.
 * Kept intentionally dim (peak ~10-14% alpha) so it never competes with foreground text --
 * Cards render on a fully opaque surface regardless. Respects prefers-reduced-motion by
 * rendering one static frame instead of animating. */
export default function AmbientBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    let w = 0
    let h = 0
    let raf = 0
    let t = 0
    let mouseX = 0.5
    let mouseY = 0.5

    function resize() {
      w = window.innerWidth
      h = window.innerHeight
      canvas!.width = w * dpr
      canvas!.height = h * dpr
    }
    resize()
    window.addEventListener('resize', resize)

    function onMouseMove(e: MouseEvent) {
      mouseX = e.clientX / window.innerWidth
      mouseY = e.clientY / window.innerHeight
    }
    window.addEventListener('mousemove', onMouseMove)

    const dots = Array.from({ length: 80 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00015,
      vy: (Math.random() - 0.5) * 0.00015,
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.7,
    }))

    type Spark = { x: number; y: number; life: number; maxLife: number }
    const sparks: Spark[] = []

    function frame() {
      if (!ctx || !canvas) return
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)

      const px = (mouseX - 0.5) * 16 * dpr
      const py = (mouseY - 0.5) * 12 * dpr

      for (let layer = 0; layer < 3; layer++) {
        ctx.beginPath()
        ctx.strokeStyle = `rgba(201,149,69,${0.06 + layer * 0.025})`
        ctx.lineWidth = 1.25
        const amp = H * (0.035 + layer * 0.022)
        const freq = 1.2 + layer * 0.6
        const yBase = H * (0.22 + layer * 0.3)
        for (let x = 0; x <= W; x += 6) {
          const xu = x / W
          const y = yBase + Math.sin(xu * Math.PI * 2 * freq + t * (0.12 + layer * 0.04)) * amp + py * (layer + 1) * 0.25
          const drawX = x + px * (layer + 1) * 0.18
          if (x === 0) ctx.moveTo(drawX, y)
          else ctx.lineTo(drawX, y)
        }
        ctx.stroke()
      }

      for (const d of dots) {
        if (!reduceMotion) {
          d.x += d.vx
          d.y += d.vy
          if (d.x < 0) d.x = 1
          if (d.x > 1) d.x = 0
          if (d.y < 0) d.y = 1
          if (d.y > 1) d.y = 0
        }
        const pulse = reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t * d.speed + d.phase)
        const x = d.x * W + px
        const y = d.y * H + py
        ctx.beginPath()
        ctx.fillStyle = `rgba(201,149,69,${0.1 + pulse * 0.14})`
        ctx.arc(x, y, (0.9 + pulse * 0.9) * dpr, 0, Math.PI * 2)
        ctx.fill()
      }

      if (!reduceMotion) {
        if (Math.random() < 0.02 && sparks.length < 7) {
          sparks.push({ x: Math.random() * W, y: Math.random() * H, life: 0, maxLife: 70 + Math.random() * 50 })
        }
        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i]
          s.life += 1
          const p = s.life / s.maxLife
          ctx.beginPath()
          ctx.strokeStyle = `rgba(227,180,94,${(1 - p) * 0.55})`
          ctx.lineWidth = 1.5
          ctx.arc(s.x, s.y, p * 80 * dpr, 0, Math.PI * 2)
          ctx.stroke()
          if (p >= 1) sparks.splice(i, 1)
        }
        t += 0.01
        raf = requestAnimationFrame(frame)
      }
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [])

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 h-screen w-screen" />
}
