import { Link } from 'react-router'
import { motion } from 'motion/react'
import { CheckCircle2 } from 'lucide-react'
import { apiGet } from '../../api/client'
import { useFetchOnMount } from '../../hooks/useApi'
import type { IbmHardwareResponse } from '../../types/api'
import { Card } from '../ui'

/** A third kind of comparison alongside BackendRace (4 simulators racing each other) and
 * QuantumClassicalRace (quantum vs. classical) -- how the simulators above actually compare to
 * the one point of real hardware ground truth this project has. This deliberately does NOT try
 * to "race" real IBM hardware live: a real hardware job goes through an actual queue (minutes to
 * hours, not seconds), and this backend never holds IBM credentials at all (see
 * backend/app/routers/ibm.py) -- there's no live hardware result to race against for an
 * arbitrary N a visitor picks. What's real and available is a small set of *stored* runs
 * (notes/05-real-hardware-validation.md); this surfaces whichever of those match the N currently
 * selected above, so the comparison is honest about being retrospective, not a live third lane. */
export default function RealHardwareCheckpoint({ n }: { n: number }) {
  const results = useFetchOnMount(() => apiGet<IbmHardwareResponse>('/ibm-hardware/results'), [])
  if (results.status !== 'success') return null

  const matches = results.data.runs.filter((run) => run.N === n)
  if (matches.length === 0) return null

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="border-success/30 bg-success/5">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <div>
            <h3 className="font-medium text-ink">Real hardware checkpoint for N = {n}</h3>
            <p className="mt-1 text-sm text-ink-muted">
              This isn't a third live lane in the race above -- a real IBM job runs through an actual queue (minutes to
              hours), and this backend never holds IBM credentials (see{' '}
              <Link to="/ibm-hardware" className="text-gold underline underline-offset-2">
                IBM Hardware Validation
              </Link>
              ). But this exact N has really been run once, and the result is stored, not simulated:
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {matches.map((run) => (
                <li key={run.job_id} className="flex flex-wrap items-center gap-x-2 font-mono text-xs text-ink-muted">
                  <span className="text-ink">
                    a={run.a}, backend={run.backend_name}
                  </span>
                  <span>&middot;</span>
                  <span>total variation distance from theory: {run.total_variation_distance.toFixed(4)}</span>
                  <span>&middot;</span>
                  <span>{run.shots} real shots</span>
                </li>
              ))}
            </ul>
            <Link to="/ibm-hardware" className="mt-2 inline-block text-sm text-gold underline underline-offset-2 hover:text-gold-warm">
              See the full noise/theory comparison &rarr;
            </Link>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
