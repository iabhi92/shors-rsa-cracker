import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, CheckCircle2, Lock, Unlock } from 'lucide-react'
import PipelineAnimation, { type PipelineStage } from '../PipelineAnimation'
import CodePanel, { type CodeSnippet } from '../CodePanel'
import { modPow } from '../../lib/modPow'
import { playKeygen, playEncrypt, playDecrypt, playTick } from '../../lib/sfx'

const RSA_STAGE_SOUND: Record<string, () => void> = {
  keygen: playKeygen,
  blocks: playTick,
  encrypt: playEncrypt,
  transit: playTick,
  decrypt: playDecrypt,
}

// Copied verbatim from this repository's own rsa/*.py.
const RSA_SNIPPETS: Record<string, CodeSnippet> = {
  keygen: {
    file: 'rsa/keygen.py',
    startLine: 41,
    code:
      'def mod_inverse(a: int, m: int) -> int:\n' +
      '    """Modular inverse of a mod m via extended Euclidean algorithm."""\n' +
      '    g, x, _ = extended_gcd(a % m, m)\n' +
      '    if g != 1:\n' +
      '        raise ValueError(f"{a} has no inverse mod {m} (gcd = {g})")\n' +
      '    return x % m',
    notes: {
      41: 'This is what derives d from e and φ(N) -- the one step that actually makes a keypair asymmetric.',
      43: 'extended_gcd(a, m) returns (g, x, y) with a·x + m·y = g; when g=1, x is exactly a\'s inverse mod m.',
      44: 'a has an inverse mod m only if they\'re coprime (gcd=1) -- this is why e must be coprime with φ(N).',
      45: 'A non-invertible e would silently break decryption later, so this fails loudly at keygen time instead.',
      46: 'Extended_gcd\'s x can come back negative; % m folds it back into the correct range [0, m).',
    },
  },
  blocks: {
    file: 'rsa/core.py',
    startLine: 72,
    code:
      '    block_size = _block_size(public_key.n)\n' +
      '    padded = _pkcs7_pad(message, block_size)\n' +
      '    blocks = [padded[i : i + block_size] for i in range(0, len(padded), block_size)]',
    notes: {
      72: 'The largest number of bytes guaranteed to encode to an integer strictly less than N.',
      73: 'PKCS7 padding fills the message out to an exact multiple of block_size before splitting it.',
      74: 'Plain Python slicing, not a library call -- this is the entire "split into blocks" step.',
    },
  },
  encrypt: {
    file: 'rsa/core.py',
    startLine: 27,
    code:
      'def encrypt_int(m: int, public_key: PublicKey) -> int:\n' +
      '    if not (0 <= m < public_key.n):\n' +
      '        raise ValueError("message integer must satisfy 0 <= m < n")\n' +
      '    return pow(m, public_key.e, public_key.n)',
    notes: {
      27: 'Encrypts one already-chunked integer block at a time -- encrypt_bytes calls this once per block.',
      28: 'A block that doesn\'t satisfy this can\'t be recovered uniquely by decryption -- checked up front.',
      30: 'The entire cryptographic operation: c = m^e mod N, computed with Python\'s built-in 3-argument pow.',
    },
  },
  transit: {
    file: 'rsa/core.py',
    startLine: 3,
    code:
      'WARNING (intentional, for this project): this is "textbook" RSA — plain modular\n' +
      'exponentiation with no padding scheme (no OAEP). It is deterministic (same plaintext\n' +
      'block always encrypts to the same ciphertext block) and malleable. Real-world RSA\n' +
      '(TLS, etc.) always wraps this core operation in padding specifically to defend against\n' +
      'attacks that don\'t need to touch the math at all. We\'re implementing the bare\n' +
      'mathematical primitive on purpose, since the point of this project is to attack that\n' +
      'primitive directly (classically and via a simulated quantum computer) rather than any\n' +
      'particular padding scheme.',
  },
  decrypt: {
    file: 'rsa/core.py',
    startLine: 33,
    code: 'def decrypt_int(c: int, private_key: PrivateKey) -> int:\n    return pow(c, private_key.d, private_key.n)',
    notes: {
      33: 'Only the holder of d can run this -- the public key alone has no way to invert encrypt_int.',
      34: 'c^d mod N recovers m exactly, because ed ≡ 1 (mod φ(N)) by construction during keygen.',
    },
  },
}

/** A small burst of sparks radiating from a point -- the payoff for a real (not the default
 * illustrative example) message finishing its full round trip. Every other success state on this
 * site is a static SuccessBanner; the actual climax of the RSA Lab -- your own message coming
 * back byte-for-byte intact through real encrypt/decrypt code -- deserved more than a banner. */
function SparkBurst() {
  const sparks = [0, 60, 120, 180, 240, 300]
  return (
    <>
      {sparks.map((angle) => (
        <motion.span
          key={angle}
          className="absolute top-1/2 left-1/2 h-1 w-1 rounded-full bg-gold"
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            x: Math.cos((angle * Math.PI) / 180) * 34,
            y: Math.sin((angle * Math.PI) / 180) * 34,
            opacity: 0,
            scale: 0.3,
          }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      ))}
    </>
  )
}

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

