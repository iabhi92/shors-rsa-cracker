import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { motion, animate } from 'motion/react'
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import DecryptText from './DecryptText'
import { DURATION, EASE_SIGNATURE } from '../lib/motion'

export function PageHeader({ title, description, eyebrow }: { title: string; description?: ReactNode; eyebrow?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.fast, ease: EASE_SIGNATURE }}
      className="mb-8"
    >
      {eyebrow && (
        <p className="mb-2 font-mono text-xs font-medium tracking-[0.1em] text-gold uppercase">
          <span className="text-ink-muted">${' '}</span>
          {eyebrow}
        </p>
      )}
      <h1 aria-label={title} className="font-display text-2xl font-semibold text-ink sm:text-3xl">
        <DecryptText text={title} />
      </h1>
      {description && <p className="mt-2 max-w-3xl font-sans text-sm text-ink-muted sm:text-base">{description}</p>}
    </motion.div>
  )
}

export function Card({
  className = '',
  interactive = false,
  accent = 'gold',
  title,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean; accent?: 'gold' | 'violet'; title?: string }) {
  const hoverBorder = accent === 'violet' ? 'hover:border-violet/50' : 'hover:border-gold/50'
  // A soft outer glow on hover, in the card's own accent -- the "lit lab equipment" elevation
  // cue from the design brief (accents get a 2-4px glow instead of a heavier shadow).
  const hoverGlow = accent === 'violet' ? 'hover:shadow-[0_0_20px_-6px_var(--color-violet)]' : 'hover:shadow-[0_0_20px_-6px_var(--color-gold)]'
  return (
    <div
      className={`group relative rounded-sm border border-line bg-surface transition-[color,background-color,border-color,box-shadow] duration-150 ${
        interactive ? `${hoverBorder} ${hoverGlow}` : ''
      } ${className}`}
      {...props}
    >
      {title && (
        <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2">
          <span className="h-2.5 w-2.5 rounded-full border border-line" />
          <span className="h-2.5 w-2.5 rounded-full border border-line" />
          <span className="h-2.5 w-2.5 rounded-full border border-line" />
          <span className="ml-2 truncate font-mono text-xs text-ink-muted">{title}</span>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

export function Button({
  variant = 'primary',
  loading = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary'; loading?: boolean }) {
  const base =
    'focus-ring relative inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2 font-mono text-sm font-medium transition-colors duration-100 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0'
  const styles =
    variant === 'primary'
      ? 'bg-gold text-navy hover:bg-gold-warm'
      : 'border border-line text-ink-muted hover:border-gold/50 hover:text-ink'
  return (
    <button className={`${base} ${styles} ${className}`} disabled={disabled || loading} {...props}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : variant === 'primary' && <span aria-hidden>{'>'}</span>}
      {children}
    </button>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      role="alert"
      className="flex items-start gap-2.5 rounded-sm border border-red-500/30 bg-red-500/10 px-4 py-3 font-mono text-sm text-red-300"
    >
      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </motion.div>
  )
}

export function WarningBanner({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-sm border border-gold/30 bg-gold/10 px-4 py-3 font-mono text-sm text-gold-warm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

export function SuccessBanner({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2.5 rounded-sm border border-success/30 bg-success/10 px-4 py-3 font-mono text-sm text-success"
    >
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </motion.div>
  )
}

export function Spinner({ label = 'loading...' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 font-mono text-sm text-ink-muted" role="status" aria-live="polite">
      <Loader2 className="h-4 w-4 animate-spin text-gold" />
      {label}
    </div>
  )
}

/** Animates from 0 to `value` on mount / whenever `value` changes. Falls back to a plain
 * render for non-finite/non-numeric values (e.g. StatCard's "Yes"/"No" hardware-validated flag).
 *
 * Previously gated behind `useInView(..., { once: true, margin: '-10% 0px' })` so the count-up
 * only played once scrolled into view -- fine for the homepage's passive stats section, but a
 * real bug everywhere else this component is used (Circuit Explorer, Resource Estimate, IBM
 * Hardware, Classical Benchmark): those numbers appear as the *result of a button click*, not a
 * scroll reveal, and whenever the result grid landed with its second row just outside that
 * shrunk margin (verified: literally any StatCard below roughly the top/bottom 10% of the
 * viewport at the moment its data arrives), `once: true` meant it never got a second chance --
 * stuck at 0 permanently, even after manually scrolling directly to it. That's not a decorative
 * miss like the homepage's train/car, it's the actual data the user just asked for rendering as
 * a wrong number. Same fix as that homepage bug: drop the scroll-gating, always animate. */
function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
    })
    return () => controls.stop()
  }, [value])

  return <span>{display.toLocaleString()}</span>
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  const isPlainFiniteNumber = typeof value === 'number' && Number.isFinite(value)
  // The flex-column layout lives on this inner div, not on Card's own className: Card renders
  // {children} inside its own `p-5` wrapper, so a className passed to Card never reaches these
  // spans -- passing `flex flex-col gap-1` as Card's className (the previous version) only ever
  // styled Card's outer shell, leaving label/value/hint as plain inline content. That was
  // invisible at most widths (inline spans plus a numeric value usually wrap acceptably by
  // accident) but broke for real on an actual mobile screen: the "Real hardware validated" card's
  // "ibm_marrakesh" hint -- one unbreakable word -- ran directly into "Yes" on the same line and
  // overflowed straight past the card's border.
  return (
    // min-w-0 on the grid/flex item itself, not just the text inside it: a grid cell defaults
    // to min-width:auto, which refuses to shrink below an unbroken token's intrinsic width no
    // matter what wrapping the text itself allows -- this is exactly what let a long gate count
    // (e.g. "103,137,935,360") push straight past this card's own border instead of wrapping,
    // the same min-w-0 fix AmplitudeView.tsx already needed for its own table column.
    <Card interactive className="h-full min-w-0">
      <div className="flex h-full min-w-0 flex-col gap-1">
        <span className="font-mono text-xs tracking-wide text-ink-muted uppercase">{label}</span>
        <span className="font-mono text-2xl wrap-break-word text-gold-warm">
          {isPlainFiniteNumber ? <AnimatedNumber value={value as number} /> : value}
        </span>
        {hint && <span className="font-mono text-xs wrap-break-word text-ink-muted">{hint}</span>}
      </div>
    </Card>
  )
}

export function CodeBlock({ children }: { children: ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-sm border border-line bg-navy p-3 font-mono text-xs text-ink-muted">
      {children}
    </pre>
  )
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-sm border border-line">
      <table className="w-full min-w-[560px] border-collapse text-left font-mono text-sm [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-line/40">
        {children}
      </table>
    </div>
  )
}
