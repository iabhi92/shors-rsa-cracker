import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { motion, useInView, animate } from 'motion/react'
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import DecryptText from './DecryptText'

export function PageHeader({ title, description, eyebrow }: { title: string; description?: ReactNode; eyebrow?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
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
  return (
    <div
      className={`group relative rounded-sm border border-line bg-surface transition-colors duration-150 ${
        interactive ? hoverBorder : ''
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

/** Animates from 0 to `value` once it scrolls into view. Falls back to a plain render for
 * non-finite/non-numeric values (e.g. StatCard's "Yes"/"No" hardware-validated flag). */
function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10% 0px' })
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!inView) return
    const controls = animate(0, value, {
      duration: 1,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
    })
    return () => controls.stop()
  }, [inView, value])

  return <span ref={ref}>{display.toLocaleString()}</span>
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  const isPlainFiniteNumber = typeof value === 'number' && Number.isFinite(value)
  return (
    <Card interactive className="flex flex-col gap-1">
      <span className="font-mono text-xs tracking-wide text-ink-muted uppercase">{label}</span>
      <span className="font-mono text-2xl text-gold-warm">
        {isPlainFiniteNumber ? <AnimatedNumber value={value as number} /> : value}
      </span>
      {hint && <span className="font-mono text-xs text-ink-muted">{hint}</span>}
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
