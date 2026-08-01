import { useState } from 'react'
import { Link } from 'react-router'
import { BlockMath } from 'react-katex'
import { apiPost } from '../api/client'
import { useAction } from '../hooks/useApi'
import type { QftDemoResponse } from '../types/api'
import { Button, Card, ErrorBanner, PageHeader, StatCard, SuccessBanner } from '../components/ui'
import AmplitudeView from '../components/AmplitudeView'
import PhaseDialRow from '../components/PhaseDialRow'
import CodePanel, { type CodeSnippet } from '../components/CodePanel'
import NextStepNav from '../components/NextStepNav'
import DocLink from '../components/DocLink'

// Copied verbatim from this repository's own quantum/qft.py.
const QFT_SNIPPETS: Record<string, CodeSnippet> = {
  forward: {
    file: 'quantum/qft.py',
    startLine: 26,
    code:
      'def apply_qft(register: GateSink, qubits: list[int]) -> None:\n' +
      '    """Apply the QFT circuit to `qubits` (qubits[0] most significant) in place."""\n' +
      '    n = len(qubits)\n' +
      '    for i in range(n):\n' +
      '        target = qubits[i]\n' +
      '        register.apply_gate(H, target)\n' +
      '        for j in range(i + 1, n):\n' +
      '            control = qubits[j]\n' +
      '            k = j - i + 1  # rotation R_k = diag(1, e^{2*pi*i / 2^k})\n' +
      '            register.apply_controlled_gate(phase(2 * np.pi / 2**k), control, target)\n' +
      '    for i in range(n // 2):\n' +
      '        register.apply_swap(qubits[i], qubits[n - 1 - i])',
    notes: {
      29: 'One qubit at a time, most significant first -- n Hadamards and O(n²) controlled-phase gates total.',
      31: 'The Hadamard is what actually creates superposition for this qubit -- everything else is phase.',
      34: 'The rotation angle shrinks as k grows -- qubits further apart influence each other less.',
      35: 'Applies e^{iπ/2^(k-1)} conditionally -- the actual phase-encoding step, once per qubit pair.',
      36: 'A final bit-order reversal -- the QFT\'s own convention, undone by apply_inverse_qft\'s first step.',
    },
  },
}

