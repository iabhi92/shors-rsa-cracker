import { useEffect, useMemo, useState } from 'react'
import { motion, animate } from 'motion/react'
import { Check } from 'lucide-react'
import PipelineAnimation, { type PipelineStage } from '../PipelineAnimation'
import CodePanel, { type CodeSnippet } from '../CodePanel'
import { playTick } from '../../lib/sfx'

// Copied verbatim from this repository's own attacker/classical.py.
const CLASSICAL_SNIPPETS: Record<string, CodeSnippet> = {
  trial_division: {
    file: 'attacker/classical.py',
    startLine: 88,
    code:
      '    limit = math.isqrt(n)\n' +
      '    d = 3\n' +
      '    while d <= limit:\n' +
      '        operations += 1\n' +
      '        remainder = n % d\n' +
      '        if trace is not None:\n' +
      '            trace.append(TrialDivisionStep(d, remainder, remainder == 0))\n' +
      '        if remainder == 0:\n' +
      '            elapsed = time.perf_counter() - start\n' +
      '            return FactorAttemptResult(n, "trial_division", d, n // d, operations, elapsed, True, trace=trace)',
    notes: {
      88: 'A factor larger than √n would always have a matching cofactor smaller than √n, already found.',
      89: 'Only odd divisors are tried -- the even case (n % 2) is handled separately just above this.',
      92: 'Computed once per divisor so it can both decide success and feed the replay trace below.',
      93: 'None unless the Classical Attack Lab\'s replay mode asked for it -- see collect_trace.',
      97: 'The actual "found it" check -- everything above this line is just trying the next candidate.',
    },
  },
  fermat: {
    file: 'attacker/classical.py',
    startLine: 118,
    code:
      '    a = math.isqrt(n)\n' +
      '    if a * a < n:\n' +
      '        a += 1\n' +
      '    while True:\n' +
      '        b_squared = a * a - n\n' +
      '        b = math.isqrt(b_squared)\n' +
      '        operations += 1\n' +
      '        if b * b == b_squared:\n' +
      '            p, q = a - b, a + b',
    notes: {
      118: 'Starts at ⌈√n⌉ -- the smallest a for which a² - n can even be non-negative.',
      120: 'isqrt truncates, so a² can land just under n; nudges a up until a² ≥ n actually holds.',
      122: 'Tests whether n = a² - b² for the current a -- i.e. whether b² = a² - n is a perfect square.',
      123: 'isqrt(b_squared) then re-squaring it is the actual "is this a perfect square?" test below.',
      126: 'The whole point of the method: n = a² - b² = (a-b)(a+b), so p and q fall straight out.',
    },
  },
  pollards_rho: {
    file: 'attacker/classical.py',
    startLine: 151,
    code:
      '    def f(x: int, c: int) -> int:\n' +
      '        return (x * x + c) % n\n' +
      '\n' +
      '    for _ in range(max_attempts):\n' +
      '        c = secrets.randbelow(n - 1) + 1\n' +
      '        x = y = secrets.randbelow(n - 2) + 2\n' +
      '        d = 1\n' +
      '        while d == 1:\n' +
      '            x = f(x, c)\n' +
      '            y = f(f(y, c), c)\n' +
      '            d = math.gcd(abs(x - y), n)\n' +
      '            operations += 1',
    notes: {
      151: 'The pseudo-random sequence being cycle-detected -- any polynomial works; this is the classic choice.',
      154: 'A failed (x0, c) pair just gets replaced by a fresh random one on the next attempt.',
      157: 'x is the "tortoise" (one step per round); y is the "hare" (two steps) -- Floyd\'s cycle detection.',
      160: 'y advances twice as fast as x -- this is what makes the tortoise/hare cycle collide eventually.',
      161: 'A nontrivial gcd here means x and y collided mod some factor of n before colliding mod n itself.',
    },
  },
  pollards_p_minus_1: {
    file: 'attacker/classical.py',
    startLine: 183,
    code:
      '    for prime in _sieve_primes_up_to(bound):\n' +
      '        prime_power = prime\n' +
      '        while prime_power <= bound:\n' +
      '            a = pow(a, prime, n)\n' +
      '            prime_power *= prime\n' +
      '            operations += 1\n' +
      '        d = math.gcd(a - 1, n)\n' +
      '        if 1 < d < n:\n' +
      '            elapsed = time.perf_counter() - start\n' +
      '            return FactorAttemptResult(n, "pollards_p_minus_1", d, n // d, operations, elapsed, True)',
    notes: {
      183: 'Every prime up to the smoothness bound gets folded into the exponent, one at a time.',
      186: 'Raises a to each prime power in turn -- equivalent to raising a to the product of all of them.',
      189: 'If p-1 (or q-1) divides this accumulated exponent, Fermat\'s little theorem forces this gcd to split n.',
      190: 'A gcd strictly between 1 and n is exactly a real, usable factor -- neither trivial extreme.',
    },
  },
}

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

