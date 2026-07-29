import { motion } from 'motion/react'
import { ArrowRight, ArrowDown, Bug, CheckCircle2, XCircle, X as XIcon } from 'lucide-react'
import { Chip } from '../rsa/RsaFlowVisual'
import { modPow } from '../../lib/modPow'
import DecryptText from '../DecryptText'
import type { MalleabilityResponse, TamperResponse } from '../../types/api'

/** Splits two strings into their common prefix, the two differing middles, and their common
 * suffix -- e.g. diffing `original_plaintext` against `tampered_plaintext` this way highlights
 * exactly the bytes an attack actually changed, rather than assuming a fixed block-byte layout
 * client-side (the backend's block boundaries aren't re-derivable from the API response alone,
 * but "what actually changed" always is). */
function diffAffixes(a: string, b: string): { prefix: string; midA: string; midB: string; suffix: string } {
  let start = 0
  const maxStart = Math.min(a.length, b.length)
  while (start < maxStart && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }
  return { prefix: a.slice(0, start), midA: a.slice(start, endA), midB: b.slice(start, endB), suffix: a.slice(endA) }
}

/** 1. Multiplicative malleability: c and s^e mod N visibly multiply together into c', which then
 * decrypts to m·s -- the homomorphism from the caption made concrete instead of left as prose.
 * Before a result exists, shows the same schematic with muted/dashed placeholders so the shape
 * of the attack is visible before you ever click the button. */
export function MalleabilityVisual({
  n,
  e,
  messageInt,
  blindFactor,
  result,
}: {
  n: number
  e: number
  messageInt: number
  blindFactor: number
  result: MalleabilityResponse | null
}) {
  if (!result) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-line p-5 opacity-60">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Chip value={messageInt} color="#8c919b" label="m (secret)" />
          <ArrowRight className="h-3.5 w-3.5 text-ink-muted" />
          <Chip value="c" color="#8c919b" label="intercepted" />
          <span className="font-mono text-lg text-ink-muted">×</span>
          <Chip value="s^e" color="#8c919b" label={`s = ${blindFactor}`} />
          <ArrowRight className="h-3.5 w-3.5 text-ink-muted" />
          <Chip value="c′" color="#8c919b" label="tampered" />
        </div>
        <p className="font-mono text-xs text-ink-muted">run the attack above to see this animate with real numbers</p>
      </div>
    )
  }

  const sToE = modPow(blindFactor, e, n)

  return (
    <div className="flex flex-col items-center gap-4 rounded-sm border border-line bg-navy/40 p-5">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Chip value={result.original_ciphertext} color="#c99545" label="c (intercepted)" />
        </motion.div>
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35, duration: 0.3, type: 'spring' }}
          className="font-mono text-xl text-ink-muted"
        >
          ×
        </motion.span>
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.3 }}>
          <Chip value={sToE} color="#e05a4e" label={`sᵉ mod N (s=${blindFactor})`} />
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
        <ArrowDown className="h-4 w-4 text-ink-muted" />
      </motion.div>

      <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.05, duration: 0.35, type: 'spring' }}>
        <Chip value={result.tampered_ciphertext} color="#e3b45e" label="c′ = c · sᵉ mod N" />
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }} className="flex items-center gap-2 font-mono text-xs text-ink-muted">
        <ArrowDown className="h-4 w-4" /> victim decrypts c′ with d, unaware it was tampered with
      </motion.div>

      <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.7, duration: 0.35, type: 'spring' }}>
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-12 min-w-14 items-center justify-center rounded-sm border border-orange-400 px-2 font-mono text-base font-semibold text-orange-400">
            <DecryptText text={String(result.tampered_plaintext)} />
          </div>
          <span className="font-mono text-xs text-ink-muted">recovered = m·s mod N</span>
        </div>
      </motion.div>

      {result.matches_prediction && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.1 }} className="max-w-sm text-center font-mono text-xs text-success">
          matches the predicted m·s mod N = {result.expected_tampered_plaintext} exactly -- the attacker fully
          controlled the recovered value, and d was never touched.
        </motion.p>
      )}
    </div>
  )
}

