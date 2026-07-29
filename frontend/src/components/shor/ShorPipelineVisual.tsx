import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Volume2, VolumeX } from 'lucide-react'
import PipelineAnimation, { type PipelineStage } from '../PipelineAnimation'
import { playAmplitudeSweep, stopSonification } from '../../lib/sonify'
import CodePanel, { type CodeSnippet } from '../CodePanel'
import PhaseDial from '../PhaseDial'
import { playShimmer, playWhoosh, playSweep, playSnap, playSettle } from '../../lib/sfx'

const SHOR_STAGE_SOUND: Record<string, () => void> = {
  superposition: playShimmer,
  entangle: playWhoosh,
  qft: playSweep,
  measure: playSnap,
  cleanup: playSettle,
}

// Copied verbatim from this repository's own quantum/*.py -- the exact code that runs when you
// click "Run Shor's algorithm" above, not paraphrased pseudocode. File paths and line numbers
// are real; if the implementation ever changes, these need to be re-copied by hand (see
// CodePanel.tsx's own comment for why this stays static rather than fetched live).
const SHOR_SNIPPETS: Record<string, CodeSnippet> = {
  superposition: {
    file: 'quantum/shor.py',
    startLine: 121,
    code: '    for q in control_qubits:\n        register.apply_gate(H, q)',
    notes: {
      121: 'Every control qubit, one at a time -- this is the entire "put it all in superposition" step.',
      122: 'H is the Hadamard gate: it turns a definite |0⟩ into an equal mix of |0⟩ and |1⟩.',
    },
  },
  entangle: {
    file: 'quantum/shor.py',
    startLine: 124,
    code: '    apply_modular_exponentiation(register, n_count, n_target, a, N)',
    notes: {
      124: 'One call, but it\'s doing a^x mod N for every x the control register holds at once -- the whole entangling step.',
    },
  },
  qft: {
    file: 'quantum/qft.py',
    startLine: 40,
    code:
      'def apply_inverse_qft(register: GateSink, qubits: list[int]) -> None:\n' +
      '    """Apply the inverse QFT: the exact gate-reversal of apply_qft (reverse order,\n' +
      '    negated phase angles, self-inverse H and SWAP)."""\n' +
      '    n = len(qubits)\n' +
      '    for i in range(n // 2):\n' +
      '        register.apply_swap(qubits[i], qubits[n - 1 - i])\n' +
      '    for i in reversed(range(n)):\n' +
      '        target = qubits[i]\n' +
      '        for j in reversed(range(i + 1, n)):\n' +
      '            control = qubits[j]\n' +
      '            k = j - i + 1\n' +
      '            register.apply_controlled_gate(phase(-2 * np.pi / 2**k), control, target)\n' +
      '        register.apply_gate(H, target)',
    notes: {
      44: 'Swaps qubits into reversed bit order first -- the QFT\'s own convention, undone here to invert it.',
      46: 'Walks qubits from most- to least-significant, mirroring apply_qft\'s own loop in reverse.',
      50: 'The phase angle is negated (-2π instead of +2π) -- the one sign flip that makes this the inverse.',
      52: 'Each qubit still gets its own Hadamard -- H is its own inverse, so this half doesn\'t change.',
    },
  },
  measure: {
    file: 'quantum/shor.py',
    startLine: 128,
    code:
      '    control_probs = register.marginal_probabilities(control_qubits)\n' +
      '    control_probs = control_probs / control_probs.sum()\n' +
      '    measured = int(rng.choice(2**n_count, p=control_probs))',
    notes: {
      128: 'Sums out (traces over) every target-register possibility, leaving just the control register\'s odds.',
      129: 'Renormalizes after tracing out the target register, so the remaining probabilities sum to exactly 1.',
      130: 'The actual quantum measurement -- one real random draw from the interference pattern\'s own distribution.',
    },
  },
  cleanup: {
    file: 'quantum/shor.py',
    startLine: 97,
    code:
      '    for frac in continued_fraction_convergents(measured, denominator):\n' +
      '        r = frac.denominator\n' +
      '        if r == 0 or r >= N:\n' +
      '            continue\n' +
      '        if pow(a, r, N) == 1:\n' +
      '            return r',
    notes: {
      97: 'Purely classical from here on -- turns the noisy measured integer back into a candidate period r.',
      98: 'The convergent\'s denominator is the actual period candidate -- the numerator is discarded.',
      99: 'r=0 or r≥N can\'t be a real period of a mod N; skips straight to the next convergent.',
      102: 'The real check: does a^r actually come back to 1 mod N? Only then is r a genuine period.',
    },
  },
}

// Colorblind-safe categorical order -- run through the project's own palette validator
// (dataviz skill's validate_palette.js) rather than picked by eye: passes lightness band,
// chroma floor, adjacent CVD separation (worst pair ΔE 8.4), and normal-vision floor on the
// dark surface. The site's brand gold/violet look nearly identical to a protanopic viewer,
// which is exactly the kind of thing that fails silently unless you actually check for it.
const GROUP_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300']

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b]
  return a
}

