import { useEffect, useMemo, useState } from 'react'
import { motion, animate } from 'motion/react'
import { Check } from 'lucide-react'
import PipelineAnimation, { type PipelineStage } from '../PipelineAnimation'

const FERMAT_STEP_CAP = 400

function isqrt(x: number): number {
  let r = Math.floor(Math.sqrt(x))
  while (r * r > x) r--
  while ((r + 1) * (r + 1) <= x) r++
  return r
}

function isPerfectSquare(x: number): { isSquare: boolean; root: number } {
  const root = isqrt(x)
  return { isSquare: root * root === x, root }
}

function smallestFactor(n: number): number {
  const limit = isqrt(n)
  for (let d = 2; d <= limit; d++) {
    if (n % d === 0) return d
  }
  return -1
}

function fermatClimb(n: number): { start: number; found: number | null; b: number; steps: number } {
  const start = isqrt(n) + (isqrt(n) * isqrt(n) === n ? 0 : 1)
  for (let i = 0; i <= FERMAT_STEP_CAP; i++) {
    const a = start + i
    const { isSquare, root } = isPerfectSquare(a * a - n)
    if (isSquare) return { start, found: a, b: root, steps: i + 1 }
  }
  return { start, found: null, b: 0, steps: FERMAT_STEP_CAP }
}

function largestPrimeFactor(m: number): number {
  let v = m
  let largest = 1
  for (let d = 2; d * d <= v; d++) {
    while (v % d === 0) {
      largest = d
      v /= d
    }
  }
  if (v > 1) largest = Math.max(largest, v)
  return largest
}

function primesUpTo(limit: number): number[] {
  const primes: number[] = []
  for (let i = 2; i <= limit && primes.length < 8; i++) {
    if (primes.every((p) => i % p !== 0)) primes.push(i)
  }
  return primes
}

// The NInput below already clamps to this range on every keystroke, but a component shouldn't
// trust its caller to always enforce that -- someone changing NInput later, or driving this hook
// from a different input entirely, could otherwise re-open an unbounded trial-division loop.
// Clamping again at the point of use is one extra line and makes the bound an invariant of the
// computation itself, not just a property of one particular input widget.
const N_MIN = 4
const N_MAX = 10_000_000

function useClassicalMath(nRaw: number) {
  return useMemo(() => {
    const n = Math.min(N_MAX, Math.max(N_MIN, Math.round(nRaw)))
    const factor = smallestFactor(n)
    const other = factor > 0 ? n / factor : 0
    const trialLimit = isqrt(n)
    const fermat = fermatClimb(n)
    // p-1 smoothness: Pollard's p-1 succeeds as soon as the trial exponent's bound B covers the
    // *largest* prime factor of p-1 or q-1 -- whichever side is smoother is the one that breaks
    // first, so take the smaller of the two largest-prime-factors as the real bound needed.
    let pm1Bound = 0
    let pm1Smooth = false
    let pm1Primes: number[] = []
    if (factor > 1 && other > 1) {
      const lpfP = largestPrimeFactor(factor - 1)
      const lpfQ = largestPrimeFactor(other - 1)
      pm1Bound = Math.min(lpfP, lpfQ)
      pm1Smooth = pm1Bound <= 97
      pm1Primes = primesUpTo(pm1Smooth ? pm1Bound : 19)
    }
    return { n, factor, other, trialLimit, fermat, pm1Bound, pm1Smooth, pm1Primes }
  }, [nRaw])
}

function TrialDivisionVisual({ n, factor, trialLimit, reduceMotion }: { n: number; factor: number; trialLimit: number; reduceMotion: boolean }) {
  const target = factor > 0 ? factor : trialLimit
  const [d, setD] = useState(reduceMotion ? target : 2)
  const [done, setDone] = useState(reduceMotion)

  useEffect(() => {
    if (reduceMotion) return
    setDone(false)
    setD(2)
    const controls = animate(2, target, {
      duration: 2.0,
      ease: 'easeIn',
      onUpdate: (v) => setD(Math.round(v)),
      onComplete: () => setDone(true),
    })
    return () => controls.stop()
  }, [target, reduceMotion])

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="font-mono text-sm text-ink-muted">trying every candidate divisor of {n}, one at a time</p>
      <div className="flex items-center gap-4">
        <span className="font-mono text-4xl text-ink">{n} ÷ {d}</span>
        {done ? (
          factor > 0 ? (
            <span className="flex items-center gap-1 font-mono text-base font-semibold text-success">
              <Check className="h-5 w-5" /> divides evenly
            </span>
          ) : (
            <span className="font-mono text-base text-gold-warm">no factor ≤ √n — n looks prime</span>
          )
        ) : (
          <span className="font-mono text-base text-ink-muted">…</span>
        )}
      </div>
      <p className="font-mono text-sm text-ink-muted">O(√n) — has to reach {target} before it {factor > 0 ? 'finds anything' : 'gives up'}</p>
    </div>
  )
}

