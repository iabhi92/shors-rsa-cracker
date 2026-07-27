import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, Lock, Unlock } from 'lucide-react'
import PipelineAnimation, { type PipelineStage } from '../PipelineAnimation'

/** Default illustrative example (p=3, q=11 -> N=33, phi=20, e=3, d=7 -- verified: 2^3 mod 33 = 8,
 * 8^7 mod 33 = 2) shown before the user has generated anything. The moment a real key exists on
 * the page above, every stage switches to the real numbers instead -- this is the whole point of
 * the "let people use their own input" request: the visual isn't a fixed demo, it's a live view
 * of whatever key and message the user actually just made. */
const DEFAULT_KEY = { p: 3, q: 11, n: 33, phi: 20, e: 3, d: 7 }
const DEFAULT_BLOCKS = [2, 5, 7]
const DEFAULT_CIPHER = [8, 26, 13]

export type RsaKey = { p: number; q: number; n: number; phi: number; e: number; d: number }
export type RsaCiphertext = { ciphertext: number[]; block_size_bytes: number }

function Chip({ value, color, label }: { value: number | string; color: string; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="flex h-12 min-w-14 items-center justify-center rounded-sm border px-2 font-mono text-base font-semibold"
        style={{ borderColor: color, color }}
      >
        {value}
      </div>
      {label && <span className="font-mono text-xs text-ink-muted">{label}</span>}
    </div>
  )
}

function KeygenVisual({ k, isReal }: { k: RsaKey; isReal: boolean }) {
  const rows = [
    [`p = ${k.p}`, `q = ${k.q}`],
    [`N = p × q = ${k.n}`],
    [`φ(N) = ${k.p - 1} × ${k.q - 1} = ${k.phi}`],
    [`e = ${k.e}   (public)`],
    [`d = ${k.d}   (private — the modular inverse of e)`],
  ]
  return (
    <div className="flex flex-col items-center gap-1.5">
      <p className={`mb-1 font-mono text-xs ${isReal ? 'text-success' : 'text-gold-warm'}`}>
        {isReal ? 'using your real generated key' : 'showing an example — generate your own key in step 1 below and this updates automatically'}
      </p>
      {rows.map((row, i) => (
        <motion.div
          key={row.join('')}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.35 }}
          className="flex gap-3"
        >
          {row.map((text) => (
            <span
              key={text}
              className={`font-mono text-sm ${i === 3 ? 'text-gold' : i === 4 ? 'font-semibold text-gold-warm' : 'text-ink'}`}
            >
              {text}
            </span>
          ))}
        </motion.div>
      ))}
    </div>
  )
}

const MAX_SHOWN_BLOCKS = 24

function BlocksVisual({ blocks, isReal }: { blocks: (number | string)[]; isReal: boolean }) {
  const shown = blocks.slice(0, MAX_SHOWN_BLOCKS)
  const hidden = blocks.length - shown.length
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="font-mono text-xs text-ink-muted">
        {isReal ? 'your message → split into fixed-size numeric blocks' : '"message" → split into fixed-size numeric blocks'}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {shown.map((b, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, delay: (i / shown.length) * 0.5 }}
          >
            <Chip value={b} color="#eee8da" label={`block ${i + 1}`} />
          </motion.div>
        ))}
      </div>
      {hidden > 0 && <p className="font-mono text-xs text-ink-muted">+{hidden} more block{hidden === 1 ? '' : 's'} (long message)</p>}
    </div>
  )
}

/** The determinism counterfactual: textbook RSA has no randomness in it at all, so encrypting
 * the same message twice produces byte-for-byte the same ciphertext both times -- a real,
 * checkable fact (just re-running m^e mod N gives the same answer, there's nothing random to
 * re-roll), and a real weakness: an eavesdropper who can't decrypt anything can still tell two
 * intercepted messages are identical. This is exactly why production RSA (OAEP) folds in random
 * padding before encrypting -- so the same plaintext never produces the same ciphertext twice. */
