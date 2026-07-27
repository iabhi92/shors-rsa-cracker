import { Link } from 'react-router'
import { apiGet } from '../api/client'
import { useFetchOnMount } from '../hooks/useApi'
import type { DocIndexResponse } from '../types/api'
import { Card, ErrorBanner, PageHeader, Spinner } from '../components/ui'

export default function DocsIndexPage() {
  const index = useFetchOnMount(() => apiGet<DocIndexResponse>('/docs'), [])

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Documentation" description="This project's own notes, rendered directly from the repository -- not duplicated by hand." />
      {index.status === 'loading' && <Spinner />}
      {index.status === 'error' && <ErrorBanner message={index.message} />}
      {index.status === 'success' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {index.data.pages.map((page) => (
            <Link key={page.slug} to={`/docs/${page.slug}`} className="focus-ring block rounded-sm">
              <Card interactive className="h-full">
                <h2 className="text-sm font-medium text-ink">{page.title}</h2>
                <p className="mt-1 font-mono text-xs text-ink-muted">{page.source_file}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
