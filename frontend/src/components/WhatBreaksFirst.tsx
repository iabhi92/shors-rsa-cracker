import { useEffect } from 'react'
import { motion } from 'motion/react'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { apiPost } from '../api/client'
import { useAction } from '../hooks/useApi'
import type { ClassicalTimeEstimateResponse, ResourceEstimateResponse } from '../types/api'
import { Card } from './ui'
import { LARGEST_ANNOUNCED_CHIP_NAME, LARGEST_ANNOUNCED_CHIP_QUBITS } from '../lib/quantumHardwareFacts'

const SECONDS_PER_YEAR = 365.25 * 24 * 3600

type Severity = 'ok' | 'warn' | 'critical'

const SEVERITY_STYLE: Record<Severity, { icon: typeof CheckCircle2; text: string; border: string; bg: string }> = {
  ok: { icon: CheckCircle2, text: 'text-success', border: 'border-success/40', bg: 'bg-success/10' },
  warn: { icon: AlertTriangle, text: 'text-gold-warm', border: 'border-gold/40', bg: 'bg-gold/10' },
  critical: { icon: XCircle, text: 'text-red-300', border: 'border-red-400/30', bg: 'bg-red-400/10' },
}

function classicalSeverity(log10Seconds: number): Severity {
  if (log10Seconds < Math.log10(60)) return 'ok'
  if (log10Seconds < Math.log10(SECONDS_PER_YEAR)) return 'warn'
  return 'critical'
}

function qubitSeverity(qubits: number): Severity {
  if (qubits <= LARGEST_ANNOUNCED_CHIP_QUBITS) return 'ok'
  if (qubits <= LARGEST_ANNOUNCED_CHIP_QUBITS * 1000) return 'warn'
  return 'critical'
}

function Layer({ severity, title, value, detail }: { severity: Severity; title: string; value: string; detail: string }) {
  const { icon: Icon, text, border, bg } = SEVERITY_STYLE[severity]
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col gap-1.5 rounded-sm border p-4 ${border} ${bg}`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${text}`} />
        <span className="font-mono text-xs tracking-wide text-ink-muted uppercase">{title}</span>
      </div>
      <p className={`font-mono text-lg font-semibold ${text}`}>{value}</p>
      <p className="text-xs text-ink-muted">{detail}</p>
    </motion.div>
  )
}

/** Three real layers, side by side, for the same bit size: this project's own classical attacks
 * (extrapolated from a real measurement, not GNFS -- see attacker/extrapolation.py), this
 * project's own honest gate-level qubit estimate, and the real published state of the art for
 * quantum hardware. None of these is "the" answer to "when does RSA break" -- they're three
 * different, independently real answers to three different questions, shown together so the gap
 * between them is the actual takeaway, not a single asserted verdict. */
export default function WhatBreaksFirst({ bits, resourceEstimate }: { bits: number; resourceEstimate: ResourceEstimateResponse | null }) {
  const classical = useAction((bits: number) => apiPost<ClassicalTimeEstimateResponse>('/classical/time-estimate', { bits }))

  useEffect(() => {
    const t = setTimeout(() => classical.run(bits), 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bits])

  const classicalData = classical.state.status === 'success' ? classical.state.data : null
  const qubits = resourceEstimate?.this_project.total_qubits ?? null
  const gapMultiple = qubits ? qubits / LARGEST_ANNOUNCED_CHIP_QUBITS : null

  return (
    <Card className="mt-6">
      <h2 className="font-medium text-ink">What actually breaks first, at {bits} bits</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Three independently real numbers for the same key size -- not a single verdict, since they're answers to three
        different questions (see each card).
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {classicalData ? (
          <Layer
            severity={classicalSeverity(classicalData.trial_division_log10_seconds)}
            title="This project's classical attack"
            value={classicalData.trial_division_human}
            detail={`Trial division, extrapolated from a real measured run at ${classicalData.reference_bits} bits via its own O(√n) complexity -- not GNFS, the real best-known algorithm.`}
          />
        ) : (
          <div className="animate-pulse rounded-sm border border-line bg-navy p-4 text-xs text-ink-muted">computing…</div>
        )}

        {qubits != null ? (
          <Layer
            severity={qubitSeverity(qubits)}
            title="This project's qubit estimate"
            value={`${qubits.toLocaleString()} qubits`}
            detail="This project's own unoptimized, closed-form gate-level estimate (quantum/resource_estimate.py) -- see the chart below for the full curve."
          />
        ) : (
          <div className="rounded-sm border border-line bg-navy p-4 text-xs text-ink-muted">move the slider above to compute</div>
        )}

        {gapMultiple != null && (
          <Layer
            severity={qubitSeverity(qubits!)}
            title="vs. real quantum hardware today"
            value={gapMultiple <= 1 ? 'within reach' : `${gapMultiple < 1000 ? gapMultiple.toFixed(1) : gapMultiple.toExponential(1)}x`}
            detail={`${LARGEST_ANNOUNCED_CHIP_NAME}, the largest gate-model chip publicly announced, has ${LARGEST_ANNOUNCED_CHIP_QUBITS.toLocaleString()} qubits -- and that's raw qubit count, before any fault-tolerance overhead at all.`}
          />
        )}
      </div>
    </Card>
  )
}
