import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { CheckCircle2, Pause, Play, RotateCcw, SkipForward, Zap } from 'lucide-react'
import { apiPost } from '../../api/client'
import { useAction } from '../../hooks/useApi'
import type { KeygenResponse, ParityOracleResponse } from '../../types/api'
import { Button, Card, ErrorBanner } from '../ui'
import { playTick, playSnap } from '../../lib/sfx'
import CodePanel, { type CodeSnippet } from '../CodePanel'

const SNIPPETS: Record<string, CodeSnippet> = {
  attack: {
    file: 'attacker/parity_oracle.py',
    startLine: 64,
    code:
      '    for i in range(1, bits_needed + 1):\n' +
      '        current_ciphertext = (current_ciphertext * two_e) % n\n' +
      '        bit = oracle(current_ciphertext)\n' +
      '        if bit not in (0, 1):\n' +
      '            raise ValueError(f"oracle must return 0 or 1, got {bit!r}")\n' +
      '        mid = (lo + hi) / 2\n' +
      '        if bit == 0:\n' +
      '            hi = mid\n' +
      '        else:\n' +
      '            lo = mid',
    notes: {
      64: 'One query per bit of N -- a 20-bit key takes 20 queries, total, to fully recover the message.',
      65: 'Multiplies the ciphertext by 2^e mod n each round -- doubles the plaintext without ever decrypting it.',
      66: 'The ONLY information this attack ever receives: one bit per query, never d, never m.',
      69: 'Bit 0 means the doubled value stayed even (no wraparound) -- m was in the lower half.',
      71: 'Bit 1 means it wrapped past the (odd) modulus, flipping parity -- m was in the upper half.',
    },
  },
}

/** The parity/LSB oracle attack: full plaintext recovery using ONLY the public key and a
 * one-bit-per-query oracle, zero access to d -- see attacker/parity_oracle.py's own module
 * docstring for the real math (RSA's multiplicative homomorphism plus any single-bit leak is
 * enough to binary-search out the entire message, in ceil(log2(N)) queries). The "oracle" in
 * this live demo is implemented server-side by actually decrypting with the real private key and
 * returning just the parity bit -- there's no other honest way to *compute* what a real side
 * channel would leak in a simulated demo -- but the attack algorithm itself only ever receives
 * that single bit per call, faithfully reproducing exactly what a real attacker exploiting a real
 * timing/error/cache side channel would see. */
export default function ParityOracleAttack({ keyPair }: { keyPair: KeygenResponse | null }) {
  const [messageInt, setMessageInt] = useState(42)
  const attack = useAction((n: number, e: number, d: number, m: number) =>
    apiPost<ParityOracleResponse>('/security-demo/parity-oracle-attack', { n, e, d, message_int: m }),
  )
  const [stepIndex, setStepIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const data = attack.state.status === 'success' ? attack.state.data : null
  const steps = data?.steps ?? []
  const step = steps[stepIndex]
  const atEnd = stepIndex >= steps.length - 1
  const n = keyPair?.n ?? 1

  useEffect(() => {
    setStepIndex(0)
    setPlaying(data != null)
  }, [data])

  useEffect(() => {
    if (!playing || !data) return
    if (atEnd) {
      setPlaying(false)
      if (data.matches_original) playSnap()
      return
    }
    timerRef.current = setTimeout(() => {
      setStepIndex((i) => Math.min(i + 1, steps.length - 1))
      playTick()
    }, 260)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [playing, stepIndex, data, atEnd, steps.length])

  return (
    <Card className="mt-6 border-violet/30">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-violet" />
        <h2 className="font-medium text-ink">4. The parity oracle attack: full recovery, zero private key</h2>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        RSA is multiplicatively homomorphic, so an attacker who can learn just the <em>parity</em> (one bit) of the
        decrypted plaintext for a chosen ciphertext -- from a timing gap, a distinct error page, anything that
        collapses to one bit -- can binary-search out the <strong className="text-ink">entire message</strong>, using
        only the public key, in ceil(log2(N)) queries. No d. No brute force. No guessing.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Secret message (integer, 0 &le; m &lt; N)
          <input
            type="number"
            min={0}
            max={n - 1}
            value={messageInt}
            onChange={(e) => setMessageInt(Number(e.target.value))}
            className="focus-ring w-40 rounded-sm border border-line bg-navy px-3 py-1.5 text-ink"
          />
        </label>
        <Button
          onClick={() => keyPair && attack.run(keyPair.n, keyPair.e, keyPair.d, messageInt)}
          disabled={!keyPair}
          loading={attack.state.status === 'loading'}
        >
          Run the attack
        </Button>
      </div>
      {!keyPair && <p className="mt-2 text-xs text-ink-muted">Generate a keypair above first.</p>}
      {attack.state.status === 'error' && (
        <div className="mt-3">
          <ErrorBanner message={attack.state.message} />
        </div>
      )}

      {data && step && (
        <div className="mt-5 flex flex-col gap-4">
          <div className="rounded-sm border border-line bg-navy p-4">
            <p className="mb-2 text-center font-mono text-xs text-ink-muted">
              query {step.query_number} of {data.total_queries} -- oracle says the plaintext is currently{' '}
              <span className={step.oracle_bit === 0 ? 'text-success' : 'text-gold-warm'}>
                {step.oracle_bit === 0 ? 'even' : 'odd'}
              </span>
            </p>
            <div className="relative h-8 w-full overflow-hidden rounded-sm bg-line/30">
              <span className="absolute inset-y-0 left-1 z-10 flex items-center font-mono text-[0.6rem] text-ink-muted">0</span>
              <span className="absolute inset-y-0 right-1 z-10 flex items-center font-mono text-[0.6rem] text-ink-muted">N</span>
              <motion.div
                className="absolute inset-y-0 bg-violet/50"
                animate={{ left: `${(step.lo / n) * 100}%`, right: `${100 - (step.hi / n) * 100}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>
            <p className="mt-2 text-center font-mono text-xs text-ink-muted">
              interval narrowed to [{step.lo.toLocaleString()}, {step.hi.toLocaleString()})
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-xs text-ink-muted">step {stepIndex + 1} of {steps.length}</span>
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
                  setStepIndex(steps.length - 1)
                }}
                className="focus-ring rounded-sm border border-line p-1.5 text-ink-muted transition-colors hover:border-ink-muted hover:text-ink"
                aria-label="Skip to end"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            </div>
          </div>

          {atEnd && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`flex items-center justify-center gap-2 rounded-sm border p-3 text-center font-mono text-sm ${
                data.matches_original ? 'border-success/40 bg-success/10 text-success' : 'border-line bg-navy text-ink-muted'
              }`}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              recovered m = {data.recovered_message} in {data.total_queries} oracle queries -- matches the real
              secret ({data.original_message}): {data.matches_original ? 'yes' : 'no'}. d was never touched.
            </motion.div>
          )}
        </div>
      )}

      <div className="mt-4">
        <h3 className="mb-2 font-mono text-xs font-semibold tracking-wide text-ink-muted uppercase">
          The actual attack code
        </h3>
        <CodePanel stageId="attack" snippets={SNIPPETS} />
      </div>
    </Card>
  )
}
