import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../api/client'
import { useAction, useFetchOnMount } from '../hooks/useApi'
import type { ResourceCurveResponse, ResourceEstimateResponse } from '../types/api'
import { Card, ErrorBanner, PageHeader, Spinner, StatCard, WarningBanner } from '../components/ui'
import DoomsdayClock from '../components/DoomsdayClock'
import ResourceCurveChart from '../components/ResourceCurveChart'
import WhatBreaksFirst from '../components/WhatBreaksFirst'

const PRESETS = [128, 512, 1024, 2048]
// estimate_for_rsa_bits is closed-form (no simulation) -- cheap enough to recompute on every
// slider tick, but the request itself still shouldn't fire on literally every pixel of drag, so
// this waits for the slider to actually settle for a moment first.
const SLIDER_DEBOUNCE_MS = 200

export default function ResourceEstimatePage() {
  const [bits, setBits] = useState(2048)
  const estimate = useAction((bits: number) => apiPost<ResourceEstimateResponse>('/resource-estimate', { bits }))
  const curve = useFetchOnMount(() => apiGet<ResourceCurveResponse>('/resource-estimate/curve'), [])

  useEffect(() => {
    const t = setTimeout(() => estimate.run(bits), SLIDER_DEBOUNCE_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bits])

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Resource Estimation"
        description="How many qubits and gates this project's honest gate-level circuit would need at a real RSA key size -- computed in closed form (quantum/resource_estimate.py), proven to exactly match real measured gate counts at small scale before being trusted to extrapolate here."
      />

      <WarningBanner>
        This is a resource <em>estimate</em>, not a simulation -- nothing can actually run a
        thousands-of-qubits circuit. See the methodology note below for exactly what's measured
        vs. extrapolated.
      </WarningBanner>

      <div className="mt-6">
        <DoomsdayClock />
      </div>

      <Card className="mt-6">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            RSA modulus size: <span className="font-mono text-ink">{bits} bits</span>
            <input
              type="range"
              min={8}
              max={4096}
              step={1}
              value={bits}
              onChange={(e) => setBits(Number(e.target.value))}
              className="accent-gold"
            />
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <input
              type="number"
              min={8}
              max={4096}
              value={bits}
              onChange={(e) => setBits(Number(e.target.value))}
              className="focus-ring w-28 rounded-sm border border-line bg-navy px-3 py-1.5 text-ink"
            />
            <div className="flex gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setBits(p)}
                  className={`focus-ring rounded-sm border px-2.5 py-1 text-xs ${
                    bits === p ? 'border-gold text-gold-warm' : 'border-line text-ink-muted hover:bg-line'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            {estimate.state.status === 'loading' && <span className="font-mono text-xs text-ink-muted">computing…</span>}
          </div>
        </div>
        {estimate.state.status === 'error' && <div className="mt-3"><ErrorBanner message={estimate.state.message} /></div>}
      </Card>

      {estimate.state.status === 'success' && (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase">This project (unoptimized)</h2>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Total qubits" value={estimate.state.data.this_project.total_qubits} />
              <StatCard label="Toffoli-equiv. gates" value={estimate.state.data.this_project.toffoli_equivalent_gates} />
              <StatCard label="n_count" value={estimate.state.data.this_project.n_count} />
              <StatCard label="n_target" value={estimate.state.data.this_project.n_target} />
            </div>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase">Gidney &amp; Ekerå 2019 (published)</h2>
            <div className="grid grid-cols-1 gap-3">
              <StatCard label="Logical qubits" value={Math.round(estimate.state.data.gidney_ekera_2019.logical_qubits)} />
              <StatCard label="Toffoli gates" value={estimate.state.data.gidney_ekera_2019.toffoli_gates.toExponential(3)} />
              <StatCard label="Physical qubits (headline)" value={estimate.state.data.gidney_ekera_2019.physical_qubits_headline} />
            </div>
          </div>
        </div>
      )}

      <WhatBreaksFirst bits={bits} resourceEstimate={estimate.state.status === 'success' ? estimate.state.data : null} />

      <Card className="mt-6">
        <h2 className="font-medium text-ink">The cliff: how fast this actually grows</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Every point below is a real closed-form computation at that bit size, not an interpolation -- the dashed line
          marks wherever the slider above is currently set.
        </p>
        <div className="mt-4">
          {curve.status === 'loading' && <Spinner label="Computing the curve…" />}
          {curve.status === 'error' && <ErrorBanner message={curve.message} />}
          {curve.status === 'success' && <ResourceCurveChart points={curve.data.points} currentBits={bits} />}
        </div>
      </Card>

      {estimate.state.status === 'success' && (
        <Card className="mt-6">
          <h2 className="font-medium text-ink">Methodology</h2>
          <p className="mt-2 text-sm text-ink-muted">{estimate.state.data.methodology_note}</p>
        </Card>
      )}
    </div>
  )
}