/** Truncates a long decimal digit string to its first/last few digits -- a real 1024-bit
 * ciphertext is ~300 decimal digits, which is honest but unreadable in full; this keeps the
 * "yes, this is a real huge number" impression without a wall of digits nobody's going to read
 * character by character. Never used on anything actually used for further computation
 * client-side -- see this file's own OaepMalleabilityVisual, which does none. */
function truncateBigDecimal(value: string): string {
  return value.length > 24 ? `${value.slice(0, 10)}…${value.slice(-10)}` : value
}

/** 1b. The OAEP-padded variant of the malleability attack -- deliberately a separate component
 * from MalleabilityVisual rather than a prop toggle on it. MalleabilityVisual computes s^e mod N
 * client-side via lib/modPow.ts's BigInt-based helper, but that helper takes plain JS `number`
 * inputs -- fine for this site's usual 8-24 bit keys, silently wrong for the ~1024-bit key OAEP
 * actually needs (JSON itself can carry an exact 1024-bit integer as a decimal string just fine;
 * the precision loss would happen the moment that string got parsed into a JS `number`). Rather
 * than teach modPow to take bigint/string inputs just for this one demo, this component does no
 * client-side arithmetic on the big numbers at all -- everything shown here is exactly what the
 * backend already computed, string all the way through. */
export function OaepMalleabilityVisual({ blindFactor, result }: { blindFactor: number; result: MalleabilityResponse | null }) {
  if (!result) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-line p-5 opacity-60">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Chip value="c" color="#8c919b" label="intercepted (OAEP-padded)" />
          <span className="font-mono text-lg text-ink-muted">×</span>
          <Chip value="s^e" color="#8c919b" label={`s = ${blindFactor}`} />
          <ArrowRight className="h-3.5 w-3.5 text-ink-muted" />
          <Chip value="c′" color="#8c919b" label="tampered" />
        </div>
        <p className="font-mono text-xs text-ink-muted">run the attack above to see whether OAEP catches it</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-sm border border-line bg-navy/40 p-5">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Chip value={truncateBigDecimal(result.original_ciphertext)} color="#c99545" label="c (intercepted)" />
        <span className="font-mono text-xl text-ink-muted">×</span>
        <Chip value={`sᵉ mod N (s=${blindFactor})`} color="#e05a4e" label="attacker's blinding factor" />
      </div>

      <ArrowDown className="h-4 w-4 text-ink-muted" />

      <Chip value={truncateBigDecimal(result.tampered_ciphertext)} color="#e3b45e" label="c′ = c · sᵉ mod N" />

      <div className="flex items-center gap-2 font-mono text-xs text-ink-muted">
        <ArrowDown className="h-4 w-4" /> victim decrypts c′ with d, then tries to remove the OAEP padding
      </div>

      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        <div
          className={`flex flex-col items-center gap-1.5 rounded-sm border p-3 text-center ${
            result.original_oaep_valid ? 'border-success/50 bg-success/10' : 'border-line'
          }`}
        >
          <CheckCircle2 className={`h-4 w-4 ${result.original_oaep_valid ? 'text-success' : 'text-ink-muted'}`} />
          <span className="font-mono text-xs">victim's own message: OAEP valid</span>
          {result.original_message_int != null && (
            <span className="font-mono text-sm text-success">recovered: {result.original_message_int}</span>
          )}
        </div>
        <div
          className={`flex flex-col items-center gap-1.5 rounded-sm border p-3 text-center ${
            result.tampered_oaep_valid ? 'border-gold/50 bg-gold/10' : 'border-success/50 bg-success/10'
          }`}
        >
          {result.tampered_oaep_valid ? (
            <XCircle className="h-4 w-4 text-gold-warm" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-success" />
          )}
          <span className="font-mono text-xs">
            {result.tampered_oaep_valid ? "tampered ciphertext: OAEP still valid (rare!)" : 'tampered ciphertext: OAEP REJECTED'}
          </span>
        </div>
      </div>

      <p className="max-w-md text-center font-mono text-xs text-ink-muted">{result.explanation}</p>
    </div>
  )
}

