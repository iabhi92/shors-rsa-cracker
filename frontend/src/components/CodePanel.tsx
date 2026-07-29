import { useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Check, Copy } from 'lucide-react'
import { DURATION, EASE_SIGNATURE } from '../lib/motion'

// Keyed by the *absolute* line number (matching the real file, same numbers the header and
// gutter already show) -- not every line needs an entry, just the ones worth explaining. Every
// note is hand-written against the actual line it's attached to (re-read from the real file when
// written), the same standard this project holds its code comments to -- never a generated or
// templated gloss.
export type CodeSnippet = { file: string; startLine: number; code: string; notes?: Record<number, string> }

const KEYWORDS = new Set([
  'def', 'for', 'in', 'if', 'return', 'import', 'from', 'class', 'while', 'else', 'elif',
  'not', 'and', 'or', 'as', 'raise', 'try', 'except', 'finally', 'with', 'lambda', 'yield',
  'break', 'continue', 'pass', 'is', 'global', 'nonlocal', 'assert', 'del',
])
const CONSTANTS = new Set(['None', 'True', 'False'])
// Built-in types (annotations and constructors) -- coloured apart from KEYWORDS so a signature
// like `def f(a: int, m: int) -> int:` doesn't read as one flat wall of violet.
const TYPES = new Set([
  'int', 'str', 'bytes', 'bool', 'float', 'list', 'dict', 'tuple', 'set', 'frozenset',
  'bytearray', 'complex', 'object', 'Path',
])
// The other half of "not one flat wall of violet": built-in functions and exceptions, which a
// real editor never colours the same as control-flow keywords.
const BUILTINS = new Set([
  'ValueError', 'RuntimeError', 'TypeError', 'KeyError', 'IndexError', 'StopIteration',
  'OverflowError', 'AssertionError', 'NotImplementedError', 'AppError',
  'len', 'range', 'isinstance', 'enumerate', 'zip', 'map', 'filter', 'sum', 'min', 'max',
  'abs', 'round', 'pow', 'sorted', 'reversed', 'print', 'super', 'property', 'staticmethod',
  'classmethod', 'dataclass', 'field',
])
const SELF = new Set(['self', 'cls'])

/** Wraps a rendered line in the hover affordance for its explanation, when one exists for this
 * absolute line number -- a dotted underline (so there's a visible signal something's there
 * before you ever hover, unlike a bare native title attribute on plain text) plus the browser's
 * own tooltip via `title`, deliberately not a custom-positioned popover: one sentence of real
 * text doesn't need its own floating-panel machinery, and the native tooltip already handles
 * viewport edges, keyboard focus, and touch devices for free. */
function withNote(node: ReactNode, note: string | undefined) {
  if (!note) return node
  return (
    <span title={note} className="cursor-help border-b border-dotted border-ink-muted/50">
      {node}
    </span>
  )
}

/** A small, deliberately literal syntax pass -- keywords, numbers, comments, and (properly
 * stateful across line breaks, unlike a single-line regex) triple-quoted docstrings -- not a
 * full highlighting engine for one language this panel only ever shows short, hand-picked
 * snippets of. Tracks docstring state across the whole snippet so a docstring's *second* line
 * (which has no quote marks of its own to key off) still renders muted instead of falling back
 * to plain white text. */
// Applied to every rendered line -- a subtle current-line highlight, the one affordance that
// most says "this is a real editor" rather than a static code screenshot.
const LINE_HOVER = 'rounded-sm px-1 -mx-1 transition-colors hover:bg-white/[0.04]'

