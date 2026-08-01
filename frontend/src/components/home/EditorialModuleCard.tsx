import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'

export function BenchmarkSketch() {
  return (
    <svg viewBox="0 0 64 40" className="h-full w-full" aria-hidden="true">
      <polyline points="2,34 14,30 24,22 34,24 44,10 54,14 62,2" fill="none" stroke="#c99545" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="2" y1="36" x2="62" y2="36" stroke="#8c919b" strokeWidth="1" opacity="0.4" />
    </svg>
  )
}

export function OrbitSketch() {
  return (
    <svg viewBox="0 0 64 40" className="h-full w-full" aria-hidden="true">
      <ellipse cx="32" cy="20" rx="28" ry="12" fill="none" stroke="#8065b8" strokeWidth="1.5" />
      <ellipse cx="32" cy="20" rx="14" ry="16" fill="none" stroke="#c99545" strokeWidth="1.25" opacity="0.7" />
      <circle cx="60" cy="20" r="2" fill="#e3b45e" />
    </svg>
  )
}

export function WaveSketch() {
  return (
    <svg viewBox="0 0 64 40" className="h-full w-full" aria-hidden="true">
      <path d="M 2 24 Q 8 12, 14 24 T 26 24" fill="none" stroke="#8065b8" strokeWidth="1.25" opacity="0.7" />
      <path d="M 26 24 Q 30 6, 34 30 Q 38 6, 42 30 Q 46 8, 50 26 Q 54 14, 58 24 L 62 22" fill="none" stroke="#c99545" strokeWidth="1.5" />
    </svg>
  )
}

export function CircuitSketch() {
  return (
    <svg viewBox="0 0 64 40" className="h-full w-full" aria-hidden="true">
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

export function HardwareSketch() {
  return (
    <svg viewBox="0 0 64 40" className="h-full w-full" aria-hidden="true">
      <rect x="20" y="10" width="24" height="20" fill="none" stroke="#c99545" strokeWidth="1.5" />
      <line x1="8" y1="14" x2="20" y2="14" stroke="#8c919b" strokeWidth="1" opacity="0.6" />
      <line x1="8" y1="20" x2="20" y2="20" stroke="#8c919b" strokeWidth="1" opacity="0.6" />
      <line x1="8" y1="26" x2="20" y2="26" stroke="#8c919b" strokeWidth="1" opacity="0.6" />
      <line x1="44" y1="14" x2="56" y2="14" stroke="#8c919b" strokeWidth="1" opacity="0.6" />
      <line x1="44" y1="20" x2="56" y2="20" stroke="#8c919b" strokeWidth="1" opacity="0.6" />
      <line x1="44" y1="26" x2="56" y2="26" stroke="#8c919b" strokeWidth="1" opacity="0.6" />
      <circle cx="32" cy="20" r="7" fill="none" stroke="#e3b45e" strokeWidth="1" opacity="0.5" />
      <circle cx="32" cy="20" r="3" fill="#e3b45e" />
    </svg>
  )
}

export function AttackSurfaceSketch() {
  // A crosshair on the key at center, with four converging lines from four dots colored to
  // match the Attack Surface Map's own category colors (red=key recovery, gold=message
  // recovery, violet=message manipulation, blue=side-channel) -- not arbitrary decoration.
  return (
    <svg viewBox="0 0 64 40" className="h-full w-full" aria-hidden="true">
      <circle cx="32" cy="20" r="3" fill="#e05a4e" />
      <circle cx="32" cy="20" r="9" fill="none" stroke="#e05a4e" strokeWidth="1" opacity="0.5" />
      <line x1="32" y1="4" x2="32" y2="11" stroke="#e05a4e" strokeWidth="1" opacity="0.6" />
      <line x1="32" y1="29" x2="32" y2="36" stroke="#e05a4e" strokeWidth="1" opacity="0.6" />
      <line x1="16" y1="20" x2="23" y2="20" stroke="#e05a4e" strokeWidth="1" opacity="0.6" />
      <line x1="41" y1="20" x2="48" y2="20" stroke="#e05a4e" strokeWidth="1" opacity="0.6" />
      <line x1="10" y1="10" x2="27" y2="17" stroke="#8c919b" strokeWidth="0.75" opacity="0.4" />
      <line x1="54" y1="10" x2="37" y2="17" stroke="#8c919b" strokeWidth="0.75" opacity="0.4" />
      <line x1="10" y1="30" x2="27" y2="23" stroke="#8c919b" strokeWidth="0.75" opacity="0.4" />
      <line x1="54" y1="30" x2="37" y2="23" stroke="#8c919b" strokeWidth="0.75" opacity="0.4" />
      <circle cx="10" cy="10" r="1.6" fill="#e05a4e" />
      <circle cx="54" cy="10" r="1.6" fill="#e3b45e" />
      <circle cx="10" cy="30" r="1.6" fill="#8065b8" />
      <circle cx="54" cy="30" r="1.6" fill="#204a66" />
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
  accent = '#c99545',
}: {
  to: string
  number: string
  title: string
  description: string
  cta: string
  sketch: ReactNode
  /** Each module gets its own accent -- the top rule, the hover border, and the corner glow
   * behind its sketch -- instead of every card defaulting to the same gold regardless of
   * subject, so "Start here" reads as four distinct doors rather than one card repeated four
   * times with different words in it. */
  accent?: string
}) {
  return (
    <Link
      to={to}
      className="group relative flex h-full flex-col overflow-hidden rounded-sm border border-line bg-surface transition-all duration-200 hover:-translate-y-1"
    >
      {/* an accent-colored ring that fades in on hover, layered over the neutral base border --
          avoids reaching for JS mouse handlers just to swap one CSS color on :hover. */}
      <div
        className="pointer-events-none absolute inset-0 rounded-sm border opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{ borderColor: accent }}
        aria-hidden
      />

      <div className="h-0.75 w-full shrink-0" style={{ backgroundColor: accent }} aria-hidden />

      {/* a soft glow seated behind the sketch, in the module's own accent -- turns the empty
          space a short description would otherwise leave into part of the composition instead
          of dead air between the copy and the CTA. */}
      <div
        className="pointer-events-none absolute top-8 right-0 h-40 w-40 rounded-full opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-35"
        style={{ backgroundColor: accent }}
        aria-hidden
      />

      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          <span className="font-mono text-sm font-semibold tracking-wide" style={{ color: accent }}>
            {number}
          </span>
          <h3 className="mt-1.5 font-display text-lg tracking-wide text-ink uppercase">{title}</h3>
          <p className="mt-1.5 max-w-sm font-sans text-sm text-ink-muted">{description}</p>
        </div>

        <div className="my-3 flex flex-1 items-center justify-end">
          <div className="h-16 w-28 opacity-75 transition-all duration-300 group-hover:scale-110 group-hover:opacity-100 sm:h-20 sm:w-32">
            {sketch}
          </div>
        </div>

        <span className="relative inline-flex items-center gap-1.5 font-mono text-xs font-medium" style={{ color: accent }}>
          {cta}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  )
}
