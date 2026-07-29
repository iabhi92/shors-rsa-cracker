import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion, AnimatePresence } from 'motion/react'
import { BlockMath } from 'react-katex'
import { Pause, Play, ChevronLeft, ChevronRight, Maximize2, X, Gauge } from 'lucide-react'
import { DURATION, EASE_SIGNATURE } from '../lib/motion'

export type PipelineStage = {
  id: string
  label: string
  /** Short plain-English sentence explaining the step -- read this out loud to a class. */
  caption: ReactNode
  /** Optional LaTeX (rendered with KaTeX) shown as the formal statement of what the step does --
   * this is what makes the panel usable in an actual lecture, not just a mood board. */
  formula?: string
  render: (opts: { active: boolean; reduceMotion: boolean; theatre: boolean }) => ReactNode
}

// Generous by default -- this is a teaching tool, so the limiting factor is reading time (the
// caption + formula + diagram), not how fast the little entrance animations finish. Every speed
// setting still leaves multiple seconds per stage.
const BASE_DWELL_MS = 6000
const SPEEDS = [0.1, 0.5, 0.75, 1, 1.5, 2]
const DEFAULT_SPEED_INDEX = SPEEDS.indexOf(1)

function GridBackdrop() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]" aria-hidden="true">
      <defs>
        <pattern id="pipeline-grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#eee8da" strokeWidth="0.75" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#pipeline-grid)" />
    </svg>
  )
}

