import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { CheckCircle2, Circle } from 'lucide-react'
import { apiPost, ApiError } from '../api/client'
import { useAction } from '../hooks/useApi'
import type { DecryptResponse, EncryptResponse, KeygenResponse, MalleabilityResponse, OaepKeygenResponse, TamperResponse } from '../types/api'
import { Button, Card, CodeBlock, ErrorBanner, PageHeader, WarningBanner } from '../components/ui'
import CodePanel, { type CodeSnippet } from '../components/CodePanel'
import ParityOracleAttack from '../components/security/ParityOracleAttack'
import WienerAttackDemo from '../components/security/WienerAttackDemo'
import CrtFaultInjectionDemo from '../components/security/CrtFaultInjectionDemo'
import { playKeygen, playTamper } from '../lib/sfx'

// Copied verbatim from this repository's own backend/app/routers/security_demo.py -- the exact
// live attack code each section's "Run attack" button actually calls.
const MALLEABILITY_SNIPPETS: Record<string, CodeSnippet> = {
  attack: {
    file: 'backend/app/routers/security_demo.py',
    startLine: 118,
    code: 's_pow_e = pow(req.blind_factor, req.e, req.n)\nc_tampered = (c * s_pow_e) % req.n',
    notes: {
      118: 'The attacker only ever needs (n, e) and the intercepted ciphertext c -- never d, never m.',
      119: 'This one multiplication is the entire attack: (m^e)(s^e) = (ms)^e mod n, by plain exponent rules.',
    },
  },
}
// Copied verbatim from this repository's own rsa/oaep.py -- the actual structural check that
// makes the tampered ciphertext detectable once OAEP padding is in place.
const OAEP_SNIPPETS: Record<string, CodeSnippet> = {
  attack: {
    file: 'rsa/oaep.py',
    startLine: 98,
    code:
      '    valid_leading_byte = y == 0\n' +
      '    valid_l_hash = hmac.compare_digest(db_l_hash, l_hash)\n' +
      '    separator_index = rest.find(b"\\x01")\n' +
      '    valid_separator = separator_index != -1 and rest[:separator_index] == b"\\x00" * separator_index\n' +
      '\n' +
      '    if not (valid_leading_byte and valid_l_hash and valid_separator):\n' +
      '        raise OaepError("invalid OAEP padding (corrupted ciphertext, wrong key, or tampering)")',
    notes: {
      98: 'A tampered ciphertext decrypts to essentially random bytes -- this leading byte is almost never 0.',
      99: 'compare_digest, not ==, so a mismatch here doesn\'t leak timing information about how it failed.',
      100: 'Looks for the 0x01 byte marking the boundary between the zero-padding and the real message.',
      101: 'Everything before the 0x01 must be all zero bytes -- one more structural coincidence tampering breaks.',
      103: 'All four checks run regardless of which one already failed -- no early-exit that could leak which check tripped.',
      104: 'One generic error either way -- distinguishing *why* it failed is exactly what a padding-oracle attack exploits.',
    },
  },
}
const SPLICE_SNIPPETS: Record<string, CodeSnippet> = {
  attack: {
    file: 'backend/app/routers/security_demo.py',
    startLine: 216,
    code: 'forged_ciphertext_block = encrypt_int(int.from_bytes(forged_bytes_padded, "big"), pub)',
    notes: {
      216: 'Built entirely from the public key -- the attacker never sees d or the real block this replaces.',
    },
  },
}
import {
  BlockSubstitutionVisual,
  MalleabilityVisual,
  OaepMalleabilityVisual,
  PaddingCaseStudyVisual,
  type PaddingCaseStudyOutcome,
} from '../components/security/SecurityLabVisuals'

type Completed = { malleability: boolean; splice: boolean; padding: boolean }
const SCORECARD_ROWS: { key: keyof Completed; label: string; done: string }[] = [
  { key: 'malleability', label: 'Multiplicative malleability', done: 'Recovered plaintext controlled without ever seeing d.' },
  { key: 'splice', label: 'Block substitution (splicing)', done: 'A forged block decrypted cleanly alongside the genuine ones.' },
  { key: 'padding', label: 'PKCS7 padding case study', done: 'Watched a corrupted block take the real validation code\'s actual branch.' },
]

/** Ties the three otherwise-separate demo cards together into one closing tally -- each is a
 * real, independent attack, but the point they're all making is the same one: every single
 * one only ever needed the public key and an intercepted ciphertext. Seeing that stated three
 * times in a row as a running count lands harder than three isolated success banners do. */
