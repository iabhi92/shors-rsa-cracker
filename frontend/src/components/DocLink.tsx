import { Link } from 'react-router'
import { BookOpen } from 'lucide-react'

/** A single, consistent "go deeper" pointer from an interactive lab to the real conceptual
 * write-up it's built on -- only rendered where a genuine, accurate match exists (see each
 * page's own use of this component for which doc it actually corresponds to). Deliberately not
 * added to every page: forcing a link to a doc that doesn't really match would be worse than no
 * link at all. */
export default function DocLink({ to, title }: { to: string; title: string }) {
  return (
    <Link
      to={to}
      className="focus-ring mt-6 flex items-center gap-2.5 rounded-sm border border-line bg-surface px-4 py-3 text-sm text-ink-muted transition-colors hover:border-gold/50 hover:text-ink"
    >
      <BookOpen className="h-4 w-4 shrink-0 text-gold" />
      <span>
        Go deeper: <span className="text-ink underline underline-offset-2">{title}</span>
      </span>
    </Link>
  )
}
