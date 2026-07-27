import { apiGet } from '../api/client'
import { useFetchOnMount } from '../hooks/useApi'
import type { IbmHardwareResponse } from '../types/api'
import { Card, ErrorBanner, PageHeader, Spinner, StatCard, WarningBanner } from '../components/ui'
import AmplitudeView from '../components/AmplitudeView'

export default function IbmHardwarePage() {
  const results = useFetchOnMount(() => apiGet<IbmHardwareResponse>('/ibm-hardware/results'), [])

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Real IBM Quantum Hardware Validation"
        description="Stored results from an actual run on real IBM quantum hardware -- not a simulator agreeing with itself."
      />

      {results.status === 'loading' && <Spinner label="Loading stored results…" />}
      {results.status === 'error' && <ErrorBanner message={results.message} />}

      {results.status === 'success' && (
        <>
          <WarningBanner>{results.data.disclaimer}</WarningBanner>

          {results.data.runs.map((run) => {
            const amplitudes = Object.keys(run.theoretical_distribution)
              .map(Number)
              .sort((a, b) => a - b)
              .map((x) => ({
                basis_state: String(x),
                real: 0,
                imag: 0,
                probability: run.counts[String(x)] ? run.counts[String(x)] / run.shots : 0,
              }))
            const theoryAmplitudes = Object.entries(run.theoretical_distribution).map(([x, p]) => ({
              basis_state: x,
              real: 0,
              imag: 0,
              probability: p,
            }))

            return (
              <Card key={run.job_id} className="mt-6">
                <h2 className="font-medium text-ink">
                  a={run.a}, N={run.N}, backend: {run.backend_name}
                </h2>
                <p className="mt-1 font-mono text-xs text-ink-muted">
                  job {run.job_id} &middot; {run.shots} shots &middot; {new Date(run.timestamp_utc).toLocaleString()}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard label="Total variation distance" value={run.total_variation_distance.toFixed(4)} />
                  <StatCard label="Impossible-outcome mass" value={run.probability_mass_on_theoretically_impossible_outcomes.toFixed(4)} />
                  <StatCard label="Order r" value={run.r} />
                  <StatCard label="Counting qubits" value={run.n_count} />
                </div>

                <div className="mt-4 grid gap-6 sm:grid-cols-2">
                  <AmplitudeView title="Theoretical prediction" amplitudes={theoryAmplitudes} />
                  <AmplitudeView title={`Real hardware (${run.backend_name})`} amplitudes={amplitudes} />
                </div>
              </Card>
            )
          })}

          <Card className="mt-6">
            <h2 className="font-medium text-ink">Why the target register was compactly re-encoded</h2>
            <p className="mt-2 text-sm text-ink-muted">
              The general gate-level circuit needs too many qubits/gates to survive real
              hardware noise. For N=15, every valid base <em>a</em> has a multiplicative order
              that's automatically a power of two (since |(Z/15Z)*| = φ(15) = 8 = 2³), so the
              target register can be re-encoded as a compact log₂(r)-qubit "cycle position"
              counter instead of its full mod-N value. This is an <strong>exact</strong>{' '}
              re-encoding, not an approximation: only <em>which</em> reachable value the target
              holds ever matters for period-finding, and that's invariant under any relabeling
              of the traced-out target register's basis states.
            </p>
            <h3 className="mt-4 text-sm font-medium text-ink">What this validates</h3>
            <p className="mt-1 text-sm text-ink-muted">
              That the specific, non-uniform interference pattern this project's simulator
              predicts is physically real and observable on today's hardware -- not just an
              artifact of simulators agreeing with each other.
            </p>
            <h3 className="mt-4 text-sm font-medium text-ink">What this does not prove</h3>
            <p className="mt-1 text-sm text-ink-muted">
              This is not a claim that real hardware can factor real RSA-sized N. The compiled
              circuit only works because the order r was known classically in advance for this
              specific tiny N=15 -- computing r classically is exactly as hard as factoring for
              real RSA sizes. See{' '}
              <a href="/docs/real-hardware-validation" className="text-gold underline underline-offset-2">
                the full write-up
              </a>{' '}
              for the complete methodology, including two real bugs caught locally before this
              was ever run on real hardware.
            </p>
          </Card>
        </>
      )}
    </div>
  )
}
