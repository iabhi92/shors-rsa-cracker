import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { CheckCircle2, Radio, XCircle, Zap } from 'lucide-react'
import { apiGet, apiPost, ApiError } from '../api/client'
import { Button, Card, ErrorBanner } from './ui'
import NoiseOverlayChart from './NoiseOverlayChart'
import AmplitudeView from './AmplitudeView'
import { playIbmBlip, playSnap } from '../lib/sfx'
import { ALLOWED_LIVE_A_VALUES, type IbmLiveStatusResponse, type IbmLiveSubmitResponse } from '../types/api'

const POLL_INTERVAL_MS = 3000

type Phase = 'idle' | 'submitting' | 'polling' | 'done' | 'error'

/** Live, on-demand submission to REAL IBM Quantum hardware -- this is the one place on the
 * entire site that spends real, account-limited hardware time on a visitor's click (see
 * backend/app/routers/ibm_live.py's own docstring for the rate limits guarding it). Real jobs
 * queue for anywhere from seconds to many minutes, so this submits once and then polls
 * /status/{run_id} on an interval rather than blocking a single request -- the same shape as
 * any real "start a job, check back later" system, not a simulated instant response. */
export default function LiveIbmHardwareRun() {
  const [a, setA] = useState<number>(7)
  const [phase, setPhase] = useState<Phase>('idle')
  const [status, setStatus] = useState<IbmLiveStatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const startRef = useRef<number>(0)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'polling' && phase !== 'submitting') return
    const tick = setInterval(() => setElapsedMs(Date.now() - startRef.current), 250)
    return () => clearInterval(tick)
  }, [phase])

  const poll = async (runId: string) => {
    try {
      const s = await apiGet<IbmLiveStatusResponse>(`/ibm-hardware/live/status/${runId}`)
      setStatus(s)
      if (s.status === 'done') {
        setPhase('done')
        playSnap()
        return
      }
      if (s.status === 'error') {
        setPhase('error')
        setError(s.error_message ?? 'The job ended in an error state.')
        return
      }
      // Still queued or running -- the one place on the whole site this fires repeatedly,
      // standing in for real control-electronics chatter while a real job is in flight.
      playIbmBlip()
      pollRef.current = setTimeout(() => void poll(runId), POLL_INTERVAL_MS)
    } catch (err) {
      setPhase('error')
      setError(err instanceof ApiError ? err.message : 'Lost contact with the backend while polling.')
    }
  }

  const submit = async () => {
    setPhase('submitting')
    setError(null)
    setStatus(null)
    startRef.current = Date.now()
    setElapsedMs(0)
    try {
      const res = await apiPost<IbmLiveSubmitResponse>('/ibm-hardware/live/submit', { a })
      setPhase('polling')
      playIbmBlip()
      pollRef.current = setTimeout(() => void poll(res.run_id), POLL_INTERVAL_MS)
    } catch (err) {
      setPhase('error')
      setError(err instanceof ApiError ? err.message : 'Request failed.')
    }
  }

  const busy = phase === 'submitting' || phase === 'polling'
  const elapsedS = (elapsedMs / 1000).toFixed(1)

  const resultAsRun =
    status?.status === 'done' &&
    status.backend_name != null &&
    status.job_id != null &&
    status.counts &&
    status.theoretical_distribution &&
    status.total_variation_distance != null &&
    status.probability_mass_on_theoretically_impossible_outcomes != null
      ? {
          a: status.a,
          N: status.N,
          n_count: status.n_count,
          r: status.r,
          backend_name: status.backend_name,
          job_id: status.job_id,
          shots: status.shots,
          timestamp_utc: new Date().toISOString(),
          counts: status.counts,
          theoretical_distribution: status.theoretical_distribution,
          total_variation_distance: status.total_variation_distance,
          probability_mass_on_theoretically_impossible_outcomes: status.probability_mass_on_theoretically_impossible_outcomes,
        }
      : null

  return (
    <Card className="mt-6 border-gold/30">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-gold" />
        <h2 className="font-medium text-ink">Run this live, right now</h2>
      </div>
      <p className="mt-2 text-sm text-ink-muted">
        This submits the same compiled circuit shown above to a real IBM quantum computer, on this project's own IBM
        Cloud account -- not a simulation, not the stored run from earlier. Because real hardware time is a
        genuinely limited, shared resource, this is capped hard: one submission per visitor per hour, and a small
        total number across everyone per day.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Base a (mod 15)
          <select
            value={a}
            onChange={(e) => setA(Number(e.target.value))}
            disabled={busy}
            className="focus-ring w-32 rounded-sm border border-line bg-navy px-3 py-1.5 text-ink disabled:opacity-50"
          >
            {ALLOWED_LIVE_A_VALUES.map((v) => (
              <option key={v} value={v}>
                a = {v}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={() => void submit()} disabled={busy} loading={phase === 'submitting'}>
          <Radio className="mr-1.5 h-4 w-4" />
          Submit to real hardware
        </Button>
        {busy && <span className="font-mono text-xs text-ink-muted">{elapsedS}s elapsed</span>}
      </div>

      {phase === 'error' && error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {(phase === 'submitting' || phase === 'polling') && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 flex items-center gap-3 rounded-sm border border-line bg-navy p-4"
        >
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-gold"
          />
          <span className="font-mono text-sm text-ink-muted">
            {phase === 'submitting' && 'Submitting to IBM Quantum...'}
            {phase === 'polling' && (!status || status.status === 'submitting') && 'Submitting to IBM Quantum...'}
            {phase === 'polling' &&
              status &&
              status.status !== 'submitting' &&
              `Status: ${status.status}${status.backend_name ? ` on ${status.backend_name}` : ''}${status.job_id ? ` -- job ${status.job_id}` : ''}`}
          </span>
        </motion.div>
      )}

      {phase === 'done' && status && resultAsRun && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-5">
          <div className="flex items-center gap-2 font-mono text-sm text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Done -- a={status.a}, N={status.N}, backend {status.backend_name}, {status.shots} shots, job{' '}
            {status.job_id}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total variation distance" value={status.total_variation_distance!.toFixed(4)} />
            <Stat
              label="Impossible-outcome mass"
              value={status.probability_mass_on_theoretically_impossible_outcomes!.toFixed(4)}
            />
            <Stat label="Order r" value={String(status.r)} />
            <Stat label="Counting qubits" value={String(status.n_count)} />
          </div>
          <div className="mt-4">
            <NoiseOverlayChart run={resultAsRun} />
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <AmplitudeView
              title="Theoretical prediction"
              amplitudes={Object.entries(resultAsRun.theoretical_distribution).map(([x, p]) => ({
                basis_state: x,
                real: 0,
                imag: 0,
                probability: p,
              }))}
            />
            <AmplitudeView
              title={`Your real hardware run (${status.backend_name})`}
              amplitudes={Object.keys(resultAsRun.theoretical_distribution)
                .map(Number)
                .sort((x, y) => x - y)
                .map((x) => ({
                  basis_state: String(x),
                  real: 0,
                  imag: 0,
                  probability: resultAsRun.counts[String(x)] ? resultAsRun.counts[String(x)] / resultAsRun.shots : 0,
                }))}
            />
          </div>
        </motion.div>
      )}

      {phase === 'error' && !error && (
        <div className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
          <XCircle className="h-4 w-4 shrink-0" />
          Something went wrong.
        </div>
      )}
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[0.65rem] tracking-wide text-ink-muted uppercase">{label}</span>
      <span className="font-mono text-sm text-ink">{value}</span>
    </div>
  )
}