function FermatVisual({ n, fermat, reduceMotion }: { n: number; fermat: ReturnType<typeof useClassicalMath>['fermat']; reduceMotion: boolean }) {
  const { start, found, b, steps } = fermat
  const [a, setA] = useState(reduceMotion ? (found ?? start) : start)
  const [done, setDone] = useState(reduceMotion || found === null)

  useEffect(() => {
    if (reduceMotion || found === null) return
    setDone(false)
    setA(start)
    const controls = animate(start, found, {
      duration: Math.min(0.15 * steps, 2.2),
      ease: 'easeOut',
      onUpdate: (v) => setA(Math.round(v)),
      onComplete: () => setDone(true),
    })
    return () => controls.stop()
  }, [start, found, steps, reduceMotion])

  const bsq = a * a - n
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="font-mono text-sm text-ink-muted">writing {n} = a² − b², a climbing up from ⌈√{n}⌉ = {start}</p>
      {found !== null ? (
        <>
          <p className="font-mono text-3xl text-ink">a={a} → b² = {bsq}</p>
          {done ? (
            <div className="flex flex-col items-center gap-1.5">
              <span className="flex items-center gap-1 font-mono text-base font-semibold text-success">
                <Check className="h-5 w-5" /> {bsq} = {b}² — a perfect square
              </span>
              <span className="font-mono text-sm text-gold-warm">p = {found}−{b} = {found - b}, q = {found}+{b} = {found + b}</span>
            </div>
          ) : (
            <span className="font-mono text-sm text-ink-muted">is b² a perfect square yet?</span>
          )}
        </>
      ) : (
        <p className="max-w-xs text-center font-mono text-sm text-gold-warm">
          climbed {FERMAT_STEP_CAP} steps without landing on a perfect square — this n's two factors
          aren't close together, exactly the case Fermat's method is bad at.
        </p>
      )}
    </div>
  )
}

function RhoVisual() {
  const nodes = 10
  const points = Array.from({ length: nodes }).map((_, i) => {
    const angle = (i / nodes) * Math.PI * 2 - Math.PI / 2
    return { x: 50 + Math.cos(angle) * 38, y: 50 + Math.sin(angle) * 38 }
  })
  const path = points.map((p) => `${p.x},${p.y}`).join(' ')
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="font-mono text-sm text-ink-muted">tortoise and hare walk the same cycle at different speeds</p>
      <svg viewBox="0 0 100 100" className="h-44 w-44 sm:h-52 sm:w-52">
        <polygon points={path} fill="none" stroke="#1b2430" strokeWidth="1.5" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" fill="#8c919b" />
        ))}
        <motion.circle
          r="3.2"
          fill="#54c89a"
          initial={{ cx: points[0].x, cy: points[0].y }}
          animate={{
            cx: points.map((p) => p.x).concat(points[0].x),
            cy: points.map((p) => p.y).concat(points[0].y),
          }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
        <motion.circle
          r="3.2"
          fill="#c99545"
          initial={{ cx: points[0].x, cy: points[0].y }}
          animate={{
            cx: [points[0], points[2], points[4], points[6], points[8], points[0], points[2]].map((p) => p.x),
            cy: [points[0], points[2], points[4], points[6], points[8], points[0], points[2]].map((p) => p.y),
          }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
      </svg>
      <p className="font-mono text-sm text-ink-muted">when they meet, gcd(difference, n) usually reveals a factor</p>
    </div>
  )
}

function PMinusOneVisual({
  reduceMotion,
  pm1Bound,
  pm1Smooth,
  pm1Primes,
}: {
  reduceMotion: boolean
  pm1Bound: number
  pm1Smooth: boolean
  pm1Primes: number[]
}) {
  const primes = pm1Primes.length ? pm1Primes : [2, 3, 5, 7]
  const [count, setCount] = useState(reduceMotion ? primes.length : 0)

  useEffect(() => {
    if (reduceMotion) return
    setCount(0)
    const id = setInterval(() => {
      setCount((c) => (c < primes.length ? c + 1 : c))
    }, 320)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion, primes.length])

  const done = count >= primes.length
  return (
    <div className="flex flex-col items-center gap-5">
      <p className="font-mono text-sm text-ink-muted">
        {pm1Smooth
          ? `this n's p−1 or q−1 is smooth up to ${pm1Bound} — building the exponent from real small primes`
          : `checking real small primes anyway — this n's p−1 and q−1 both need a factor above ${pm1Bound}`}
      </p>
      <div className="flex gap-2.5">
        {primes.map((pr, i) => (
          <motion.div
            key={pr}
            className="flex h-11 w-11 items-center justify-center rounded-sm border font-mono text-base"
            style={{ borderColor: i < count ? '#c99545' : '#1b2430', color: i < count ? '#e3b45e' : '#8c919b' }}
            animate={{ scale: i === count - 1 ? [1, 1.15, 1] : 1 }}
            transition={{ duration: 0.3 }}
          >
            {pr}
          </motion.div>
        ))}
      </div>
      {done && pm1Smooth ? (
        <span className="flex items-center gap-1 font-mono text-base font-semibold text-success">
          <Check className="h-5 w-5" /> gcd(a^M − 1, n) finds a factor — this n really is this weak
        </span>
      ) : done ? (
        <span className="max-w-xs text-center font-mono text-sm text-gold-warm">
          no luck with small primes — this n's p−1 and q−1 both carry a large prime factor, exactly
          the property real key generators check for
        </span>
      ) : (
        <span className="font-mono text-sm text-ink-muted">M = lcm({primes.join(', ')}, …)</span>
      )}
    </div>
  )
}

