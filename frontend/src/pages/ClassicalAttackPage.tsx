import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { apiPost } from '../api/client'
import { useAction } from '../hooks/useApi'
import type { AttackMethod, CompareResponse } from '../types/api'
import { Button, Card, ErrorBanner, PageHeader, StatCard, Table } from '../components/ui'
import ClassicalAttackVisual from '../components/classical/ClassicalAttackVisual'
import TrialDivisionReplay from '../components/classical/TrialDivisionReplay'
import NextStepNav from '../components/NextStepNav'

const METHOD_INFO: Record<AttackMethod, { label: string; why: string; suggestedN: number }> = {
  trial_division: {
    label: 'Trial division',
    why: 'Tries every divisor up to √n. Fast only when n has a small factor -- O(√n) in general.',
    suggestedN: 1_048_573,
  },
  fermat: {
    label: "Fermat's method",
    why: 'Expresses n = a² − b². Extremely fast when the two prime factors are close together -- a real historical implementation bug class.',
    suggestedN: 8051, // 83 * 97, close primes
  },
  pollards_rho: {
    label: "Pollard's rho",
    why: 'General-purpose cycle-detection method, expected ~O(n^(1/4)) -- better than trial division for generic composites.',
    suggestedN: 8051,
  },
  pollards_p_minus_1: {
    label: "Pollard's p-1",
    why: 'Succeeds fast only when p−1 (or q−1) is "smooth" (all small prime factors) -- defended against by choosing safe primes.',
    suggestedN: 8051,
  },
}

export default function ClassicalAttackPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const paramN = Number(searchParams.get('n'))
  const [n, setN] = useState(paramN >= 4 && paramN <= 10_000_000 ? paramN : 8051)
  const compare = useAction((n: number) => apiPost<CompareResponse>('/classical/compare', { n }))
  const autoRanFor = useRef<number | null>(null)

  // Lets the command palette's "factor n=..." quick action (?n=...) land here already running,
  // instead of requiring a second click.
  useEffect(() => {
    if (paramN >= 4 && paramN <= 10_000_000 && autoRanFor.current !== paramN) {
      autoRanFor.current = paramN
      compare.run(paramN)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramN])

  // The reverse direction: n is shareable, not just readable-once-on-load. Every change to n
  // (typing, a preset button, the visualizer) updates the address bar so the current composite
  // is always a link -- but it also marks autoRanFor immediately, so the effect above (which
  // exists for *external* navigation into this page) doesn't mistake our own write for a fresh
  // deep link and fire an extra compare call on every keystroke.
  useEffect(() => {
    autoRanFor.current = n
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('n', String(n))
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n])

  const results = compare.state.status === 'success' ? compare.state.data.results : null
  const fastest = results
    ? [...results].filter((r) => r.succeeded).sort((a, b) => a.elapsed_seconds - b.elapsed_seconds)[0]
    : null

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Classical Attack Laboratory"
        description="Run this project's four from-scratch classical factoring attacks (attacker/classical.py) against a composite number, side by side."
      />

      <div className="mb-6">
        <h2 className="mb-3 font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">
          0. How each attack actually works, step by step
        </h2>
        <ClassicalAttackVisual n={n} onNChange={setN} />
      </div>

      <h2 className="mb-3 font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">
        1. Run all four attacks live
      </h2>
      <Card>
        <p className="font-mono text-sm text-ink-muted">
          Using <span className="text-ink">n = {n}</span> —{' '}
          <a
            href="#classical-controls"
            onClick={(e) => { e.preventDefault(); document.getElementById('classical-controls')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}
            className="text-gold underline underline-offset-2 hover:text-gold-warm"
          >
            change above
          </a>
          .
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(METHOD_INFO).map(([method, info]) => (
            <button
              key={method}
              type="button"
              onClick={() => setN(info.suggestedN)}
              className="focus-ring rounded-sm border border-line px-2.5 py-1 text-xs text-ink-muted hover:bg-line"
            >
              try {info.suggestedN} ({info.label.toLowerCase()}-friendly)
            </button>
          ))}
        </div>
        <div className="mt-4">
          <Button onClick={() => compare.run(n)} disabled={compare.state.status === 'loading'}>
            {compare.state.status === 'loading' ? 'Running all four attacks…' : 'Run all four attacks'}
          </Button>
        </div>
        {compare.state.status === 'error' && <div className="mt-3"><ErrorBanner message={compare.state.message} /></div>}
      </Card>

      {compare.state.status === 'success' && (
        <Card className="mt-6">
          <h2 className="mb-3 font-medium text-ink">Results for n = {compare.state.data.n}</h2>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Bit length" value={`${n.toString(2).length} bits`} />
            <StatCard label="Methods succeeded" value={compare.state.data.results.filter((r) => r.succeeded).length} />
            <StatCard label="Fastest method" value={fastest ? METHOD_INFO[fastest.method].label : '—'} />
            <StatCard
              label="Total operations"
              value={compare.state.data.results.reduce((sum, r) => sum + r.operations, 0).toLocaleString()}
            />
          </div>
          <Table>
            <thead>
              <tr className="border-b border-line text-xs tracking-wide text-ink-muted uppercase">
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">Succeeded</th>
                <th className="px-3 py-2">Factors</th>
                <th className="px-3 py-2">Operations</th>
                <th className="px-3 py-2">Time (s)</th>
              </tr>
            </thead>
            <tbody>
              {compare.state.data.results.map((r) => (
                <tr key={r.method} className="border-b border-line/60 last:border-0">
                  <td className="px-3 py-2 font-medium text-ink">{METHOD_INFO[r.method].label}</td>
                  <td className="px-3 py-2">
                    {r.succeeded ? (
                      <span className="text-success">yes</span>
                    ) : r.timed_out ? (
                      <span className="text-gold">timed out</span>
                    ) : (
                      <span className="text-ink-muted">no</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-ink-muted">
                    {r.factor ? `${r.factor} × ${r.other_factor}` : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-ink-muted">{r.operations.toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-xs text-ink-muted">{r.elapsed_seconds.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <TrialDivisionReplay n={n} />

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        {Object.entries(METHOD_INFO).map(([method, info]) => (
          <Card key={method}>
            <h3 className="text-sm font-medium text-ink">{info.label}</h3>
            <p className="mt-1 text-xs text-ink-muted">{info.why}</p>
          </Card>
        ))}
      </section>

      <p className="mt-6 text-sm text-ink-muted">
        None of these demonstrations scale to real RSA key sizes (2048+ bits) -- see the{' '}
        <Link to="/classical-benchmark" className="text-gold underline underline-offset-2">Classical Benchmark</Link>{' '}
        page for measured evidence of the exponential growth.
      </p>

      <NextStepNav />
    </div>
  )
}
