import { useParams } from 'react-router'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { apiGet } from '../api/client'
import { useFetchOnMount } from '../hooks/useApi'
import type { DocPage as DocPageData } from '../types/api'
import { ErrorBanner, Spinner, WarningBanner } from '../components/ui'

export default function DocPage({ forcedSlug }: { forcedSlug?: string }) {
  const params = useParams<{ slug: string }>()
  const slug = forcedSlug ?? params.slug ?? ''
  const doc = useFetchOnMount(() => apiGet<DocPageData>(`/docs/${slug}`), [slug])

  return (
    <div className="mx-auto max-w-3xl">
      {doc.status === 'loading' && <Spinner label="Loading documentation…" />}
      {doc.status === 'error' && <ErrorBanner message={doc.message} />}
      {doc.status === 'success' && (
        <>
          {slug === 'journey' && (
            <WarningBanner>
              This page renders <code>AI_USAGE.md</code> verbatim: a running, honest log of
              AI-assisted work on this project, distinguishing human decisions/review/testing
              from AI-assisted implementation. It is not reconstructed or illustrative --
              it's the project's real, contemporaneous record.
            </WarningBanner>
          )}
          <article className="prose prose-invert prose-slate mt-6 max-w-none prose-pre:bg-surface prose-pre:border prose-pre:border-line prose-code:text-gold-warm prose-a:text-gold">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {doc.data.content_markdown}
            </ReactMarkdown>
          </article>
        </>
      )}
    </div>
  )
}