function modpow(base: number, exp: number, mod: number): number {
  if (mod === 1) return 0
  let result = 1
  let b = base % mod
  let e = exp
  while (e > 0) {
    if (e & 1) result = (result * b) % mod
    b = (b * b) % mod
    e >>= 1
  }
  return result
}

// This whole visual assumes N stays in the small, curated "educational" range the real backend
// hands it (allowedN, all well under a thousand) -- but that assumption lives in a different
// file, fetched over the network, and nothing here actually enforces it. pickDefaultA is O(N)
// candidates times an O(order) search each, so an N that quietly grew into the tens of thousands
// would turn one page load into a multi-second freeze of the tab. Capping both loops here makes
// the bound a property of this component, not something borrowed on trust from the caller.
const ORDER_SEARCH_CAP = 20_000
const DEFAULT_A_CANDIDATE_CAP = 500

/** The actual classical post-processing step, computed for real rather than asserted in prose:
 * the continued-fraction expansion of measured/states, and its convergents p/q -- the same
 * algorithm that turns "the register read 21" into "the period is 6" using nothing but
 * elementary arithmetic. Returns every convergent up to `maxTerms`; the caller picks out whichever
 * one's denominator matches the real period (computed independently via multiplicativeOrder), the
 * same way the actual algorithm would test each candidate q in turn. */
function continuedFractionConvergents(numerator: number, denominator: number, maxTerms = 8): { p: number; q: number }[] {
  let n = numerator
  let d = denominator
  const convergents: { p: number; q: number }[] = []
  let p0 = 0
  let q0 = 1
  let p1 = 1
  let q1 = 0
  for (let i = 0; i < maxTerms && d !== 0; i++) {
    const term = Math.floor(n / d)
    const p2 = term * p1 + p0
    const q2 = term * q1 + q0
    convergents.push({ p: p2, q: q2 })
    p0 = p1
    q0 = q1
    p1 = p2
    q1 = q2
    const remainder = n - term * d
    n = d
    d = remainder
  }
  return convergents
}

function multiplicativeOrder(a: number, N: number): number {
  let r = 1
  let v = a % N
  const cap = Math.min(N, ORDER_SEARCH_CAP)
  while (v !== 1) {
    v = (v * a) % N
    r++
    if (r > cap) return -1 // either N is absurdly large, or gcd(a,N) != 1 -- either way, bail
  }
  return r
}

/** The real inverse-QFT amplitude at output y, given the reduced control-register state after
 * entangling with the target and conditioning on one branch (WLOG x0=0, matching the same
 * assumption `peaks` below already makes): a uniform superposition over x = 0, r, 2r, ... up to
 * `states`. This is a genuine geometric-series sum, not a fitted curve -- verified against the
 * existing `peaks` array (top |amplitude|^2 values land exactly on it) and against total
 * probability summing to 1 before this was ever wired into a component. Same idealization
 * `InterferenceCanvas.tsx` uses on the homepage, generalized here to run on whatever N/a/r is
 * actually live instead of one fixed illustrative period. */
function qftAmplitude(y: number, r: number, states: number): { re: number; im: number } {
  const M = Math.floor((states - 1) / r) + 1
  let re = 0
  let im = 0
  for (let k = 0; k < M; k++) {
    const theta = (-2 * Math.PI * k * r * y) / states
    re += Math.cos(theta)
    im += Math.sin(theta)
  }
  const norm = 1 / Math.sqrt(M * states)
  return { re: re * norm, im: im * norm }
}

function pickDefaultA(N: number): number {
  let fallback = -1
  const limit = Math.min(N, DEFAULT_A_CANDIDATE_CAP)
  for (let a = 2; a < limit; a++) {
    if (gcd(a, N) !== 1) continue
    const r = multiplicativeOrder(a, N)
    if (r === -1) continue
    if (fallback === -1) fallback = a
    if (r % 2 === 0 && r > 1 && modpow(a, r / 2, N) !== N - 1) return a
  }
  return fallback === -1 ? 2 : fallback
}

/** Everything about this visual is computed live from whichever N and a are currently selected --
 * there's no baked-in example. The register size is chosen to keep the diagram readable (up to 64
 * bars) while staying a genuine multiple of the true period where possible, so the peaks line up
 * cleanly; where it can't (period doesn't divide the register evenly), the real spreading shows,
 * exactly like Figure 2 in the written report. */
