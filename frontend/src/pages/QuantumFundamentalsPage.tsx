import { useEffect, useState } from 'react'
import { InlineMath } from 'react-katex'
import { apiPost } from '../api/client'
import { useAction } from '../hooks/useApi'
import type { BellStateResponse, GateName, StatevectorResponse } from '../types/api'
import { Button, Card, ErrorBanner, PageHeader, StatCard, WarningBanner } from '../components/ui'
import AmplitudeView from '../components/AmplitudeView'
import NextStepNav from '../components/NextStepNav'
import DocLink from '../components/DocLink'
import { playShimmer, playTick, playWhoosh } from '../lib/sfx'

const GATES: { name: GateName; symbol: string; effect: string }[] = [
  { name: 'X', symbol: 'X', effect: 'Bit flip: |0⟩ ↔ |1⟩' },
  { name: 'H', symbol: 'H', effect: 'Creates equal superposition of |0⟩ and |1⟩' },
  { name: 'Y', symbol: 'Y', effect: 'Bit flip + phase flip' },
  { name: 'Z', symbol: 'Z', effect: 'Flips the phase of |1⟩ only' },
]

const MAX_QUBITS = 4

export default function QuantumFundamentalsPage() {
  const [gate, setGate] = useState<GateName>('H')
  const [nQubits, setNQubits] = useState(1)
  const [qubit, setQubit] = useState(0)
  const [initialValue, setInitialValue] = useState(0)

  // Keep the target qubit / starting basis state in range whenever the register size shrinks --
  // e.g. going from 4 qubits down to 2 while qubit=3 or initial_value=9 would otherwise silently
  // send an out-of-range request the backend correctly 400s, with no obvious reason why to a
  // visitor who just moved one unrelated slider.
  useEffect(() => {
    setQubit((q) => Math.min(q, nQubits - 1))
    setInitialValue((v) => Math.min(v, 2 ** nQubits - 1))
  }, [nQubits])

  const gateDemo = useAction((g: GateName, n: number, q: number, init: number) =>
    apiPost<StatevectorResponse>('/quantum/gate-demo', { n_qubits: n, qubit: q, gate: g, initial_value: init }),
  )
  const bellState = useAction(() => apiPost<BellStateResponse>('/quantum/bell-state'))

  const runGateDemo = () => {
    gateDemo.run(gate, nQubits, qubit, initialValue)
    if (gate === 'H') playShimmer()
    else playTick()
  }

  const runBellState = async () => {
    const r = await bellState.run()
    if (r) playWhoosh()
  }

  const gateData = gateDemo.state.status === 'success' ? gateDemo.state.data : null
  const bellData = bellState.state.status === 'success' ? bellState.state.data : null

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Quantum Fundamentals"
        description="Qubits, superposition, and entanglement -- run against this project's own from-scratch statevector simulator (quantum/statevector.py), not a canned illustration."
      />

      <div className="mb-6">
        <WarningBanner>
          Registers here are capped at {MAX_QUBITS} qubits ({2 ** MAX_QUBITS} amplitudes) so every amplitude table
          stays readable at a glance. Real registers grow to <InlineMath math="2^n" /> amplitudes for n qubits --
          Shor's algorithm against a real RSA key would need dozens of qubits, which is exactly why this project's
          own honest simulator can only reach small N. See the Shor's Algorithm Lab and Resource Estimation pages
          for what that scaling actually looks like.
        </WarningBanner>
      </div>

      <h2 className="mb-3 font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">
        0. What's a qubit, and what's a gate?
      </h2>
      <Card>
        <p className="text-sm text-ink-muted">
          A qubit's state is a length-2 complex vector <InlineMath math="\alpha|0\rangle + \beta|1\rangle" /> with{' '}
          <InlineMath math="|\alpha|^2 + |\beta|^2 = 1" />. n qubits together are a single length-
          <InlineMath math="2^n" /> vector, not n separate length-2 vectors -- that exponential blowup is why
          simulating a real quantum computer classically gets hard fast, and it's exactly what the controls below
          let you watch happen directly. A gate is just a unitary matrix applied to that vector.
        </p>
      </Card>

      <h2 className="mt-6 mb-3 font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">
        1. Apply a gate and watch the full state
      </h2>
      <Card>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            Register size (qubits)
            <select
              value={nQubits}
              onChange={(e) => setNQubits(Number(e.target.value))}
              className="focus-ring rounded-sm border border-line bg-navy px-3 py-1.5 text-ink"
            >
              {Array.from({ length: MAX_QUBITS }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} qubit{n !== 1 ? 's' : ''} ({2 ** n} amplitudes)
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            Starting basis state
            <select
              value={initialValue}
              onChange={(e) => setInitialValue(Number(e.target.value))}
              className="focus-ring rounded-sm border border-line bg-navy px-3 py-1.5 text-ink"
            >
              {Array.from({ length: 2 ** nQubits }, (_, i) => i).map((v) => (
                <option key={v} value={v}>
                  |{v.toString(2).padStart(nQubits, '0')}⟩
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            Apply gate to qubit
            <select
              value={qubit}
              onChange={(e) => setQubit(Number(e.target.value))}
              className="focus-ring rounded-sm border border-line bg-navy px-3 py-1.5 text-ink"
            >
              {Array.from({ length: nQubits }, (_, i) => i).map((q) => (
                <option key={q} value={q}>
                  qubit {q}
                </option>
              ))}
            </select>
          </label>
        </div>

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
          <Button onClick={runGateDemo} disabled={gateDemo.state.status === 'loading'}>
            Apply {gate} to qubit {qubit} of |{initialValue.toString(2).padStart(nQubits, '0')}⟩
          </Button>
        </div>
        {gateDemo.state.status === 'error' && <div className="mt-3"><ErrorBanner message={gateDemo.state.message} /></div>}
        {gateData && (
          <div className="mt-4">
            <div className="mb-3 grid grid-cols-3 gap-3">
              <StatCard label="Qubits" value={gateData.n_qubits} />
              <StatCard label="State-vector dimension" value={2 ** gateData.n_qubits} hint={`2^${gateData.n_qubits}`} />
              <StatCard
                label="Nonzero amplitudes"
                value={gateData.amplitudes.filter((a) => a.probability > 1e-6).length}
              />
            </div>
            <AmplitudeView amplitudes={gateData.amplitudes} />
          </div>
        )}
      </Card>

      <h2 className="mt-6 mb-3 font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">
        2. Entanglement: the Bell state
      </h2>
      <Card>
        <p className="text-sm text-ink-muted">
          H on qubit 0, then a controlled-X (control=0, target=1): the two qubits become
          correlated so that measuring one instantly determines the other, even though neither
          has a definite value on its own.
        </p>
        <div className="mt-4">
          <Button onClick={() => void runBellState()} disabled={bellState.state.status === 'loading'}>
            Create a Bell state
          </Button>
        </div>
        {bellState.state.status === 'error' && <div className="mt-3"><ErrorBanner message={bellState.state.message} /></div>}
        {bellData && (
          <div className="mt-4">
            <div className="mb-3 grid grid-cols-3 gap-3">
              <StatCard label="Qubits" value={2} />
              <StatCard label="State-vector dimension" value={4} hint="2^2" />
              <StatCard
                label="Nonzero amplitudes"
                value={bellData.amplitudes.filter((a) => a.probability > 1e-6).length}
                hint="entangled, not just superposed"
              />
            </div>
            <AmplitudeView amplitudes={bellData.amplitudes} />
            <p className="mt-3 text-xs text-ink-muted">{bellData.explanation}</p>
          </div>
        )}
        <DocLink to="/docs/quantum-basics" title="Quantum Basics" />
      </Card>

      <NextStepNav />
    </div>
  )
}
