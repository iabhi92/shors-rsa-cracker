import { Link } from 'react-router'
import { motion } from 'motion/react'
import { apiGet } from '../api/client'
import { useFetchOnMount } from '../hooks/useApi'
import type { ProjectMeta } from '../types/api'
import { Card, ErrorBanner, Spinner, StatCard } from '../components/ui'
import InterferenceCanvas from '../components/InterferenceCanvas'
import SydneyHarbourHero from '../components/home/SydneyHarbourHero'
import TutorialClassScene from '../components/home/TutorialClassScene'
import { BenchmarkSketch, CircuitSketch, EditorialModuleCard, OrbitSketch, WaveSketch } from '../components/home/EditorialModuleCard'
import CoordinateFooter from '../components/home/CoordinateFooter'
import { DURATION, EASE_SIGNATURE } from '../lib/motion'

const MODULES = [
  {
    to: '/classical-benchmark',
    number: '01',
    title: 'Classical Benchmark',
    description: 'See how RSA holds up against today\'s best classical algorithms.',
    cta: 'Explore',
    sketch: <BenchmarkSketch />,
    accent: '#c99545',
  },
  {
    to: '/shor',
    number: '02',
    title: "Shor's Lab",
    description: "Run Shor's algorithm step-by-step in an interactive environment.",
    cta: 'Open Lab',
    sketch: <OrbitSketch />,
    accent: '#8065b8',
  },
  {
    to: '/qft',
    number: '03',
    title: 'QFT & Period-Finding',
    description: "Understand the heart of Shor's algorithm -- and how it finds periods the classical world can't.",
    cta: 'Explore',
    sketch: <WaveSketch />,
    accent: '#204a66',
  },
  {
    to: '/circuit-explorer',
    number: '04',
    title: 'Circuit Explorer',
    description: 'Inspect real quantum circuits, controlled operations, and register evolution.',
    cta: 'View Circuits',
    sketch: <CircuitSketch />,
    accent: '#54c89a',
  },
]

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
}

export default function HomePage() {
  const meta = useFetchOnMount(() => apiGet<ProjectMeta>('/meta'), [])

  return (
    <>
      <SydneyHarbourHero />

      <div className="mx-auto max-w-6xl">
        <motion.section
          className="mb-10"
          initial="hidden"
          animate="show"
          variants={fadeUp}
          transition={{ duration: DURATION.base, ease: EASE_SIGNATURE }}
        >
          <h2 className="mb-4 flex items-center gap-2.5 font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">
            // what the QFT step is doing
            <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 font-mono text-[0.65rem] font-medium tracking-normal text-success normal-case">
              Live
            </span>
          </h2>
          <Card title="qft.py — constructive interference at the period">
            <div className="h-56 sm:h-64">
              <InterferenceCanvas />
            </div>
          </Card>
          <p className="mt-3 font-sans text-sm text-ink-muted">
            This is a real Dirichlet kernel, the same sum of amplitudes the quantum Fourier
            transform produces: it nearly cancels out everywhere except at multiples of the
            period r. That's why measuring afterward almost always lands near a multiple of
            N/r -- the one signal the rest of the algorithm needs. See{' '}
            <Link to="/qft" className="text-gold underline underline-offset-2">
              QFT &amp; Period-Finding
            </Link>{' '}
            for the full explanation and a from-scratch check against the exact math.
          </p>
        </motion.section>

        <motion.section
          className="mb-10"
          initial="hidden"
          animate="show"
          variants={fadeUp}
          transition={{ duration: DURATION.base, ease: EASE_SIGNATURE }}
        >
          <h2 className="mb-4 font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">Project stats (from this repository)</h2>
          {meta.status === 'loading' && <Spinner label="Loading project stats…" />}
          {meta.status === 'error' && <ErrorBanner message={meta.message} />}
          {meta.status === 'success' && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Tests passing" value={meta.data.test_count} />
              <StatCard label="Classical attacks" value={meta.data.classical_attack_methods.length} hint={meta.data.classical_attack_methods.join(', ')} />
              <StatCard label="Quantum backends" value={meta.data.quantum_backends.length} hint={meta.data.quantum_backends.join(' / ')} />
              <StatCard
                label="Real hardware validated"
                value={meta.data.ibm_hardware_validated ? 'Yes' : 'No'}
                hint={meta.data.ibm_hardware_backend_name ?? undefined}
              />
            </div>
          )}
        </motion.section>

        <motion.section
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
        >
          <h2 className="mb-4 font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">Start here</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((mod) => (
              <motion.div key={mod.to} variants={fadeUp} transition={{ duration: DURATION.fast, ease: EASE_SIGNATURE }}>
                <EditorialModuleCard {...mod} />
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Same fade as the sections above, just written as a raw object instead of the shared
            `fadeUp` variant (this one has no siblings to stagger with). All of these sections
            used to be gated behind `whileInView`/`viewport={{ once: true }}`, which hides
            content at opacity 0 until an IntersectionObserver fires -- on a section already near
            the fold on a shorter screen, that trigger could be missed entirely with no retry,
            a real reported bug (the train and car scenes staying invisible from first load).
            The same fragility turned out to affect StatCard's count-up animation too (see
            AnimatedNumber in components/ui.tsx), so every scroll-gated section on this page now
            just animates on mount instead. */}
        <motion.div
          className="relative -mx-4 mt-10 w-[calc(100%+2rem)] border-y border-line bg-navy-secondary px-4 py-6 sm:-mx-8 sm:w-[calc(100%+4rem)] sm:px-8 sm:py-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.base, ease: EASE_SIGNATURE }}
        >
          <div className="mx-auto max-w-5xl">
            <TutorialClassScene />
          </div>
        </motion.div>

        <div className="mt-10 mb-8 border-t border-line pt-6 text-center">
          <p className="font-display text-sm tracking-wider text-ink-muted uppercase">
            The harbour connects. The algorithm transforms.
          </p>
          <p className="mt-2 font-mono text-xs tracking-[0.25em] text-ink-muted/70 uppercase">
            Care <span className="mx-2 text-line">·</span> Rigour <span className="mx-2 text-line">·</span> Curiosity
          </p>
          <div className="mt-4">
            <CoordinateFooter />
          </div>
        </div>
      </div>
    </>
  )
}
