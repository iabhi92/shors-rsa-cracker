import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { IbmHardwareResult } from '../types/api'

/** The two side-by-side AmplitudeViews on IbmHardwarePage show the same two distributions in
 * separate panels -- correct, but it makes comparing them work: line up two charts by eye,
 * cross-reference the x-axis. This puts real hardware counts and the theoretical prediction on
 * one shared axis, grouped bar by bar, so the noise itself -- the gap between the two bars at
 * each basis state -- is the thing you see first, not something you have to compute. Basis
 * states where the real hardware measured nonzero probability but the theoretical distribution
 * says exactly zero (states this circuit provably cannot produce) get their real-hardware bar
 * tinted red instead of violet -- literal decoherence/readout noise, not sampling variance on
 * an allowed outcome. */
export default function NoiseOverlayChart({ run }: { run: IbmHardwareResult }) {
  const states = Array.from(new Set([...Object.keys(run.theoretical_distribution), ...Object.keys(run.counts)]))
    .map(Number)
    .sort((a, b) => a - b)

  const data = states.map((x) => {
    const key = String(x)
    const theoretical = run.theoretical_distribution[key] ?? 0
    const real = run.counts[key] ? run.counts[key] / run.shots : 0
    return {
      state: `|${x}⟩`,
      theoretical,
      real,
      impossible: theoretical === 0 && real > 0,
    }
  })

  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-sm font-medium text-ink-muted">Simulated vs. real hardware, overlaid</h3>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1b2430" />
            <XAxis dataKey="state" stroke="#8c919b" fontSize={12} />
            <YAxis stroke="#8c919b" fontSize={12} domain={[0, 1]} />
            <Tooltip
              contentStyle={{ background: '#0b1018', border: '1px solid #1b2430', fontSize: 12 }}
              formatter={(v) => (typeof v === 'number' ? v.toFixed(4) : v)}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: '#8c919b' }} />
            <Bar dataKey="theoretical" name="Simulated (ideal)" fill="#c99545" radius={[1, 1, 0, 0]} />
            <Bar dataKey="real" name="Real hardware" fill="#8065b8" radius={[1, 1, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.state} fill={d.impossible ? '#e06c5c' : '#8065b8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
