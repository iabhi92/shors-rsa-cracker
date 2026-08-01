import { useEffect } from 'react'
import { Link } from 'react-router'
import { apiGet } from '../api/client'
import { useFetchOnMount } from '../hooks/useApi'
import type { IbmHardwareResponse } from '../types/api'
import { Card, ErrorBanner, PageHeader, Spinner, StatCard, WarningBanner } from '../components/ui'
import AmplitudeView from '../components/AmplitudeView'
import NoiseOverlayChart from '../components/NoiseOverlayChart'
import CodePanel, { type CodeSnippet } from '../components/CodePanel'
import LiveIbmHardwareRun from '../components/LiveIbmHardwareRun'
import NextStepNav from '../components/NextStepNav'
import DocLink from '../components/DocLink'
import { playIbmBlip } from '../lib/sfx'

// Copied verbatim from this repository's own quantum/ibm_hardware.py -- the exact module that
// submitted the run(s) shown above, not a simplified retelling of it.
const IBM_RUN_SNIPPETS: Record<string, CodeSnippet> = {
  run: {
    file: 'quantum/ibm_hardware.py',
    startLine: 148,
    code:
      'def get_service() -> "QiskitRuntimeService":\n' +
      '    """Load qiskit-ibm-runtime credentials from the environment (IBM_QUANTUM_API_KEY,\n' +
      '    IBM_QUANTUM_CRN) -- see .env.example. Never hardcode credentials; .env is git-ignored."""\n' +
      '    from dotenv import load_dotenv\n' +
      '    from qiskit_ibm_runtime import QiskitRuntimeService\n' +
      '\n' +
      '    load_dotenv()\n' +
      '    api_key = os.environ.get("IBM_QUANTUM_API_KEY")\n' +
      '    crn = os.environ.get("IBM_QUANTUM_CRN")\n' +
      '    if not api_key or not crn:\n' +
      '        raise RuntimeError(\n' +
      '            "IBM_QUANTUM_API_KEY and IBM_QUANTUM_CRN must be set (see .env.example) "\n' +
      '            "before running anything against real hardware"\n' +
      '        )\n' +
      '    return QiskitRuntimeService(channel="ibm_cloud", token=api_key, instance=crn)',
    notes: {
      148: 'The only function in the whole codebase that ever touches IBM credentials -- see the note below.',
      152: 'Imported here, not at module load -- so nothing else that imports this file needs qiskit installed.',
      157: 'Read straight from environment variables -- never a hardcoded string, never checked into git.',
      160: 'Fails loudly with a clear message rather than letting a missing credential surface as a cryptic SDK error.',
      165: 'The actual handle to IBM Quantum -- everything past this line is real Qiskit, not this project\'s code.',
    },
  },
}

export default function IbmHardwarePage() {
  const results = useFetchOnMount(() => apiGet<IbmHardwareResponse>('/ibm-hardware/results'), [])

  // The one place this specific effect is allowed to fire at all -- a cold, electronic blip
  // standing in for real control-hardware chatter, only ever heard here (see lib/sfx.ts).
  useEffect(() => {
    if (results.status === 'success') playIbmBlip()
  }, [results.status])

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Real IBM Quantum Hardware Validation"
        description="Submit this project's real circuit to an actual IBM quantum computer yourself, right now -- not a simulator agreeing with itself, and not just a stored screenshot of somebody else's run."
      />

      <LiveIbmHardwareRun />

      <h2 className="mt-8 font-display text-lg font-semibold text-ink">Two independent stored runs, for a fixed reference point</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Every live run above is genuinely new. These two are frozen, already-documented runs kept around as a fixed
        comparison point (see <Link to="/docs/real-hardware-validation" className="text-gold underline underline-offset-2">the full write-up</Link>).
      </p>

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

                <div className="mt-4">
                  <NoiseOverlayChart run={run} />
                </div>

                <div className="mt-6 grid gap-6 sm:grid-cols-2">
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
              <Link to="/docs/real-hardware-validation" className="text-gold underline underline-offset-2">
                the full write-up
              </Link>{' '}
              for the complete methodology, including two real bugs caught locally before this
              was ever run on real hardware.
            </p>
          </Card>

          <Card className="mt-6">
            <h2 className="font-medium text-ink">Or run it on your own IBM Quantum account instead</h2>
            <p className="mt-2 text-sm text-ink-muted">
              The live button at the top of this page shares this project's own account and rate limit with every
              visitor. IBM Quantum's free plan includes real hardware time too -- if you'd rather use your own
              account instead of waiting on the shared budget, three things, in order:
            </p>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-ink-muted">
              <li>
                Create a free account at{' '}
                <a
                  href="https://quantum.ibm.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-gold underline underline-offset-2 hover:text-gold-warm"
                >
                  quantum.ibm.com
                </a>{' '}
                and copy your API key and instance CRN from the dashboard.
              </li>
              <li>
                <code className="rounded bg-line px-1 py-0.5 text-ink-muted">pip install qiskit qiskit-ibm-runtime python-dotenv</code>, and
                put those two values in a <code className="rounded bg-line px-1 py-0.5 text-ink-muted">.env</code> file as{' '}
                <code className="rounded bg-line px-1 py-0.5 text-ink-muted">IBM_QUANTUM_API_KEY</code> /{' '}
                <code className="rounded bg-line px-1 py-0.5 text-ink-muted">IBM_QUANTUM_CRN</code> (see this repo's{' '}
                <code className="rounded bg-line px-1 py-0.5 text-ink-muted">.env.example</code>).
              </li>
              <li>
                Call <code className="rounded bg-line px-1 py-0.5 text-ink-muted">run_on_hardware(a=7, N=15, n_count=3)</code> from{' '}
                <code className="rounded bg-line px-1 py-0.5 text-ink-muted">quantum/ibm_hardware.py</code> -- it builds the exact compiled
                circuit described above, transpiles it for whichever backend you pick (or the least-busy one, by default), and submits
                it via Qiskit's SamplerV2 primitive.
              </li>
            </ol>
            <div className="mt-4">
              <CodePanel stageId="run" snippets={IBM_RUN_SNIPPETS} />
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              quantum/ibm_hardware.py's get_service() is the only function in the whole codebase that reads these
              credentials -- both the button above and this path call the exact same code, just with a different
              IBM Cloud account and CRN behind the scenes. See backend/app/routers/ibm_live.py's own module docstring
              for the rate limits guarding the shared, live version above.
            </p>
            <DocLink to="/docs/real-hardware-validation" title="Real Hardware Validation" />
          </Card>
        </>
      )}

      <NextStepNav />
    </div>
  )
}
