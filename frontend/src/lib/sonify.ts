/** Turns the QFT stage's own real per-outcome amplitude data into sound instead of only pixels --
 * the same numbers BarRow/PhaseDial already draw (see ShorPipelineVisual.tsx's `phaseVectors`),
 * swept across a rising pitch so index maps to pitch (matching the bar chart's left-to-right
 * layout) while each outcome's normalized magnitude maps to volume. A flat, uniform input (the
 * pre-QFT state) sonifies as a steady unmodulated tone; a peaked input (post-QFT) sonifies as an
 * audible pulse at each surviving peak and near-silence everywhere else -- constructive and
 * destructive interference, heard rather than just seen. */

let sharedCtx: AudioContext | null = null
let activeStop: (() => void) | null = null

function getContext(): AudioContext {
  if (!sharedCtx) sharedCtx = new AudioContext()
  if (sharedCtx.state === 'suspended') void sharedCtx.resume()
  return sharedCtx
}

const MIN_FREQ = 220
const MAX_FREQ = 660
const PEAK_GAIN = 0.22

/** Plays `magnitudes` (any non-negative scale, normalized internally) as a swept tone and returns
 * a stop function. Starting a new sweep silently stops any sweep already in progress -- there is
 * only ever one sonification voice active at a time on this site. */
export function playAmplitudeSweep(magnitudes: number[]): () => void {
  activeStop?.()

  const ctx = getContext()
  const max = Math.max(...magnitudes, 1e-9)
  const n = magnitudes.length
  const stepDuration = Math.min(0.28, Math.max(0.035, 3.2 / n))
  const now = ctx.currentTime + 0.02

  const osc = ctx.createOscillator()
  osc.type = 'sine'
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, now)
  osc.connect(gain)
  gain.connect(ctx.destination)

  for (let i = 0; i < n; i++) {
    const t = now + i * stepDuration
    const freq = MIN_FREQ + (MAX_FREQ - MIN_FREQ) * (n > 1 ? i / (n - 1) : 0)
    const level = Math.max(0.0008, (magnitudes[i] / max) * PEAK_GAIN)
    osc.frequency.linearRampToValueAtTime(freq, t)
    gain.gain.linearRampToValueAtTime(level, t + stepDuration * 0.35)
    gain.gain.linearRampToValueAtTime(level * 0.4, t + stepDuration * 0.9)
  }
  const end = now + n * stepDuration
  gain.gain.linearRampToValueAtTime(0, end + 0.05)

  osc.start(now)
  osc.stop(end + 0.1)

  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    try {
      gain.gain.cancelScheduledValues(ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05)
      osc.stop(ctx.currentTime + 0.06)
    } catch {
      // already stopped -- nothing to clean up
    }
    if (activeStop === stop) activeStop = null
  }
  osc.addEventListener('ended', () => {
    if (activeStop === stop) activeStop = null
  })
  activeStop = stop
  return stop
}

export function stopSonification() {
  activeStop?.()
}