function EncryptVisual({ k, blocks, cipher }: { k: RsaKey; blocks: (number | string)[]; cipher: number[] }) {
  const [again, setAgain] = useState(false)
  const shown = cipher.slice(0, MAX_SHOWN_BLOCKS)
  const hidden = cipher.length - shown.length
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="font-mono text-xs text-ink-muted">c = m<sup>{k.e}</sup> mod {k.n}, applied to every block</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {shown.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <Chip value={blocks[i] ?? '?'} color="#8c919b" />
            <ArrowRight className="h-3.5 w-3.5 text-gold" />
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + (i / shown.length) * 0.5, duration: 0.3 }}>
              <Chip value={c} color="#c99545" />
            </motion.div>
          </div>
        ))}
      </div>
      {hidden > 0 && <p className="font-mono text-xs text-ink-muted">+{hidden} more block{hidden === 1 ? '' : 's'} (long message)</p>}

      {!again ? (
        <button
          type="button"
          onClick={() => setAgain(true)}
          className="focus-ring mt-1 rounded-sm border border-line px-3 py-1.5 font-mono text-xs text-ink-muted transition-colors hover:border-gold/50 hover:text-ink"
        >
          encrypt the exact same message again →
        </button>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-center gap-2 border-t border-line pt-3">
            {shown.map((c, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (i / shown.length) * 0.4 }}>
                <Chip value={c} color="#c99545" />
              </motion.div>
            ))}
          </div>
          <p className="max-w-sm text-center font-mono text-sm text-gold-warm">
            identical ciphertext, both times — textbook RSA has no randomness to re-roll. An
            eavesdropper can tell you sent the same message twice without decrypting anything.
            Real systems add random padding (OAEP) specifically so this can't happen.
          </p>
        </>
      )}
    </div>
  )
}

const MAX_TRANSIT_DOTS = 6

function TransitVisual({ cipher }: { cipher: number[] }) {
  const shown = cipher.slice(0, MAX_TRANSIT_DOTS)
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-2 font-mono text-xs text-ink-muted">
        <Lock className="h-4 w-4 text-gold" /> sent over an open, public channel
      </div>
      <div className="relative flex h-14 w-full max-w-xs items-center justify-between">
        <span className="font-mono text-[0.65rem] text-ink-muted">sender</span>
        <span className="font-mono text-[0.65rem] text-ink-muted">receiver</span>
        <div className="absolute inset-x-8 top-1/2 h-px bg-line" />
        {shown.map((c, i) => (
          <motion.div
            key={i}
            className="absolute top-1/2 -translate-y-1/2"
            initial={{ left: '8%', opacity: 0 }}
            animate={{ left: '85%', opacity: [0, 1, 1, 0] }}
            transition={{ duration: 2.4, delay: i * 0.5, repeat: Infinity, repeatDelay: 1.2, ease: 'linear' }}
          >
            <Chip value={c} color="#c99545" />
          </motion.div>
        ))}
      </div>
      <p className="max-w-xs text-center font-mono text-[0.7rem] text-ink-muted">
        anyone watching the wire sees {cipher.slice(0, 8).join(', ')}{cipher.length > 8 ? ', …' : ''} — not the original blocks
      </p>
    </div>
  )
}

function DecryptVisual({ k, cipher, blocks, plaintext }: { k: RsaKey; cipher: number[]; blocks: (number | string)[]; plaintext?: string }) {
  const shown = cipher.slice(0, MAX_SHOWN_BLOCKS)
  const hidden = cipher.length - shown.length
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-2 font-mono text-xs text-ink-muted">
        <Unlock className="h-4 w-4 text-success" /> m = c<sup>{k.d}</sup> mod {k.n} — only possible with the private key d = {k.d}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {shown.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <Chip value={c} color="#c99545" />
            <ArrowRight className="h-3.5 w-3.5 text-success" />
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + (i / shown.length) * 0.5, duration: 0.3 }}>
              <Chip value={blocks[i] ?? '?'} color="#54c89a" label="recovered" />
            </motion.div>
          </div>
        ))}
      </div>
      {hidden > 0 && <p className="font-mono text-xs text-ink-muted">+{hidden} more block{hidden === 1 ? '' : 's'} (long message)</p>}
      {plaintext && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="font-mono text-sm font-semibold text-success"
        >
          recovered: "{plaintext}"
        </motion.p>
      )}
    </div>
  )
}

