import { useState } from 'react'
import { Link } from 'react-router'
import { apiGet } from '../api/client'
import { useFetchOnMount } from '../hooks/useApi'
import type { ShorBackend, ShorBackendsResponse, SimulatorCompareResponse } from '../types/api'
import { Card, ErrorBanner, PageHeader, Spinner } from '../components/ui'
import BackendRace from '../components/shor/BackendRace'

function Yn({ value }: { value: boolean }) {
  return value ? <span className="text-success">yes</span> : <span className="text-ink-muted">no</span>
}

const N_PRESETS = [15, 21, 91, 8051]

/** The name each spec card below uses vs. the ShorBackend key BackendRace races against --
 * "Real IBM quantum hardware" has no live key at all (it can only ever replay stored results,
 * see IbmHardwarePage), so it's the one card without a "just raced" badge. */
const SIM_NAME_TO_BACKEND: Record<string, ShorBackend> = {
  'Honest statevector simulator': 'honest',
  'Gate-level circuit (zero shortcuts)': 'gate_level',
  'Fast/sampling simulator': 'fast',
  'Cirq cross-check': 'cirq',
}

export default function SimulatorComparisonPage() {
  const compare = useFetchOnMount(() => apiGet<SimulatorCompareResponse>('/simulators/compare'), [])
  const backends = useFetchOnMount(() => apiGet<ShorBackendsResponse>('/shor/backends'), [])
  const [n, setN] = useState(15)

  const backendData = backends.status === 'success' ? backends.data : null
  const gateLevelDisabled = backendData ? !backendData.gate_level_allowed_n.includes(n) : false

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Simulator Comparison"
        description="Every backend this project can run Shor's algorithm on, what it actually does, and where it's verified -- each row cites the module and test that backs it. Race them live below with your own N, not just read about them."
      />

      <Card>
        <h2 className="font-medium text-ink">Try it live</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Pick an N and race every backend that can actually run it, in parallel, from the same random seed --
          the exact same race the Shor's Algorithm Lab uses, right here next to each backend's own spec.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            N
            <input
              type="number"
              min={4}
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
              className="focus-ring w-32 rounded-sm border border-line bg-navy px-3 py-1.5 text-ink"
            />
          </label>
          <div className="flex gap-2">
            {N_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setN(p)}
                className={`focus-ring rounded-sm border px-2.5 py-1 text-xs ${
                  n === p ? 'border-gold text-gold-warm' : 'border-line text-ink-muted hover:bg-line'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        {gateLevelDisabled && (
          <p className="mt-2 text-xs text-ink-muted">
            N = {n} is too large for the gate-level (zero-shortcut) backend to run live -- it'll sit out this race.
          </p>
        )}
        {backendData && (
          <div className="mt-4">
            <BackendRace
              n={n}
              aInput=""
              availableBackends={(Object.keys(backendData.descriptions) as ShorBackend[]).filter(
                (b) => !(b === 'gate_level' && gateLevelDisabled),
              )}
            />
          </div>
        )}
        {backends.status === 'error' && <div className="mt-3"><ErrorBanner message={backends.message} /></div>}
      </Card>

      {compare.status === 'loading' && <Spinner label="Loading comparison data…" />}
      {compare.status === 'error' && <ErrorBanner message={compare.message} />}

      {compare.status === 'success' && (
        <div className="mt-6 space-y-4">
          {compare.data.simulators.map((sim) => {
            const backendKey = SIM_NAME_TO_BACKEND[sim.name]
            return (
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
                {backendKey ? (
                  <p className="mt-3 font-mono text-xs text-ink-muted">
                    Raced live above as <span className="text-gold-warm">{backendKey}</span> -- scroll up and hit
                    "Race all backends" to see this exact code path run for N = {n}.
                  </p>
                ) : (
                  <p className="mt-3 font-mono text-xs text-ink-muted">
                    Not part of the live race above -- this one only ever replays stored results, see{' '}
                    <Link to="/ibm-hardware" className="text-gold underline underline-offset-2">
                      IBM Hardware Validation
                    </Link>
                    .
                  </p>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
