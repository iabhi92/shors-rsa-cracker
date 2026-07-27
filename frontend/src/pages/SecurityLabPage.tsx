import { useState } from 'react'
import { apiPost, ApiError } from '../api/client'
import { useAction } from '../hooks/useApi'
import type { DecryptResponse, EncryptResponse, KeygenResponse, MalleabilityResponse, TamperResponse } from '../types/api'
import { Button, Card, CodeBlock, ErrorBanner, PageHeader, SuccessBanner, WarningBanner } from '../components/ui'

export default function SecurityLabPage() {
  const [bits, setBits] = useState(24)
  const keygen = useAction(() => apiPost<KeygenResponse>('/rsa/keygen', { bits }))
  const key = keygen.state.status === 'success' ? keygen.state.data : null

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

      <MalleabilitySection keyPair={key} />
      <BlockSubstitutionSection keyPair={key} />
      <PaddingCaseStudySection keyPair={key} />
    </div>
  )
}

function MalleabilitySection({ keyPair }: { keyPair: KeygenResponse | null }) {
  const [messageInt, setMessageInt] = useState(7)
  const [blindFactor, setBlindFactor] = useState(3)
  const attack = useAction((n: number, e: number, d: number) =>
    apiPost<MalleabilityResponse>('/security-demo/malleability', {
      n,
      e,
      d,
      message_int: messageInt,
      blind_factor: blindFactor,
    }),
  )
  const result = attack.state.status === 'success' ? attack.state.data : null

  return (
    <Card className="mt-6">
      <h2 className="font-medium text-ink">1. Multiplicative malleability</h2>
      <p className="mt-1 text-sm text-ink-muted">
        RSA encryption is a homomorphism: (m^e)(s^e) &equiv; (m&middot;s)^e (mod N). An
        attacker who intercepts c = m^e mod N can multiply in any blinding factor s of their
        choosing -- without ever seeing m or d -- and the victim's decryption comes back as
        m&middot;s mod N.
      </p>
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
          onClick={() => keyPair && attack.run(keyPair.n, keyPair.e, keyPair.d)}
          disabled={!keyPair}
          loading={attack.state.status === 'loading'}
        >
          Run attack
        </Button>
      </div>
      {!keyPair && <p className="mt-2 text-xs text-ink-muted">Generate a keypair above first.</p>}
      {attack.state.status === 'error' && (
        <div className="mt-3">
          <ErrorBanner message={attack.state.message} />
        </div>
      )}
      {result && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-ink-muted">Original ciphertext c</p>
              <p className="font-mono text-sm break-all text-gold-warm">{result.original_ciphertext}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Attacker's tampered ciphertext c' = c&middot;s^e mod N</p>
              <p className="font-mono text-sm break-all text-orange-400">{result.tampered_ciphertext}</p>
            </div>
          </div>
          <SuccessBanner>
            Decrypting c' gives m&middot;s mod N = {result.tampered_plaintext}, exactly as
            predicted ({result.expected_tampered_plaintext}) -- the attacker fully controlled
            the recovered plaintext without ever touching d.
          </SuccessBanner>
        </div>
      )}
    </Card>
  )
}

function BlockSubstitutionSection({ keyPair }: { keyPair: KeygenResponse | null }) {
  const [message, setMessage] = useState('Transfer $10 to Alice, ref #4471')
  const [forgedText, setForgedText] = useState('X')
  const attack = useAction((n: number, e: number, d: number) =>
    apiPost<TamperResponse>('/security-demo/tamper', {
      n,
      e,
      d,
      message,
      block_index: 0,
      forged_block_text: forgedText,
    }),
  )
  const result = attack.state.status === 'success' ? attack.state.data : null

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
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Attacker's forged text for block 0
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
      {result && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-ink-muted">
            {result.total_blocks} blocks, {result.block_size_bytes} bytes/block &mdash; block{' '}
            {result.forged_block_index} replaced with the attacker's forged ciphertext.
          </p>
          <div>
            <p className="text-xs text-ink-muted">Original plaintext</p>
            <p className="font-mono text-sm text-ink">"{result.original_plaintext}"</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">Decrypted after splicing (no error raised)</p>
            <p className="font-mono text-sm text-orange-400">"{result.tampered_plaintext}"</p>
          </div>
          <SuccessBanner>{result.explanation}</SuccessBanner>
        </div>
      )}
    </Card>
  )
}

type PaddingCaseStudyResult = { outcome: 'rejected'; message: string } | { outcome: 'decrypted'; plaintext: string }

function PaddingCaseStudySection({ keyPair }: { keyPair: KeygenResponse | null }) {
  const [message, setMessage] = useState('a real bug this project shipped and fixed')
  const attack = useAction(async (n: number, e: number, d: number): Promise<PaddingCaseStudyResult> => {
    const enc = await apiPost<EncryptResponse>('/rsa/encrypt', { message, n, e })
    const corrupted = [...enc.ciphertext]
    const lastIdx = corrupted.length - 1
    corrupted[lastIdx] = corrupted[lastIdx] ^ 1 // flip the ciphertext's lowest bit, simulating tampering or line noise
    try {
      const dec = await apiPost<DecryptResponse>('/rsa/decrypt', { n, d, ciphertext: corrupted })
      return { outcome: 'decrypted', plaintext: dec.plaintext }
    } catch (err) {
      if (err instanceof ApiError) return { outcome: 'rejected', message: err.message }
      throw err
    }
  })
  const result = attack.state.status === 'success' ? attack.state.data : null

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
      {result?.outcome === 'rejected' && (
        <div className="mt-3">
          <SuccessBanner>
            Rejected cleanly: <span className="font-mono">{result.message}</span> -- the fixed
            validation caught the corrupted block instead of silently returning wrong
            plaintext (or crashing).
          </SuccessBanner>
        </div>
      )}
      {result?.outcome === 'decrypted' && (
        <div className="mt-3 rounded-sm border border-gold/30 bg-gold/10 p-3 text-sm text-gold-warm">
          This particular bit flip happened to still look like valid padding -- decryption
          "succeeded" with garbled plaintext: <span className="font-mono">"{result.plaintext}"</span>.
          Textbook RSA still has no way to prove this is the plaintext that was actually sent;
          try a different message, or click again after changing the modulus size above.
        </div>
      )}
    </Card>
  )
}