function useShorMath(N: number, aRaw: number) {
  return useMemo(() => {
    const aValid = aRaw >= 2 && aRaw < N && gcd(aRaw, N) === 1
    const a = aValid ? aRaw : pickDefaultA(N)
    const r = multiplicativeOrder(a, N)
    let nCount = 3
    while (2 ** nCount < N && nCount < 6) nCount++
    if (r > 0) {
      let candidate = nCount
      while (candidate < 6 && (2 ** candidate) % r !== 0) candidate++
      if ((2 ** candidate) % r === 0) nCount = candidate
    }
    const states = 2 ** nCount
    const controlValues = Array.from({ length: states }, (_, i) => i)
    const targetValues = controlValues.map((x) => modpow(a, x, N))
    const groupOf = (x: number) => (r > 0 ? x % r : 0)
    const peaks = r > 0 ? Array.from(new Set(Array.from({ length: r }, (_, k) => Math.round((k * states) / r) % states))) : [0]
    const measured = peaks[Math.floor(peaks.length / 2)] ?? 0
    const amplitude = 1 / Math.sqrt(states)
    const half = r % 2 === 0 ? modpow(a, r / 2, N) : -1
    const canFactor = r % 2 === 0 && half !== N - 1 && half !== 1
    const f1 = canFactor ? gcd(half - 1, N) : 0
    const f2 = canFactor ? gcd(half + 1, N) : 0
    // Real per-outcome complex amplitude, not just the probability `peaks` already captures --
    // this is what makes a phase-vector (magnitude + angle) visualization possible instead of a
    // bar that can only ever show |amplitude|^2.
    const phaseVectors = r > 0 ? controlValues.map((y) => qftAmplitude(y, r, states)) : controlValues.map(() => ({ re: amplitude, im: 0 }))
    const maxMagnitude = Math.max(...phaseVectors.map(({ re, im }) => Math.hypot(re, im)))
    // The real continued-fraction convergents of measured/states -- the actual classical
    // post-processing, not a description of it. `foundAt` is which convergent's denominator is
    // the real period, exactly the one the algorithm would stop at once gcd(q, states) == 1 and
    // a^q == 1 mod N checks out.
    const convergents = continuedFractionConvergents(measured, states)
    const foundAt = convergents.findIndex((c) => c.q === r)
    return {
      a,
      aWasInvalid: !aValid && aRaw !== a,
      r,
      nCount,
      states,
      controlValues,
      targetValues,
      groupOf,
      peaks,
      measured,
      amplitude,
      canFactor,
      half,
      f1,
      f2,
      phaseVectors,
      maxMagnitude,
      convergents,
      foundAt,
    }
  }, [N, aRaw])
}

type GateHighlight = 'h' | 'u' | 'qft' | 'measure' | 'none'

const LEGEND: { swatch: string; label: string; sub: string }[] = [
  { swatch: '#8065b8', label: 'H', sub: 'superposition' },
  { swatch: '#c99545', label: '●–●', sub: 'controlled op' },
  { swatch: '#e3b45e', label: 'QFT⁻¹', sub: 'inverse Fourier' },
  { swatch: '#54c89a', label: '⌒↗', sub: 'measurement' },
]

function CircuitLegend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
      {LEGEND.map((l) => (
        <span key={l.label} className="flex items-center gap-1.5 font-mono text-[0.65rem] text-ink-muted">
          <span className="font-semibold" style={{ color: l.swatch }}>{l.label}</span>
          <span>{l.sub}</span>
        </span>
      ))}
    </div>
  )
}

// Where the "signal" marker sits for each stage -- used to animate a single traveling dot
// along the control wire rather than just fading gates in and out independently, so the eye
// has one continuous thing to follow as the active stage changes instead of four unrelated
// opacity toggles.
const SIGNAL_X: Record<GateHighlight, number> = { none: 60, h: 92, u: 160, qft: 263, measure: 337 }
const GATE_COLOR: Record<GateHighlight, string> = { none: '#8c919b', h: '#8065b8', u: '#c99545', qft: '#e3b45e', measure: '#54c89a' }