/** 2. Block substitution: a real row of ciphertext blocks, one visibly swapped for the
 * attacker's forged block, with the plaintext diff (common prefix/suffix vs. the differing
 * middle) showing exactly what changed in the decrypted output -- not just the final strings
 * the way the plain-text version of this section showed them. */
export function BlockSubstitutionVisual({ result }: { result: TamperResponse | null }) {
  if (!result) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-line p-5 opacity-60">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <Chip key={i} value={i === 0 ? '✕' : '···'} color="#8c919b" />
          ))}
        </div>
        <p className="font-mono text-xs text-ink-muted">splice a forged block above to see which one changes and why</p>
      </div>
    )
  }

  const diff = diffAffixes(result.original_plaintext, result.tampered_plaintext)
  const maxShown = 16
  const shownBlocks = Math.min(result.total_blocks, maxShown)

  return (
    <div className="flex flex-col items-center gap-4 rounded-sm border border-line bg-navy/40 p-5">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {Array.from({ length: shownBlocks }).map((_, i) => {
          const isForged = i === result.forged_block_index
          const value = isForged ? result.tampered_ciphertext[i] : result.original_ciphertext[i]
          return (
            <motion.div key={i} className="flex flex-col items-center gap-1">
              <motion.div
                initial={isForged ? { scale: 1.3, opacity: 0 } : { opacity: 0, y: -4 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ delay: isForged ? 0.5 : i * 0.03, duration: 0.3, type: isForged ? 'spring' : 'tween' }}
                className={`flex h-11 min-w-13 items-center justify-center gap-1 rounded-sm border px-2 font-mono text-xs font-semibold ${
                  isForged ? 'border-orange-400 text-orange-400' : 'border-line text-ink-muted'
                }`}
              >
                {isForged && <Bug className="h-3 w-3 shrink-0" />}
                {value}
              </motion.div>
              <span className="font-mono text-[0.6rem] text-ink-muted">block {i}</span>
            </motion.div>
          )
        })}
        {result.total_blocks > maxShown && (
          <span className="self-center font-mono text-xs text-ink-muted">+{result.total_blocks - maxShown} more</span>
        )}
      </div>

      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="flex items-center gap-1.5 font-mono text-xs text-orange-400">
        <Bug className="h-3.5 w-3.5" /> block {result.forged_block_index} replaced with the attacker's own ciphertext -- encrypted
        with only the public key, no d required
      </motion.p>

      <ArrowDown className="h-4 w-4 text-ink-muted" />

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }} className="max-w-lg text-center font-mono text-sm">
        <span className="text-ink">"{diff.prefix}</span>
        <span className="text-ink-muted/50 line-through">{diff.midA}</span>
        <span className="text-orange-400">{diff.midB}</span>
        <span className="text-ink">{diff.suffix}"</span>
      </motion.div>
      <p className="font-mono text-[0.65rem] text-ink-muted">
        struck-through = the original text that vanished · orange = the attacker's forged fragment, decrypted in its place
      </p>
    </div>
  )
}

export type PaddingCaseStudyOutcome =
  | { outcome: 'rejected'; message: string; beforeByte: number; afterByte: number }
  | { outcome: 'decrypted'; plaintext: string; beforeByte: number; afterByte: number }

/** 3. The padding case study: the actual bit that gets flipped, shown in binary, feeding into a
 * two-path flowchart mirroring the exact `_pkcs7_unpad` code already printed above it on the
 * page -- whichever path this specific run actually took lights up, the other stays dim. */
