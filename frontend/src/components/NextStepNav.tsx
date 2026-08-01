import { Link, useLocation } from 'react-router'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { LEARNING_PATH } from '../lib/learningPath'

/** Real prev/next navigation through the site's suggested learning order (lib/learningPath.ts),
 * auto-detected from the current URL so it can just be dropped at the bottom of any page in the
 * sequence with no props. Renders nothing on a page that isn't part of the sequence (About-group
 * pages, the homepage) rather than a confusing dead end. */
export default function NextStepNav() {
  const { pathname } = useLocation()
  const index = LEARNING_PATH.findIndex((step) => step.to === pathname)
  if (index === -1) return null

  const prev = index > 0 ? LEARNING_PATH[index - 1] : null
  const next = index < LEARNING_PATH.length - 1 ? LEARNING_PATH[index + 1] : null
  if (!prev && !next) return null

  return (
    <nav aria-label="Suggested reading order" className="mt-10 flex items-center justify-between gap-4 border-t border-line pt-6">
      {prev ? (
        <Link to={prev.to} className="focus-ring group inline-flex items-center gap-2 rounded-sm text-sm text-ink-muted transition-colors hover:text-gold-warm">
          <ArrowLeft className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
          <span>
            <span className="block font-mono text-[0.65rem] tracking-wide text-ink-muted/70 uppercase">Previous</span>
            {prev.label}
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link to={next.to} className="focus-ring group inline-flex items-center gap-2 rounded-sm text-right text-sm text-ink-muted transition-colors hover:text-gold-warm">
          <span>
            <span className="block font-mono text-[0.65rem] tracking-wide text-ink-muted/70 uppercase">Next</span>
            {next.label}
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}
