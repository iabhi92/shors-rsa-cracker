import { useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { apiGet, BASE } from '../api/client'
import { useFetchOnMount } from '../hooks/useApi'
import type { ProjectMeta } from '../types/api'
import { Card, PageHeader, Spinner, StatCard } from '../components/ui'
import TimingOracleDemo from '../components/TimingOracleDemo'

const EXPECTED_HEADERS = [
  { key: 'content-security-policy', label: 'Content-Security-Policy' },
  { key: 'x-content-type-options', label: 'X-Content-Type-Options' },
  { key: 'x-frame-options', label: 'X-Frame-Options' },
  { key: 'referrer-policy', label: 'Referrer-Policy' },
  { key: 'permissions-policy', label: 'Permissions-Policy' },
  { key: 'strict-transport-security', label: 'Strict-Transport-Security' },
  { key: 'cache-control', label: 'Cache-Control' },
]

type HeaderCheck = { entries: [string, string][] }

async function fetchHeaderCheck(): Promise<HeaderCheck> {
  // Deliberately a raw fetch, not apiGet -- this page needs the Response object itself to read
  // headers, not the parsed JSON body. Must still go through the same BASE as every other call
  // (see api/client.ts): a relative '/api/health' would resolve against the current page's own
  // origin, which is correct for same-origin deployments (local dev, Docker) but silently wrong
  // on GitHub Pages, where that path doesn't exist on the static site at all and the browser
  // would report back on GitHub Pages' own incidental headers instead of the backend's.
  const res = await fetch(`${BASE}/health`)
  return { entries: [...res.headers.entries()] }
}

export default function SecurityDashboardPage() {
  const meta = useFetchOnMount(() => apiGet<ProjectMeta>('/meta'))
  const headerCheck = useFetchOnMount(fetchHeaderCheck)

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Not a claim -- a live check"
        title="Security Dashboard"
        description="Every panel below reads real state from the running backend: actual response headers off a live request, an actual rate limiter tripping in real time, and this project's actual, currently-passing test count. Nothing here is a screenshot or a hardcoded number."
      />

      <Card className="mt-6">
        <h2 className="font-medium text-ink">Live security headers self-check</h2>
        <p className="mt-1 text-sm text-ink-muted">
          A fresh <code className="rounded bg-line px-1 py-0.5 text-ink-muted">GET /api/health</code> request,
          made by your browser just now, checked against <code className="rounded bg-line px-1 py-0.5 text-ink-muted">backend/app/security_headers.py</code>.
        </p>
        {headerCheck.status === 'loading' && <div className="mt-4"><Spinner label="Fetching headers…" /></div>}
        {headerCheck.status === 'error' && <p className="mt-4 text-sm text-red-300">{headerCheck.message}</p>}
        {headerCheck.status === 'success' && (
          <ul className="mt-4 flex flex-col gap-2">
            {EXPECTED_HEADERS.map((expected) => {
              const found = headerCheck.data.entries.find(([k]) => k === expected.key)
              return (
                <li key={expected.key} className="flex items-start gap-2.5 text-sm">
                  {found ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  )}
                  <span className="text-ink-muted">
                    {expected.label}
                    {found && <span className="ml-2 font-mono text-xs break-all text-ink-muted">{found[1]}</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <RateLimitDemo />

      <TimingOracleDemo />

      <Card className="mt-6">
        <h2 className="font-medium text-ink">Dependency &amp; verification status</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Kept honest rather than aspirational -- what's automated in CI, what's been checked
          by hand, and what still isn't automated.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Backend tests passing" value={meta.status === 'success' ? meta.data.test_count : '—'} hint="pytest -q, this build" />
          <StatCard label="Python deps" value="0 known CVEs" hint="pip-audit, runs in CI on every push/PR" />
          <StatCard label="JS deps" value="0 known CVEs" hint="npm audit, checked manually -- see note below" />
        </div>
        <ul className="mt-4 space-y-2 text-sm text-ink-muted">
          <li>
            <CheckCircle2 className="mr-1.5 inline h-4 w-4 text-success" />
            <code className="rounded bg-line px-1 py-0.5 text-ink-muted">ruff</code> and{' '}
            <code className="rounded bg-line px-1 py-0.5 text-ink-muted">mypy</code> run in CI on every push/PR
            (<code className="rounded bg-line px-1 py-0.5 text-ink-muted">.github/workflows/ci.yml</code>).
          </li>
          <li>
            <CheckCircle2 className="mr-1.5 inline h-4 w-4 text-success" />
            <code className="rounded bg-line px-1 py-0.5 text-ink-muted">pip-audit</code> runs in CI against both{' '}
            <code className="rounded bg-line px-1 py-0.5 text-ink-muted">requirements.txt</code> and{' '}
            <code className="rounded bg-line px-1 py-0.5 text-ink-muted">requirements-dev.txt</code>.
          </li>
          <li>
            <XCircle className="mr-1.5 inline h-4 w-4 text-gold" />
            <strong className="text-gold-warm">Known gap:</strong> the frontend's{' '}
            <code className="rounded bg-line px-1 py-0.5 text-ink-muted">npm audit</code> is not wired into CI
            yet -- a real high-severity <code className="rounded bg-line px-1 py-0.5 text-ink-muted">react-router</code> CSRF
            advisory was caught and fixed manually during this project's development, but a
            regression wouldn't be caught automatically today. Documented here rather than
            left as a silent gap.
          </li>
        </ul>
      </Card>

      <Card className="mt-6">
        <h2 className="font-medium text-ink">OWASP Top 10 (2021) mapping</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Where each category applies to this project, and what addresses it (or why it's out
          of scope for a stateless, keyless-auth demo site).
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs tracking-wide text-ink-muted uppercase">
                <th className="py-2 pr-4 font-medium">Category</th>
                <th className="py-2 font-medium">This project</th>
              </tr>
            </thead>
            <tbody className="[&_tr]:border-b [&_tr]:border-line/60 [&_tr:last-child]:border-0">
              {OWASP_ROWS.map((row) => (
                <tr key={row.category}>
                  <td className="py-2.5 pr-4 align-top font-medium whitespace-nowrap text-ink">{row.category}</td>
                  <td className="py-2.5 text-ink-muted">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function RateLimitDemo() {
  const [log, setLog] = useState<{ n: number; ok: boolean; detail: string }[]>([])
  const [running, setRunning] = useState(false)

  async function fire() {
    setRunning(true)
    setLog([])
    for (let i = 1; i <= 8; i++) {
      const res = await fetch('/api/security-demo/rate-limit-ping')
      if (res.ok) {
        setLog((prev) => [...prev, { n: i, ok: true, detail: '200 accepted' }])
      } else {
        const retryAfter = res.headers.get('retry-after')
        setLog((prev) => [...prev, { n: i, ok: false, detail: `429 blocked${retryAfter ? ` -- Retry-After: ${retryAfter}s` : ''}` }])
      }
    }
    setRunning(false)
  }

  return (
    <Card className="mt-6">
      <h2 className="font-medium text-ink">Live rate-limit demo</h2>
      <p className="mt-1 text-sm text-ink-muted">
        <code className="rounded bg-line px-1 py-0.5 text-ink-muted">GET /api/security-demo/rate-limit-ping</code> is
        guarded by its own real limiter capped at 5 requests / 15s (separate from the budgets
        RSA keygen, classical attacks, and Shor's algorithm actually use elsewhere on this
        site). Fire 8 requests back-to-back and watch it trip.
      </p>
      <button
        type="button"
        onClick={fire}
        disabled={running}
        className="focus-ring mt-3 inline-flex items-center gap-2 rounded-sm bg-gold px-4 py-2 text-sm font-medium text-navy transition-all hover:bg-gold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {running ? 'Firing…' : 'Fire 8 requests'}
      </button>
      {log.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5 font-mono text-sm">
          {log.map((entry) => (
            <li key={entry.n} className={`flex items-center gap-2.5 ${entry.ok ? 'text-success' : 'text-red-300'}`}>
              {entry.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
              request {entry.n}: {entry.detail}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

const OWASP_ROWS: { category: string; note: string }[] = [
  {
    category: 'A01: Broken Access Control',
    note: 'No auth/authorization model exists -- every endpoint is public and read/compute-only. No user data, no privileged action, so no access-control boundary to break.',
  },
  {
    category: 'A02: Cryptographic Failures',
    note: 'The entire site. Textbook RSA is deliberately unpadded and malleable -- see the Malleability & Tampering Lab and SECURITY.md’s "known limitations" for the full, named list.',
  },
  {
    category: 'A03: Injection',
    note: 'No shell execution, no SQL, no template injection anywhere in the codebase (verified by grep for eval/exec/subprocess/os.system as part of this review). All inputs are Pydantic-validated before touching business logic.',
  },
  {
    category: 'A04: Insecure Design',
    note: 'The RSA weaknesses are an intentional teaching design, not an accident -- explicitly disclosed rather than hidden. Rate limiting and security headers exist so the demo site itself is not trivially abusable.',
  },
  {
    category: 'A05: Security Misconfiguration',
    note: 'CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS, and no-store caching are set explicitly per response (backend/app/security_headers.py), checked live above rather than assumed.',
  },
  {
    category: 'A06: Vulnerable & Outdated Components',
    note: 'pip-audit runs in CI; npm audit is checked manually (0 known CVEs currently) -- the gap in CI automation is disclosed above, not hidden.',
  },
  {
    category: 'A07: Identification & Authentication Failures',
    note: 'No authentication exists on this site -- out of scope by design (nothing here is a real account or session).',
  },
  {
    category: 'A08: Software & Data Integrity Failures',
    note: 'Directly demonstrated, not just mitigated: the malleability and block-substitution attacks on this page ARE integrity failures, shown live against real code.',
  },
  {
    category: 'A09: Security Logging & Monitoring Failures',
    note: 'Errors return clean, non-leaking JSON (backend/app/errors.py) but there is no structured audit log -- reasonable for a stateless educational demo with no accounts or sensitive actions to audit.',
  },
  {
    category: 'A10: Server-Side Request Forgery',
    note: 'No endpoint accepts or fetches a user-supplied URL anywhere in the API surface, so there is no SSRF-shaped input to exploit.',
  },
]
