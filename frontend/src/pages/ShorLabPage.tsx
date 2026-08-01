import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { Check, Copy, Download, ShieldCheck } from 'lucide-react'
import { apiGet, apiPost } from '../api/client'
import { useAction, useFetchOnMount } from '../hooks/useApi'
import type { ShorBackend, ShorBackendsResponse, ShorResponse } from '../types/api'
import { Button, Card, ErrorBanner, PageHeader, Spinner, StatCard, Table, WarningBanner } from '../components/ui'
import VaultIllustration from '../components/VaultIllustration'
import ShorPipelineVisual from '../components/shor/ShorPipelineVisual'
import FailureModeGallery from '../components/shor/FailureModeGallery'
import ShorLabIllustration from '../components/shor/ShorLabIllustration'
import BackendRace from '../components/shor/BackendRace'
import QuantumClassicalRace from '../components/shor/QuantumClassicalRace'
import RealHardwareCheckpoint from '../components/shor/RealHardwareCheckpoint'
import NextStepNav from '../components/NextStepNav'
import DocLink from '../components/DocLink'
import { downloadShorResultCard } from '../lib/shareCard'
import { playSettle } from '../lib/sfx'

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

  useEffect(() => {
    if (run.state.status === 'success') playSettle()
  }, [run.state.status])

  const backendData = backends.status === 'success' ? backends.data : null
  const gateLevelDisabled = backendData ? !backendData.gate_level_allowed_n.includes(n) : false

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="The central demonstration"
        title="Shor's Algorithm Laboratory"
        description="Factor N using a real simulated quantum period-finding circuit, then recover the factors with the classical continued-fractions post-processing -- run the full pipeline, not a hardcoded answer."
      />

      <ShorLabIllustration />

      <div className="mb-6">
        <WarningBanner>
          N here is deliberately tiny (15–65), so the entire pipeline -- simulation, measurement, and classical
          post-processing -- runs end to end in real time. See{' '}
          <Link to="/resource-estimate" className="underline underline-offset-2">
            Resource Estimation
          </Link>{' '}
          for what a real RSA-2048 key would actually require.
        </WarningBanner>
      </div>

      <div className="mb-6">
        <h2 className="mb-3 font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">
          0. Watch it work, step by step
        </h2>
        <ShorPipelineVisual allowedN={backendData?.allowed_n} N={n} onNChange={setN} aInput={aInput} onAChange={setAInput} />
      </div>

      <div className="mb-6">
        <h2 className="mb-3 font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">
          1. Pick a starting point
        </h2>
        <FailureModeGallery
          onPick={(pickedN, pickedA) => {
            setN(pickedN)
            setAInput(String(pickedA))
          }}
        />
      </div>

      {backends.status === 'loading' && <Spinner label="Loading available backends…" />}
      {backends.status === 'error' && <ErrorBanner message={backends.message} />}

      <h2 className="mb-3 font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">
        2. Configure and run it for real
      </h2>

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

      {backendData && (
        <div className="mt-6 space-y-6">
          <div>
            <h2 className="mb-3 font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">
              3. Compare simulator backends
            </h2>
            <BackendRace
              n={n}
              aInput={aInput}
              availableBackends={(Object.keys(backendData.descriptions) as ShorBackend[]).filter((b) => !(b === 'gate_level' && gateLevelDisabled))}
            />
          </div>
          <div>
            <h2 className="mb-3 font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">
              4. Quantum vs. classical, honestly
            </h2>
            <QuantumClassicalRace n={n} aInput={aInput} />
          </div>
          <div>
            <h2 className="mb-3 font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">
              5. Check against real hardware
            </h2>
            <RealHardwareCheckpoint n={n} />
          </div>
        </div>
      )}

      <DocLink to="/docs/shors-algorithm-math" title="Shor's Algorithm: The Math" />
      <NextStepNav />
    </div>
  )
}

/** This is the thesis of the entire site paying off -- a quantum period-finding pipeline that
 * actually factored N, not a hardcoded answer -- so it gets more than the vault's own crack
 * animation: a border glow that flashes through gold into success-green and settles, plus a
 * one-shot ring pulse expanding outward from the card, both timed to land just after the vault's
 * fracture line finishes drawing rather than competing with it. */