/** A sweep bar from d=2 to √n, not a chip per candidate divisor -- trialLimit can run into the
 * thousands at this component's largest allowed n, so anything per-candidate would either be
 * unreadable or need to silently drop most of the range. A single continuous sweep scales to
 * any magnitude and still shows the one thing that actually matters here: how far O(√n) has to
 * search before it gets lucky (or gives up). */
function DivisorSweepBar({ d, target, trialLimit, done, found }: { d: number; target: number; trialLimit: number; done: boolean; found: boolean }) {
  const progress = trialLimit > 2 ? Math.min(1, (d - 2) / (trialLimit - 2)) : 1
  const targetProgress = trialLimit > 2 ? Math.min(1, (target - 2) / (trialLimit - 2)) : 1
  return (
    <div className="w-full max-w-sm">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-line">
        <motion.div
          className={`h-full rounded-full ${done && found ? 'bg-success' : 'bg-gold'}`}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.1, ease: 'linear' }}
        />
        {found && (
          <div
            className="absolute top-0 h-full w-0.5 bg-success/70"
            style={{ left: `${targetProgress * 100}%` }}
          />
        )}
        <motion.div
          className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-navy ${done && found ? 'bg-success' : 'bg-gold-warm'}`}
          animate={{ left: `${progress * 100}%`, x: '-50%' }}
          transition={{ duration: 0.1, ease: 'linear' }}
        />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[0.65rem] text-ink-muted">
        <span>d=2</span>
        <span>√n = {trialLimit}</span>
      </div>
    </div>
  )
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
      <DivisorSweepBar d={d} target={target} trialLimit={trialLimit} done={done} found={factor > 0} />
      <p className="font-mono text-sm text-ink-muted">O(√n) — has to reach {target} before it {factor > 0 ? 'finds anything' : 'gives up'}</p>
    </div>
  )
}

/** The classic gnomon: a big square of side a with a smaller square of side b removed from one
 * corner, leaving an L-shaped strip of area a²−b². Deliberately schematic, not to scale (the two
 * squares would often be degenerately close in size or wildly different at this component's real
 * a/b values) -- same convention CircuitDiagram.tsx already uses for its own schematic, not
 * literal, circuit render. The real numbers are the text above/below; this just makes the
 * identity itself legible at a glance. */
function FermatGnomon({ done, waiting }: { done: boolean; waiting: boolean }) {
  const gnomonPath = 'M 15 15 L 95 15 L 95 55 L 55 55 L 55 95 L 15 95 Z'
  return (
    <svg viewBox="0 0 100 100" className="h-32 w-32 sm:h-36 sm:w-36" role="img" aria-label="A large square with a smaller square removed from one corner, illustrating a squared minus b squared">
      <motion.path
        d={gnomonPath}
        fill={done ? '#54c89a' : '#c99545'}
        fillOpacity={done ? 0.35 : 0.18}
        stroke={done ? '#54c89a' : '#e3b45e'}
        strokeWidth={1.5}
        animate={waiting ? { fillOpacity: [0.12, 0.24, 0.12] } : undefined}
        transition={{ duration: 1.1, repeat: waiting ? Infinity : 0 }}
      />
      <rect x={55} y={15} width={40} height={40} fill="none" stroke="#8c919b" strokeWidth={1} strokeDasharray="2.5 2.5" opacity={0.6} />
      <text x={30} y={58} textAnchor="middle" className="font-mono" fontSize={9} fill="#eee8da">a²</text>
      <text x={75} y={38} textAnchor="middle" className="font-mono" fontSize={7} fill="#8c919b">b²</text>
      <text x={38} y={80} textAnchor="middle" className="font-mono" fontSize={7} fill={done ? '#54c89a' : '#e3b45e'}>n</text>
    </svg>
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
          <FermatGnomon done={done} waiting={!done} />
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
      <div className="flex items-center gap-4 font-mono text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: '#54c89a' }} /> tortoise (slow)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: '#c99545' }} /> hare (2x speed)
        </span>
      </div>
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
  const [activeStageIndex, setActiveStageIndex] = useState(0)

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
      <PipelineAnimation stages={stages} accent="gold" onActiveChange={setActiveStageIndex} onStageSound={() => playTick()} />
      <div className="mt-4">
        <h3 className="mb-2 font-mono text-xs font-semibold tracking-wide text-ink-muted uppercase">
          The actual code behind this step
        </h3>
        <CodePanel stageId={stages[activeStageIndex]?.id ?? 'trial_division'} snippets={CLASSICAL_SNIPPETS} />
      </div>
    </div>
  )
}
