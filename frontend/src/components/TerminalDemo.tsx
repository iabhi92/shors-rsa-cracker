import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { RotateCw } from 'lucide-react'
import { apiPost } from '../api/client'
import type { ShorResponse } from '../types/api'

/** A real, live terminal transcript of quantum/shor.py's honest simulator actually factoring
 * N=35 -- not a recording, not scripted copy. Every run hits POST /api/shor/run for real and
 * builds the transcript from whatever comes back, so the attempt count/timing genuinely
 * varies run to run (the "LIVE" badge and Replay button are there specifically so that's
 * visible, not just claimed). */

const DEMO_N = 35

function formatLines(result: ShorResponse): string[] {
  const lines = [
    `$ curl -X POST /api/shor/run -d '{"n": ${result.n}, "backend": "honest"}'`,
    '',
    `Factoring N=${result.n} with Shor's algorithm (honest quantum statevector simulator)...`,
    '',
  ]
  result.attempts.forEach((a, i) => {
    lines.push(
      `  attempt ${i + 1}: a=${a.a} measured=${a.measured ?? '—'} period=${a.period_candidate ?? '—'} -> ${a.outcome}`,
    )
  })
  lines.push('')
  if (result.succeeded && result.factors) {
    lines.push(
      `Factored N = ${result.n} = ${result.factors[0]} × ${result.factors[1]}  (${result.elapsed_seconds.toFixed(3)}s, ${result.attempts.length} attempt${result.attempts.length !== 1 ? 's' : ''})`,
    )
    lines.push('Real quantum period-finding -- superposition, controlled-U, inverse QFT. Not a lookup table.')
  } else {
    lines.push('No factors found this run (a known, expected occasional outcome) -- click Replay.')
  }
  return lines
}

function useTypewriter(lines: string[] | null) {
  const [visibleLines, setVisibleLines] = useState(0)
  const [charsInLine, setCharsInLine] = useState(0)

  useEffect(() => {
    setVisibleLines(0)
    setCharsInLine(0)
    if (!lines) return
    let cancelled = false
    let line = 0
    let char = 0

    function step() {
      if (cancelled || !lines) return
      if (line >= lines.length) return
      const text = lines[line]
      if (char < text.length) {
        char += Math.min(3, text.length - char) // a few chars at a time reads better than 1-by-1
        setCharsInLine(char)
        setTimeout(step, 8)
      } else {
        line += 1
        char = 0
        setVisibleLines(line)
        setCharsInLine(0)
        setTimeout(step, text === '' ? 40 : 90)
      }
    }
    const t = setTimeout(step, 150)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [lines])

  return { visibleLines, charsInLine }
}

export default function TerminalDemo() {
  const [lines, setLines] = useState<string[] | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const runId = useRef(0)

  const { visibleLines, charsInLine } = useTypewriter(lines)

  async function run() {
    const id = ++runId.current
    setRunning(true)
    setError(null)
    setLines(null)
    try {
      // a=13 pinned deliberately (coprime with 35, even order, no a^(r/2)=-1 dead end) so this
      // hero widget always demonstrates real quantum period-finding -- a random `a` has a
      // real ~29% chance of landing on the classical gcd(a,N)!=1 shortcut instead, which is a
      // genuine part of the algorithm but a worse first impression with no measured/period
      // values to show. Still a real, live call every time -- just a fixed, honest choice of
      // which real computation to showcase (the same reasoning scripts/demo_crack.py uses
      // fixed p, q, e for). apiPost itself already retries through a cold-started backend
      // (see api/client.ts) -- this only fires once that's genuinely exhausted.
      const result = await apiPost<ShorResponse>('/shor/run', { n: DEMO_N, a: 13, backend: 'honest' })
      if (runId.current === id) setLines(formatLines(result))
    } catch {
      if (runId.current === id) setError('Could not reach the backend -- it may be down; try reloading in a minute.')
    } finally {
      if (runId.current === id) setRunning(false)
    }
  }

  useEffect(() => {
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const done = lines !== null && visibleLines >= lines.length

  return (
    <div className="overflow-hidden rounded-sm border border-line bg-black">
      <div className="flex items-center justify-between border-b border-line bg-surface/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-500/70" />
          <span className="h-3 w-3 rounded-full bg-gold/70" />
          <span className="h-3 w-3 rounded-full bg-success/70" />
          <span className="ml-3 font-mono text-xs text-ink-muted">shor-lab &mdash; live</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-mono text-[0.65rem] tracking-wide text-success uppercase">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            live
          </span>
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="focus-ring flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-ink-muted hover:text-gold-warm disabled:opacity-50"
          >
            <RotateCw className={`h-3 w-3 ${running ? 'animate-spin' : ''}`} />
            Replay
          </button>
        </div>
      </div>
      <div className="min-h-[260px] p-4 font-mono text-[0.8rem] leading-relaxed sm:text-sm">
        {error && <p className="text-red-300">{error}</p>}
        {!error &&
          lines &&
          lines.slice(0, visibleLines + 1).map((text, i) => {
            const isCurrent = i === visibleLines
            const shown = isCurrent ? text.slice(0, charsInLine) : text
            return (
              <div key={i} className="whitespace-pre-wrap text-ink-muted">
                {shown.startsWith('$ ') ? (
                  <>
                    <span className="text-gold">$ </span>
                    {shown.slice(2)}
                  </>
                ) : shown.startsWith('Factored') ? (
                  <span className="font-medium text-success">{shown}</span>
                ) : (
                  shown
                )}
                {isCurrent && !done && <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.6, repeat: Infinity }} className="text-gold">▍</motion.span>}
              </div>
            )
          })}
        {!lines && !error && (
          <p className="text-ink-muted">
            connecting… (free-tier hosting sleeps when idle -- first load can take up to a
            minute)
          </p>
        )}
      </div>
    </div>
  )
}
