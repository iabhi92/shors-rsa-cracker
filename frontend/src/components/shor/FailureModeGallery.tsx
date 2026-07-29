import { CircleCheck, Dices, Divide, Ban } from 'lucide-react'
import { Card } from '../ui'

type Preset = {
  n: number
  a: number
  label: string
  description: string
  icon: typeof Dices
}

// Real (N, a) pairs, each independently verified by walking the actual multiplicative-order
// and gcd math for every a coprime with N (not asserted, computed -- see the failure-mode
// case's own r and gcd(a,N) values below, which are exactly what quantum/shor.py would compute
// for these inputs). One curated example per outcome the "Reading the failure modes" list
// below already documents in prose -- this is the same four cases, but clickable.
const PRESETS: Preset[] = [
  {
    n: 15,
    a: 3,
    label: 'Trivial factor via gcd',
    description: 'gcd(3, 15) = 3 -- already a factor, no quantum step even needed.',
    icon: Divide,
  },
  {
    n: 21,
    a: 4,
    label: 'Odd period (unusable)',
    description: 'order of 4 mod 21 is r = 3, which is odd -- the standard construction has no way to use it.',
    icon: Dices,
  },
  {
    n: 15,
    a: 14,
    label: 'a^(r/2) ≡ −1 mod N',
    description: 'order of 14 mod 15 is r = 2, and 14^1 mod 15 = 14 = N − 1 -- a genuine dead end for this a.',
    icon: Ban,
  },
  {
    n: 15,
    a: 2,
    label: 'Clean success',
    description: 'order of 2 mod 15 is r = 4, even, and neither gcd step is trivial -- factors (3, 5) fall out.',
    icon: CircleCheck,
  },
]

/** One-click ways to actually witness each of the four outcomes the "Reading the failure modes"
 * list further down only describes in prose -- each button sets the exact (N, a) that produces
 * that outcome (independently verified, not guessed) instead of leaving it to chance whether a
 * random a happens to land on the interesting case. Sets the controls, doesn't auto-run: the
 * run button's own click still fires the request against values React has actually committed,
 * rather than racing a stale closure by calling it in the same handler as the state update. */
export default function FailureModeGallery({ onPick }: { onPick: (n: number, a: number) => void }) {
  function handlePick(preset: Preset) {
    onPick(preset.n, preset.a)
    document.getElementById('shor-controls')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <Card>
      <h2 className="font-medium text-ink">Failure-mode gallery</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Four real, curated (N, a) pairs -- one for each outcome this algorithm can actually produce. Click one to load
        it above, then run it yourself.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => handlePick(preset)}
            className="focus-ring flex flex-col gap-1 rounded-sm border border-line p-3 text-left text-sm transition-colors hover:border-gold/50 hover:bg-line/60"
          >
            <span className="flex items-center gap-2 font-medium text-ink">
              <preset.icon className="h-4 w-4 shrink-0 text-gold" />
              {preset.label}
            </span>
            <span className="font-mono text-xs text-ink-muted">
              N = {preset.n}, a = {preset.a}
            </span>
            <span className="text-xs text-ink-muted">{preset.description}</span>
          </button>
        ))}
      </div>
    </Card>
  )
}