export default function QftPage() {
  const [nQubits, setNQubits] = useState(3)
  const [initialValue, setInitialValue] = useState(1)
  const qft = useAction((inverse: boolean) =>
    apiPost<QftDemoResponse>('/quantum/qft-demo', { n_qubits: nQubits, initial_value: initialValue, inverse }),
  )

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Quantum Fourier Transform & Period-Finding"
        description="The QFT doesn't factor anything by itself -- it turns periodic structure in a superposition into a measurable peak pattern, which is what Shor's algorithm's period-finding step relies on."
      />

      <h2 className="mb-3 font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">
        0. Apply the QFT and watch it happen
      </h2>
      <Card>
        <BlockMath math="\text{QFT}|x\rangle = \frac{1}{\sqrt{2^n}} \sum_{y=0}^{2^n-1} e^{2\pi i x y / 2^n} |y\rangle" />
        <p className="mt-2 text-sm text-ink-muted">
          Run against this project's real <code className="text-gold-warm">quantum/qft.py</code>{' '}
          circuit (H + controlled-phase gates), which is independently verified against this
          exact matrix definition in the test suite -- shown below as a live validation, not a
          claim.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            Qubits
            <input
              type="number"
              min={1}
              max={6}
              value={nQubits}
              onChange={(e) => setNQubits(Number(e.target.value))}
              className="focus-ring w-24 rounded-sm border border-line bg-navy px-3 py-1.5 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            Initial value |x⟩
            <input
              type="number"
              min={0}
              max={2 ** nQubits - 1}
              value={initialValue}
              onChange={(e) => setInitialValue(Number(e.target.value))}
              className="focus-ring w-24 rounded-sm border border-line bg-navy px-3 py-1.5 text-ink"
            />
          </label>
          <Button onClick={() => qft.run(false)} disabled={qft.state.status === 'loading'}>
            Apply QFT
          </Button>
          <Button variant="secondary" onClick={() => qft.run(true)} disabled={qft.state.status === 'loading'}>
            Apply inverse QFT
          </Button>
        </div>

        {qft.state.status === 'error' && <div className="mt-3"><ErrorBanner message={qft.state.message} /></div>}
        {qft.state.status === 'success' && (
          <div className="mt-4 space-y-4">
            {qft.state.data.matches_exact_dft_matrix ? (
              <SuccessBanner>
                Matches the exact DFT matrix (max amplitude error: {qft.state.data.max_amplitude_error_vs_dft_matrix.toExponential(2)}) --
                this circuit provably implements the definition above, not an approximation of it.
              </SuccessBanner>
            ) : (
              <ErrorBanner message="Did not match the exact DFT matrix -- unexpected, please report this." />
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Qubits" value={qft.state.data.n_qubits} />
              <StatCard label="State-vector dimension" value={2 ** qft.state.data.n_qubits} hint={`2^${qft.state.data.n_qubits}`} />
              <StatCard label="Matches exact DFT" value={qft.state.data.matches_exact_dft_matrix ? 'Yes' : 'No'} />
              <StatCard label="Max amplitude error" value={qft.state.data.max_amplitude_error_vs_dft_matrix.toExponential(2)} />
            </div>
            {/* The phase itself -- what a probability bar chart can't show at all. Before a QFT,
                every basis state is equal length and (for a definite input) already in phase;
                after one, the arrows fan out to their real computed angles. This is the actual
                mechanism period-finding depends on, not just the peaked-vs-flat probability
                shape below. */}
            <div className="rounded-sm border border-line bg-navy p-4">
              <p className="mb-3 text-center font-mono text-xs text-ink-muted uppercase">
                Phase, before &amp; after (angle = phase, length = relative magnitude)
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-center text-xs text-ink-muted">Before</p>
                  <PhaseDialRow amplitudes={qft.state.data.before} />
                </div>
                <div>
                  <p className="mb-2 text-center text-xs text-ink-muted">After</p>
                  <PhaseDialRow amplitudes={qft.state.data.after} />
                </div>
              </div>
            </div>
            {/* Stacked, not side-by-side: the amplitude table needs ~560px to show all three
                columns without truncating, which a two-up layout can't give it on any real
                screen width (a 2-column split of a ~900px card leaves ~430px each). Full width,
                one above the other, means the Probability column is never fighting for space. */}
            <div className="grid gap-6">
              <AmplitudeView title="Before" amplitudes={qft.state.data.before} />
              <AmplitudeView title="After" amplitudes={qft.state.data.after} />
            </div>
          </div>
        )}
      </Card>

      <h2 className="mt-6 mb-3 font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">
        1. The actual code behind this step
      </h2>
      <Card>
        <CodePanel stageId="forward" snippets={QFT_SNIPPETS} />
      </Card>

      <h2 className="mt-6 mb-3 font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">
        2. How this connects to period-finding
      </h2>
      <Card>
        <p className="text-sm text-ink-muted">
          In Shor's algorithm, a control register is put into superposition, then entangled with
          a target register via controlled modular exponentiation (so the target register's
          value depends periodically on the control register's value, with period equal to the
          order <em>r</em> we're trying to find). Applying the inverse QFT to the control
          register concentrates the measurement probability at multiples of{' '}
          <code>2^n_count / r</code> -- try it yourself on the{' '}
          <Link to="/shor" className="text-gold underline underline-offset-2">Shor's Algorithm Lab</Link> page.
        </p>
        <DocLink to="/docs/qft-and-period-finding" title="QFT & Period-Finding" />
      </Card>

      <NextStepNav />
    </div>
  )
}
