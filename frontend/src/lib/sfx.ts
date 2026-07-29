/** Short, one-shot sound effects fired by real events -- never an ambient loop. There is no
 * "background sound" here at all: every function below builds a fresh, tiny set of Web Audio
 * nodes, plays a sub-second envelope, and stops -- nothing is left running between triggers, so
 * there's nothing to fade, suspend on tab-switch, or explain with a caption (a UI click sound
 * doesn't need a caption either; the moment it fires on screen is the explanation).
 *
 * Each lab gets its own distinct effect, tied to what's actually happening, not one generic
 * blip reused everywhere:
 *   - keygen:     a soft rising two-note chime -- "here's your key"
 *   - encrypt:    a sharp latch-closing click (noise thunk + downward blip) -- locking something
 *   - decrypt:    the mirror-image latch-opening click (upward blip) -- unlocking something
 *   - tick:       a brief mechanical tick -- a block/number moving, or one classical-attack step
 *   - shimmer:    three near-simultaneous plucks -- superposition, many things at once
 *   - whoosh:     a noise burst swept through a rising bandpass -- two qubits entangling
 *   - sweep:      a rising sine sweep -- the QFT sweeping through frequencies
 *   - snap:       a single sharp click -- measurement collapsing the state
 *   - settle:     a short descending tone -- cleanup, coming to rest
 *   - tamper:     two close, clashing tones -- something not lining up (an attack landing)
 *   - ibmBlip:    a short square-wave blip through a highpass filter -- control-electronics
 *                 chatter, used only on the IBM Hardware page
 * Off by default and only ever fires from an explicit user toggle -- see SfxToggle.tsx. */

let ctx: AudioContext | null = null
let enabled = false

/** Creates (or resumes) the shared AudioContext -- must be called synchronously from inside the
 * toggle's own click handler, not lazily from whatever later effect happens to fire the first
 * actual sound (a pipeline stage advancing on a timer, an API response arriving). Browsers only
 * treat context creation/resume as exempt from autoplay restrictions when it happens in the same
 * gesture-handling call stack as a real user interaction; a context built later, off a timer,
 * can get silently stuck 'suspended' forever in stricter browsers. */
export function setSfxEnabled(on: boolean) {
  enabled = on
  if (on) {
    if (!ctx) ctx = new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  }
}

export function isSfxEnabled() {
  return enabled
}

function getContext(): AudioContext | null {
  if (!enabled || !ctx) return null
  return ctx
}

function tone(
  context: AudioContext,
  destination: AudioNode,
  {
    type,
    freq,
    endFreq,
    attack = 0.005,
    decay = 0.16,
    peak = 0.22,
    delay = 0,
  }: { type: OscillatorType; freq: number; endFreq?: number; attack?: number; decay?: number; peak?: number; delay?: number },
) {
  const start = context.currentTime + delay
  const osc = context.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + attack + decay)
  const gain = context.createGain()
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(peak, start + attack)
  gain.gain.exponentialRampToValueAtTime(0.0005, start + attack + decay)
  osc.connect(gain)
  gain.connect(destination)
  osc.start(start)
  osc.stop(start + attack + decay + 0.05)
}

/** A short burst of filtered noise -- the shared building block for the tick/thunk/whoosh
 * family, all of which want "friction/mechanism", not a musical pitch. */
function noiseBurst(
  context: AudioContext,
  destination: AudioNode,
  { filterType, freq, q = 1.5, duration = 0.05, peak = 0.25, sweepTo }: { filterType: BiquadFilterType; freq: number; q?: number; duration?: number; peak?: number; sweepTo?: number },
) {
  const bufferSize = Math.max(1, Math.floor(context.sampleRate * duration))
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
  const noise = context.createBufferSource()
  noise.buffer = buffer
  const filter = context.createBiquadFilter()
  filter.type = filterType
  filter.Q.value = q
  filter.frequency.setValueAtTime(freq, context.currentTime)
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, context.currentTime + duration)
  const gain = context.createGain()
  gain.gain.value = peak
  noise.connect(filter)
  filter.connect(gain)
  gain.connect(destination)
  noise.start()
}

export function playKeygen() {
  const c = getContext()
  if (!c) return
  tone(c, c.destination, { type: 'triangle', freq: 440, peak: 0.16, decay: 0.12 })
  tone(c, c.destination, { type: 'triangle', freq: 660, peak: 0.16, decay: 0.22, delay: 0.08 })
}

export function playEncrypt() {
  const c = getContext()
  if (!c) return
  noiseBurst(c, c.destination, { filterType: 'lowpass', freq: 900, duration: 0.04, peak: 0.3 })
  tone(c, c.destination, { type: 'square', freq: 520, endFreq: 220, attack: 0.002, decay: 0.09, peak: 0.14, delay: 0.02 })
}

export function playDecrypt() {
  const c = getContext()
  if (!c) return
  noiseBurst(c, c.destination, { filterType: 'lowpass', freq: 900, duration: 0.04, peak: 0.3 })
  tone(c, c.destination, { type: 'square', freq: 220, endFreq: 520, attack: 0.002, decay: 0.09, peak: 0.14, delay: 0.02 })
}

export function playTick() {
  const c = getContext()
  if (!c) return
  noiseBurst(c, c.destination, { filterType: 'bandpass', freq: 1400, q: 3, duration: 0.03, peak: 0.22 })
}

export function playShimmer() {
  const c = getContext()
  if (!c) return
  ;[523.3, 659.3, 784].forEach((freq, i) => tone(c, c.destination, { type: 'triangle', freq, peak: 0.13, decay: 0.5, delay: i * 0.03 }))
}

export function playWhoosh() {
  const c = getContext()
  if (!c) return
  noiseBurst(c, c.destination, { filterType: 'bandpass', freq: 300, sweepTo: 2400, q: 1.2, duration: 0.35, peak: 0.18 })
}

export function playSweep() {
  const c = getContext()
  if (!c) return
  tone(c, c.destination, { type: 'sine', freq: 220, endFreq: 880, attack: 0.02, decay: 0.4, peak: 0.16 })
}

export function playSnap() {
  const c = getContext()
  if (!c) return
  noiseBurst(c, c.destination, { filterType: 'highpass', freq: 2000, q: 4, duration: 0.02, peak: 0.3 })
}

export function playSettle() {
  const c = getContext()
  if (!c) return
  tone(c, c.destination, { type: 'sine', freq: 392, endFreq: 196, attack: 0.01, decay: 0.5, peak: 0.15 })
}

export function playTamper() {
  const c = getContext()
  if (!c) return
  tone(c, c.destination, { type: 'sawtooth', freq: 180, decay: 0.3, peak: 0.16 })
  tone(c, c.destination, { type: 'sawtooth', freq: 180 * (16 / 15), decay: 0.3, peak: 0.16 })
}

export function playIbmBlip() {
  const c = getContext()
  if (!c) return
  noiseBurst(c, c.destination, { filterType: 'highpass', freq: 1500, q: 2, duration: 0.05, peak: 0.18 })
  tone(c, c.destination, { type: 'square', freq: 1800 + Math.random() * 900, attack: 0.001, decay: 0.05, peak: 0.06 })
}