export default function RsaFlowVisual({
  realKey,
  realCiphertext,
  realPlaintext,
}: {
  realKey?: RsaKey | null
  realCiphertext?: RsaCiphertext | null
  realPlaintext?: string | null
}) {
  const stages: PipelineStage[] = useMemo(() => {
    const k: RsaKey = realKey ?? DEFAULT_KEY
    const isReal = !!realKey
    const nBlocks = realCiphertext ? realCiphertext.ciphertext.length : DEFAULT_BLOCKS.length
    const blocks: (number | string)[] = realCiphertext
      ? Array.from({ length: nBlocks }, (_, i) => (isReal ? 'mᵢ' : DEFAULT_BLOCKS[i]))
      : isReal
        ? []
        : DEFAULT_BLOCKS
    const cipher = realCiphertext ? realCiphertext.ciphertext : DEFAULT_CIPHER
    const waitingForMessage = isReal && !realCiphertext

    return [
      {
        id: 'keygen',
        label: 'Generate keys',
        caption: 'Pick two secret primes, multiply them, and derive a public/private exponent pair from the result.',
        formula: String.raw`N = pq,\quad \varphi(N) = (p-1)(q-1),\quad ed \equiv 1 \pmod{\varphi(N)}`,
        render: () => <KeygenVisual k={k} isReal={isReal} />,
      },
      {
        id: 'blocks',
        label: 'Chunk the message',
        caption: waitingForMessage
          ? 'Encrypt a message above and this step will show your own message split into real blocks.'
          : 'The message is split into fixed-size numeric blocks — RSA encrypts numbers, not letters directly.',
        formula: String.raw`\text{message} \rightarrow [m_1, \dots, m_${nBlocks}]`,
        render: () =>
          waitingForMessage ? (
            <p className="font-mono text-sm text-ink-muted">waiting for you to encrypt a message above…</p>
          ) : (
            <BlocksVisual blocks={blocks} isReal={isReal} />
          ),
      },
      {
        id: 'encrypt',
        label: 'Encrypt',
        caption: 'Every block is raised to the public exponent, modulo N. Anyone can do this step — that’s the point of a public key.',
        formula: String.raw`c = m^{${k.e}} \bmod ${k.n}`,
        render: () =>
          waitingForMessage ? (
            <p className="font-mono text-sm text-ink-muted">waiting for you to encrypt a message above…</p>
          ) : (
            <EncryptVisual k={k} blocks={blocks} cipher={cipher} />
          ),
      },
      {
        id: 'transit',
        label: 'Send it',
        caption: 'Only the ciphertext numbers ever cross the wire. Without the private key, they reveal nothing about the original blocks.',
        formula: String.raw`\text{public: } (N, e) = (${k.n}, ${k.e}) \quad\text{private: } d`,
        render: () =>
          waitingForMessage ? (
            <p className="font-mono text-sm text-ink-muted">waiting for you to encrypt a message above…</p>
          ) : (
            <TransitVisual cipher={cipher} />
          ),
      },
      {
        id: 'decrypt',
        label: 'Decrypt',
        caption: 'Raising each ciphertext block to the private exponent, modulo N, recovers the original numbers exactly.',
        formula: String.raw`m = c^{${k.d}} \bmod ${k.n}`,
        render: () =>
          waitingForMessage ? (
            <p className="font-mono text-sm text-ink-muted">waiting for you to encrypt a message above…</p>
          ) : (
            <DecryptVisual k={k} cipher={cipher} blocks={blocks} plaintext={realPlaintext ?? undefined} />
          ),
      },
    ]
  }, [realKey, realCiphertext, realPlaintext])

  return <PipelineAnimation stages={stages} accent="gold" />
}
