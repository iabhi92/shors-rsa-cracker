import { useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { Loader2, Trophy } from 'lucide-react'
import { apiPost } from '../../api/client'
import type { AttackResponse, ShorResponse } from '../../types/api'
import { Button, Card } from '../ui'
import { DURATION, EASE_SIGNATURE } from '../../lib/motion'

type LaneState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'quantum-done'; data: ShorResponse }
  | { status: 'classical-done'; data: AttackResponse }
  | { status: 'error'; message: string }

/** The honest version of "quantum vs classical" -- not staged to make the quantum side look
 * good. At the toy N this site necessarily uses (see the banner at the top of every page),
 * classical Pollard's rho almost always wins, easily: it's a handful of modular multiplications,
 * while the "quantum" side is a classical statevector simulation of a multi-qubit circuit --
 * more work, not less, at this scale. That's real and worth showing, not hiding: Shor's actual
 * advantage only shows up at key sizes no quantum computer or simulator can reach yet (see
 * Resource Estimation), and the caption below says exactly that instead of staying quiet about
 * an inconvenient result. */
export default function QuantumClassicalRace({ n, aInput }: { n: number; aInput: string }) {
  const [quantum, setQuantum] = useState<LaneState>({ status: 'idle' })
  const [classical, setClassical] = useState<LaneState>({ status: 'idle' })
  const [racing, setRacing] = useState(false)

  async function startRace() {
    setRacing(true)
    setQuantum({ status: 'running' })
    setClassical({ status: 'running' })

    const quantumRun = apiPost<ShorResponse>('/shor/run', {
      n,
      a: aInput.trim() === '' ? null : Number(aInput),
      backend: 'honest',
      seed: null,
    })
      .then((data) => setQuantum({ status: 'quantum-done', data }))
      .catch((err) => setQuantum({ status: 'error', message: err instanceof Error ? err.message : 'Request failed' }))

    const classicalRun = apiPost<AttackResponse>('/classical/attack', { method: 'pollards_rho', n })
      .then((data) => setClassical({ status: 'classical-done', data }))
      .catch((err) => setClassical({ status: 'error', message: err instanceof Error ? err.message : 'Request failed' }))

    await Promise.allSettled([quantumRun, classicalRun])
    setRacing(false)
  }

  const quantumSeconds = quantum.status === 'quantum-done' ? quantum.data.elapsed_seconds : null
  const classicalSeconds = classical.status === 'classical-done' ? classical.data.elapsed_seconds : null
  const bothDone = quantumSeconds !== null && classicalSeconds !== null
  const classicalWon = bothDone && classicalSeconds! <= quantumSeconds!
  const maxSeconds = Math.max(quantumSeconds ?? 0, classicalSeconds ?? 0, 0.001)

  // Narrates each side finishing and the final verdict -- silent progress bars and a trophy icon
  // tell a sighted viewer everything, but nothing here otherwise reaches a screen reader.
  const narration = [
    quantum.status === 'quantum-done' ? `Quantum finished in ${quantumSeconds!.toFixed(4)} seconds.` : '',
    classical.status === 'classical-done' ? `Classical finished in ${classicalSeconds!.toFixed(4)} seconds.` : '',
    bothDone ? (classicalWon ? 'Classical won this race.' : 'Quantum won this race.') : '',
  ]
    .filter(Boolean)
    .join(' ')

  function Lane({
    label,
    state,
    seconds,
    won,
    color,
  }: {
    label: string
    state: LaneState
    seconds: number | null
    won: boolean
    color: string
  }) {
    const widthPct = seconds !== null ? Math.max(6, (seconds / maxSeconds) * 100) : 0
    return (
      <div className="flex items-center gap-3">
        <div className="flex w-36 shrink-0 items-center gap-1.5 font-mono text-xs text-ink-muted sm:w-44">
          {won && <Trophy className="h-3.5 w-3.5 shrink-0 text-gold" />}
          <span className={won ? 'text-gold-warm' : ''}>{label}</span>
        </div>
        <div className="relative h-7 min-w-0 flex-1 overflow-hidden rounded-sm border border-line bg-navy">
          {state.status === 'running' && (
            <motion.div
              className="absolute inset-y-0 left-0"
              style={{ backgroundColor: `${color}40` }}
              initial={{ width: '0%' }}
              animate={{ width: ['0%', '85%'] }}
              transition={{ duration: 2.2, ease: 'easeOut' }}
            />
          )}
          {seconds !== null && (
            <motion.div
              className="absolute inset-y-0 left-0"
              style={{ backgroundColor: won ? '#e3b45e' : color }}
              initial={{ width: '0%' }}
              animate={{ width: `${widthPct}%` }}
              transition={{ duration: DURATION.base, ease: EASE_SIGNATURE }}
            />
          )}
          <div className="relative z-10 flex h-full items-center justify-between px-2.5 font-mono text-xs [text-shadow:0_1px_2px_rgba(7,10,15,0.85)]">
            <span className="flex items-center gap-1.5 text-ink">
              {state.status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
              {state.status === 'idle' && 'waiting'}
              {state.status === 'error' && <span className="text-red-300">request failed</span>}
              {state.status === 'quantum-done' &&
                (state.data.succeeded ? `${state.data.factors![0]} × ${state.data.factors![1]}` : 'no factor found')}
              {state.status === 'classical-done' &&
                (state.data.succeeded ? `${state.data.factor} × ${state.data.other_factor}` : 'no factor found')}
            </span>
            {seconds !== null && <span className="text-ink">{seconds.toFixed(4)}s</span>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium text-ink">Quantum vs. classical</h2>
          <p className="mt-1 max-w-xl text-sm text-ink-muted">
            The honest simulator against Pollard's rho, same N = {n}, at the same time -- no thumb on the scale.
          </p>
        </div>
        <Button onClick={startRace} loading={racing} disabled={racing}>
          {racing ? 'Racing…' : 'Race quantum vs. classical'}
        </Button>
      </div>

      <div aria-live="polite" className="sr-only">{narration}</div>

      <div className="mt-5 flex flex-col gap-3">
        <Lane label="Quantum (honest sim)" state={quantum} seconds={quantumSeconds} won={bothDone && !classicalWon} color="#8065b8" />
        <Lane label="Classical (Pollard's rho)" state={classical} seconds={classicalSeconds} won={bothDone && classicalWon} color="#54c89a" />
      </div>

      {bothDone && (
        <p className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">
          {classicalWon
            ? "Classical won, and at this N it almost always will -- Pollard's rho is a handful of modular multiplications, while the \"quantum\" side is a classical computer simulating an entire multi-qubit statevector, which is more work here, not less."
            : 'Quantum happened to win this run -- unusual at this N, and not the point: the honest comparison only turns in Shor\'s favor at key sizes far beyond what any quantum computer or simulator can reach today.'}{' '}
          See <Link to="/resource-estimate" className="text-gold underline underline-offset-2 hover:text-gold-warm">Resource Estimation</Link> for exactly how big that gap still is.
        </p>
      )}
    </Card>
  )
}
