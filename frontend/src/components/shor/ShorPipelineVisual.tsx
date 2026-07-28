import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import PipelineAnimation, { type PipelineStage } from '../PipelineAnimation'

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
    return { a, aWasInvalid: !aValid && aRaw !== a, r, nCount, states, controlValues, targetValues, groupOf, peaks, measured, amplitude, canFactor, half, f1, f2 }
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
  const dim = (on: boolean) => (on ? 1 : 0.28)
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
    <div className="max-w-full overflow-x-auto px-2">
      <div className="flex items-end gap-2 sm:gap-3">
        {math.controlValues.map((x) => {
          const isPeak = math.peaks.includes(x)
          const show = mode === 'flat' || isPeak
          const labelled = mode === 'peaked' && isPeak
          return (
            <div key={x} className="flex shrink-0 flex-col items-center gap-1.5">
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
  return (
    <div className="flex flex-col items-center gap-4">
      <CircuitDiagram highlight={withQft ? 'qft' : 'none'} N={N} a={a} />
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
      <BarRow math={math} mode={withQft ? 'peaked' : 'flat'} />
      {withQft ? (
        <p className="font-mono text-sm text-ink-muted">{math.peaks.length} peak{math.peaks.length === 1 ? '' : 's'} survive out of {math.states} possible outcomes</p>
      ) : (
        <p className="max-w-sm text-center font-mono text-sm text-gold-warm">
          every outcome is exactly as likely as any other — measuring here would tell you nothing about the period at all
        </p>
      )}
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

  const stages: PipelineStage[] = useMemo(() => {
    const { a, r, states, amplitude, peaks, measured, canFactor, half, f1, f2 } = math
    return [
      {
        id: 'superposition',
        label: 'Superposition',
        caption: `Put the counting register into every value 0–${states - 1} at once, instead of picking just one.`,
        formula: String.raw`|\psi\rangle = \frac{1}{\sqrt{${states}}}\sum_{x=0}^{${states - 1}}|x\rangle`,
        render: () => (
          <div className="flex flex-col items-center gap-4">
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
          <div className="flex flex-col items-center gap-4">
            <CircuitDiagram highlight="u" N={N} a={a} />
            <div className="max-w-full overflow-x-auto px-2">
              <div className="flex gap-2 sm:gap-3">
                {math.controlValues.map((x) => (
                  <div key={x} className="flex shrink-0 flex-col items-center gap-1.5">
                    <span className="font-mono text-[0.65rem] text-ink-muted">{x}</span>
                    <motion.div
                      className="h-6 w-0.5"
                      style={{ backgroundColor: GROUP_COLORS[math.groupOf(x) % GROUP_COLORS.length] }}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ duration: 0.3, delay: (x / math.controlValues.length) * 0.3 }}
                    />
                    <motion.div
                      className="flex h-9 w-10 items-center justify-center rounded-sm border font-mono text-xs font-semibold"
                      style={{ borderColor: GROUP_COLORS[math.groupOf(x) % GROUP_COLORS.length], color: GROUP_COLORS[math.groupOf(x) % GROUP_COLORS.length] }}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: (x / math.controlValues.length) * 0.3 }}
                    >
                      {math.targetValues[x]}
                    </motion.div>
                  </div>
                ))}
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
          <div className="flex flex-col items-center gap-4">
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
          <div className="flex flex-col items-center gap-4">
            <CircuitDiagram highlight="none" N={N} a={a} />
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
      <PipelineAnimation stages={stages} accent="violet" />
    </div>
  )
}
