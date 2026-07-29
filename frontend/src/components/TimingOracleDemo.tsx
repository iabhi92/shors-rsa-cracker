import { useState } from 'react'
import { motion } from 'motion/react'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { apiPost } from '../api/client'
import { useAction } from '../hooks/useApi'
import type { TimingComparisonResult, TimingOracleResponse } from '../types/api'
import { Button, Card, ErrorBanner } from './ui'

const TRIAL_OPTIONS = [1000, 2000, 5000]

function verdictStyle(sigmas: number) {
  if (sigmas > 3) return { icon: XCircle, text: 'text-red-300', label: 'real timing leak' }
  if (sigmas > 1) return { icon: AlertTriangle, text: 'text-gold-warm', label: 'borderline' }
  return { icon: CheckCircle2, text: 'text-success', label: 'no measurable leak' }
}

function ComparisonPanel({ title, subtitle, result }: { title: string; subtitle: string; result: TimingComparisonResult }) {
  const maxMedian = Math.max(...result.scenarios.map((s) => s.median_ns))
  const { icon: Icon, text, label } = verdictStyle(result.gap_in_std_errors)
  return (
    <div className="flex flex-col gap-3 rounded-sm border border-line bg-navy p-4">
      <div>
        <h3 className="font-medium text-ink">{title}</h3>
        <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>
      </div>
      <div className="flex flex-col gap-2">
        {result.scenarios.map((s) => (
          <div key={s.label} className="flex flex-col gap-1">
            <div className="flex items-center justify-between font-mono text-[0.7rem] text-ink-muted">
              <span>{s.label}</span>
              <span>{s.median_ns.toFixed(0)} ns</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-line/40">
              <motion.div
                className="h-full rounded-full bg-gold"
                initial={{ width: 0 }}
                animate={{ width: `${(s.median_ns / maxMedian) * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className={`flex items-center gap-2 rounded-sm border border-line/60 bg-navy-secondary px-3 py-2 font-mono text-xs ${text}`}>
        <Icon className="h-4 w-4 shrink-0" />
        <span>
          gap: {result.gap_ns.toFixed(0)}ns ({result.gap_percent.toFixed(1)}%), {result.gap_in_std_errors.toFixed(1)}σ -- {label}
        </span>
      </div>
    </div>
  )
}

/** Turns the "NOT constant-time" caveat already written into rsa/core.py's and rsa/oaep.py's
 * own docstrings into a live, statistically measured demonstration -- this is the actual
 * mechanism behind a Bleichenbacher-style padding-oracle attack: if "rejected immediately" and
 * "rejected after more work" take measurably different time, an attacker who can only observe
 * response time (never the plaintext, never even a valid/invalid flag) can still learn *where*
 * validation failed, and chain enough such probes into a full decryption oracle. Runs on this
 * actual server, right now, against the actual shipped rsa/core.py and rsa/oaep.py -- not a
 * canned chart. */
export default function TimingOracleDemo() {
  const [trials, setTrials] = useState(2000)
  const action = useAction((trials: number) => apiPost<TimingOracleResponse>('/security-demo/timing-oracle', { trials }))
  const data = action.state.status === 'success' ? action.state.data : null

  return (
    <Card className="mt-6">
      <h2 className="font-medium text-ink">Live timing side-channel measurement</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Measures actual wall-clock time, on this server, right now: how long <code className="rounded bg-line px-1 py-0.5 text-ink-muted">_pkcs7_unpad</code>{' '}
        and <code className="rounded bg-line px-1 py-0.5 text-ink-muted">oaep_decode</code> each take to reject a
        ciphertext, split by <em>why</em> it was rejected. This is the actual mechanism behind a Bleichenbacher-style
        padding-oracle attack -- an attacker who can only observe response time, never the plaintext, can still learn
        where validation failed.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {TRIAL_OPTIONS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTrials(t)}
              className={`focus-ring rounded-sm border px-2.5 py-1 font-mono text-xs ${
                trials === t ? 'border-gold text-gold-warm' : 'border-line text-ink-muted hover:bg-line'
              }`}
            >
              {t.toLocaleString()} trials
            </button>
          ))}
        </div>
        <Button onClick={() => action.run(trials)} loading={action.state.status === 'loading'}>
          Measure real timing
        </Button>
        {action.state.status === 'loading' && (
          <span className="font-mono text-xs text-ink-muted">running {trials.toLocaleString()} real trials per scenario…</span>
        )}
      </div>
      {action.state.status === 'error' && (
        <div className="mt-3">
          <ErrorBanner message={action.state.message} />
        </div>
      )}

      {data && (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ComparisonPanel
              title="rsa/core.py -- _pkcs7_unpad"
              subtitle="Returns as soon as the length byte fails -- an early exit that skips real work."
              result={data.pkcs7}
            />
            <ComparisonPanel
              title="rsa/oaep.py -- oaep_decode"
              subtitle="Always runs all four structural checks before combining them, regardless of which fails."
              result={data.oaep}
            />
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Statistical significance (σ, standard errors between the fastest and slowest scenario's medians) reflects
            what's measurable in a local, noise-minimized loop -- a real attacker probing over a network deals with
            far more jitter, so "statistically real here" is necessary but not sufficient for "practically
            exploitable remotely." What's worth comparing is the shape:{' '}
            an early-exit check (<code className="rounded bg-line px-1 py-0.5 text-ink-muted">_pkcs7_unpad</code>) vs.
            one that always does the same amount of work regardless of outcome (
            <code className="rounded bg-line px-1 py-0.5 text-ink-muted">oaep_decode</code>).
          </p>
        </>
      )}
    </Card>
  )
}
