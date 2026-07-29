import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ResourceCurvePoint } from '../types/api'

/** The actual "cliff": both qubits and gates plotted on log-log axes across a fixed spread from
 * this project's smallest teaching sizes to a real RSA-2048 modulus (and past it), with a
 * reference line marking whatever bit size the slider above is currently on. Two small-multiple
 * charts, not one shared axis -- qubits (hundreds to low thousands) and Toffoli-equivalent gates
 * (billions to quadrillions) differ by so many orders of magnitude that even a shared log axis
 * would flatten the qubit line into visual noise next to the gate line; see the dataviz
 * principle this project already follows elsewhere (ClassicalBenchmarkPage) of never forcing
 * two very differently-scaled series onto one axis. */
export default function ResourceCurveChart({ points, currentBits }: { points: ResourceCurvePoint[]; currentBits: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <p className="mb-2 text-sm font-medium text-ink">Total qubits vs. modulus size</p>
        <div className="h-56 w-full">
          <ResponsiveContainer>
            <LineChart data={points} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1b2430" />
              <XAxis
                dataKey="bits"
                type="number"
                scale="log"
                domain={['auto', 'auto']}
                stroke="#8c919b"
                tick={{ fill: '#8c919b', fontSize: 11 }}
                label={{ value: 'RSA modulus size (bits, log scale)', position: 'insideBottom', offset: -6, fill: '#8c919b', fontSize: 10 }}
              />
              <YAxis scale="log" domain={['auto', 'auto']} stroke="#8c919b" tick={{ fill: '#8c919b', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#0b1018', border: '1px solid #1b2430', borderRadius: 2, fontSize: 12 }}
                labelFormatter={(bits) => `${bits}-bit modulus`}
                formatter={(v) => [Math.round(Number(v)).toLocaleString(), 'qubits']}
              />
              <ReferenceLine x={currentBits} stroke="#e3b45e" strokeDasharray="3 3" label={{ value: `${currentBits}`, fill: '#e3b45e', fontSize: 10, position: 'top' }} />
              <Line type="monotone" dataKey="total_qubits" name="this project" stroke="#c99545" strokeWidth={2.5} dot={{ r: 2.5, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-ink">Toffoli-equivalent gates vs. modulus size</p>
        <div className="h-56 w-full">
          <ResponsiveContainer>
            <LineChart data={points} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1b2430" />
              <XAxis
                dataKey="bits"
                type="number"
                scale="log"
                domain={['auto', 'auto']}
                stroke="#8c919b"
                tick={{ fill: '#8c919b', fontSize: 11 }}
                label={{ value: 'RSA modulus size (bits, log scale)', position: 'insideBottom', offset: -6, fill: '#8c919b', fontSize: 10 }}
              />
              <YAxis scale="log" domain={['auto', 'auto']} stroke="#8c919b" tick={{ fill: '#8c919b', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#0b1018', border: '1px solid #1b2430', borderRadius: 2, fontSize: 12 }}
                labelFormatter={(bits) => `${bits}-bit modulus`}
                formatter={(v) => [Number(v).toExponential(2), 'gates']}
              />
              <ReferenceLine x={currentBits} stroke="#e3b45e" strokeDasharray="3 3" label={{ value: `${currentBits}`, fill: '#e3b45e', fontSize: 10, position: 'top' }} />
              <Line type="monotone" dataKey="toffoli_equivalent_gates" name="this project" stroke="#8065b8" strokeWidth={2.5} dot={{ r: 2.5, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