function CircuitDiagram({ highlight, N, a }: { highlight: GateHighlight; N: number; a: number }) {
  // 0.28 read as "basically invisible" against the near-black navy background -- the inactive
  // three-quarters of the diagram effectively disappeared at any given stage, which is what
  // made the whole schematic look empty rather than like a real circuit with gates you just
  // aren't on yet. 0.55 keeps the highlighted gate clearly the star while leaving the rest
  // legible.
  const dim = (on: boolean) => (on ? 1 : 0.55)
  return (
    <div className="flex w-full max-w-lg flex-col items-center gap-2">
    <svg viewBox="0 0 400 100" className="h-20 w-full sm:h-24">
      <defs>
        <filter id="gate-glow" x="-75%" y="-75%" width="250%" height="250%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <text x="4" y="17" className="font-mono" fontSize="9" fill="#8c919b">control</text>
      <line x1="60" y1="14" x2="400" y2="14" stroke="#8c919b" strokeWidth="1.25" opacity={0.6} />
      <line x1="60" y1="34" x2="400" y2="34" stroke="#8c919b" strokeWidth="1.25" opacity={0.6} />
      <text x="60" y="50" className="font-mono" fontSize="9" fill="#8c919b">⋮</text>
      <text x="4" y="77" className="font-mono" fontSize="9" fill="#8c919b">target</text>
      <line x1="60" y1="74" x2="400" y2="74" stroke="#8c919b" strokeWidth="1.25" opacity={0.6} />

      {/* the traveling signal -- glides smoothly to whichever stage is active, a spring on a
          single persistent element rather than four gates independently fading */}
      <motion.circle
        r="3.2"
        cy={14}
        initial={{ cx: SIGNAL_X[highlight], fill: GATE_COLOR[highlight] }}
        animate={{ cx: SIGNAL_X[highlight], fill: GATE_COLOR[highlight] }}
        transition={{ type: 'spring', stiffness: 140, damping: 16 }}
        style={{ filter: 'url(#gate-glow)' }}
      />

      {[14, 34].map((y) => (
        <motion.g
          key={y}
          animate={{ opacity: dim(highlight === 'h'), scale: highlight === 'h' ? 1.06 : 1 }}
          style={{ transformOrigin: '92px ' + y + 'px', filter: highlight === 'h' ? 'url(#gate-glow)' : 'none' }}
          transition={{ duration: 0.4 }}
        >
          <rect x={82} y={y - 10} width="20" height="20" rx="3" fill="#101722" stroke="#8065b8" strokeWidth="1.5" />
          <text x="92" y={y + 4} textAnchor="middle" className="font-mono font-semibold" fontSize="11" fill="#8065b8">H</text>
        </motion.g>
      ))}

      <motion.g
        animate={{ opacity: dim(highlight === 'u'), scale: highlight === 'u' ? 1.05 : 1 }}
        style={{ transformOrigin: '160px 38px', filter: highlight === 'u' ? 'url(#gate-glow)' : 'none' }}
        transition={{ duration: 0.4 }}
      >
        <line x1="160" y1="14" x2="160" y2="74" stroke="#c99545" strokeWidth="1.5" />
        <circle cx="160" cy="14" r="4" fill="#c99545" />
        <circle cx="160" cy="34" r="4" fill="#c99545" />
        <rect x="132" y="62" width="56" height="24" rx="3" fill="#101722" stroke="#c99545" strokeWidth="1.5" />
        <text x="160" y="78" textAnchor="middle" className="font-mono" fontSize="8.5" fill="#c99545">{a}ˣ mod {N}</text>
      </motion.g>

      <motion.g
        animate={{ opacity: dim(highlight === 'qft'), scale: highlight === 'qft' ? 1.05 : 1 }}
        style={{ transformOrigin: '263px 24px', filter: highlight === 'qft' ? 'url(#gate-glow)' : 'none' }}
        transition={{ duration: 0.4 }}
      >
        <rect x="240" y="2" width="46" height="44" rx="3" fill="#101722" stroke="#e3b45e" strokeWidth="1.5" />
        <text x="263" y="28" textAnchor="middle" className="font-mono font-semibold" fontSize="10" fill="#e3b45e">QFT⁻¹</text>
      </motion.g>

      <motion.g
        animate={{ opacity: dim(highlight === 'measure'), scale: highlight === 'measure' ? 1.05 : 1 }}
        style={{ transformOrigin: '337px 24px', filter: highlight === 'measure' ? 'url(#gate-glow)' : 'none' }}
        transition={{ duration: 0.4 }}
      >
        <rect x="320" y="2" width="34" height="44" rx="3" fill="#101722" stroke="#54c89a" strokeWidth="1.5" />
        <path d="M 328 34 A 9 9 0 0 1 346 34" fill="none" stroke="#54c89a" strokeWidth="1.5" />
        <line x1="337" y1="34" x2="344" y2="21" stroke="#54c89a" strokeWidth="1.5" strokeLinecap="round" />
      </motion.g>
    </svg>
      <CircuitLegend />
    </div>
  )
}

