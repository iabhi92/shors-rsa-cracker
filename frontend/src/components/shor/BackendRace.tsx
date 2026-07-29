import { useState } from 'react'
import { motion } from 'motion/react'
import { Loader2, Trophy } from 'lucide-react'
import { apiPost } from '../../api/client'
import type { ShorBackend, ShorResponse } from '../../types/api'
import { Button, Card } from '../ui'
import { DURATION, EASE_SIGNATURE } from '../../lib/motion'

const BACKEND_LABEL: Record<ShorBackend, string> = {
  honest: 'Honest',
  gate_level: 'Gate-level',
  fast: 'Fast sampler',
  cirq: 'Cirq cross-check',
}

type LaneState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; data: ShorResponse }
  | { status: 'error'; message: string }

/** Every backend option on this page (honest / gate_level / fast / cirq) is a real, independent
 * period-finding implementation -- not four labels pointing at the same code path (see
 * backend/app/routers/shor.py's _PERIOD_FINDERS). So racing them for the same N is a genuine
 * comparison, not theatre: four real requests fire in parallel, each lane fills in as its own
 * request actually resolves, and the fastest *successful* one gets the trophy. All four share one
 * random seed generated per race so they're working from the same shot sequence -- a fair race,
 * not four independent dice rolls. */
export default function BackendRace({
  n,
  aInput,
  availableBackends,
}: {
  n: number
  aInput: string
  availableBackends: ShorBackend[]
}) {
  const [lanes, setLanes] = useState<Partial<Record<ShorBackend, LaneState>>>({})
  const [racing, setRacing] = useState(false)

  const maxElapsed = Math.max(
    0.001,
    ...Object.values(lanes)
      .filter((l): l is { status: 'done'; data: ShorResponse } => l.status === 'done')
      .map((l) => l.data.elapsed_seconds),
  )
  const fastestSucceeded = Object.entries(lanes)
    .filter(([, l]) => l.status === 'done' && l.data.succeeded)
    .sort((a, b) => (a[1] as { data: ShorResponse }).data.elapsed_seconds - (b[1] as { data: ShorResponse }).data.elapsed_seconds)[0]?.[0]

  // Narrates each lane finishing as it happens -- the bars filling in and the trophy landing are
  // silent to a screen reader otherwise, since nothing about this race announces itself without
  // an explicit live region.
  const completedSummary = (Object.entries(lanes) as [ShorBackend, LaneState][])
    .filter(([, l]) => l.status === 'done')
    .map(([backend, l]) => {
      const data = (l as { status: 'done'; data: ShorResponse }).data
      const outcome = data.succeeded ? `factors ${data.factors![0]} × ${data.factors![1]}` : 'no factor found'
      const isWinner = fastestSucceeded === backend
      return `${BACKEND_LABEL[backend]} finished in ${data.elapsed_seconds.toFixed(3)} seconds: ${outcome}${isWinner ? ', fastest so far' : ''}.`
    })
    .join(' ')

  async function startRace() {
    setRacing(true)
    const seed = Math.floor(Math.random() * 1_000_000_000)
    setLanes(Object.fromEntries(availableBackends.map((b) => [b, { status: 'running' } as LaneState])))

    await Promise.allSettled(
      availableBackends.map(async (backend) => {
        try {
          const data = await apiPost<ShorResponse>('/shor/run', {
            n,
            a: aInput.trim() === '' ? null : Number(aInput),
            backend,
            seed,
          })
          setLanes((prev) => ({ ...prev, [backend]: { status: 'done', data } }))
        } catch (err) {
          setLanes((prev) => ({ ...prev, [backend]: { status: 'error', message: err instanceof Error ? err.message : 'Request failed' } }))
        }
      }),
    )
    setRacing(false)
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium text-ink">Backend race</h2>
          <p className="mt-1 max-w-xl text-sm text-ink-muted">
            Fire the same N = {n} at every available backend at once, from the same random seed -- four independent
            period-finding implementations, timed against each other for real.
          </p>
        </div>
        <Button onClick={startRace} loading={racing} disabled={racing}>
          {racing ? 'Racing…' : 'Race all backends'}
        </Button>
      </div>

      <div aria-live="polite" className="sr-only">{completedSummary}</div>

      <div className="mt-5 flex flex-col gap-3">
        {availableBackends.map((backend) => {
          const lane = lanes[backend] ?? { status: 'idle' }
          const isWinner = fastestSucceeded === backend
          const widthPct = lane.status === 'done' ? Math.max(6, (lane.data.elapsed_seconds / maxElapsed) * 100) : 0
          return (
            <div key={backend} className="flex items-center gap-3">
              <div className="flex w-32 shrink-0 items-center gap-1.5 font-mono text-xs text-ink-muted sm:w-36">
                {isWinner && <Trophy className="h-3.5 w-3.5 shrink-0 text-gold" />}
                <span className={isWinner ? 'text-gold-warm' : ''}>{BACKEND_LABEL[backend]}</span>
              </div>
              <div className="relative h-7 min-w-0 flex-1 overflow-hidden rounded-sm border border-line bg-navy">
                {lane.status === 'running' && (
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-violet/25"
                    initial={{ width: '0%' }}
                    animate={{ width: ['0%', '85%'] }}
                    transition={{ duration: 2.2, ease: 'easeOut' }}
                  />
                )}
                {lane.status === 'done' && (
                  <motion.div
                    className={`absolute inset-y-0 left-0 ${lane.data.succeeded ? (isWinner ? 'bg-gold' : 'bg-success/50') : 'bg-ink-muted/30'}`}
                    initial={{ width: '0%' }}
                    animate={{ width: `${widthPct}%` }}
                    transition={{ duration: DURATION.base, ease: EASE_SIGNATURE }}
                  />
                )}
                <div className="relative z-10 flex h-full items-center justify-between px-2.5 font-mono text-xs [text-shadow:0_1px_2px_rgba(7,10,15,0.85)]">
                  <span className="flex items-center gap-1.5 text-ink">
                    {lane.status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
                    {lane.status === 'idle' && 'waiting'}
                    {lane.status === 'error' && <span className="text-red-300">request failed</span>}
                    {lane.status === 'done' &&
                      (lane.data.succeeded
                        ? `${lane.data.factors![0]} × ${lane.data.factors![1]}`
                        : `no factor (${lane.data.attempts.length} attempt${lane.data.attempts.length !== 1 ? 's' : ''})`)}
                  </span>
                  {lane.status === 'done' && (
                    <span className={isWinner ? 'font-semibold text-gold-warm' : 'text-ink'}>{lane.data.elapsed_seconds.toFixed(3)}s</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