function highlightPython(code: string, notes: Record<number, string> | undefined, startLine: number) {
  let inDocstring = false
  return code.split('\n').map((line, i) => {
    const note = notes?.[startLine + i]
    if (inDocstring) {
      if (line.includes('"""')) inDocstring = false
      return <div key={i} className={LINE_HOVER}>{withNote(<span className="text-ink-muted italic">{line}</span>, note)}</div>
    }
    const quoteCount = (line.match(/"""/g) || []).length
    if (quoteCount === 1) {
      inDocstring = true
      return <div key={i} className={LINE_HOVER}>{withNote(<span className="text-ink-muted italic">{line}</span>, note)}</div>
    }
    if (quoteCount >= 2 || /^\s*#/.test(line)) {
      return <div key={i} className={LINE_HOVER}>{withNote(<span className="text-ink-muted italic">{line}</span>, note)}</div>
    }
    if (/^\s*@/.test(line)) {
      return <div key={i} className={LINE_HOVER}>{withNote(<span className="text-gold-warm">{line}</span>, note)}</div>
    }
    const tokens = line.split(/(\s+|[()[\]{}.,:*/+-]|"[^"]*")/g).filter((t) => t !== '')
    // The token right after `def`/`class` is the declared name itself -- worth its own colour so
    // a signature reads as "def NAME(params) -> type:", not four tokens all fighting for the
    // same violet.
    let prevSignificant = ''
    return (
      <div key={i} className={LINE_HOVER}>
        {withNote(
          <>
            {tokens.map((tok, j) => {
              const isDeclaredName = (prevSignificant === 'def' || prevSignificant === 'class') && /^[A-Za-z_]\w*$/.test(tok)
              if (tok.trim() !== '') prevSignificant = tok
              if (isDeclaredName) return <span key={j} className="font-semibold text-gold-warm">{tok}</span>
              if (/^"[^"]*"$/.test(tok)) return <span key={j} className="text-success">{tok}</span>
              if (CONSTANTS.has(tok)) return <span key={j} className="text-gold-warm">{tok}</span>
              if (KEYWORDS.has(tok)) return <span key={j} className="text-violet">{tok}</span>
              if (TYPES.has(tok)) return <span key={j} className="text-[#cfe3ee]">{tok}</span>
              if (BUILTINS.has(tok)) return <span key={j} className="text-[#e05a4e]">{tok}</span>
              if (SELF.has(tok)) return <span key={j} className="text-ink-muted italic">{tok}</span>
              if (/^-?\d+(\.\d+)?$/.test(tok)) return <span key={j} className="text-gold-warm">{tok}</span>
              return <span key={j}>{tok}</span>
            })}
          </>,
          note,
        )}
      </div>
    )
  })
}

/** Shows the exact source snippet backing whichever pipeline stage is currently active (Shor's
 * Lab, RSA Lab, and the Classical Attack Lab all wire this up the same way -- see each page's own
 * onActiveChange), so "here's what the algorithm actually does" is never just prose, it's the
 * real function -- with line numbers matching the real file and a copy button for pulling the
 * exact snippet out. Snippets are static text embedded at build time per lab rather than fetched
 * from a live "serve any repo file" endpoint: the functions involved are short, stable, and
 * exactly the ones already explained elsewhere on each page, so a fetch round-trip would add a
 * loading state and a new backend surface for no real benefit over keeping the strings in sync
 * by hand (each verified against the real files when written). */
export default function CodePanel({ stageId, snippets }: { stageId: string; snippets: Record<string, CodeSnippet> }) {
  const [copied, setCopied] = useState(false)
  const snippet = snippets[stageId]
  if (!snippet) return null
  const lines = snippet.code.split('\n')
  const lineNoWidth = String(snippet.startLine + lines.length - 1).length

  async function handleCopy() {
    await navigator.clipboard.writeText(snippet.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="overflow-hidden rounded-sm border border-line bg-[#0a0e14]">
      <div className="flex items-center gap-2 border-b border-line bg-navy-secondary px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-gold/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
        <span className="ml-2 font-mono text-xs text-ink-muted">
          {snippet.file}
          <span className="text-ink-muted/60">
            :{snippet.startLine}-{snippet.startLine + lines.length - 1}
          </span>
        </span>
        {snippet.notes && Object.keys(snippet.notes).length > 0 && (
          <span className="hidden font-mono text-[0.65rem] text-ink-muted/70 sm:inline">hover a dotted line for what it does</span>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="focus-ring ml-auto flex items-center gap-1 rounded-sm px-1.5 py-1 font-mono text-[0.65rem] text-ink-muted transition-colors hover:text-ink"
          aria-label="Copy snippet"
        >
          {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="overflow-x-auto px-4 py-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={stageId}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.fast, ease: EASE_SIGNATURE }}
            className="flex font-mono text-[0.78rem] leading-[1.65]"
          >
            <pre className="mr-3 shrink-0 text-right text-ink-muted/40 select-none" aria-hidden>
              {lines.map((_, i) => (
                <div key={i}>{String(snippet.startLine + i).padStart(lineNoWidth, ' ')}</div>
              ))}
            </pre>
            <pre className="min-w-0 flex-1 whitespace-pre text-ink">{highlightPython(snippet.code, snippet.notes, snippet.startLine)}</pre>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
