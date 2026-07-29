import { useMemo, useRef, type ReactNode } from 'react'
import { useParams, Link } from 'react-router'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { motion, useReducedMotion, useScroll } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { apiGet } from '../api/client'
import { useFetchOnMount } from '../hooks/useApi'
import type { DocPage as DocPageData } from '../types/api'
import { ErrorBanner, Spinner } from '../components/ui'
import DoomsdayClock from '../components/DoomsdayClock'

/** Where each crash-course note actually gets hands-on -- shown as a "try it" callout under the
 * header so the theory pages point somewhere instead of just sitting there as prose. Every target
 * is a real route in App.tsx, not a placeholder link. No entry for 'security': that page already
 * *is* the security-limits doc, nothing else to point it at. */
const TRY_IT: Record<string, { to: string; label: string }> = {
  'quantum-basics': { to: '/quantum-fundamentals', label: 'Try single-qubit gates and the Bell state' },
  'qft-and-period-finding': { to: '/qft', label: 'Run the QFT & period-finding lab' },
  'shors-algorithm-math': { to: '/shor', label: "Run Shor's Algorithm Laboratory" },
  'gate-level-modexp': { to: '/circuit-explorer', label: 'Explore the real gate-level circuit' },
  'real-hardware-validation': { to: '/ibm-hardware', label: 'See the real IBM hardware results' },
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

/** Pulls the plain text out of a heading's children -- which react-markdown hands over as a mix
 * of raw strings and nested elements (inline code, emphasis) -- so the on-page anchor id and the
 * table of contents entry are built from identical text and never drift apart. */
function flattenText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(flattenText).join('')
  if (typeof node === 'object' && 'props' in node) return flattenText((node as { props: { children?: ReactNode } }).props.children)
  return ''
}

type TocEntry = { slug: string; text: string; level: 2 | 3 }

/** extractToc reads raw markdown lines directly (regex, not the parsed AST -- see this
 * function's own reasoning below), so unlike the real rendered <h2>/<h3> elements (which get
 * their text via flattenText walking react-markdown's already-parsed output), inline emphasis
 * markup here is still literal source characters. A heading like `### What *is* handled
 * correctly` rendered as "What *is* handled correctly" in the TOC, asterisks and all, while the
 * actual on-page heading correctly showed "is" in italics -- caught by comparing the two side by
 * side. Bold/italic only (this project's docs never use _underscore_ emphasis in a heading, and
 * stripping bare underscores would corrupt a real identifier like n_count if one ever appeared
 * in a heading). */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
}

function extractToc(markdown: string): TocEntry[] {
  const entries: TocEntry[] = []
  for (const line of markdown.split('\n')) {
    const match = /^(#{2,3})\s+(.*)$/.exec(line)
    if (!match) continue
    const level = match[1].length as 2 | 3
    const text = stripInlineMarkdown(match[2].replace(/`/g, ''))
    entries.push({ slug: slugify(text), text, level })
  }
  return entries
}

function makeHeading(level: 2 | 3) {
  return function Heading({ children }: { children?: ReactNode }) {
    const id = slugify(flattenText(children))
    const Tag = level === 2 ? 'h2' : 'h3'
    return <Tag id={id}>{children}</Tag>
  }
}

function TableOfContents({ toc }: { toc: TocEntry[] }) {
  if (toc.length < 2) return null
  return (
    <nav className="mb-6 rounded-sm border border-line bg-surface p-4" aria-label="On this page">
      <p className="mb-2 font-mono text-xs font-semibold tracking-wide text-ink-muted uppercase">On this page</p>
      <ul className="flex flex-col gap-1.5">
        {toc.map((entry) => (
          <li key={entry.slug} className={entry.level === 3 ? 'ml-4' : ''}>
            <a href={`#${entry.slug}`} className="text-sm text-ink-muted underline-offset-2 hover:text-gold hover:underline">
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default function DocPage({ forcedSlug }: { forcedSlug?: string }) {
  const params = useParams<{ slug: string }>()
  const slug = forcedSlug ?? params.slug ?? ''
  const doc = useFetchOnMount(() => apiGet<DocPageData>(`/docs/${slug}`), [slug])
  const containerRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] })

  const toc = useMemo(() => (doc.status === 'success' ? extractToc(doc.data.content_markdown) : []), [doc])
  const tryIt = TRY_IT[slug]

  return (
    <div ref={containerRef} className="relative mx-auto max-w-3xl">
      {/* Reading-progress rail -- the same "continuous scroll fraction, not a toggle" device
          HistoryPage's timeline already uses, so a long crash-course note at least gives some
          feedback on how far through it you are instead of reading as one endless scroll. */}
      <div className="fixed top-0 right-0 left-0 z-40 h-0.5 bg-line/40" aria-hidden>
        <motion.div
          className="h-full origin-left bg-gold"
          style={reduceMotion ? { scaleX: 1 } : { scaleX: scrollYProgress }}
        />
      </div>

      {doc.status === 'loading' && <Spinner label="Loading documentation…" />}
      {doc.status === 'error' && <ErrorBanner message={doc.message} />}
      {doc.status === 'success' && (
        <>
          {tryIt && (
            <Link
              to={tryIt.to}
              className="focus-ring mb-6 flex items-center justify-between gap-3 rounded-sm border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold-warm transition-colors hover:border-gold/70 hover:bg-gold/15"
            >
              <span>{tryIt.label}</span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </Link>
          )}

          <TableOfContents toc={toc} />

          {/* The same real gap ResourceEstimatePage's own clock shows -- this is the one doc
              page that actually discusses "how close is this, really," so it gets the visual
              answer up front instead of only in prose further down. */}
          {slug === 'security' && (
            <div className="mb-6">
              <DoomsdayClock />
            </div>
          )}

          <article className="prose prose-invert prose-slate max-w-none prose-pre:bg-surface prose-pre:border prose-pre:border-line prose-code:text-gold-warm prose-a:text-gold prose-headings:scroll-mt-20">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{ h2: makeHeading(2), h3: makeHeading(3) }}
            >
              {doc.data.content_markdown}
            </ReactMarkdown>
          </article>
        </>
      )}
    </div>
  )
}
