import { motion } from 'motion/react'

/** A schematic (not a literal gate-by-gate render) of the circuit quantum/shor.py actually
 * runs: n_count control wires in superposition, controlled modular exponentiation entangling
 * them with the target register, inverse QFT on the control register, then measurement.
 * Purely illustrative SVG -- the real gate counts are on this page's stat cards above,
 * measured from the real circuit, not drawn from this diagram. */
export default function CircuitDiagram() {
  const wireY = [40, 72, 104]
  const targetY = 150

  return (
    <svg viewBox="0 0 620 190" className="w-full" role="img" aria-label="Schematic of the Shor's algorithm circuit: Hadamards on control qubits, controlled modular exponentiation, inverse QFT, measurement">
      {/* control wires */}
      {wireY.map((y, i) => (
        <g key={i}>
          <line x1={70} y1={y} x2={550} y2={y} stroke="#3f3f46" strokeWidth="1.5" />
          <text x={20} y={y + 4} fill="#71717a" fontSize="11" fontFamily="var(--font-mono)">
            c{i}
          </text>
        </g>
      ))}
      <text x={20} y={wireY[2] + 22} fill="#52525b" fontSize="10" fontFamily="var(--font-mono)">
        ⋮ n_count
      </text>

      {/* target wire */}
      <line x1={70} y1={targetY} x2={550} y2={targetY} stroke="#3f3f46" strokeWidth="1.5" />
      <text x={12} y={targetY + 4} fill="#71717a" fontSize="11" fontFamily="var(--font-mono)">
        |1⟩
      </text>

      {/* H gates */}
      {wireY.map((y, i) => (
        <motion.g
          key={`h-${i}`}
          initial={{ opacity: 0, scale: 0.7 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.05, type: 'spring', stiffness: 300 }}
        >
          <rect x={95} y={y - 14} width="28" height="28" rx="2" fill="#000" stroke="#c99545" strokeWidth="1.5" />
          <text x={109} y={y + 5} fill="#c99545" fontSize="13" fontWeight="600" textAnchor="middle" fontFamily="var(--font-mono)">
            H
          </text>
        </motion.g>
      ))}

      {/* controlled-U block */}
      <motion.g initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
        {wireY.map((y, i) => (
          <circle key={i} cx={230} cy={y} r="4" fill="#e4e4e7" />
        ))}
        <line x1={230} y1={wireY[0]} x2={230} y2={targetY} stroke="#e4e4e7" strokeWidth="1.5" />
        <rect x={195} y={targetY - 16} width="70" height="32" rx="2" fill="#000" stroke="#e4e4e7" strokeWidth="1.5" />
        <text x={230} y={targetY + 5} fill="#e4e4e7" fontSize="12" fontWeight="600" textAnchor="middle" fontFamily="var(--font-mono)">
          U_a^x
        </text>
      </motion.g>

      {/* inverse QFT block spanning control wires */}
      <motion.g initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 }}>
        <rect x={340} y={wireY[0] - 20} width="90" height={wireY[2] - wireY[0] + 40} rx="2" fill="#000" stroke="#54c89a" strokeWidth="1.5" />
        <text x={385} y={(wireY[0] + wireY[2]) / 2 + 5} fill="#54c89a" fontSize="13" fontWeight="600" textAnchor="middle" fontFamily="var(--font-mono)">
          QFT⁻¹
        </text>
      </motion.g>

      {/* measurement meters */}
      {wireY.map((y, i) => (
        <motion.g
          key={`m-${i}`}
          initial={{ opacity: 0, scale: 0.7 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 + i * 0.05, type: 'spring', stiffness: 300 }}
        >
          <rect x={475} y={y - 14} width="30" height="28" rx="2" fill="#000" stroke="#a1a1aa" strokeWidth="1.5" />
          <path d={`M 481 ${y + 6} A 8 8 0 0 1 499 ${y + 6}`} stroke="#a1a1aa" strokeWidth="1.3" fill="none" />
          <line x1={490} y1={y + 6} x2={497} y2={y - 5} stroke="#a1a1aa" strokeWidth="1.3" />
        </motion.g>
      ))}
    </svg>
  )
}
