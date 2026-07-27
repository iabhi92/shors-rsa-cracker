import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { apiGet, apiPost } from '../api/client'
import { useAction, useFetchOnMount } from '../hooks/useApi'
import type { ShorBackend, ShorBackendsResponse, ShorResponse } from '../types/api'
import { Button, Card, ErrorBanner, PageHeader, Spinner, Table, WarningBanner } from '../components/ui'
import VaultIllustration from '../components/VaultIllustration'
import ShorPipelineVisual from '../components/shor/ShorPipelineVisual'

export default function ShorLabPage() {
  const backends = useFetchOnMount(() => apiGet<ShorBackendsResponse>('/shor/backends'), [])
  // N and a live in the URL so a specific worked example is a link, not just a description --
  // read once on mount (a lazy initializer, not an effect, so it never fights the URL writes
  // below), then every change to either value updates the address bar via history.replaceState
  // (no new back-button entry per keystroke).
  const [searchParams, setSearchParams] = useSearchParams()
  const [n, setN] = useState(() => {
    const fromUrl = Number(searchParams.get('n'))
    return Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : 15
  })
  const [aInput, setAInput] = useState(() => searchParams.get('a') ?? '')
  const [backend, setBackend] = useState<ShorBackend>('honest')

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('n', String(n))
        if (aInput.trim() === '') next.delete('a')
        else next.set('a', aInput.trim())
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, aInput])
  const run = useAction(() =>
    apiPost<ShorResponse>('/shor/run', {
      n,
      a: aInput.trim() === '' ? null : Number(aInput),
      backend,
      seed: null,
    }),
  )

  const backendData = backends.status === 'success' ? backends.data : null
  const gateLevelDisabled = backendData ? !backendData.gate_level_allowed_n.includes(n) : false

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="The central demonstration"
        title="Shor's Algorithm Laboratory"
        description="Factor N using a real simulated quantum period-finding circuit, then recover the factors with the classical continued-fractions post-processing -- run the full pipeline, not a hardcoded answer."
      />

      <div className="mb-6">
        <h2 className="mb-3 font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">
          How this actually works, step by step
        </h2>
        <ShorPipelineVisual allowedN={backendData?.allowed_n} N={n} onNChange={setN} aInput={aInput} onAChange={setAInput} />
      </div>

      {backends.status === 'loading' && <Spinner label="Loading available backends…" />}
      {backends.status === 'error' && <ErrorBanner message={backends.message} />}

      {backendData && (
        <Card>
          <p className="font-mono text-sm text-ink-muted">
            Using <span className="text-ink">N = {n}</span>, <span className="text-ink">a = {aInput.trim() === '' ? 'auto' : aInput}</span> —{' '}
            <a
              href="#shor-controls"
              onClick={(e) => { e.preventDefault(); document.getElementById('shor-controls')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}
              className="text-gold underline underline-offset-2 hover:text-gold-warm"
            >
              change these above
            </a>
            . Pick a backend below and run the real thing.
          </p>

          <fieldset className="mt-4">
            <legend className="mb-2 text-sm text-ink-muted">Backend</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(backendData.descriptions) as ShorBackend[]).map((b) => {
                const disabled = b === 'gate_level' && gateLevelDisabled
                return (
                  <label
                    key={b}
                    className={`focus-ring flex cursor-pointer flex-col gap-1 rounded-sm border p-3 text-sm transition-colors ${
                      disabled
                        ? 'cursor-not-allowed border-line opacity-40'
                        : backend === b
                          ? 'border-gold bg-gold/10 ring-1 ring-gold/30'
                          : 'border-line hover:bg-line/60'
                    }`}
                  >
                    <span className="flex items-center gap-2 font-medium text-ink">
                      <input type="radio" name="backend" checked={backend === b} disabled={disabled} onChange={() => setBackend(b)} />
                      {b}
                    </span>
                    <span className="text-xs text-ink-muted">{backendData.descriptions[b]}</span>
                    {disabled && (
                      <span className="text-xs text-gold">
                        Only available for N in {backendData.gate_level_allowed_n.join(', ')} on this site (see Simulator Comparison).
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </fieldset>

          <div className="mt-4">
            <Button onClick={() => run.run()} loading={run.state.status === 'loading'}>
              {run.state.status === 'loading' ? 'Running…' : "Run Shor's algorithm"}
            </Button>
          </div>
        </Card>
      )}

      {run.state.status === 'loading' && (
        <div className="mt-6">
          <Spinner label="Running the quantum period-finding pipeline… this can take a few seconds." />
        </div>
      )}
      {run.state.status === 'error' && <div className="mt-6"><ErrorBanner message={run.state.message} /></div>}

      {run.state.status === 'success' && <ResultView result={run.state.data} onRetry={() => run.run()} />}
    </div>
  )
}

function CrackedHero({ result }: { result: ShorResponse }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="relative overflow-hidden rounded-sm border border-gold/30 bg-surface p-6 text-center sm:p-8"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-28 w-28">
          <VaultIllustration cracked />
        </div>
        <p className="font-mono text-xs tracking-[0.2em] text-gold uppercase">// cracked</p>
        <p className="font-mono text-3xl font-semibold text-ink sm:text-4xl">
          {result.n} = {result.factors![0]} <span className="text-success">×</span> {result.factors![1]}
        </p>
        <p className="text-sm text-ink-muted">
          Recovered using the <strong className="text-ink">{result.backend_used}</strong> backend in{' '}
          {result.elapsed_seconds.toFixed(3)}s ({result.attempts.length} attempt{result.attempts.length !== 1 ? 's' : ''})
        </p>
      </div>
    </motion.div>
  )
}

function ResultView({ result, onRetry }: { result: ShorResponse; onRetry: () => void }) {
  return (
    <div className="mt-6 space-y-4">
      {result.note && <WarningBanner>{result.note}</WarningBanner>}

      {result.succeeded ? (
        <CrackedHero result={result} />
      ) : (
        <ErrorBanner
          message={`No factors found within ${result.attempts.length} attempt(s) -- this is a known, expected occasional outcome of the algorithm's per-shot failure modes. Try again.`}
        />
      )}

      <Card>
        <h2 className="mb-3 font-medium text-ink">Attempt log</h2>
        <Table>
          <thead>
            <tr className="border-b border-line text-xs tracking-wide text-ink-muted uppercase">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">a</th>
              <th className="px-3 py-2">Measured</th>
              <th className="px-3 py-2">Period candidate</th>
              <th className="px-3 py-2">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {result.attempts.map((attempt, i) => (
              <tr key={i} className="border-b border-line/60 last:border-0">
                <td className="px-3 py-2 font-mono text-xs text-ink-muted">{i + 1}</td>
                <td className="px-3 py-2 font-mono text-xs text-ink">{attempt.a}</td>
                <td className="px-3 py-2 font-mono text-xs text-ink-muted">{attempt.measured ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-xs text-ink-muted">{attempt.period_candidate ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-ink-muted">{attempt.outcome}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="mt-4">
          <Button variant="secondary" onClick={onRetry}>Retry</Button>
        </div>
      </Card>

      <Card>
        <h2 className="font-medium text-ink">Reading the failure modes</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink-muted">
          <li><strong>gcd(a,N) != 1:</strong> that gcd is already a factor -- a free classical shortcut, no quantum step needed.</li>
          <li><strong>odd period:</strong> the recovered order r is odd, which the standard construction can't use -- retry with a new a.</li>
          <li><strong>a^(r/2) == -1 mod N:</strong> a genuine, expected dead end for that specific a -- retry.</li>
          <li><strong>no valid period found:</strong> the measurement didn't reduce to a usable period via continued fractions -- a real per-shot failure, not a bug.</li>
        </ul>
      </Card>
    </div>
  )
}
