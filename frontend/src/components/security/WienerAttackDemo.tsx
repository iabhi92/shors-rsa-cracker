import { useState } from 'react'
import { motion } from 'motion/react'
import { CheckCircle2, KeyRound, ShieldAlert } from 'lucide-react'
import { apiPost } from '../../api/client'
import { useAction } from '../../hooks/useApi'
import type { WienerAttackResponse, WienerKeygenResponse } from '../../types/api'
import { Button, Card, ErrorBanner } from '../ui'
import { playSnap } from '../../lib/sfx'
import CodePanel, { type CodeSnippet } from '../CodePanel'

const SNIPPETS: Record<string, CodeSnippet> = {
  attack: {
    file: 'attacker/wiener.py',
    startLine: 37,
    code:
      'def wiener_attack(n: int, e: int) -> WienerResult:\n' +
      '    convergents = continued_fraction_convergents(e, n)\n' +
      '    for i, frac in enumerate(convergents):\n' +
      '        k, d = frac.numerator, frac.denominator\n' +
      '        if k == 0 or d == 0 or (e * d - 1) % k != 0:\n' +
      '            continue\n' +
      '        phi_candidate = (e * d - 1) // k\n' +
      '        s = n - phi_candidate + 1  # p + q, if this convergent is the right one\n' +
      '        discriminant = s * s - 4 * n\n' +
      '        if discriminant < 0:\n' +
      '            continue\n' +
      '        sqrt_disc = math.isqrt(discriminant)\n' +
      '        if sqrt_disc * sqrt_disc != discriminant:\n' +
      '            continue\n' +
      '        p, q = (s + sqrt_disc) // 2, (s - sqrt_disc) // 2\n' +
      '        if p > 1 and q > 1 and p * q == n:\n' +
      '            return WienerResult(True, d, p, q, i + 1, len(convergents))\n' +
      '    return WienerResult(False, None, None, None, len(convergents), len(convergents))',
    notes: {
      37: 'Only n and e ever come in -- the same continued_fraction_convergents used to turn a noisy Shor measurement into a period.',
      38: 'Every convergent of e/N is a candidate (k, d) pair -- most fail instantly, cheaply, below.',
      44: 'phi(N) = (ed-1)/k, if this convergent is the right one -- an integer test that almost always fails for a wrong guess.',
      49: 'p+q and p*q are both known once phi(N) is known, so p and q are just roots of a quadratic.',
      55: 'A perfect-square discriminant is the real signal: the convergent produced an actual factorization.',
      56: 'This is the only place p, q are ever computed -- straight from N and the recovered phi(N).',
    },
  },
}

/** Wiener's attack (1990): a classical, non-quantum attack that recovers RSA's ENTIRE private
 * key -- d, p, and q, not just one message -- from nothing but the public key (n, e), whenever d
 * was chosen too small. See attacker/wiener.py's own module docstring for why: e*d - 1 = k*phi(N)
 * means e/N sits suspiciously close to k/d, close enough that a small d makes k/d fall out
 * directly as one of e/N's continued-fraction convergents. This demo generates a REAL, valid RSA
 * keypair deliberately built with a too-small d (generate_wiener_vulnerable_keypair), then runs
 * the attack against only n and e -- the request to /wiener-attack never includes d or p/q at
 * all, faithfully matching what a real attacker holding just the public key would have. */