export function Chip({ value, color, label }: { value: number | string; color: string; label?: string }) {
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
// Capped so a long message doesn't render thousands of hex-dump rows -- 8 blocks' worth is
// already enough to make the "structured bytes vs. noise" contrast visible.
const MAX_HEX_DUMP_BLOCKS = 8

/** Big-endian bytes for one block, fixed at `width` bytes -- this is what actually goes out on
 * the wire per block (a real block cipher/RSA implementation always emits a fixed-width block,
 * never a variable-length one that would leak the value's magnitude from its length alone). */
function blockToBytes(value: number, width: number): number[] {
  const bytes: number[] = []
  let v = value
  for (let i = 0; i < width; i++) {
    bytes.unshift(v & 0xff)
    v = Math.floor(v / 256)
  }
  return bytes
}

/** A real hexdump -C-style byte view -- offset, hex bytes in groups of 8, and an ASCII sidebar
 * (dots for anything outside printable ASCII). Rendered for both sides of the wire so "anyone
 * watching sees ciphertext, not the original blocks" is something you can actually see byte by
 * byte, not just take on faith from a sentence. */
function HexDump({ blocks, byteWidth, label, accent }: { blocks: number[]; byteWidth: number; label: string; accent: string }) {
  const bytes = blocks.slice(0, MAX_HEX_DUMP_BLOCKS).flatMap((b) => blockToBytes(b, byteWidth))
  const rows: number[][] = []
  for (let i = 0; i < bytes.length; i += 16) rows.push(bytes.slice(i, i + 16))

  return (
    <div className="w-full min-w-0">
      <p className="mb-1.5 font-mono text-[0.65rem] tracking-wide text-ink-muted uppercase">{label}</p>
      <div className="w-full min-w-0 overflow-x-auto rounded-sm border border-line bg-navy p-3">
        <div className="min-w-max font-mono text-[0.7rem] leading-relaxed">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-4">
              <span className="text-ink-muted/50">{(i * 16).toString(16).padStart(8, '0')}</span>
              <span style={{ color: accent }}>
                {row.map((b) => b.toString(16).padStart(2, '0')).join(' ')}
                {row.length < 16 && '   '.repeat(16 - row.length)}
              </span>
              <span className="text-ink-muted">
                {row.map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.')).join('')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TransitVisual({ cipher, blocks }: { cipher: number[]; blocks: (number | string)[] }) {
  const [showHex, setShowHex] = useState(false)
  const shown = cipher.slice(0, MAX_TRANSIT_DOTS)
  const numericBlocks = blocks.filter((b): b is number => typeof b === 'number')
  const byteWidth = Math.max(1, Math.ceil(Math.log2(Math.max(...cipher, ...numericBlocks, 1) + 1) / 8))

  return (
    <div className="flex w-full flex-col items-center gap-4">
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

      <button
        type="button"
        onClick={() => setShowHex((s) => !s)}
        className="focus-ring rounded-sm border border-line px-3 py-1.5 font-mono text-xs text-ink-muted transition-colors hover:border-gold/50 hover:text-ink"
      >
        {showHex ? 'hide hex dump' : 'show hex dump →'}
      </button>

      {showHex && numericBlocks.length > 0 && (
        <div className="flex w-full max-w-xl flex-col gap-3">
          <HexDump blocks={numericBlocks} byteWidth={byteWidth} label="plaintext blocks (never sent)" accent="#8c919b" />
          <HexDump blocks={cipher} byteWidth={byteWidth} label="ciphertext (what actually crosses the wire)" accent="#c99545" />
          <p className="text-center font-mono text-[0.65rem] text-ink-muted">
            same byte width, same layout -- the only difference is that the top block is structured (real message bytes) and
            the bottom one, without OAEP, is still a deterministic function of it{cipher.length > MAX_HEX_DUMP_BLOCKS ? ` (first ${MAX_HEX_DUMP_BLOCKS} blocks shown)` : ''}.
          </p>
        </div>
      )}
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
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="relative flex flex-col items-center gap-2 rounded-sm border border-success/40 bg-success/10 px-5 py-3"
        >
          <motion.div
            className="relative flex h-8 w-8 items-center justify-center rounded-full bg-success/20"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.75, type: 'spring', stiffness: 400, damping: 15 }}
          >
            <CheckCircle2 className="h-5 w-5 text-success" />
            <SparkBurst />
          </motion.div>
          <p className="font-mono text-sm font-semibold text-success">recovered: "{plaintext}"</p>
          <p className="font-mono text-xs text-ink-muted">byte-for-byte intact -- the full round trip, through the real encrypt/decrypt code above</p>
        </motion.div>
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
  const [activeStageIndex, setActiveStageIndex] = useState(0)
  const stages: PipelineStage[] = useMemo(() => {
    const k: RsaKey = realKey ?? DEFAULT_KEY
    const isReal = !!realKey
    const nBlocks = realCiphertext ? realCiphertext.ciphertext.length : DEFAULT_BLOCKS.length
    // The real m_i per block: computed here, not fetched, since /rsa/decrypt only returns the
    // final decoded string server-side. This is the actual c^d mod n for each real ciphertext
    // block, not a placeholder -- matches this project's own "nothing here is faked" standard.
    const blocks: (number | string)[] = realCiphertext
      ? realCiphertext.ciphertext.map((c) => modPow(c, k.d, k.n))
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
            <TransitVisual cipher={cipher} blocks={blocks} />
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

  return (
    <div>
      <PipelineAnimation
        stages={stages}
        accent="gold"
        onActiveChange={setActiveStageIndex}
        onStageSound={(id) => RSA_STAGE_SOUND[id]?.()}
      />
      <div className="mt-4">
        <h3 className="mb-2 font-mono text-xs font-semibold tracking-wide text-ink-muted uppercase">
          The actual code behind this step
        </h3>
        <CodePanel stageId={stages[activeStageIndex]?.id ?? 'keygen'} snippets={RSA_SNIPPETS} />
      </div>
    </div>
  )
}
