import { apiGet } from '../api/client'
import { useFetchOnMount } from '../hooks/useApi'
import type { SimulatorCompareResponse } from '../types/api'
import { Card, ErrorBanner, PageHeader, Spinner } from '../components/ui'

function Yn({ value }: { value: boolean }) {
  return value ? <span className="text-success">yes</span> : <span className="text-ink-muted">no</span>
}

export default function SimulatorComparisonPage() {
  const compare = useFetchOnMount(() => apiGet<SimulatorCompareResponse>('/simulators/compare'), [])

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Simulator Comparison"
        description="Every backend this project can run Shor's algorithm on, what it actually does, and where it's verified -- each row cites the module and test that backs it."
      />

      {compare.status === 'loading' && <Spinner label="Loading comparison data…" />}
      {compare.status === 'error' && <ErrorBanner message={compare.message} />}

      {compare.status === 'success' && (
        <div className="space-y-4">
          {compare.data.simulators.map((sim) => (
            <Card key={sim.name}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-medium text-ink">{sim.name}</h2>
                <code className="text-xs text-ink-muted">{sim.module}</code>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                <p className="text-ink-muted">Simulates amplitudes: <Yn value={sim.simulates_amplitudes} /></p>
                <p className="text-ink-muted">Models gates directly: <Yn value={sim.models_gates_directly} /></p>
                <p className="text-ink-muted">Uses known period: <Yn value={sim.uses_classically_known_period} /></p>
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Practical limit</dt>
                  <dd className="text-ink-muted">{sim.practical_limit}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Intended purpose</dt>
                  <dd className="text-ink-muted">{sim.intended_purpose}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Known limitations</dt>
                  <dd className="text-ink-muted">{sim.known_limitations}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Verified by</dt>
                  <dd className="font-mono text-xs text-gold-warm">{sim.verified_by}</dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