export default function WienerAttackDemo() {
  const [bits, setBits] = useState(128)
  const keygen = useAction((b: number) => apiPost<WienerKeygenResponse>('/security-demo/wiener-keygen', { bits: b }))
  const attack = useAction((n: string, e: string) =>
    apiPost<WienerAttackResponse>('/security-demo/wiener-attack', { n, e }),
  )

  const key = keygen.state.status === 'success' ? keygen.state.data : null
  const result = attack.state.status === 'success' ? attack.state.data : null

  const runAttack = async () => {
    if (!key) return
    const r = await attack.run(key.n, key.e)
    if (r?.succeeded) playSnap()
  }

  return (
    <Card className="mt-6 border-red-500/30">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-red-300" />
        <h2 className="font-medium text-ink">5. Wiener's attack: a classical break of the whole private key</h2>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        No quantum computer, no oracle, no chosen ciphertexts -- just number theory. If a key was ever generated with
        an abnormally small private exponent <code className="text-ink">d</code> (roughly{' '}
        <code className="text-ink">d &lt; N^0.25 / 3</code>), the continued-fraction expansion of{' '}
        <code className="text-ink">e/N</code> leaks <code className="text-ink">d</code> outright -- and from{' '}
        <code className="text-ink">d</code>, the full factorization <code className="text-ink">p, q</code>.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Modulus size (bits)
          <input
            type="number"
            min={32}
            max={512}
            step={32}
            value={bits}
            onChange={(e) => setBits(Number(e.target.value))}
            className="focus-ring w-32 rounded-sm border border-line bg-navy px-3 py-1.5 text-ink"
          />
        </label>
        <Button onClick={() => keygen.run(bits)} loading={keygen.state.status === 'loading'}>
          <KeyRound className="mr-1.5 h-4 w-4" />
          Generate a vulnerable key
        </Button>
      </div>
      {keygen.state.status === 'error' && (
        <div className="mt-3">
          <ErrorBanner message={keygen.state.message} />
        </div>
      )}

      {key && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 rounded-sm border border-line bg-navy p-4 sm:grid-cols-4">
            <Stat label="N size" value={`${key.n_bits} bits`} />
            <Stat label="d size" value={`${key.d_bits} bits`} warn />
            <Stat label="Wiener bound" value={`< ${key.wiener_bound_bits.toFixed(1)} bits`} />
            <Stat label="Vulnerable?" value={key.d_bits < key.wiener_bound_bits ? 'yes' : 'no'} warn />
          </div>
          <p className="font-mono text-xs break-all text-ink-muted">n = {key.n}</p>
          <p className="font-mono text-xs break-all text-ink-muted">e = {key.e}</p>

          <div>
            <Button onClick={runAttack} loading={attack.state.status === 'loading'}>
              Run the attack -- from n and e alone
            </Button>
            <p className="mt-1 text-xs text-ink-muted">
              d, p, and q are held back client-side from this point on -- only n and e are sent to the attack.
            </p>
          </div>
        </div>
      )}
      {attack.state.status === 'error' && (
        <div className="mt-3">
          <ErrorBanner message={attack.state.message} />
        </div>
      )}

      {result && key && (
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
                full private key recovered in {result.convergents_tried} of {result.total_convergents} convergents
                tried
              </div>
              <div className="mt-2 grid gap-1 font-mono text-xs break-all text-ink-muted">
                <span>
                  recovered d = {result.recovered_d}{' '}
                  <span className={result.recovered_d === key.d ? 'text-success' : 'text-red-300'}>
                    ({result.recovered_d === key.d ? 'matches the real key' : 'MISMATCH'})
                  </span>
                </span>
                <span>
                  recovered p, q = {result.recovered_p}, {result.recovered_q}{' '}
                  <span
                    className={
                      new Set([result.recovered_p, result.recovered_q]).has(key.p) &&
                      new Set([result.recovered_p, result.recovered_q]).has(key.q)
                        ? 'text-success'
                        : 'text-red-300'
                    }
                  >
                    ({new Set([result.recovered_p, result.recovered_q]).has(key.p) &&
                    new Set([result.recovered_p, result.recovered_q]).has(key.q)
                      ? 'matches the real factorization'
                      : 'MISMATCH'})
                  </span>
                </span>
              </div>
            </>
          ) : (
            <span className="font-mono text-ink-muted">
              attack failed after trying all {result.total_convergents} convergents -- this key's d was not
              small enough to be Wiener-vulnerable
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