/** The previous version bound the input's `value` straight to the validated number and only
 * called onChange when the typed value was already in range -- which meant clearing the field to
 * type a new one (or typing the first digit of "10000000", which starts below N_MIN on its own)
 * got silently rejected and the input snapped back to the old value on every keystroke, making it
 * impossible to actually type a new number. Decoupling the input's own text from the committed,
 * validated `n` fixes that: the field can hold any in-progress text, onChange commits upstream
 * only once that text parses to a valid in-range integer, and onBlur reverts to the last good
 * value if you tab away mid-edit instead of leaving the field in a stuck, ambiguous state. */
function NInput({ n, onChange }: { n: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(n))

  useEffect(() => {
    setText(String(n))
  }, [n])

  const parsed = Number(text)
  const valid = text.trim() !== '' && Number.isInteger(parsed) && parsed >= N_MIN && parsed <= N_MAX

  return (
    <div className="mb-4 flex flex-wrap items-end gap-4 border-b border-line pb-4">
      <label className="flex flex-col gap-1 font-mono text-xs text-ink-muted">
        n
        <input
          type="number"
          min={N_MIN}
          max={N_MAX}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            const v = Number(e.target.value)
            if (e.target.value.trim() !== '' && Number.isInteger(v) && v >= N_MIN && v <= N_MAX) onChange(v)
          }}
          onBlur={() => {
            if (!valid) setText(String(n))
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
          className={`focus-ring w-40 rounded-sm border bg-navy px-2 py-1 font-mono text-sm text-ink ${valid ? 'border-line' : 'border-gold-warm'}`}
        />
      </label>
      <p className="font-mono text-xs text-ink-muted">
        {valid
          ? 'try your own composite — every stage below recomputes for real, and the tool below stays in sync'
          : `enter a whole number between ${N_MIN} and ${N_MAX.toLocaleString()}`}
      </p>
    </div>
  )
}

export default function ClassicalAttackVisual({ n, onNChange }: { n: number; onNChange: (n: number) => void }) {
  const math = useClassicalMath(n)

  const stages: PipelineStage[] = useMemo(
    () => [
      {
        id: 'trial_division',
        label: 'Trial division',
        caption: 'Check every possible divisor up to √n. Always correct eventually — but painfully slow for large n.',
        formula: String.raw`n \bmod d = 0, \quad d = 2, 3, \dots, \lfloor\sqrt{${n}}\rfloor = ${math.trialLimit}`,
        render: ({ reduceMotion }: { reduceMotion: boolean }) => (
          <TrialDivisionVisual n={n} factor={math.factor} trialLimit={math.trialLimit} reduceMotion={reduceMotion} />
        ),
      },
      {
        id: 'fermat',
        label: "Fermat's method",
        caption: 'Write n as a difference of two squares. Converges almost instantly when the two prime factors happen to sit close together.',
        formula: String.raw`${n} = a^2 - b^2 = (a-b)(a+b)`,
        render: ({ reduceMotion }: { reduceMotion: boolean }) => <FermatVisual n={n} fermat={math.fermat} reduceMotion={reduceMotion} />,
      },
      {
        id: 'pollards_rho',
        label: "Pollard's rho",
        caption: 'Two walkers trace the same pseudo-random cycle at different speeds. Where they collide usually exposes a factor — no special structure required.',
        formula: String.raw`x_{i+1} = x_i^2 + 1 \bmod ${n}, \qquad \gcd(|x_i - x_{2i}|,\, ${n})`,
        render: () => <RhoVisual />,
      },
      {
        id: 'pollards_p_minus_1',
        label: 'Pollard’s p−1',
        caption: math.pm1Smooth
          ? `This n is actually vulnerable to this: p−1 or q−1 only needs primes up to ${math.pm1Bound}.`
          : `This n resists it: both p−1 and q−1 carry a prime factor above ${math.pm1Bound}, so no small bound B works.`,
        formula: String.raw`\gcd(a^{M}-1,\, ${n}), \qquad M = \mathrm{lcm}(1, 2, \dots, B)`,
        render: ({ reduceMotion }: { reduceMotion: boolean }) => (
          <PMinusOneVisual reduceMotion={reduceMotion} pm1Bound={math.pm1Bound} pm1Smooth={math.pm1Smooth} pm1Primes={math.pm1Primes} />
        ),
      },
    ],
    [n, math],
  )

  return (
    <div id="classical-controls">
      <NInput n={n} onChange={onNChange} />
      <PipelineAnimation stages={stages} accent="gold" />
    </div>
  )
}
