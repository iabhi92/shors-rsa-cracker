import { useState } from 'react'
import { InlineMath } from 'react-katex'
import { apiPost } from '../api/client'
import { useAction } from '../hooks/useApi'
import type { DecryptResponse, EncryptResponse, KeygenResponse } from '../types/api'
import { Button, Card, ErrorBanner, PageHeader, WarningBanner } from '../components/ui'
import KeyIllustration from '../components/KeyIllustration'
import RsaFlowVisual from '../components/rsa/RsaFlowVisual'

export default function RsaLabPage() {
  const [bits, setBits] = useState(16)
  const [message, setMessage] = useState('Attack at dawn')
  const keygen = useAction(() => apiPost<KeygenResponse>('/rsa/keygen', { bits }))
  const encrypt = useAction((n: number, e: number) => apiPost<EncryptResponse>('/rsa/encrypt', { message, n, e }))
  const decrypt = useAction((n: number, d: number, ciphertext: number[]) =>
    apiPost<DecryptResponse>('/rsa/decrypt', { n, d, ciphertext }),
  )

  const key = keygen.state.status === 'success' ? keygen.state.data : null
  const ciphertext = encrypt.state.status === 'success' ? encrypt.state.data : null
  const recoveredPlaintext = decrypt.state.status === 'success' ? decrypt.state.data.plaintext : null

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="RSA Laboratory"
        description="Generate a real RSA keypair, encrypt a message, and decrypt it -- using this project's own from-scratch implementation (rsa/keygen.py, rsa/core.py, rsa/primes.py), not a library."
      />

      <div className="mt-6 mb-6">
        <h2 className="mb-3 font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">
          How this actually works, step by step
        </h2>
        <RsaFlowVisual realKey={key} realCiphertext={ciphertext} realPlaintext={recoveredPlaintext} />
      </div>

      <WarningBanner>
        This is <strong>textbook RSA</strong> (no OAEP padding) at an educational key size.
        It's deterministic and malleable by design, so the weaknesses are visible --
        never use output from this page to protect real data. See{' '}
        <a href="/security" className="underline">Security &amp; Limitations</a>.
      </WarningBanner>

      <Card className="mt-6">
        <h2 className="font-medium text-ink">1. Generate a keypair</h2>
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
          <Button onClick={() => keygen.run()} disabled={keygen.state.status === 'loading'}>
            {keygen.state.status === 'loading' ? 'Generating…' : 'Generate keypair'}
          </Button>
        </div>
        {keygen.state.status === 'error' && <div className="mt-3"><ErrorBanner message={keygen.state.message} /></div>}
        {key && (
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div key={`${key.n}-${key.e}`} className="h-20 w-32 shrink-0 sm:h-24 sm:w-36">
              <KeyIllustration />
            </div>
            <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 font-mono text-sm sm:grid-cols-3">
              <Field label="p" value={key.p} />
              <Field label="q" value={key.q} />
              <Field label="N = p·q" value={key.n} />
              <Field label="φ(N)" value={key.phi} />
              <Field label="e (public)" value={key.e} />
              <Field label="d (private)" value={key.d} />
            </div>
          </div>
        )}
        {key && <p className="mt-3 text-xs text-ink-muted">{key.warning}</p>}
      </Card>

      <Card className="mt-6">
        <h2 className="font-medium text-ink">2. Encrypt with the public key (N, e)</h2>
        <p className="mt-1 text-sm text-ink-muted">
          <InlineMath math="c = m^e \; \text{mod} \; N" /> -- applied per byte-block of your message.
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
          <Button onClick={() => key && encrypt.run(key.n, key.e)} disabled={!key || encrypt.state.status === 'loading'}>
            Encrypt
          </Button>
        </div>
        {!key && <p className="mt-2 text-xs text-ink-muted">Generate a keypair first.</p>}
        {encrypt.state.status === 'error' && <div className="mt-3"><ErrorBanner message={encrypt.state.message} /></div>}
        {ciphertext && (
          <div className="mt-4">
            <p className="text-xs text-ink-muted">Ciphertext blocks (one integer per {ciphertext.block_size_bytes}-byte block):</p>
            <pre className="mt-1 overflow-x-auto rounded-sm border border-line bg-navy p-3 font-mono text-xs text-gold-warm">
              [{ciphertext.ciphertext.join(', ')}]
            </pre>
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <h2 className="font-medium text-ink">3. Decrypt with the private key (N, d)</h2>
        <p className="mt-1 text-sm text-ink-muted">
          <InlineMath math="m = c^d \; \text{mod} \; N" />
        </p>
        <div className="mt-3">
          <Button
            onClick={() => key && ciphertext && decrypt.run(key.n, key.d, ciphertext.ciphertext)}
            disabled={!key || !ciphertext || decrypt.state.status === 'loading'}
          >
            Decrypt
          </Button>
        </div>
        {!ciphertext && <p className="mt-2 text-xs text-ink-muted">Encrypt a message first.</p>}
        {decrypt.state.status === 'error' && <div className="mt-3"><ErrorBanner message={decrypt.state.message} /></div>}
        {decrypt.state.status === 'success' && (
          <div className="mt-4 rounded-sm border border-success/30 bg-success/10 p-3 text-sm text-success">
            Recovered plaintext: <span className="font-mono">"{decrypt.state.data.plaintext}"</span>
            {decrypt.state.data.plaintext === message && ' — matches the original message.'}
          </div>
        )}
      </Card>
    </div>
  )
}

function Field({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span className="block text-xs text-ink-muted">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  )
}
