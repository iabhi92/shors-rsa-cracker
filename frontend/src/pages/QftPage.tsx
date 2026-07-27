import { useState } from 'react'
import { BlockMath } from 'react-katex'
import { apiPost } from '../api/client'
import { useAction } from '../hooks/useApi'
import type { QftDemoResponse } from '../types/api'
import { Button, Card, ErrorBanner, PageHeader, SuccessBanner } from '../components/ui'
import AmplitudeView from '../components/AmplitudeView'

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
            <div className="grid gap-6 sm:grid-cols-2">
              <AmplitudeView title="Before" amplitudes={qft.state.data.before} />
              <AmplitudeView title="After" amplitudes={qft.state.data.after} />
            </div>
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <h2 className="font-medium text-ink">How this connects to period-finding</h2>
        <p className="mt-2 text-sm text-ink-muted">
          In Shor's algorithm, a control register is put into superposition, then entangled with
          a target register via controlled modular exponentiation (so the target register's
          value depends periodically on the control register's value, with period equal to the
          order <em>r</em> we're trying to find). Applying the inverse QFT to the control
          register concentrates the measurement probability at multiples of{' '}
          <code>2^n_count / r</code> -- try it yourself on the{' '}
          <a href="/shor" className="text-gold underline underline-offset-2">Shor's Algorithm Lab</a> page.
        </p>
      </Card>
    </div>
  )
}
