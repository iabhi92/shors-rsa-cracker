import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'

export function BenchmarkSketch() {
  return (
    <svg viewBox="0 0 64 40" className="h-10 w-16" aria-hidden="true">
      <polyline points="2,34 14,30 24,22 34,24 44,10 54,14 62,2" fill="none" stroke="#c99545" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="2" y1="36" x2="62" y2="36" stroke="#8c919b" strokeWidth="1" opacity="0.4" />
    </svg>
  )
}

export function OrbitSketch() {
  return (
    <svg viewBox="0 0 64 40" className="h-10 w-16" aria-hidden="true">
      <ellipse cx="32" cy="20" rx="28" ry="12" fill="none" stroke="#8065b8" strokeWidth="1.5" />
      <ellipse cx="32" cy="20" rx="14" ry="16" fill="none" stroke="#c99545" strokeWidth="1.25" opacity="0.7" />
      <circle cx="60" cy="20" r="2" fill="#e3b45e" />
    </svg>
  )
}

export function WaveSketch() {
  return (
    <svg viewBox="0 0 64 40" className="h-10 w-16" aria-hidden="true">
      <path d="M 2 24 Q 8 12, 14 24 T 26 24" fill="none" stroke="#8065b8" strokeWidth="1.25" opacity="0.7" />
      <path d="M 26 24 Q 30 6, 34 30 Q 38 6, 42 30 Q 46 8, 50 26 Q 54 14, 58 24 L 62 22" fill="none" stroke="#c99545" strokeWidth="1.5" />
    </svg>
  )
}

export function CircuitSketch() {
  return (
    <svg viewBox="0 0 64 40" className="h-10 w-16" aria-hidden="true">
      <line x1="2" y1="10" x2="62" y2="10" stroke="#8c919b" strokeWidth="1" opacity="0.6" />
      <line x1="2" y1="22" x2="62" y2="22" stroke="#8c919b" strokeWidth="1" opacity="0.6" />
      <line x1="2" y1="34" x2="62" y2="34" stroke="#8c919b" strokeWidth="1" opacity="0.6" />
      <rect x="16" y="4" width="12" height="12" fill="none" stroke="#c99545" strokeWidth="1.25" />
      <rect x="38" y="16" width="14" height="24" fill="none" stroke="#8065b8" strokeWidth="1.25" />
      <circle cx="22" cy="22" r="1.6" fill="#e3b45e" />
      <circle cx="22" cy="34" r="1.6" fill="#e3b45e" />
    </svg>
  )
}

export function EditorialModuleCard({
  to,
  number,
  title,
  description,
  cta,
  sketch,
}: {
  to: string
  number: string
  title: string
  description: string
  cta: string
  sketch: ReactNode
}) {
  return (
    <Link
      to={to}
      className="focus-ring group flex h-full flex-col justify-between rounded-sm border border-line bg-surface p-5 transition-all duration-200 hover:-translate-y-1 hover:border-gold/40"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="font-mono text-xs text-gold">{number}</span>
          <h3 className="mt-1 font-display text-lg tracking-wide text-ink uppercase">{title}</h3>
          <p className="mt-1.5 max-w-sm font-sans text-sm text-ink-muted">{description}</p>
        </div>
        <div className="shrink-0 opacity-80 transition-opacity group-hover:opacity-100">{sketch}</div>
      </div>
      <span className="mt-4 inline-flex items-center gap-1.5 font-mono text-xs font-medium text-gold-warm">
        {cta}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}