function Scorecard({ completed }: { completed: Completed }) {
  const doneCount = Object.values(completed).filter(Boolean).length
  if (doneCount === 0) return null

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-sm border border-gold/30 bg-gold/5 p-5">
      <h2 className="font-mono text-sm font-semibold text-gold-warm">
        {doneCount} of {SCORECARD_ROWS.length} attacks demonstrated -- 0 uses of the private key d
      </h2>
      <ul className="mt-3 space-y-2">
        {SCORECARD_ROWS.map((row) => {
          const done = completed[row.key]
          return (
            <li key={row.key} className="flex items-start gap-2.5 font-mono text-xs">
              {done ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted/40" />
              )}
              <span className={done ? 'text-ink' : 'text-ink-muted/60'}>
                <span className="font-semibold">{row.label}</span>
                {done && <span className="text-ink-muted"> -- {row.done}</span>}
              </span>
            </li>
          )
        })}
      </ul>
      {doneCount === SCORECARD_ROWS.length && (
        <p className="mt-3 font-mono text-xs text-ink-muted">
          Three different mechanisms, one shared cause: textbook RSA has no integrity check on the
          ciphertext. A MAC, an AEAD construction, or OAEP-with-authentication closes every one of
          these at once -- see{' '}
          <Link to="/security" className="text-gold underline underline-offset-2">Security &amp; Limitations</Link>.
        </p>
      )}
    </motion.div>
  )
}

export default function SecurityLabPage() {
  const [bits, setBits] = useState(24)
  const keygen = useAction(() => apiPost<KeygenResponse>('/rsa/keygen', { bits }))
  const key = keygen.state.status === 'success' ? keygen.state.data : null
  const [completed, setCompleted] = useState<Completed>({ malleability: false, splice: false, padding: false })

  // A demo "completed" against the previous key shouldn't keep counting once that key is gone --
  // same reasoning as each section's own stale-result reset effect below.
  useEffect(() => {
    setCompleted({ malleability: false, splice: false, padding: false })
  }, [key])

  useEffect(() => {
    if (keygen.state.status === 'success') playKeygen()
  }, [keygen.state.status])

  // Stable identities, not inline arrows: each section's own effect depends on its `onSucceed`
  // prop, and a fresh function reference every parent render (which setCompleted triggers) would
  // make that effect re-fire every time regardless of whether `result` actually changed --
  // setCompleted -> re-render -> new prop -> effect fires -> setCompleted -> re-render -> ...,
  // an infinite loop caught before it ever ran once live.
  const onMalleabilitySucceed = useCallback(() => setCompleted((c) => (c.malleability ? c : { ...c, malleability: true })), [])
  const onSpliceSucceed = useCallback(() => setCompleted((c) => (c.splice ? c : { ...c, splice: true })), [])
  const onPaddingSucceed = useCallback(() => setCompleted((c) => (c.padding ? c : { ...c, padding: true })), [])

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Attacks that never touch the private key"
        title="Malleability & Tampering Lab"
        description="Textbook RSA (rsa/core.py) has no ciphertext integrity check -- no MAC, no AEAD. Each demo below breaks that in a different, real way using this project's actual encrypt/decrypt code, and each is backed by a passing test in backend/tests/test_security_demo.py and tests/test_rsa.py."
      />

      <WarningBanner>
        Every attack here needs only the <strong>public</strong> key and an intercepted
        ciphertext -- none of them touch the private key d. That's the point: this is exactly
        what a network eavesdropper could do.
      </WarningBanner>

      <Card className="mt-6">
        <h2 className="font-medium text-ink">0. Generate a keypair to attack</h2>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            Modulus size (bits)
            <input
              type="number"
              min={8}
              max={24}
              value={bits}
              onChange={(e) => setBits(Number(e.target.value))}
              className="focus-ring w-28 rounded-sm border border-line bg-navy px-3 py-1.5 text-ink"
            />
          </label>
          <Button onClick={() => keygen.run()} loading={keygen.state.status === 'loading'}>
            Generate keypair
          </Button>
        </div>
        {keygen.state.status === 'error' && (
          <div className="mt-3">
            <ErrorBanner message={keygen.state.message} />
          </div>
        )}
        {key && (
          <p className="mt-3 font-mono text-xs text-ink-muted">
            N={key.n} · e={key.e} · d={key.d}{' '}
            <span className="text-ink-muted">(shown only because this is a teaching demo)</span>
          </p>
        )}
      </Card>

      <MalleabilitySection keyPair={key} onSucceed={onMalleabilitySucceed} />
      <BlockSubstitutionSection keyPair={key} onSucceed={onSpliceSucceed} />
      <PaddingCaseStudySection keyPair={key} onSucceed={onPaddingSucceed} />
      <ParityOracleAttack keyPair={key} />
      <WienerAttackDemo />
      <CrtFaultInjectionDemo />
      <Scorecard completed={completed} />
    </div>
  )
}

