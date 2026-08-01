import { Link } from 'react-router'
import { motion } from 'motion/react'
import { apiGet } from '../api/client'
import { useFetchOnMount } from '../hooks/useApi'
import type { ProjectMeta } from '../types/api'
import { Card, ErrorBanner, Spinner, StatCard } from '../components/ui'
import InterferenceCanvas from '../components/InterferenceCanvas'
import SydneyHarbourHero from '../components/home/SydneyHarbourHero'
import TutorialClassScene from '../components/home/TutorialClassScene'
import { AttackSurfaceSketch, EditorialModuleCard, HardwareSketch, KeySketch, MalleabilitySketch, OrbitSketch, QubitSketch } from '../components/home/EditorialModuleCard'
import CoordinateFooter from '../components/home/CoordinateFooter'
import { ATTACKS } from '../lib/attackSurface'
import { DURATION, EASE_SIGNATURE } from '../lib/motion'

// The real first two steps of the site's own enforced learning path (lib/learningPath.ts),
// followed by two highlights each from Shor's Algorithm and Attacking RSA -- previously this
// grid opened with Classical Benchmark (actually step 10 of 12) and never featured Quantum
// Fundamentals or RSA Laboratory at all, so "Start here" didn't actually start where the site
// itself says to start.
const MODULES = [
  {
    to: '/quantum-fundamentals',
    number: '01',
    title: 'Quantum Fundamentals',
    description: 'Qubits, superposition, and entanglement -- the actual starting point, run against a real from-scratch simulator.',
    cta: 'Start Here',
    sketch: <QubitSketch />,
    accent: '#8065b8',
  },
  {
    to: '/rsa',
    number: '02',
    title: 'RSA Laboratory',
    description: 'Generate a real keypair, encrypt a message, decrypt it -- from scratch, no crypto library.',
    cta: 'Build a Key',
    sketch: <KeySketch />,
    accent: '#c99545',
  },
  {
    to: '/shor',
    number: '03',
    title: "Shor's Lab",
    description: "Run Shor's algorithm step-by-step in an interactive environment.",
    cta: 'Open Lab',
    sketch: <OrbitSketch />,
    accent: '#8065b8',
  },
  {
    to: '/ibm-hardware',
    number: '04',
    title: 'Real IBM Hardware',
    description: "Submit this project's real circuit to an actual IBM quantum computer, live, on your own click -- not just a stored screenshot.",
    cta: 'Run It Live',
    sketch: <HardwareSketch />,
    accent: '#e3b45e',
  },
  {
    to: '/malleability-lab',
    number: '05',
    title: 'Malleability & Tampering Lab',
    description: 'Six live attacks on textbook RSA -- from ciphertext malleability to a fault that factors a normal key from one signature.',
    cta: 'Break It',
    sketch: <MalleabilitySketch />,
    accent: '#e05a4e',
  },
  {
    to: '/attack-surface',
    number: '06',
    title: 'Attack Surface Map',
    description: `${ATTACKS.length} real attacks against RSA -- key recovery, message recovery, and side-channels -- mapped against what stops each one.`,
    cta: 'See Every Attack',
    sketch: <AttackSurfaceSketch />,
    accent: '#e05a4e',
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
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <StatCard label="Tests passing" value={meta.data.test_count} />
              <Link to="/attack-surface" className="focus-ring block rounded-sm">
                <StatCard label="Attacks demonstrated" value={ATTACKS.length} hint="key recovery to side-channels" />
              </Link>
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
