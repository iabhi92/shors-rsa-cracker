import { useState } from 'react'
import { Link } from 'react-router'
import { Divide, Gauge, ScanEye, Sparkles } from 'lucide-react'
import { apiPost } from '../api/client'
import { useAction } from '../hooks/useApi'
import type { CircuitMetadataResponse } from '../types/api'
import { Button, Card, ErrorBanner, PageHeader, StatCard, WarningBanner } from '../components/ui'
import CircuitDiagram from '../components/CircuitDiagram'
import NextStepNav from '../components/NextStepNav'
import DocLink from '../components/DocLink'

const SUPPORTED_N = [15, 21, 33, 35, 51, 55, 65]
const STAGES = [
  {
    name: 'Hadamard layer',
    desc: 'H on every control qubit -- equal superposition over all possible control-register values.',
    icon: Sparkles,
  },
  {
    name: 'Controlled modular exponentiation',
    desc: 'Built from elementary reversible-arithmetic gates: Fourier adders → controlled modular multiplication (compute-swap-uncompute) → exponentiation.',
    icon: Gauge,
  },
  {
    name: 'Inverse QFT',
    desc: 'Applied to the control register -- concentrates measurement probability at multiples of 2^n_count / r.',
    icon: Divide,
  },
  {
    name: 'Measurement',
    desc: 'Only the control register is measured; the target/ancilla registers are traced out.',
    icon: ScanEye,
  },
]

export default function CircuitExplorerPage() {
  const [n, setN] = useState(15)
  const metadata = useAction((n: number) => apiPost<CircuitMetadataResponse>('/circuit/metadata', { n }))

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Circuit Explorer"
        description="Real, measured qubit and gate counts for the gate-level modular exponentiation circuit (quantum/modexp_circuit.py) -- via quantum/resource_estimate.py's CountingRegister, which runs the actual unmodified circuit-emission code."
      />

      <WarningBanner>
        N is capped to the {SUPPORTED_N.length} values below since larger composites make the
        gate-level circuit exponentially slower to actually <em>build</em>, not just simulate --
        see Resource Estimation for extrapolated counts at real RSA sizes, where direct
        measurement like this is impossible.
      </WarningBanner>

      <h2 className="mt-6 mb-3 font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">
        0. Circuit schematic
      </h2>
      <Card>
        <CircuitDiagram />
      </Card>

      <h2 className="mt-6 mb-3 font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">
        1. Compute real circuit metadata
      </h2>
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            N
            <select
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
              className="focus-ring rounded-sm border border-line bg-navy px-3 py-1.5 font-mono text-ink"
            >
              {SUPPORTED_N.map((val) => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
          </label>
          <Button onClick={() => metadata.run(n)} loading={metadata.state.status === 'loading'}>
            Compute circuit metadata
          </Button>
        </div>
        {metadata.state.status === 'error' && <div className="mt-3"><ErrorBanner message={metadata.state.message} /></div>}
      </Card>

      {metadata.state.status === 'success' && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard label="Control qubits" value={metadata.state.data.n_count} />
            <StatCard label="Target qubits" value={metadata.state.data.n_target} />
            <StatCard label="Ancilla qubits" value={metadata.state.data.n_ancilla} />
            <StatCard label="Total qubits" value={metadata.state.data.total_qubits} />
            <StatCard label="Toffoli-equivalent gates" value={metadata.state.data.toffoli_equivalent_gates} />
            <StatCard label="Total gate emissions" value={metadata.state.data.total_gate_emissions} />
          </div>
          <Card className="mt-4">
            <p className="text-xs text-ink-muted">
              These are directly measured by running the real gate-emission code with a counting
              backend (no shortcuts, no estimation) -- not extrapolated. See{' '}
              <Link to="/resource-estimate" className="text-gold underline underline-offset-2">Resource Estimation</Link>{' '}
              for the closed-form extrapolation used at real RSA bit sizes, where direct measurement is impossible.
            </p>
          </Card>
        </>
      )}

      <section className="mt-6 space-y-3">
        <h2 className="font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">2. Circuit stages</h2>
        {STAGES.map((stage, i) => (
          <Card key={stage.name} interactive className="flex gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-navy text-gold">
              <stage.icon className="h-4.5 w-4.5" strokeWidth={1.75} />
            </span>
            <div>
              <h3 className="text-sm font-medium text-ink">
                <span className="mr-1.5 text-ink-muted">{i + 1}.</span>
                {stage.name}
              </h3>
              <p className="mt-1 text-xs text-ink-muted">{stage.desc}</p>
            </div>
          </Card>
        ))}
      </section>

      <h2 className="mt-6 mb-3 font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">
        3. Why zero ancilla leakage matters
      </h2>
      <Card>
        <p className="text-sm text-ink-muted">
          The ancilla (scratch) qubits used by the modular adder must return to exactly |0⟩ after
          each operation -- if they didn't, they'd carry a record of which computational path was
          taken, and that leaked "which-path" information would destroy the quantum interference
          the rest of Shor's algorithm depends on. This project's test suite checks this directly:
          a compute-swap-uncompute controlled multiplier is verified to leave 100% of the
          probability mass on the expected result with zero leakage to any other state.
        </p>
        <DocLink to="/docs/gate-level-modexp" title="Gate-Level Modular Exponentiation" />
      </Card>

      <NextStepNav />
    </div>
  )
}
