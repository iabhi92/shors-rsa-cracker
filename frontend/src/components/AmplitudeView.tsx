import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Amplitude } from '../types/api'
import { Table } from './ui'

export default function AmplitudeView({ amplitudes, title }: { amplitudes: Amplitude[]; title?: string }) {
  const chartData = amplitudes.map((a) => ({ state: `|${a.basis_state}⟩`, probability: a.probability }))

  return (
    // min-w-0 overrides the grid/flex-item default of min-width:auto -- without it, a parent
    // grid (e.g. QftPage's side-by-side Before/After columns) refuses to shrink this column
    // below the table's own min-w-[560px], so the table overflows the whole page instead of
    // scrolling inside its own overflow-x-auto wrapper, silently clipping the Probability
    // column off the right edge instead of making it reachable.
    <div className="min-w-0">
      {title && <h3 className="mb-2 text-sm font-medium text-ink-muted">{title}</h3>}
      <div className="h-56 w-full">
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1b2430" />
            <XAxis dataKey="state" stroke="#8c919b" fontSize={12} />
            <YAxis stroke="#8c919b" fontSize={12} domain={[0, 1]} />
            <Tooltip
              contentStyle={{ background: '#0b1018', border: '1px solid #1b2430', fontSize: 12 }}
              formatter={(v) => (typeof v === 'number' ? v.toFixed(4) : v)}
            />
            <Bar dataKey="probability" fill="#c99545" radius={[1, 1, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3">
        <Table>
          <thead>
            <tr className="border-b border-line text-xs tracking-wide text-ink-muted uppercase">
              <th className="px-3 py-1.5">Basis state</th>
              <th className="px-3 py-1.5">Amplitude</th>
              <th className="px-3 py-1.5">Probability</th>
            </tr>
          </thead>
          <tbody>
            {amplitudes
              .filter((a) => a.probability > 1e-6)
              .map((a) => (
                <tr key={a.basis_state} className="border-b border-line/60 font-mono text-xs last:border-0">
                  <td className="px-3 py-1.5 text-ink">|{a.basis_state}⟩</td>
                  <td className="px-3 py-1.5 text-ink-muted">
                    {a.real.toFixed(3)} {a.imag >= 0 ? '+' : '-'} {Math.abs(a.imag).toFixed(3)}i
                  </td>
                  <td className="px-3 py-1.5 text-gold-warm">{a.probability.toFixed(4)}</td>
                </tr>
              ))}
          </tbody>
        </Table>
      </div>
    </div>
  )
}
