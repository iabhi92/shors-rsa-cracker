import { useState } from 'react'
import { motion } from 'motion/react'
import { CheckCircle2, Radiation } from 'lucide-react'
import { apiPost } from '../../api/client'
import { useAction } from '../../hooks/useApi'
import type { CrtFaultAttackResponse, CrtFaultScenarioResponse } from '../../types/api'
import { Button, Card, ErrorBanner } from '../ui'
import { playTamper } from '../../lib/sfx'
import CodePanel, { type CodeSnippet } from '../CodePanel'

const SNIPPETS: Record<string, CodeSnippet> = {
  attack: {
    file: 'attacker/crt_fault.py',
    startLine: 100,
    code:
      'def crt_fault_attack(n: int, e: int, message: int, faulty_signature: int) -> CrtFaultResult:\n' +
      '    candidate = (pow(faulty_signature, e, n) - message) % n\n' +
      '    factor = math.gcd(candidate, n)\n' +
      '    if factor in (0, 1, n):\n' +
      '        return CrtFaultResult(succeeded=False, recovered_p=None, recovered_q=None)\n' +
      '    other = n // factor\n' +
      '    p, q = sorted((factor, other))\n' +
      '    return CrtFaultResult(succeeded=True, recovered_p=p, recovered_q=q)',
    notes: {
      100: 'Only n, e, the message, and the ONE faulty signature ever come in -- no d, no p, no q.',
      101: "s'^e - m is 0 mod whichever prime the fault did NOT touch, and (almost certainly) nonzero mod the one it did.",
      102: 'One gcd call. That\'s the entire attack -- no search, no brute force, no queries.',
      104: 'A wrong gcd (0, 1, or n itself) means the input wasn\'t actually a faulted signature -- reported honestly, not forced to succeed.',
      108: 'The gcd IS the prime factor -- n divided by it is the other one.',
    },
  },
}

/** RSA-CRT fault/glitch injection (Boneh-DeMillo-Lipton, 1997): unlike every other attack on
 * this page, this one needs nothing unusual about the key at all -- see attacker/crt_fault.py's
 * own module docstring for why a single hardware fault during ONE branch of ordinary CRT-
 * optimized signing (the ~4x speedup almost every real RSA implementation uses) is enough to
 * factor n outright. The scenario below signs the same message twice with a completely normal
 * key -- once correctly, once with a fault injected into a randomly-chosen branch -- and the
 * attack itself only ever receives the public key, the message, and that one faulty signature. */
export default function CrtFaultInjectionDemo() {
  const [bits, setBits] = useState(128)
  const scenario = useAction((b: number) => apiPost<CrtFaultScenarioResponse>('/security-demo/crt-fault-scenario', { bits: b }))
  const attack = useAction((n: string, e: string, message: string, faultySignature: string) =>
    apiPost<CrtFaultAttackResponse>('/security-demo/crt-fault-attack', { n, e, message, faulty_signature: faultySignature }),
  )

  const s = scenario.state.status === 'success' ? scenario.state.data : null
  const result = attack.state.status === 'success' ? attack.state.data : null

  const runAttack = async () => {
    if (!s) return
    const r = await attack.run(s.n, s.e, s.message, s.faulty_signature)
    if (r?.succeeded) playTamper()
  }

  return (
    <Card className="mt-6 border-red-500/30">
      <div className="flex items-center gap-2">
        <Radiation className="h-4 w-4 text-red-300" />
        <h2 className="font-medium text-ink">6. Fault injection: one glitched bit factors a completely normal key</h2>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        Real-world RSA signing almost always uses the CRT speedup (~4x faster than plain modular exponentiation):
        sign separately mod <em>p</em> and mod <em>q</em>, then recombine. No weak key, no small exponent, nothing
        unusual required -- if a single physical fault (a voltage glitch, a laser pulse, a stray cosmic ray, all
        documented against real smart cards and TPMs) corrupts just <strong className="text-ink">one</strong> of
        those two branches, the resulting signature leaks a full factor of <em>n</em> via one gcd computation.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Modulus size (bits)
          <input
            type="number"
            min={32}
            max={256}
            step={32}
            value={bits}
            onChange={(e) => setBits(Number(e.target.value))}
            className="focus-ring w-32 rounded-sm border border-line bg-navy px-3 py-1.5 text-ink"
          />
        </label>
        <Button onClick={() => scenario.run(bits)} loading={scenario.state.status === 'loading'}>
          Sign a message -- with a fault injected
        </Button>
      </div>
      {scenario.state.status === 'error' && (
        <div className="mt-3">
          <ErrorBanner message={scenario.state.message} />
        </div>
      )}

      {s && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 rounded-sm border border-line bg-navy p-4 sm:grid-cols-4">
            <Stat label="N size" value={`${s.n_bits} bits`} />
            <Stat label="Faulted branch" value={`mod ${s.faulted_branch}`} warn />
            <Stat label="Special key needed?" value="no" />
            <Stat label="Signatures leaked" value="1 (faulty only)" />
          </div>
          <p className="font-mono text-xs break-all text-ink-muted">n = {s.n}</p>
          <p className="font-mono text-xs break-all text-ink-muted">message = {s.message}</p>
          <p className="font-mono text-xs break-all text-ink-muted">
            correct signature = {s.correct_signature} <span className="text-ink-muted/60">(never sent to the attack)</span>
          </p>
          <p className="font-mono text-xs break-all text-gold-warm">faulty signature = {s.faulty_signature}</p>

          <div>
            <Button onClick={runAttack} loading={attack.state.status === 'loading'}>
              Run the attack -- from n, e, message, and the faulty signature alone
            </Button>
            <p className="mt-1 text-xs text-ink-muted">d, p, and q are held back client-side from this point on.</p>
          </div>
        </div>
      )}
      {attack.state.status === 'error' && (
        <div className="mt-3">
          <ErrorBanner message={attack.state.message} />
        </div>
      )}

      {result && s && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-4 rounded-sm border p-4 text-sm ${
            result.succeeded ? 'border-red-500/40 bg-red-500/10' : 'border-line bg-navy'
          }`}
        >
          {result.succeeded ? (
            <>
              <div className="flex items-center gap-2 font-mono text-red-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                full factorization recovered from one faulty signature
              </div>
              <div className="mt-2 grid gap-1 font-mono text-xs break-all text-ink-muted">
                <span>
                  recovered p, q = {result.recovered_p}, {result.recovered_q}{' '}
                  <span
                    className={
                      new Set([result.recovered_p, result.recovered_q]).has(s.p) &&
                      new Set([result.recovered_p, result.recovered_q]).has(s.q)
                        ? 'text-success'
                        : 'text-red-300'
                    }
                  >
                    ({new Set([result.recovered_p, result.recovered_q]).has(s.p) &&
                    new Set([result.recovered_p, result.recovered_q]).has(s.q)
                      ? 'matches the real factorization'
                      : 'MISMATCH'})
                  </span>
                </span>
              </div>
            </>
          ) : (
            <span className="font-mono text-ink-muted">
              attack failed -- that signature wasn't actually faulted (or the fault happened to cancel out)
            </span>
          )}
        </motion.div>
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

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[0.65rem] tracking-wide text-ink-muted uppercase">{label}</span>
      <span className={`font-mono text-sm ${warn ? 'text-gold-warm' : 'text-ink'}`}>{value}</span>
    </div>
  )
}
