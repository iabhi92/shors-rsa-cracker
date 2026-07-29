import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { CheckCircle2, Pause, Play, RotateCcw, SkipBack, SkipForward, XCircle } from 'lucide-react'
import { apiPost } from '../../api/client'
import { useAction } from '../../hooks/useApi'
import type { TrialDivisionTraceResponse } from '../../types/api'
import { Button, Card, ErrorBanner } from '../ui'
import { playTick, playSnap } from '../../lib/sfx'

const SPEEDS = [5, 20, 80]

/** Replay mode: every divisor trial_division actually tried against n, stepped through one at a
 * time -- not the final "operations: 1580" summary the compare table shows, but the real attempt
 * log frame by frame (see backend/app/routers/classical.py's trial_division_trace, which records
 * the true sequence, never a sampled subset of it). Scoped to trial_division specifically: its
 * step count is naturally small (at most ~sqrt(n)/2, ~1580 at this project's largest allowed n),
 * unlike the other three methods, so a full frame-by-frame replay is honest and practical here
 * in a way it wouldn't be for, say, Pollard's rho's own internal iteration count. */
export default function TrialDivisionReplay({ n }: { n: number }) {
  const trace = useAction((n: number) => apiPost<TrialDivisionTraceResponse>('/classical/trial-division-trace', { n }))
  const [stepIndex, setStepIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speedIndex, setSpeedIndex] = useState(1)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const data = trace.state.status === 'success' ? trace.state.data : null
  const steps = data?.steps ?? []
  const step = steps[stepIndex]
  const atEnd = stepIndex >= steps.length - 1

  useEffect(() => {
    setStepIndex(0)
    setPlaying(false)
  }, [data])

  useEffect(() => {
    if (!playing || !data) return
    if (atEnd) {
      setPlaying(false)
      return
    }
    timerRef.current = setTimeout(() => {
      setStepIndex((i) => {
        const next = Math.min(i + 1, steps.length - 1)
        playTick()
        return next
      })
    }, 1000 / SPEEDS[speedIndex])
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [playing, stepIndex, speedIndex, data, atEnd, steps.length])

  useEffect(() => {
    if (step?.is_factor) playSnap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.is_factor])

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium text-ink">Replay: trial division, one divisor at a time</h2>
          <p className="mt-1 max-w-xl text-sm text-ink-muted">
            The real attempt log for n = {n} -- every odd divisor trial division actually tried, in order, not just
            the final operations count.
          </p>
        </div>
        <Button onClick={() => trace.run(n)} loading={trace.state.status === 'loading'}>
          {data ? 'Re-trace' : 'Trace trial division'}
        </Button>
      </div>

      {trace.state.status === 'error' && (
        <div className="mt-3">
          <ErrorBanner message={trace.state.message} />
        </div>
      )}

      {data && step && (
        <div className="mt-5 flex flex-col gap-4">
          <div className="flex items-center justify-center gap-6 rounded-sm border border-line bg-navy p-6">
            <div className="flex flex-col items-center gap-1">
              <span className="font-mono text-xs text-ink-muted">trying divisor</span>
              <motion.span
                key={step.divisor}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-mono text-3xl font-semibold text-gold-warm"
              >
                {step.divisor}
              </motion.span>
            </div>
            <span className="font-mono text-xl text-ink-muted">→</span>
            <div className="flex flex-col items-center gap-1">
              <span className="font-mono text-xs text-ink-muted">{n} mod {step.divisor}</span>
              <span className={`font-mono text-3xl font-semibold ${step.is_factor ? 'text-success' : 'text-ink'}`}>
                {step.remainder}
              </span>
            </div>
            {step.is_factor ? (
              <CheckCircle2 className="h-6 w-6 shrink-0 text-success" />
            ) : (
              <XCircle className="h-6 w-6 shrink-0 text-ink-muted/40" />
            )}
          </div>

          <input
            type="range"
            min={0}
            max={steps.length - 1}
            value={stepIndex}
            onChange={(e) => {
              setPlaying(false)
              setStepIndex(Number(e.target.value))
            }}
            className="accent-gold"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-xs text-ink-muted">
              step {stepIndex + 1} of {steps.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setPlaying(false)
                  setStepIndex(0)
                }}
                className="focus-ring rounded-sm border border-line p-1.5 text-ink-muted transition-colors hover:border-ink-muted hover:text-ink"
                aria-label="Restart"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlaying(false)
                  setStepIndex((i) => Math.max(0, i - 1))
                }}
                className="focus-ring rounded-sm border border-line p-1.5 text-ink-muted transition-colors hover:border-ink-muted hover:text-ink"
                aria-label="Previous step"
              >
                <SkipBack className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                className="focus-ring rounded-sm border border-line p-1.5 text-ink-muted transition-colors hover:border-ink-muted hover:text-ink"
                aria-label={playing ? 'Pause' : 'Play'}
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlaying(false)
                  setStepIndex((i) => Math.min(steps.length - 1, i + 1))
                }}
                className="focus-ring rounded-sm border border-line p-1.5 text-ink-muted transition-colors hover:border-ink-muted hover:text-ink"
                aria-label="Next step"
              >
                <SkipForward className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setSpeedIndex((i) => (i + 1) % SPEEDS.length)}
                className="focus-ring rounded-sm border border-line px-2 py-1.5 font-mono text-xs text-ink-muted transition-colors hover:border-ink-muted hover:text-ink"
              >
                {SPEEDS[speedIndex]}/s
              </button>
            </div>
          </div>

          {atEnd && (
            <div
              className={`rounded-sm border p-3 text-center font-mono text-sm ${
                data.succeeded ? 'border-success/40 bg-success/10 text-success' : 'border-line bg-navy text-ink-muted'
              }`}
            >
              {data.succeeded
                ? `factor found: ${data.factor} × ${data.other_factor} = ${n}`
                : `no factor found up to √${n} -- ${n} is prime, or its smallest factor is larger than √${n} (impossible for a composite, so ${n} must be prime)`}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
