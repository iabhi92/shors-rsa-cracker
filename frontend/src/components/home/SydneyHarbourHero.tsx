import { Link } from 'react-router'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import TerminalDemo from '../TerminalDemo'
import HarbourBridgeIllustration from './HarbourBridgeIllustration'
import HarbourBridgeIncident from './HarbourBridgeIncident'
import HarbourWaveLayer from './HarbourWaveLayer'
import QuantumOrbitLayer from './QuantumOrbitLayer'
import QuantumWavefunctionLayer from './QuantumWavefunctionLayer'
import { useBridgeIncidentPhase } from '../../hooks/useApi'

const INCIDENT_CAPTION: Record<string, string> = {
  havoc: "A self-driving car has lost control on the bridge -- the backend is waking up (free-tier hosting naps after ~15 idle minutes). Retrying automatically.",
  quake: 'The deck splits open beneath it and the whole bridge trembles...',
  connected: 'Backend connected -- Houdini finally got through, and a very patient alien is relaying a signal from someone currently invisible to the one who can actually see it arrive.',
}

const titleReveal = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0 },
}

/** The homepage hero: the harbour bridge and water are a real illustrated environment behind
 * the headline, not a photo and not a generic gradient -- see HarbourBridgeIllustration.tsx and
 * HarbourWaveLayer.tsx for how each is actually constructed. The live terminal on the right is
 * the same real, API-backed component used everywhere else on the site (see TerminalDemo.tsx);
 * nothing about its data is faked for the redesign. */
export default function SydneyHarbourHero() {
  const reduceMotion = useReducedMotion()
  const incidentPhase = useBridgeIncidentPhase()

  return (
    <section
      className="relative -mx-4 -mt-8 w-[calc(100%+2rem)] overflow-hidden border-b border-line px-4 pt-10 pb-6 sm:-mx-8 sm:w-[calc(100%+4rem)] sm:px-8 sm:pt-14"
      style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 97%)' }}
    >
      {/* environment layers, back to front -- pinned to fixed-height bands at the very top
          (phase arcs, "sky") and very bottom (bridge, then water, the "horizon"), never behind
          the text column: the content grid below reserves its own bottom padding so nothing
          in the illustration crosses through a line of copy. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-60 sm:h-36">
        <QuantumOrbitLayer />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-14 h-52 opacity-90 sm:bottom-16 sm:h-72">
        <motion.div
          className="relative h-full w-full"
          animate={
            incidentPhase === 'quake' && !reduceMotion
              ? { x: [0, -10, 12, -8, 9, -5, 0], y: [0, 6, -5, 6, -3, 2, 0] }
              : { x: 0, y: 0 }
          }
          transition={{ duration: 0.6, repeat: incidentPhase === 'quake' && !reduceMotion ? 1 : 0 }}
        >
          <HarbourBridgeIllustration />
          <HarbourBridgeIncident phase={incidentPhase} />
        </motion.div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-8 h-20 opacity-80 sm:bottom-10 sm:h-24">
        <QuantumWavefunctionLayer />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 sm:h-20">
        <HarbourWaveLayer />
      </div>

      {/* mathematical annotations -- decorative but each one is a real relation from this
          project's own math, not scattered filler. Pinned to the same top/bottom bands as the
          illustration layers, never the mid-section where the text column lives. */}
      <div className="pointer-events-none absolute inset-x-0 top-2 hidden h-24 font-mono text-[0.7rem] text-ink-muted/70 lg:block" aria-hidden="true">
        <span className="absolute top-2 left-[4%]">N = p × q</span>
        <span className="absolute top-8 right-[6%]">a<sup>r</sup> &equiv; 1 mod N</span>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-38 hidden h-10 font-mono text-[0.7rem] text-ink-muted/70 sm:bottom-96 lg:block" aria-hidden="true">
        <span className="absolute right-[10%]">gcd(a<sup>r/2</sup> &plusmn; 1, N)</span>
        <span className="absolute left-[46%]">QFT&#8315;&#185;</span>
      </div>

      <div className="relative z-10 mx-auto grid max-w-6xl items-start gap-10 pt-4 pb-72 lg:grid-cols-[1.1fr_1fr] lg:gap-14 sm:pb-96">
        <motion.div initial="hidden" animate="show" variants={titleReveal} transition={{ duration: 0.6 }}>
          <p className="mb-3 font-mono text-xs font-medium tracking-[0.2em] text-gold uppercase">
            Educational security &amp; quantum computing demo
          </p>
          <motion.h1
            aria-label="Shor's Algorithm vs RSA"
            className="font-display text-5xl leading-[1.08] font-semibold text-ink sm:text-6xl lg:text-7xl"
          >
            <motion.span
              className="block"
              initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Shor's Algorithm
            </motion.span>
            <motion.span
              className="block"
              initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.28 }}
            >
              <span className="text-gold italic">vs</span> RSA
            </motion.span>
          </motion.h1>
          <p className="mt-5 max-w-xl font-sans text-base text-ink-muted sm:text-lg">
            A hands-on exploration of how quantum computing challenges RSA encryption, from
            classical number theory to period-finding, circuits and real hardware validation.
          </p>
          <blockquote className="mt-6 border-l-2 border-gold/50 pl-4 font-display text-lg text-ink italic">
            Why is RSA secure against classical computers, and why would a sufficiently capable
            quantum computer change that?
          </blockquote>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/rsa"
              className="focus-ring group inline-flex items-center gap-2 rounded-sm bg-gold px-5 py-2.5 font-mono text-sm font-medium text-navy transition-colors hover:bg-gold-warm"
            >
              Run the RSA Demonstration
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/shor"
              className="focus-ring group inline-flex items-center gap-2 rounded-sm border border-gold/50 px-5 py-2.5 font-mono text-sm font-medium text-gold-warm transition-colors hover:bg-gold/10"
            >
              Jump to Shor's Algorithm
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <motion.p
            key={incidentPhase}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-4 max-w-md font-mono text-xs text-ink-muted"
          >
            <span className="text-gold-warm">{'>'}</span> {INCIDENT_CAPTION[incidentPhase]}
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: reduceMotion ? 0 : 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <TerminalDemo />
          <p className="mt-2 text-center font-mono text-xs text-ink-muted">
            Live, real API call every time — not a recording. See{' '}
            <Link to="/shor" className="text-gold underline underline-offset-2 hover:text-gold-warm">
              Shor's Lab
            </Link>{' '}
            to run it yourself with any supported N.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