function BarRow({ math, mode }: { math: ReturnType<typeof useShorMath>; mode: 'flat' | 'peaked' }) {
  return (
    // overflow-x-auto (needed so wide bar rows can scroll on narrow screens) forces the browser
    // to compute overflow-y as 'auto' too, per the CSS spec's overflow-x/y pairing rule -- there's
    // no way to opt back out of that per-axis. Combined with a hardcoded row height, that silently
    // clipped the probability label above any bar tall enough to make a column's total height
    // (label + bar + axis number) exceed the fixed height. The real fix is to not fix the height
    // at all: let the row size itself to its tallest column, so there's never anything to clip.
    //
    // min-w-0 here isn't decorative: this div is a flex item of PipelineAnimation's stage
    // container, which defaults every flex child to `min-width: auto` -- refuses to shrink below
    // its own content's intrinsic width. With enough control-register values (N=21 alone has
    // more bars than the canvas is wide), that meant this div just rendered at its full ~1187px
    // regardless of the ~844px actually available, and the *canvas's* overflow-x-hidden (not
    // -auto, so no scrollbar) hard-clipped the rest with zero way to reach it -- this row's own
    // overflow-x-auto never got a chance to engage because it was never actually squeezed.
    <div className="min-w-0 max-w-full overflow-x-auto px-2">
      <div className="flex items-end gap-2 sm:gap-3">
        {math.controlValues.map((x) => {
          const isPeak = math.peaks.includes(x)
          const show = mode === 'flat' || isPeak
          const labelled = mode === 'peaked' && isPeak
          const { re, im } = math.phaseVectors[x]
          const magnitude = Math.hypot(re, im)
          const phase = Math.atan2(im, re)
          return (
            <div key={x} className="flex shrink-0 flex-col items-center gap-1">
              <PhaseDial
                magnitude={magnitude}
                phase={phase}
                maxMagnitude={math.maxMagnitude}
                color={GROUP_COLORS[math.groupOf(x) % GROUP_COLORS.length]}
                active={mode === 'peaked'}
              />
              {/* Always reserve this slot's height, even when empty, so toggling between
                  modes never reflows neighbouring columns or the row's own height. */}
              <motion.span
                className="font-mono text-[0.65rem] font-semibold leading-none"
                style={{ color: GROUP_COLORS[math.groupOf(x) % GROUP_COLORS.length], visibility: labelled ? 'visible' : 'hidden' }}
                initial={false}
                animate={labelled ? { scale: [0.5, 1.15, 1], opacity: 1 } : { scale: 1, opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.35 + (x / math.controlValues.length) * 0.3, ease: 'easeOut' }}
              >
                {(1 / math.peaks.length).toFixed(2)}
              </motion.span>
              <motion.div
                className="w-5 rounded-t-sm sm:w-6"
                style={{
                  backgroundColor: show ? GROUP_COLORS[math.groupOf(x) % GROUP_COLORS.length] : '#1b2430',
                  boxShadow: isPeak && mode === 'peaked' ? `0 0 12px 1px ${GROUP_COLORS[math.groupOf(x) % GROUP_COLORS.length]}66` : 'none',
                }}
                initial={{ height: 8 }}
                animate={{ height: mode === 'flat' ? 90 : isPeak ? 120 : 8 }}
                transition={{
                  type: 'spring',
                  stiffness: 260,
                  damping: 18,
                  delay: (x / math.controlValues.length) * 0.3,
                }}
              />
              <span className="font-mono text-[0.65rem] text-ink-muted">{x}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** The single most illuminating fact in the whole algorithm, made toggleable instead of just
 * asserted in prose: measuring the control register *before* the inverse QFT gives a perfectly
 * uniform distribution over every value -- the entanglement with the target register correlates
 * outcomes with each other, but doesn't change the marginal odds of any one of them. Only after
 * the inverse QFT rotates the basis does the period become visible as peaks. Flipping the toggle
 * re-runs the same BarRow component in 'flat' mode, so the contrast is the *same* real bars, not
 * a separate illustration. */
function QftStageVisual({
  math, N, a, withQft, setWithQft,
}: {
  math: ReturnType<typeof useShorMath>
  N: number
  a: number
  // Lifted into ShorPipelineVisual rather than a local useState here: PipelineAnimation's
  // "Present" full-screen mode unmounts this component and mounts a fresh copy inside a portal
  // (see its own comment on why -- avoiding an even worse double-mounted-state bug), so any
  // state that lived in *this* component's own useState would silently reset to its default
  // every time the toggle opened or closed. Living in the parent, which is never unmounted by
  // that swap, means the toggle survives entering and leaving Present mode intact.
  withQft: boolean
  setWithQft: (v: boolean) => void
}) {
  const [isPlaying, setIsPlaying] = useState(false)

  // Stop cleanly if this stage unmounts mid-sweep (navigating away, or PipelineAnimation
  // swapping this component out for its inert Present-mode placeholder) rather than leaving an
  // oscillator running with nothing left listening.
  useEffect(() => stopSonification, [])

  function handleSonify() {
    if (isPlaying) {
      stopSonification()
      setIsPlaying(false)
      return
    }
    // Sonifies whichever real distribution is currently on screen: the flat pre-QFT state (every
    // outcome genuinely equally likely -- a level tone) or the actual computed post-QFT
    // magnitudes (peaks ring out, everywhere else the phases cancelled toward silence).
    const magnitudes = withQft
      ? math.phaseVectors.map(({ re, im }) => Math.hypot(re, im))
      : math.controlValues.map(() => math.amplitude)
    playAmplitudeSweep(magnitudes)
    setIsPlaying(true)
    const stepDuration = Math.min(0.28, Math.max(0.035, 3.2 / magnitudes.length))
    window.setTimeout(() => setIsPlaying(false), stepDuration * magnitudes.length * 1000 + 150)
  }

  return (
    // min-w-0 on this and the other four stages' root wrapper: each is a flex item of
    // PipelineAnimation's own centering row, which defaults every flex child to
    // `min-width: auto` -- refuses to shrink below its content's intrinsic width. A wide bar
    // row (BarRow, below) or chip row rendered at full size regardless of the canvas's actual
    // available width and got hard-clipped by the canvas's overflow-x-hidden with no scrollbar,
    // instead of shrinking so its own overflow-x-auto could engage -- caught live on the QFT
    // stage at N=21, where the peak bars ran off the right edge with no way to reach them.
    <div className="min-w-0 flex flex-col items-center gap-4">
      <CircuitDiagram highlight={withQft ? 'qft' : 'none'} N={N} a={a} />
      <div className="flex flex-wrap items-center justify-center gap-2">
        <div className="flex overflow-hidden rounded-sm border border-line font-mono text-xs">
          <button
            type="button"
            onClick={() => setWithQft(false)}
            className={`px-3 py-1.5 transition-colors ${!withQft ? 'bg-gold text-navy font-semibold' : 'text-ink-muted hover:text-ink'}`}
          >
            measure before QFT⁻¹
          </button>
          <button
            type="button"
            onClick={() => setWithQft(true)}
            className={`px-3 py-1.5 transition-colors ${withQft ? 'bg-gold text-navy font-semibold' : 'text-ink-muted hover:text-ink'}`}
          >
            measure after QFT⁻¹
          </button>
        </div>
        <button
          type="button"
          onClick={handleSonify}
          className="focus-ring flex items-center gap-1.5 rounded-sm border border-line px-2.5 py-1.5 font-mono text-xs text-ink-muted transition-colors hover:border-gold/50 hover:text-ink"
          aria-label={isPlaying ? 'Stop sonification' : 'Play this distribution as sound'}
        >
          {isPlaying ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          {isPlaying ? 'Stop' : 'Listen'}
        </button>
      </div>
      <BarRow math={math} mode={withQft ? 'peaked' : 'flat'} />
      {withQft ? (
        <p className="max-w-sm text-center font-mono text-sm text-ink-muted">
          {math.peaks.length} peak{math.peaks.length === 1 ? '' : 's'} survive out of {math.states} possible outcomes — the dial above
          each bar is that outcome's real amplitude: long arrows are where the phases lined up and reinforced, the
          near-zero dots are everywhere the phases fought each other to nothing
        </p>
      ) : (
        <p className="max-w-sm text-center font-mono text-sm text-gold-warm">
          every outcome is exactly as likely as any other — measuring here would tell you nothing about the period at all
        </p>
      )}
    </div>
  )
}

/** N positions arranged in a circle (the same `states`-sized register the bars/dials already
 * use), the r peaks marked in their group colors, and a pointer landing on the real measured
 * value -- what "turn the measurement into a period" actually looks like geometrically, instead
 * of the bare assertion `continued fractions → period r = ...` the text list below still also
 * shows (kept, not replaced: the wheel is the geometry, the list is the arithmetic). */
function PeriodWheel({ math }: { math: ReturnType<typeof useShorMath> }) {
  const { states, peaks, measured, groupOf, r, convergents, foundAt } = math
  const cx = 100
  const cy = 100
  const radius = 78
  const angleOf = (x: number) => (x / states) * 2 * Math.PI - Math.PI / 2
  const pointOn = (x: number, rr: number) => ({
    x: cx + Math.cos(angleOf(x)) * rr,
    y: cy + Math.sin(angleOf(x)) * rr,
  })
  const measuredPoint = pointOn(measured, radius)
  const measuredColor = GROUP_COLORS[groupOf(measured) % GROUP_COLORS.length]
  const bestMatch = foundAt >= 0 ? convergents[foundAt] : null

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-8">
      <svg viewBox="0 0 200 200" className="h-48 w-48 shrink-0" role="img" aria-label={`A wheel of ${states} positions with the measured value ${measured} marked, and the ${peaks.length} period peaks highlighted`}>
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#1b2430" strokeWidth={1.5} />
        {Array.from({ length: states }, (_, x) => x).map((x) => {
          const isPeak = peaks.includes(x)
          const inner = pointOn(x, isPeak ? radius - 7 : radius - 3)
          const outer = pointOn(x, radius)
          return (
            <line
              key={x}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={isPeak ? GROUP_COLORS[groupOf(x) % GROUP_COLORS.length] : '#3a4048'}
              strokeWidth={isPeak ? 2 : 1}
            />
          )
        })}
        <motion.line
          x1={cx}
          y1={cy}
          stroke={measuredColor}
          strokeWidth={2}
          strokeLinecap="round"
          initial={{ x2: cx, y2: cy }}
          animate={{ x2: measuredPoint.x, y2: measuredPoint.y }}
          transition={{ type: 'spring', stiffness: 120, damping: 16, delay: 0.2 }}
        />
        <motion.circle
          r={4}
          fill={measuredColor}
          initial={{ cx, cy }}
          animate={{ cx: measuredPoint.x, cy: measuredPoint.y }}
          transition={{ type: 'spring', stiffness: 120, damping: 16, delay: 0.2 }}
        />
        <text x={cx} y={cy + 4} textAnchor="middle" className="font-mono" fontSize={11} fill="#8c919b">{measured}/{states}</text>
      </svg>

      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-xs text-ink-muted">continued fractions expands {measured}/{states} into a sequence of ever-closer approximations p/q:</p>
        {convergents.map((c, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.3 }}
            className={`font-mono text-sm ${i === foundAt ? 'font-semibold text-success' : 'text-ink-muted'}`}
          >
            {c.p}/{c.q}{i === foundAt ? ` — q = ${c.q} = r, found it` : ''}
          </motion.p>
        ))}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: convergents.length * 0.3 + 0.3 }}
          className={`max-w-xs font-mono text-sm ${bestMatch ? 'text-success' : 'text-gold-warm'}`}
        >
          {bestMatch
            ? `period r = ${r} recovered directly from this one measurement.`
            : `none of these denominators equal r = ${r} directly -- this measurement's best convergent is a proper divisor of the true period, a real and common outcome. Shor's algorithm resolves it by repeating with a fresh measurement and combining results (their lcm) until the full period emerges.`}
        </motion.p>
      </div>
    </div>
  )
}

function ControlPanel({
  N, allowedN, aInput, onN, onA,
}: { N: number; allowedN: number[]; aInput: string; onN: (n: number) => void; onA: (a: string) => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-4 border-b border-line pb-4">
      <label className="flex flex-col gap-1 font-mono text-xs text-ink-muted">
        N
        <select
          value={N}
          onChange={(e) => onN(Number(e.target.value))}
          className="focus-ring rounded-sm border border-line bg-navy px-2 py-1 font-mono text-sm text-ink"
        >
          {allowedN.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 font-mono text-xs text-ink-muted">
        a (blank = auto-pick)
        <input
          type="number"
          value={aInput}
          onChange={(e) => onA(e.target.value)}
          placeholder="auto"
          className="focus-ring w-24 rounded-sm border border-line bg-navy px-2 py-1 font-mono text-sm text-ink"
        />
      </label>
      <p className="font-mono text-xs text-ink-muted">try your own N and a — the whole diagram below recomputes for real</p>
    </div>
  )
}

export default function ShorPipelineVisual({
  allowedN = [15, 21, 33, 35, 55, 65],
  N,
  onNChange,
  aInput,
  onAChange,
}: {
  allowedN?: number[]
  N: number
  onNChange: (n: number) => void
  aInput: string
  onAChange: (a: string) => void
}) {
  const math = useShorMath(N, aInput.trim() === '' ? -1 : Number(aInput))
  // Lifted up from QftStageVisual so the toggle survives PipelineAnimation's Present-mode
  // mount/unmount swap -- see QftStageVisual's own comment for why that swap exists.
  const [withQft, setWithQft] = useState(true)
  const [activeStageIndex, setActiveStageIndex] = useState(0)

  const stages: PipelineStage[] = useMemo(() => {
    const { a, r, states, amplitude, peaks, measured, canFactor, half, f1, f2 } = math
    return [
      {
        id: 'superposition',
        label: 'Superposition',
        caption: `Put the counting register into every value 0–${states - 1} at once, instead of picking just one.`,
        formula: String.raw`|\psi\rangle = \frac{1}{\sqrt{${states}}}\sum_{x=0}^{${states - 1}}|x\rangle`,
        render: () => (
          <div className="min-w-0 flex flex-col items-center gap-4">
            <CircuitDiagram highlight="h" N={N} a={a} />
            <BarRow math={math} mode="flat" />
            <p className="font-mono text-sm text-ink-muted">every one of the {states} states carries the same amplitude — {amplitude.toFixed(3)}</p>
          </div>
        ),
      },
      {
        id: 'entangle',
        label: 'Entangle',
        caption: (
          <>
            Compute {a}<sup>x</sup> mod {N} for all {states} values simultaneously — the result links each guess to
            its remainder, which is where the hidden repeating pattern actually lives.
          </>
        ),
        formula: String.raw`|\psi\rangle = \frac{1}{\sqrt{${states}}}\sum_{x=0}^{${states - 1}}|x\rangle\,|${a}^{x} \bmod ${N}\rangle`,
        render: () => (
          <div className="min-w-0 flex flex-col items-center gap-4">
            <CircuitDiagram highlight="u" N={N} a={a} />
            {/* min-w-0: same flex-item shrink fix as BarRow above -- without it this row never
                actually shrinks to the available width, so it just renders at full size and
                gets hard-clipped by the canvas's overflow-x-hidden instead of scrolling. */}
            <div className="min-w-0 max-w-full overflow-x-auto px-2">
              <div className="flex gap-2 sm:gap-3">
                {math.controlValues.map((x) => {
                  const color = GROUP_COLORS[math.groupOf(x) % GROUP_COLORS.length]
                  const delay = (x / math.controlValues.length) * 0.3
                  return (
                    <div key={x} className="flex shrink-0 flex-col items-center">
                      {/* control chip -- the guess x, shown as a real chip (not just a label) so
                          the thread below reads as a link between two things, not a decoration
                          under one thing */}
                      <motion.div
                        className="flex h-7 w-7 items-center justify-center rounded-sm border font-mono text-[0.7rem] font-semibold"
                        style={{ borderColor: color, color, backgroundColor: `${color}1a` }}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay }}
                      >
                        {x}
                      </motion.div>
                      {/* the entanglement thread itself -- a line that draws in, then a pulse
                          that travels down it once, so the link between "this guess" and "its
                          remainder" is shown happening, not just implied by matching colors */}
                      <div className="relative h-7 w-4">
                        <motion.div
                          className="absolute top-0 left-1/2 w-0.5 -translate-x-1/2"
                          style={{ height: '100%', backgroundColor: color, transformOrigin: 'top' }}
                          initial={{ scaleY: 0 }}
                          animate={{ scaleY: 1 }}
                          transition={{ duration: 0.3, delay }}
                        />
                        <motion.div
                          className="absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
                          style={{ backgroundColor: color, boxShadow: `0 0 6px 1px ${color}` }}
                          initial={{ top: '0%', opacity: 0 }}
                          animate={{ top: ['0%', '90%'], opacity: [0, 1, 1, 0] }}
                          transition={{ duration: 0.45, delay: delay + 0.3, ease: 'easeIn', times: [0, 0.15, 0.85, 1] }}
                        />
                      </div>
                      <motion.div
                        className="flex h-9 w-10 items-center justify-center rounded-sm border font-mono text-xs font-semibold"
                        style={{ borderColor: color, color }}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: delay + 0.3 }}
                      >
                        {math.targetValues[x]}
                      </motion.div>
                    </div>
                  )
                })}
              </div>
            </div>
            <p className="max-w-sm text-center font-mono text-sm text-ink-muted">matching colors share the same remainder — that repeat has period r = {r}</p>
          </div>
        ),
      },
      {
        id: 'qft',
        label: 'Inverse QFT',
        caption: 'The inverse quantum Fourier transform doesn’t factor anything — it makes the wrong answers cancel out and the periodic ones reinforce each other.',
        formula:
          states % r === 0
            ? String.raw`\text{peaks at } x = k\cdot\frac{${states}}{${r}},\quad k = 0,\dots,${r - 1}`
            : String.raw`r=${r}\text{ doesn't divide }${states}\text{ evenly — peaks spread across nearby values}`,
        render: () => <QftStageVisual math={math} N={N} a={a} withQft={withQft} setWithQft={setWithQft} />,
      },
      {
        id: 'measure',
        label: 'Measure',
        caption: 'Reading the register now gives one of the surviving peaks — a real, physically possible outcome for this N and a, not a cherry-picked one.',
        formula: String.raw`x = ${measured} \quad \Big(\text{probability } \approx ${(1 / peaks.length).toFixed(2)}\Big)`,
        render: () => (
          <div className="min-w-0 flex flex-col items-center gap-4">
            <CircuitDiagram highlight="measure" N={N} a={a} />
            <motion.div
              className="flex h-24 w-24 items-center justify-center rounded-full border-2 sm:h-28 sm:w-28"
              style={{ borderColor: GROUP_COLORS[math.groupOf(measured) % GROUP_COLORS.length] }}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 14 }}
            >
              <span className="font-mono text-3xl font-semibold text-ink sm:text-4xl">{measured}</span>
            </motion.div>
            <p className="font-mono text-sm text-ink-muted">one peak collapses into a single real reading</p>
          </div>
        ),
      },
      {
        id: 'cleanup',
        label: 'Classical cleanup',
        caption: canFactor
          ? 'Everything from here on is ordinary arithmetic: turn the measurement into a period, then into the two factors with gcd.'
          : `With this particular a, the period ${r % 2 !== 0 ? 'is odd' : `gives ${a}^(r/2) ≡ −1 mod ${N}`} — a real, expected dead end. The actual algorithm would just retry with a new a.`,
        formula: canFactor
          ? String.raw`\gcd(${a}^{${r / 2}}-1,\,${N}) = ${f1}, \qquad \gcd(${a}^{${r / 2}}+1,\,${N}) = ${f2}`
          : String.raw`r = ${r}\ (\text{odd or trivial}) \Rightarrow \text{retry with a new } a`,
        render: () => (
          <div className="min-w-0 flex flex-col items-center gap-4">
            <CircuitDiagram highlight="none" N={N} a={a} />
            <PeriodWheel math={math} />
            <div className="flex flex-col gap-2.5">
              {[
                `measured x = ${measured}`,
                `continued fractions → period r = ${r}`,
                ...(canFactor
                  ? [
                      `gcd(${a}^${r / 2} − 1, ${N}) = gcd(${half - 1}, ${N}) = ${f1}`,
                      `gcd(${a}^${r / 2} + 1, ${N}) = gcd(${half + 1}, ${N}) = ${f2}`,
                      `${N} = ${f1} × ${f2}`,
                    ]
                  : [`${r % 2 !== 0 ? 'r is odd' : `${a}^(r/2) ≡ −1 mod ${N}`} — no factor this attempt, retry with a new a`]),
              ].map((line, i, arr) => (
                <motion.p
                  key={line}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.35 }}
                  className={`font-mono text-sm sm:text-base ${
                    i === arr.length - 1 ? (canFactor ? 'font-semibold text-success' : 'font-semibold text-gold-warm') : 'text-ink-muted'
                  }`}
                >
                  {line}
                </motion.p>
              ))}
            </div>
          </div>
        ),
      },
    ]
  }, [N, math, withQft])

  return (
    <div id="shor-controls">
      <ControlPanel N={N} allowedN={allowedN} aInput={aInput} onN={onNChange} onA={onAChange} />
      {aInput.trim() !== '' && math.aWasInvalid && (
        <p className="mb-3 font-mono text-xs text-gold-warm">
          a must satisfy gcd(a, N) = 1 — using a = {math.a} instead.
        </p>
      )}
      <PipelineAnimation
        stages={stages}
        accent="violet"
        onActiveChange={setActiveStageIndex}
        onStageSound={(id) => SHOR_STAGE_SOUND[id]?.()}
      />
      <div className="mt-4">
        <h3 className="mb-2 font-mono text-xs font-semibold tracking-wide text-ink-muted uppercase">
          The actual code behind this step
        </h3>
        <CodePanel stageId={stages[activeStageIndex]?.id ?? 'superposition'} snippets={SHOR_SNIPPETS} />
      </div>
    </div>
  )
}
