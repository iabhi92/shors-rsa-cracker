import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg py-24 text-center">
      <h1 className="text-2xl font-semibold text-ink">Page not found</h1>
      <p className="mt-2 text-ink-muted">That route doesn't exist.</p>
      <Link to="/" className="focus-ring mt-6 inline-block rounded-sm bg-gold px-4 py-2 text-sm font-medium text-navy hover:bg-gold">
        Back to home
      </Link>
    </div>
  )
}