function CrackedHero({ result }: { result: ShorResponse }) {
  const [copied, setCopied] = useState(false)

  // N and a already live in the URL (see the effect near the top of this file), so "share" is
  // just handing someone that same address -- opening it replays this exact worked example
  // rather than pointing at a separate, disconnected share mechanism.
  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const handleDownloadCard = () => {
    downloadShorResultCard({
      n: result.n,
      factors: result.factors as [number, number],
      backend: result.backend_used,
      elapsedSeconds: result.elapsed_seconds,
      attempts: result.attempts.length,
      shareUrl,
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="relative overflow-hidden rounded-sm border border-gold/30 bg-surface p-6 text-center sm:p-8"
    >
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-sm border-2"
        initial={{ borderColor: 'rgba(227,180,94,0)' }}
        animate={{ borderColor: ['rgba(227,180,94,0)', 'rgba(227,180,94,0.9)', 'rgba(84,200,154,0.6)', 'rgba(84,200,154,0)'] }}
        transition={{ duration: 1.4, delay: 0.5, times: [0, 0.3, 0.65, 1] }}
      />
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-sm border border-success"
        initial={{ opacity: 0.8, scale: 1 }}
        animate={{ opacity: 0, scale: 1.06 }}
        transition={{ duration: 0.9, delay: 0.55, ease: 'easeOut' }}
      />
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
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <Button variant="secondary" onClick={handleDownloadCard} className="text-xs">
            <Download className="h-3.5 w-3.5" /> Download result card
          </Button>
          <Button variant="secondary" onClick={handleCopyLink} className="text-xs">
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Link copied' : 'Copy shareable link'}
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

/** The crack that just happened is the entire argument for why post-quantum cryptography
 * exists -- so the moment it succeeds is where that connection actually gets made, not left as
 * an exercise for the reader. Deliberately not another wall of prose: two sentences and a real
 * link to the actual history (see HistoryPage.tsx's 2024 FIPS 203/204/205 milestone), since this
 * page has already spent a great deal of space explaining the mechanism -- this hook only needs
 * to close the loop on "so what happens next." */
function PostQuantumHook() {
  return (
    <Card className="border-violet/30 bg-violet/5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet" />
        <div>
          <h2 className="font-medium text-ink">This is exactly why post-quantum cryptography already exists</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Scale this same pipeline up to a real 2048-bit RSA key and this crack is what breaks it -- which is why
            NIST finalized RSA's replacements (FIPS 203, 204, 205) in 2024, years before any quantum computer can
            actually run this attack at that size.
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link to="/history" className="text-gold underline underline-offset-2 hover:text-gold-warm">
              See the full history &rarr;
            </Link>
            <Link to="/resource-estimate" className="text-gold underline underline-offset-2 hover:text-gold-warm">
              How far away is that, really? &rarr;
            </Link>
          </div>
        </div>
      </div>
    </Card>
  )
}

function ResultView({ result, onRetry }: { result: ShorResponse; onRetry: () => void }) {
  return (
    <div className="mt-6 space-y-4">
      {result.note && <WarningBanner>{result.note}</WarningBanner>}

      {result.succeeded ? (
        <>
          <CrackedHero result={result} />
          <PostQuantumHook />
        </>
      ) : (
        <ErrorBanner
          message={`No factors found within ${result.attempts.length} attempt(s) -- this is a known, expected occasional outcome of the algorithm's per-shot failure modes. Try again.`}
        />
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Counting qubits used" value={result.n_count_used ?? '—'} />
        <StatCard
          label="Possible outcomes"
          value={result.n_count_used != null ? (2 ** result.n_count_used).toLocaleString() : '—'}
          hint="the state space one measurement collapses"
        />
        <StatCard label="Attempts taken" value={result.attempts.length} />
        <StatCard label="Elapsed" value={`${result.elapsed_seconds.toFixed(3)}s`} />
      </div>

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
          {FAILURE_MODES.map((mode) => {
            const hit = result.attempts.find((a) => mode.match(a.outcome))
            return (
              <li key={mode.key}>
                <strong>{mode.label}:</strong>{' '}
                {hit ? (
                  <>
                    happened in this run, attempt {result.attempts.indexOf(hit) + 1} (a = {hit.a}): {hit.outcome}.
                  </>
                ) : (
                  mode.generic
                )}
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}

// Matched against each attempt's own outcome string (written by backend/app/routers/shor.py /
// quantum/shor.py, never reconstructed here) so "did this actually happen in this run" can be
// answered with this run's real a/r values instead of leaving the explanation generic
// regardless of what the attempt log above it just showed.
const FAILURE_MODES: { key: string; label: string; generic: string; match: (outcome: string) => boolean }[] = [
  {
    key: 'gcd',
    label: 'gcd(a,N) != 1',
    generic: 'that gcd is already a factor -- a free classical shortcut, no quantum step needed.',
    match: (o) => o.includes('gcd(a,N)'),
  },
  {
    key: 'odd',
    label: 'odd period',
    generic: "the recovered order r is odd, which the standard construction can't use -- retry with a new a.",
    match: (o) => o.includes('is odd'),
  },
  {
    key: 'minus1',
    label: 'a^(r/2) == -1 mod N',
    generic: 'a genuine, expected dead end for that specific a -- retry.',
    match: (o) => o.includes('== -1 mod N'),
  },
  {
    key: 'noperiod',
    label: 'no valid period found',
    generic: "the measurement didn't reduce to a usable period via continued fractions -- a real per-shot failure, not a bug.",
    match: (o) => o.includes('no valid period'),
  },
]