function StageRail({
  stages,
  active,
  accentText,
  accentBg,
  accentBorder,
  onSelect,
  reduceMotion,
}: {
  stages: PipelineStage[]
  active: number
  accentText: string
  accentBg: string
  accentBorder: string
  onSelect: (i: number) => void
  reduceMotion: boolean
}) {
  const progress = stages.length > 1 ? active / (stages.length - 1) : 0
  return (
    <div className="relative mb-5 flex items-start gap-1 overflow-x-auto pb-1 sm:gap-2">
      <div className="absolute top-3.5 right-4 left-4 z-0 h-px bg-line" aria-hidden />
      {/* Fills in behind the stage dots as you advance, instead of a flat track that never
          changes -- the one piece of the rail that visibly tracks overall progress, not just
          which single dot is active. */}
      <motion.div
        className={`absolute top-3.5 left-4 z-0 h-px ${accentBg}`}
        style={{ right: '1rem', transformOrigin: 'left center' }}
        initial={false}
        animate={{ scaleX: progress, opacity: progress > 0 ? 0.8 : 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        aria-hidden
      />
      {stages.map((s, i) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(i)}
          className="focus-ring group relative flex shrink-0 flex-col items-center gap-1.5 px-1"
          aria-current={i === active}
          title={s.label}
        >
          <span className="relative z-10 flex h-7 w-7 items-center justify-center">
            {i === active && !reduceMotion && (
              <motion.span
                className={`absolute inset-0 rounded-full ${accentBg}`}
                initial={{ opacity: 0.5, scale: 1 }}
                animate={{ opacity: 0, scale: 1.6 }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                aria-hidden
              />
            )}
            <span
              className={`relative flex h-7 w-7 items-center justify-center rounded-full border font-mono text-xs transition-colors ${
                i === active
                  ? `${accentBorder} ${accentBg} text-navy font-semibold`
                  : i < active
                    ? 'border-ink-muted/60 bg-navy text-ink-muted'
                    : 'border-line bg-navy text-ink-muted group-hover:border-ink-muted'
              }`}
            >
              {i + 1}
            </span>
          </span>
          <span
            className={`max-w-[6.5rem] text-center font-mono text-[0.65rem] leading-tight ${
              i === active ? accentText : 'text-ink-muted'
            }`}
          >
            {s.label}
          </span>
        </button>
      ))}
    </div>
  )
}

/** A teaching-first, presentation-grade step-by-step explainer. Built to actually survive being
 * projected in a lecture: a clickable stage rail (a lecturer can jump straight to any step rather
 * than sit through autoplay), a large visual canvas, an optional KaTeX-rendered formula for the
 * step's formal statement, a plain-English caption, and a "Present" button that opens the same
 * panel full-screen for a projector. Arrow keys step through stages once the panel has focus (or
 * always, while in presentation mode); Escape exits presentation mode. `prefers-reduced-motion`
 * disables autoplay and freezes each stage's visual on its resting frame. */
export default function PipelineAnimation({
  stages,
  accent = 'gold',
  onActiveChange,
  onStageSound,
}: {
  stages: PipelineStage[]
  accent?: 'gold' | 'violet'
  /** Fired whenever the active stage index changes (autoplay or manual) -- lets a parent sync
   * something of its own to whichever stage is currently on screen (see ShorPipelineVisual's
   * CodePanel) without lifting all of this component's stage-navigation state up needlessly. */
  onActiveChange?: (index: number) => void
  /** Fired alongside onActiveChange with the new stage's own id -- lets a parent play a one-shot
   * sound effect specific to what that stage actually represents (see lib/sfx.ts and each lab's
   * own id -> effect mapping) instead of PipelineAnimation itself needing to know what "encrypt"
   * or "measure" sound like for every lab that uses it. */
  onStageSound?: (stageId: string) => void
}) {
  const reduceMotion = !!useReducedMotion()
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(!reduceMotion)
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX)
  const [progressKey, setProgressKey] = useState(0)
  const [theatre, setTheatre] = useState(false)
  // Which way the stage transition should slide -- forward (next/autoplay) vs. backward
  // (previous), so jumping around the pipeline reads as real spatial motion instead of every
  // stage change looking identical regardless of direction.
  const [direction, setDirection] = useState(1)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const speed = SPEEDS[speedIndex]
  const dwellMs = BASE_DWELL_MS / speed

  useEffect(() => {
    onActiveChange?.(active)
    onStageSound?.(stages[active].id)
    // onActiveChange/onStageSound intentionally excluded: callers pass either a raw setState
    // (referentially stable) or should memoize it themselves -- re-running this on every parent
    // render just because an inline callback got a new identity would defeat the point of
    // syncing to `active`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  // Cinematic on first load, not an ambient loop: autoplay runs forward through every stage
  // exactly once and then stops parked on the last one, handing control back rather than
  // cycling back to stage one and repeating indefinitely for as long as the tab stays open.
  useEffect(() => {
    if (!playing) return
    timerRef.current = setTimeout(() => {
      if (active === stages.length - 1) {
        setPlaying(false)
        return
      }
      setDirection(1)
      setActive((i) => i + 1)
      setProgressKey((k) => k + 1)
    }, dwellMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [playing, active, stages.length, dwellMs])

  const goTo = (i: number, stopAutoplay = true) => {
    if (stopAutoplay) setPlaying(false)
    const next = ((i % stages.length) + stages.length) % stages.length
    // Prefer the short way round for direction: jumping from the last stage to the first (or
    // vice versa) via next/prev should still read as "forward"/"backward", not a jarring wrap.
    const forwardDistance = (next - active + stages.length) % stages.length
    const backwardDistance = (active - next + stages.length) % stages.length
    setDirection(forwardDistance <= backwardDistance ? 1 : -1)
    setActive(next)
    setProgressKey((k) => k + 1)
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && theatre) {
        setTheatre(false)
        return
      }
      const focusedInside = containerRef.current?.contains(document.activeElement)
      if (!theatre && !focusedInside) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        goTo(active + 1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goTo(active - 1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, theatre])

  useEffect(() => {
    if (!theatre) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [theatre])

  const accentText = accent === 'violet' ? 'text-violet' : 'text-gold'
  const accentBg = accent === 'violet' ? 'bg-violet' : 'bg-gold'
  const accentBorder = accent === 'violet' ? 'border-violet' : 'border-gold'

  const stage = stages[active]

  // While theatre mode is open, the background copy of this panel would otherwise stay fully
  // mounted underneath the modal -- same StageRail buttons, same stage.render() output, each
  // with its own independent local state (a per-stage toggle like the QFT before/after switch
  // isn't lifted into this component, so the hidden copy and the fullscreen copy would silently
  // drift apart, and you'd see the hidden copy's stale state on exit). Swapping it for an inert
  // placeholder while theatre is open avoids double-mounting live, stateful content for
  // something the viewer can't see or reach anyway.
  const inertBackground = theatre && (
    <div className="min-h-72 rounded-sm border border-line bg-surface p-4 sm:min-h-96 sm:p-6" aria-hidden="true">
      <div className="flex h-full items-center justify-center rounded-sm border border-line bg-navy py-24">
        <p className="font-mono text-xs text-ink-muted">Presenting in full screen…</p>
      </div>
    </div>
  )

  const panel = (fullscreen: boolean) => (
    <div
      ref={fullscreen ? undefined : containerRef}
      tabIndex={0}
      className={`focus-ring rounded-sm border border-line bg-surface ${fullscreen ? 'flex h-full w-full flex-col overflow-y-auto p-6 sm:p-10' : 'p-4 sm:p-6'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <StageRail
          stages={stages}
          active={active}
          accentText={accentText}
          accentBg={accentBg}
          accentBorder={accentBorder}
          reduceMotion={reduceMotion}
          onSelect={(i) => goTo(i)}
        />
        <div className="flex shrink-0 items-center gap-1.5">
          {fullscreen ? (
            <button
              type="button"
              className="focus-ring flex items-center gap-1.5 rounded-sm border border-line px-2.5 py-1.5 font-mono text-xs text-ink-muted transition-colors hover:border-ink-muted hover:text-ink"
              onClick={() => setTheatre(false)}
            >
              <X className="h-3.5 w-3.5" /> Exit
            </button>
          ) : (
            <button
              type="button"
              className="focus-ring flex items-center gap-1.5 rounded-sm border border-line px-2.5 py-1.5 font-mono text-xs text-ink-muted transition-colors hover:border-gold/50 hover:text-ink"
              onClick={() => setTheatre(true)}
              title="Open full-screen for projecting to a class"
            >
              <Maximize2 className="h-3.5 w-3.5" /> Present
            </button>
          )}
        </div>
      </div>

      {/* visual canvas -- min-height, not a hard cap: a stage with more content than the default
          box (e.g. a wide bar register) grows the box instead of getting silently clipped by
          overflow-hidden, which is what used to cut off the top of taller stages. */}
      <div
        className={`relative flex items-center justify-center overflow-x-hidden overflow-y-auto rounded-sm border border-line bg-navy ${
          fullscreen ? 'my-6 min-h-0 flex-1' : 'min-h-72 sm:min-h-96'
        }`}
      >
        <GridBackdrop />
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={stage.id}
            custom={direction}
            initial={reduceMotion ? undefined : { opacity: 0, scale: 0.97, x: direction * 28 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, scale: 0.97, x: direction * -28 }}
            transition={{ duration: DURATION.base, ease: EASE_SIGNATURE }}
            className="relative z-10 flex w-full items-center justify-center p-4 sm:p-8"
          >
            {stage.render({ active: true, reduceMotion, theatre: fullscreen })}
          </motion.div>
        </AnimatePresence>

        {playing && !reduceMotion && (
          <motion.div
            key={progressKey}
            className={`absolute top-0 left-0 z-10 h-0.5 ${accentBg}`}
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: dwellMs / 1000, ease: 'linear' }}
          />
        )}
      </div>

      {/* formula strip -- the formal statement of this step, always shown alongside the
          plain-English caption below rather than gated behind a toggle. */}
      {stage.formula && (
        <div className="mb-4 flex justify-center overflow-x-auto rounded-sm border border-line bg-navy px-4 py-3 text-ink">
          <BlockMath math={stage.formula} />
        </div>
      )}

      {/* caption + controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className={`max-w-2xl font-sans text-ink ${fullscreen ? 'text-lg sm:text-xl' : 'text-sm sm:text-[0.95rem]'}`}>
          <span className={`mr-1.5 font-mono ${fullscreen ? 'text-base' : 'text-xs'} ${accentText}`}>{`0${active + 1}`}</span>
          {stage.caption}
        </p>
        <div className="flex shrink-0 items-center gap-1.5 self-start">
          <button
            type="button"
            className="focus-ring rounded-sm border border-line p-1.5 text-ink-muted transition-colors hover:border-ink-muted hover:text-ink"
            onClick={() => goTo(active - 1)}
            aria-label="Previous step"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="focus-ring rounded-sm border border-line p-1.5 text-ink-muted transition-colors hover:border-ink-muted hover:text-ink"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            type="button"
            className="focus-ring rounded-sm border border-line p-1.5 text-ink-muted transition-colors hover:border-ink-muted hover:text-ink"
            onClick={() => goTo(active + 1)}
            aria-label="Next step"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="focus-ring flex items-center gap-1 rounded-sm border border-line px-2 py-1.5 font-mono text-xs text-ink-muted transition-colors hover:border-ink-muted hover:text-ink"
            onClick={() => setSpeedIndex((i) => (i + 1) % SPEEDS.length)}
            aria-label={`Playback speed, currently ${speed}x`}
            title="Cycle autoplay speed"
          >
            <Gauge className="h-3.5 w-3.5" /> {speed}x
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* A screen reader gets no other signal that anything changed: the visual canvas swaps
          contents on every stage change, autoplay advances with nobody touching a control, and
          none of that reaches anyone not looking at the screen without an explicit announcement.
          sr-only + aria-live="polite" narrates each stage in the same plain English already
          written for the caption below the canvas -- not a separate, harder-to-keep-in-sync
          description track. */}
      <div aria-live="polite" className="sr-only">
        Step {active + 1} of {stages.length}: {stage.label}. {stage.caption}
      </div>
      {theatre ? inertBackground : panel(false)}
      {createPortal(
        <AnimatePresence>
          {theatre && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center bg-navy/95 p-4 backdrop-blur-sm sm:p-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => {
                if (e.target === e.currentTarget) setTheatre(false)
              }}
            >
              <div className="mx-auto flex h-[88vh] w-full max-w-6xl">{panel(true)}</div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