export function PaddingCaseStudyVisual({ result }: { result: PaddingCaseStudyOutcome | null }) {
  if (!result) {
    return (
      <div className="rounded-sm border border-dashed border-line p-5 text-center opacity-60">
        <p className="font-mono text-xs text-ink-muted">encrypt &amp; corrupt a message above to watch which path it takes</p>
      </div>
    )
  }

  const before = result.beforeByte.toString(2)
  const after = result.afterByte.toString(2).padStart(before.length, '0')
  const beforeBits = before.padStart(after.length, '0').split('')
  const afterBits = after.split('')
  const rejected = result.outcome === 'rejected'

  return (
    <div className="flex min-w-0 flex-col items-center gap-4 rounded-sm border border-line bg-navy/40 p-5">
      <div className="flex min-w-0 w-full flex-col items-center gap-2">
        <p className="font-mono text-xs text-ink-muted">last ciphertext block, lowest bit flipped</p>
        {/* A ciphertext block's value can be up to N itself -- at this project's largest
            educational key size (24 bits) that's 24 bits per side, ~800px of fixed-width spans
            with no wrap, which blew straight past a mobile viewport and dragged the entire page
            body into horizontal scroll with it (confirmed: 626px of content in a 390px
            viewport). `overflow-x-auto` alone doesn't fix it: every ancestor here is a flex
            item, which defaults to `min-width: auto` (refuses to shrink below its content's
            intrinsic width) -- the same CSS Grid/flex quirk AmplitudeView hit earlier. `min-w-0`
            up the whole chain is what actually lets the scroll container shrink to the
            viewport and clip/scroll internally instead of forcing every ancestor wider. Scoping
            the overflow to this one row, not the page, is the fix -- same
            principle as this project's CodeBlock/Table components already scroll internally
            rather than widening their page. */}
        <div className="w-full min-w-0 overflow-x-auto">
          <div className="flex items-center gap-3 px-1 font-mono text-sm">
            <div className="flex gap-0.5">
              {beforeBits.map((bit, i) => (
                <span key={i} className={`w-4 shrink-0 text-center ${i === beforeBits.length - 1 ? 'font-bold text-ink' : 'text-ink-muted'}`}>
                  {bit}
                </span>
              ))}
            </div>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
            <div className="flex gap-0.5">
              {afterBits.map((bit, i) => (
                <motion.span
                  key={i}
                  initial={i === afterBits.length - 1 ? { color: '#8c919b' } : undefined}
                  animate={i === afterBits.length - 1 ? { color: '#e3b45e' } : undefined}
                  transition={{ delay: 0.4, duration: 0.3 }}
                  className={i === afterBits.length - 1 ? 'w-4 shrink-0 text-center font-bold' : 'w-4 shrink-0 text-center text-ink-muted'}
                >
                  {bit}
                </motion.span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ArrowDown className="h-4 w-4 text-ink-muted" />
      <p className="font-mono text-xs text-ink-muted">_pkcs7_unpad validates the padding structure</p>

      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        <motion.div
          animate={{ opacity: rejected ? 1 : 0.3 }}
          className={`flex flex-col items-center gap-1.5 rounded-sm border p-3 text-center ${
            rejected ? 'border-success/50 bg-success/10' : 'border-line'
          }`}
        >
          <CheckCircle2 className={`h-4 w-4 ${rejected ? 'text-success' : 'text-ink-muted'}`} />
          <span className="font-mono text-xs">structure invalid → ValueError raised</span>
        </motion.div>
        <motion.div
          animate={{ opacity: rejected ? 0.3 : 1 }}
          className={`flex flex-col items-center gap-1.5 rounded-sm border p-3 text-center ${
            !rejected ? 'border-gold/50 bg-gold/10' : 'border-line'
          }`}
        >
          <XIcon className={`h-4 w-4 ${!rejected ? 'text-gold-warm' : 'text-ink-muted'}`} />
          <span className="font-mono text-xs">still looks valid → returns garbled plaintext</span>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        {rejected ? (
          <p className="flex items-center gap-1.5 font-mono text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> rejected cleanly: "{result.message}"
          </p>
        ) : (
          <p className="flex items-center gap-1.5 font-mono text-sm text-gold-warm">
            <XCircle className="h-4 w-4" /> "decrypted" to garbage: "{result.plaintext}"
          </p>
        )}
      </motion.div>
    </div>
  )
}