function MalleabilitySection({ keyPair, onSucceed }: { keyPair: KeygenResponse | null; onSucceed: () => void }) {
  const [messageInt, setMessageInt] = useState(7)
  const [blindFactor, setBlindFactor] = useState(3)
  const [useOaep, setUseOaep] = useState(false)

  // OAEP with SHA-256 needs a modulus of at least 528 bits -- nowhere near what this page's
  // shared 8-24 bit teaching key can offer -- so the toggle gets its own real, larger keypair
  // via a dedicated endpoint (see backend/app/routers/security_demo.py's oaep_keygen, which
  // deliberately does NOT relax the site-wide 24-bit cap on the general /rsa/keygen endpoint).
  const oaepKeygen = useAction(() => apiPost<OaepKeygenResponse>('/security-demo/oaep-keygen'))
  const oaepKeyPair = oaepKeygen.state.status === 'success' ? oaepKeygen.state.data : null
  const activeKeyPair: { n: string | number; e: string | number; d: string | number } | null = useOaep ? oaepKeyPair : keyPair

  const attack = useAction((n: string | number, e: string | number, d: string | number) =>
    apiPost<MalleabilityResponse>('/security-demo/malleability', {
      n,
      e,
      d,
      message_int: messageInt,
      blind_factor: blindFactor,
      use_oaep: useOaep,
    }),
  )
  // A result computed under the previous key (or the previous OAEP toggle state) must not
  // survive a keypair regeneration or a toggle flip: it was caught live doing exactly that --
  // the leftover result kept rendering while `keyPair` (and so the `n` MalleabilityVisual
  // divides by) transiently went null during the new keygen's loading state, throwing
  // `RangeError: Division by zero` out of client-side modPow. `attack` is deliberately not in
  // the deps array: it's a fresh object every render (new `run`/`reset` each time from
  // useAction), so depending on it would reset on every keystroke instead of only when the key
  // itself changes. oxlint still flags this (its disable-next-line directive doesn't suppress
  // this particular sub-check), consistent with the two pre-existing exhaustive-deps warnings
  // already in useApi.ts for the same reason.
  useEffect(() => {
    attack.reset()
  }, [keyPair, oaepKeyPair, useOaep])

  useEffect(() => {
    if (attack.state.status === 'success') playTamper()
  }, [attack.state.status])
  // Gated on `activeKeyPair` itself, not just `attack.state`: the moment a new keygen starts,
  // the relevant keypair goes null *in that same render* (before the reset effect below even
  // runs), and a stale success result rendered against a null/mismatched key is exactly what
  // crashed MalleabilityVisual (n=0 hit its client-side modPow's BigInt modulo). Nulling result
  // here is synchronous with that same render, so there's no crash window to close after the
  // fact.
  const result = activeKeyPair && attack.state.status === 'success' ? attack.state.data : null
  useEffect(() => {
    if (result) onSucceed()
  }, [result, onSucceed])

  return (
    <Card className="mt-6">
      <h2 className="font-medium text-ink">1. Multiplicative malleability</h2>
      <p className="mt-1 text-sm text-ink-muted">
        RSA encryption is a homomorphism: (m^e)(s^e) &equiv; (m&middot;s)^e (mod N). An
        attacker who intercepts c = m^e mod N can multiply in any blinding factor s of their
        choosing -- without ever seeing m or d -- and the victim's decryption comes back as
        m&middot;s mod N.
      </p>

      <label className="mt-3 flex items-start gap-2 text-sm text-ink-muted">
        <input
          type="checkbox"
          checked={useOaep}
          onChange={(e) => setUseOaep(e.target.checked)}
          className="focus-ring mt-0.5 h-4 w-4 rounded-sm border-line bg-navy accent-gold"
        />
        <span>
          Use real OAEP padding -- does the attack above still work once RSA is wrapped the way
          it actually ships in production?
        </span>
      </label>

      {useOaep && (
        <div className="mt-2 flex flex-wrap items-center gap-3 rounded-sm border border-line bg-navy p-3">
          <Button onClick={() => oaepKeygen.run()} loading={oaepKeygen.state.status === 'loading'}>
            {oaepKeyPair ? 'Regenerate real 1024-bit OAEP keypair' : 'Generate a real 1024-bit OAEP keypair'}
          </Button>
          {oaepKeygen.state.status === 'error' && <ErrorBanner message={oaepKeygen.state.message} />}
          {oaepKeyPair && (
            <span className="font-mono text-xs text-ink-muted">
              n = {oaepKeyPair.n.slice(0, 8)}&hellip;{oaepKeyPair.n.slice(-6)} ({oaepKeyPair.n_bits} bits -- real, not intentionally weak)
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Secret message (integer, 0 &le; m &lt; N)
          <input
            type="number"
            min={0}
            value={messageInt}
            onChange={(e) => setMessageInt(Number(e.target.value))}
            className="focus-ring w-40 rounded-sm border border-line bg-navy px-3 py-1.5 text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Attacker's blinding factor s
          <input
            type="number"
            min={2}
            value={blindFactor}
            onChange={(e) => setBlindFactor(Number(e.target.value))}
            className="focus-ring w-32 rounded-sm border border-line bg-navy px-3 py-1.5 text-ink"
          />
        </label>
        <Button
          onClick={() => activeKeyPair && attack.run(activeKeyPair.n, activeKeyPair.e, activeKeyPair.d)}
          disabled={!activeKeyPair}
          loading={attack.state.status === 'loading'}
        >
          Run attack
        </Button>
      </div>
      {!activeKeyPair && (
        <p className="mt-2 text-xs text-ink-muted">
          {useOaep ? 'Generate a real OAEP-capable keypair above first.' : 'Generate a keypair above first.'}
        </p>
      )}
      {attack.state.status === 'error' && (
        <div className="mt-3">
          <ErrorBanner message={attack.state.message} />
        </div>
      )}
      <div className="mt-4">
        {useOaep ? (
          <OaepMalleabilityVisual blindFactor={blindFactor} result={result} />
        ) : (
          <MalleabilityVisual n={keyPair?.n ?? 0} e={keyPair?.e ?? 0} messageInt={messageInt} blindFactor={blindFactor} result={result} />
        )}
      </div>
      <div className="mt-4">
        <h3 className="mb-2 font-mono text-xs font-semibold tracking-wide text-ink-muted uppercase">
          The actual attack code
        </h3>
        <CodePanel stageId="attack" snippets={MALLEABILITY_SNIPPETS} />
      </div>
      {useOaep && (
        <div className="mt-4">
          <h3 className="mb-2 font-mono text-xs font-semibold tracking-wide text-ink-muted uppercase">
            The code that catches it
          </h3>
          <CodePanel stageId="attack" snippets={OAEP_SNIPPETS} />
        </div>
      )}
    </Card>
  )
}

// Mirrors rsa/core.py's real _block_size/_pkcs7_pad math exactly (not an approximation) so the
// block-index picker below can show a real, live-updating valid range as you type, instead of
// only finding out it was out of range after a 400 comes back from the actual attack request.
function estimateBlocks(n: number, message: string): { blockSize: number; totalBlocks: number } | null {
  if (n <= 0) return null
  const blockSize = Math.floor((n.toString(2).length - 1) / 8)
  if (blockSize <= 0) return null
  const messageBytes = new TextEncoder().encode(message).length
  const padLen = blockSize - (messageBytes % blockSize)
  const totalBlocks = Math.ceil((messageBytes + padLen) / blockSize)
  return { blockSize, totalBlocks }
}

function BlockSubstitutionSection({ keyPair, onSucceed }: { keyPair: KeygenResponse | null; onSucceed: () => void }) {
  const [message, setMessage] = useState('Transfer $10 to Alice, ref #4471')
  const [forgedText, setForgedText] = useState('X')
  const [blockIndex, setBlockIndex] = useState(0)
  const estimate = keyPair ? estimateBlocks(keyPair.n, message) : null
  // The final block always carries PKCS7 padding metadata (see backend's own rejection of it) --
  // valid targets are every block except the last.
  const maxBlockIndex = estimate ? Math.max(0, estimate.totalBlocks - 2) : 0
  // Keeps the visible input in sync with reality as the message changes -- typing a shorter
  // message after picking block 3 shouldn't silently leave "3" showing in a now-invalid field.
  useEffect(() => {
    setBlockIndex((i) => Math.min(i, maxBlockIndex))
  }, [maxBlockIndex])
  const attack = useAction((n: number, e: number, d: number) =>
    apiPost<TamperResponse>('/security-demo/tamper', {
      n,
      e,
      d,
      message,
      block_index: Math.min(blockIndex, maxBlockIndex),
      forged_block_text: forgedText,
    }),
  )
  // See MalleabilitySection's identical effect (and its comment on the `attack` dep warning):
  // a result from the previous key must not outlive a keypair regeneration.
  useEffect(() => {
    attack.reset()
  }, [keyPair])

  useEffect(() => {
    if (attack.state.status === 'success') playTamper()
  }, [attack.state.status])
  // Gated on `keyPair` itself, not just `attack.state`: the moment a new keygen starts,
  // `keyPair` goes null *in that same render* (before the reset effect below even runs), and a
  // stale success result rendered against a null/mismatched key is exactly what crashed
  // MalleabilityVisual (n=0 hit its client-side modPow's BigInt modulo). Nulling result here is
  // synchronous with that same render, so there's no crash window to close after the fact.
  const result = keyPair && attack.state.status === 'success' ? attack.state.data : null
  useEffect(() => {
    if (result) onSucceed()
  }, [result, onSucceed])

  return (
    <Card className="mt-6">
      <h2 className="font-medium text-ink">2. Block substitution (splicing)</h2>
      <p className="mt-1 text-sm text-ink-muted">
        A multi-block message is encrypted one block at a time with no chaining -- like ECB
        mode. An attacker who intercepts the ciphertext can encrypt a block of their own
        choosing (with only the public key) and splice it in place of a genuine one. The
        victim decrypts the whole thing without any error.
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Original message (long enough to span 2+ blocks)
          <input
            type="text"
            value={message}
            maxLength={200}
            onChange={(e) => setMessage(e.target.value)}
            className="focus-ring rounded-sm border border-line bg-navy px-3 py-1.5 text-ink"
          />
          {estimate && (
            <span className="text-xs text-ink-muted">
              {estimate.blockSize}-byte blocks -- your message currently splits into {estimate.totalBlocks} block
              {estimate.totalBlocks === 1 ? '' : 's'}
              {estimate.totalBlocks < 2 && ' (needs at least 2 to have a non-final block to splice)'}
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Which block to replace
          <input
            type="number"
            min={0}
            max={maxBlockIndex}
            value={blockIndex}
            disabled={maxBlockIndex === 0 && !estimate}
            onChange={(e) => setBlockIndex(Math.max(0, Math.min(maxBlockIndex, Number(e.target.value))))}
            className="focus-ring w-24 rounded-sm border border-line bg-navy px-3 py-1.5 text-ink"
          />
          <span className="text-xs text-ink-muted">
            Valid range: 0-{maxBlockIndex} -- the final block always carries PKCS7 padding, so it's never a valid
            target.
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted sm:col-span-2">
          Attacker's forged text for block {blockIndex}
          <input
            type="text"
            value={forgedText}
            maxLength={64}
            onChange={(e) => setForgedText(e.target.value)}
            className="focus-ring rounded-sm border border-line bg-navy px-3 py-1.5 text-ink"
          />
          <span className="text-xs text-ink-muted">
            Must fit in one block -- at these educational key sizes that's often just 1-2 bytes.
          </span>
        </label>
      </div>
      <div className="mt-3">
        <Button
          onClick={() => keyPair && attack.run(keyPair.n, keyPair.e, keyPair.d)}
          disabled={!keyPair}
          loading={attack.state.status === 'loading'}
        >
          Splice forged block
        </Button>
      </div>
      {!keyPair && <p className="mt-2 text-xs text-ink-muted">Generate a keypair above first.</p>}
      {attack.state.status === 'error' && (
        <div className="mt-3">
          <ErrorBanner message={attack.state.message} />
        </div>
      )}
      <div className="mt-4">
        <BlockSubstitutionVisual result={result} />
      </div>
      {result && (
        <p className="mt-3 text-center font-mono text-xs text-ink-muted">{result.explanation}</p>
      )}
      <div className="mt-4">
        <h3 className="mb-2 font-mono text-xs font-semibold tracking-wide text-ink-muted uppercase">
          The actual attack code
        </h3>
        <CodePanel stageId="attack" snippets={SPLICE_SNIPPETS} />
      </div>
    </Card>
  )
}

function PaddingCaseStudySection({ keyPair, onSucceed }: { keyPair: KeygenResponse | null; onSucceed: () => void }) {
  const [message, setMessage] = useState('a real bug this project shipped and fixed')
  const attack = useAction(async (n: number, e: number, d: number): Promise<PaddingCaseStudyOutcome> => {
    const enc = await apiPost<EncryptResponse>('/rsa/encrypt', { message, n, e })
    const corrupted = [...enc.ciphertext]
    const lastIdx = corrupted.length - 1
    const beforeByte = corrupted[lastIdx]
    corrupted[lastIdx] = corrupted[lastIdx] ^ 1 // flip the ciphertext's lowest bit, simulating tampering or line noise
    const afterByte = corrupted[lastIdx]
    try {
      const dec = await apiPost<DecryptResponse>('/rsa/decrypt', { n, d, ciphertext: corrupted })
      return { outcome: 'decrypted', plaintext: dec.plaintext, beforeByte, afterByte }
    } catch (err) {
      if (err instanceof ApiError) return { outcome: 'rejected', message: err.message, beforeByte, afterByte }
      throw err
    }
  })
  // See MalleabilitySection's identical effect (and its comment on the `attack` dep warning):
  // a result from the previous key must not outlive a keypair regeneration.
  useEffect(() => {
    attack.reset()
  }, [keyPair])

  useEffect(() => {
    if (attack.state.status === 'success') playTamper()
  }, [attack.state.status])
  // Gated on `keyPair` itself, not just `attack.state`: the moment a new keygen starts,
  // `keyPair` goes null *in that same render* (before the reset effect below even runs), and a
  // stale success result rendered against a null/mismatched key is exactly what crashed
  // MalleabilityVisual (n=0 hit its client-side modPow's BigInt modulo). Nulling result here is
  // synchronous with that same render, so there's no crash window to close after the fact.
  const result = keyPair && attack.state.status === 'success' ? attack.state.data : null
  useEffect(() => {
    if (result) onSucceed()
  }, [result, onSucceed])

  return (
    <Card className="mt-6">
      <h2 className="font-medium text-ink">3. Case study: the PKCS7 padding bug this project actually shipped</h2>
      <p className="mt-1 text-sm text-ink-muted">
        An early version of <code className="rounded bg-line px-1 py-0.5 text-ink-muted">rsa/core.py</code>'s
        padding check trusted the last decrypted byte as the pad length without validating it
        -- two real, silent-wrong-output bugs followed on exactly the kind of corrupted
        ciphertext these demos produce.
      </p>
      <CodeBlock>
        {`# before (vulnerable)
def _pkcs7_unpad(data, block_size):
    pad_len = data[-1]
    return data[:-pad_len]     # pad_len=0  -> data[:-0] == data[:0] == b"" (Python quirk!)
                                # pad_len > len(data) -> silently over-truncates, no error

# after (fixed, the code this site actually runs)
def _pkcs7_unpad(data, block_size):
    if not data or not (1 <= data[-1] <= block_size):
        raise ValueError("invalid PKCS7 padding")
    pad_len = data[-1]
    if data[-pad_len:] != bytes([pad_len]) * pad_len:
        raise ValueError("invalid PKCS7 padding")
    return data[:-pad_len]`}
      </CodeBlock>
      <p className="mt-3 text-sm text-ink-muted">
        Try it live: encrypt a message, flip the lowest bit of the last ciphertext block, and
        decrypt the result through the real, currently-deployed code path below.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-4">
        <label className="flex flex-1 flex-col gap-1 text-sm text-ink-muted">
          Message
          <input
            type="text"
            value={message}
            maxLength={200}
            onChange={(e) => setMessage(e.target.value)}
            className="focus-ring rounded-sm border border-line bg-navy px-3 py-1.5 text-ink"
          />
        </label>
        <Button
          onClick={() => keyPair && attack.run(keyPair.n, keyPair.e, keyPair.d)}
          disabled={!keyPair}
          loading={attack.state.status === 'loading'}
        >
          Corrupt last block &amp; decrypt
        </Button>
      </div>
      {!keyPair && <p className="mt-2 text-xs text-ink-muted">Generate a keypair above first.</p>}
      {attack.state.status === 'error' && (
        <div className="mt-3">
          <ErrorBanner message={attack.state.message} />
        </div>
      )}
      <div className="mt-4">
        <PaddingCaseStudyVisual result={result} />
      </div>
      {result?.outcome === 'decrypted' && (
        <p className="mt-3 text-center font-mono text-xs text-ink-muted">
          Textbook RSA still has no way to prove this is the plaintext that was actually sent; try a
          different message, or click again after changing the modulus size above.
        </p>
      )}
    </Card>
  )
}
