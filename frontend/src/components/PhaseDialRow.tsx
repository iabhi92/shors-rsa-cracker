import PhaseDial from './PhaseDial'
import type { Amplitude } from '../types/api'

const DIAL_COLORS = ['#c99545', '#8065b8', '#54c89a', '#204a66', '#e3b45e', '#e05a4e', '#cfe3ee', '#8c919b']

/** One phase dial per basis state, in a row -- the actual complex amplitude a bar chart's height
 * alone throws away. Colour is assigned by position, cycling through this project's own palette,
 * so each basis state keeps a stable identity across a before/after pair instead of every dial
 * looking identical. */
export default function PhaseDialRow({ amplitudes }: { amplitudes: Amplitude[] }) {
  const magnitudes = amplitudes.map((a) => Math.sqrt(a.real * a.real + a.imag * a.imag))
  const maxMagnitude = Math.max(...magnitudes, 0)

  return (
    <div className="flex flex-wrap justify-center gap-3">
      {amplitudes.map((a, i) => (
        <div key={a.basis_state} className="flex flex-col items-center gap-1">
          <PhaseDial
            magnitude={magnitudes[i]}
            phase={Math.atan2(a.imag, a.real)}
            maxMagnitude={maxMagnitude}
            color={DIAL_COLORS[i % DIAL_COLORS.length]}
            active
          />
          <span className="font-mono text-[0.6rem] text-ink-muted">|{a.basis_state}⟩</span>
        </div>
      ))}
    </div>
  )
}
