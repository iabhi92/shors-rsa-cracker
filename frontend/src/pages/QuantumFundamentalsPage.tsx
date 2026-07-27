import { useState } from 'react'
import { InlineMath } from 'react-katex'
import { apiPost } from '../api/client'
import { useAction } from '../hooks/useApi'
import type { BellStateResponse, GateName, StatevectorResponse } from '../types/api'
import { Button, Card, ErrorBanner, PageHeader } from '../components/ui'
import AmplitudeView from '../components/AmplitudeView'

const GATES: { name: GateName; symbol: string; effect: string }[] = [
  { name: 'X', symbol: 'X', effect: 'Bit flip: |0⟩ ↔ |1⟩' },
  { name: 'H', symbol: 'H', effect: 'Creates equal superposition of |0⟩ and |1⟩' },
  { name: 'Y', symbol: 'Y', effect: 'Bit flip + phase flip' },
  { name: 'Z', symbol: 'Z', effect: 'Flips the phase of |1⟩ only' },
]

export default function QuantumFundamentalsPage() {
  const [gate, setGate] = useState<GateName>('H')
  const gateDemo = useAction((g: GateName) =>
    apiPost<StatevectorResponse>('/quantum/gate-demo', { n_qubits: 1, qubit: 0, gate: g, initial_value: 0 }),
  )
  const bellState = useAction(() => apiPost<BellStateResponse>('/quantum/bell-state'))

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Quantum Fundamentals"
        description="Qubits, superposition, and entanglement -- run against this project's own from-scratch statevector simulator (quantum/statevector.py), not a canned illustration."
      />

      <Card>
        <h2 className="font-medium text-ink">Single-qubit gates</h2>
        <p className="mt-1 text-sm text-ink-muted">
          A qubit's state is a length-2 complex vector <InlineMath math="\alpha|0\rangle + \beta|1\rangle" /> with{' '}
          <InlineMath math="|\alpha|^2 + |\beta|^2 = 1" />. A gate is a unitary matrix applied to that vector.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {GATES.map((g) => (
            <button
              key={g.name}
              type="button"
              onClick={() => setGate(g.name)}
              className={`focus-ring rounded-sm border px-3 py-1.5 font-mono text-sm ${
                gate === g.name ? 'border-gold bg-gold/10 text-gold-warm' : 'border-line text-ink-muted hover:bg-line'
              }`}
            >
              {g.symbol}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-muted">{GATES.find((g) => g.name === gate)?.effect}</p>
        <div className="mt-4">
          <Button onClick={() => gateDemo.run(gate)} disabled={gateDemo.state.status === 'loading'}>
            Apply {gate} to |0⟩
          </Button>
        </div>
        {gateDemo.state.status === 'error' && <div className="mt-3"><ErrorBanner message={gateDemo.state.message} /></div>}
        {gateDemo.state.status === 'success' && (
          <div className="mt-4">
            <AmplitudeView amplitudes={gateDemo.state.data.amplitudes} />
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <h2 className="font-medium text-ink">Entanglement: the Bell state</h2>
        <p className="mt-1 text-sm text-ink-muted">
          H on qubit 0, then a controlled-X (control=0, target=1): the two qubits become
          correlated so that measuring one instantly determines the other, even though neither
          has a definite value on its own.
        </p>
        <div className="mt-4">
          <Button onClick={() => bellState.run()} disabled={bellState.state.status === 'loading'}>
            Create a Bell state
          </Button>
        </div>
        {bellState.state.status === 'error' && <div className="mt-3"><ErrorBanner message={bellState.state.message} /></div>}
        {bellState.state.status === 'success' && (
          <div className="mt-4">
            <AmplitudeView amplitudes={bellState.state.data.amplitudes} />
            <p className="mt-3 text-xs text-ink-muted">{bellState.state.data.explanation}</p>
          </div>
        )}
      </Card>
    </div>
  )
}
