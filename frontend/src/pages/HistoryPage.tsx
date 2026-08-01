import { useRef, type ReactNode } from 'react'
import { Link } from 'react-router'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { PageHeader, Card } from '../components/ui'
import {
  DiffieHellmanScene,
  RsaFoundersScene,
  ShorInsightScene,
  FirstDemoScene,
  CommitteeScene,
  StandardsShippedScene,
  TodayScene,
} from '../components/history/HistoryIllustrations'
import { LARGEST_ANNOUNCED_CHIP_QUBITS, QUBITS_NEEDED_2025_ESTIMATE } from '../lib/quantumHardwareFacts'

// Same real gap DoomsdayClock.tsx and WhatBreaksFirst.tsx already compute from the same shared
// constants -- not a separate number that could quietly drift from those two.
const GAP_ORDERS = Math.log10(QUBITS_NEEDED_2025_ESTIMATE / LARGEST_ANNOUNCED_CHIP_QUBITS)
const CURRENT_YEAR = new Date().getFullYear().toString()

type Milestone = {
  year: string
  title: string
  body: string
  link?: { to: string; label: string }
  illustration: ReactNode
}

// Six real, checkable dates -- the actual line from "here's an idea for public-key crypto" to
// "here's why it stops working," not a vibes-based timeline. Sources: Diffie & Hellman's 1976
// paper, Rivest/Shamir/Adleman's 1978 RSA paper (submitted 1977), Shor's 1994 FOCS paper,
// the 2001 IBM/Stanford NMR demonstration (Vandersypen et al., Nature), NIST's 2016 PQC call
// for proposals, and the August 2024 FIPS 203/204/205 standards.
const MILESTONES: Milestone[] = [
  {
    year: '1976',
    title: 'Diffie & Hellman propose public-key cryptography',
    body: "\"New Directions in Cryptography\" introduces the idea that two people could share a secret without ever meeting in person -- built on operations that are cheap to run forward and expensive to reverse. It described the shape of the solution before anyone had built one.",
    illustration: <DiffieHellmanScene />,
  },
  {
    year: '1977',
    title: 'Rivest, Shamir & Adleman publish RSA',
    body: 'At MIT, RSA becomes the first practical realization of that idea: encrypt with a public key (N, e), decrypt with a private key (N, d), secure because factoring N back into its two secret primes is classically believed to be hard. Try it yourself in the RSA Laboratory above.',
    link: { to: '/rsa', label: 'Open the RSA Laboratory' },
    illustration: <RsaFoundersScene />,
  },
  {
    year: '1994',
    title: "Shor's algorithm breaks the assumption",
    body: 'Peter Shor, at AT&T Bell Labs, publishes a quantum algorithm that factors integers in polynomial time -- turning "factoring is hard" from a load-bearing assumption into a statement that is only true against classical computers. The exact pipeline this project simulates.',
    link: { to: '/shor', label: "Run Shor's Algorithm Laboratory" },
    illustration: <ShorInsightScene />,
  },
  {
    year: '2001',
    title: 'First experimental demonstration',
    body: 'Researchers at IBM and Stanford run Shor\'s algorithm on a 7-qubit NMR quantum computer, factoring 15 = 3 x 5 -- proof the algorithm works on real (if tiny) hardware, not just on paper. This project\'s own Shor\'s Lab defaults to that exact same N.',
    link: { to: '/docs/real-hardware-validation', label: "Read this project's own hardware validation notes" },
    illustration: <FirstDemoScene />,
  },
  {
    year: '2016',
    title: 'NIST opens the post-quantum competition',
    body: "NIST calls for candidate algorithms designed to resist both classical and quantum attack -- work starting well ahead of any quantum computer actually capable of running Shor's algorithm on production-sized keys, precisely because migrating cryptographic infrastructure takes years.",
    illustration: <CommitteeScene />,
  },
  {
    year: '2024',
    title: 'The first post-quantum standards ship',
    body: "NIST finalizes FIPS 203, 204, and 205 -- RSA's eventual successors, already in production use before a fault-tolerant quantum computer capable of factoring real RSA key sizes exists. See Security & Limitations for exactly how far current hardware still is from that day.",
    link: { to: '/security', label: 'Read Security & Limitations' },
    illustration: <StandardsShippedScene />,
  },
  {
    year: CURRENT_YEAR,
    title: 'Where this actually stands right now',
    body: `The best published estimate for factoring a real RSA-2048 key still stands at ${QUBITS_NEEDED_2025_ESTIMATE.toLocaleString()} noisy physical qubits (Gidney, 2025) -- the largest gate-model chip publicly announced has ${LARGEST_ANNOUNCED_CHIP_QUBITS.toLocaleString()} (IBM's Condor, 2023), about ${GAP_ORDERS.toFixed(1)} orders of magnitude short. Every lab on this site runs the real mechanism; none of them run it at that scale.`,
    link: { to: '/resource-estimate', label: 'See the full resource-estimate gap' },
    illustration: <TodayScene gapOrders={GAP_ORDERS} />,
  },
]

function TimelineEntry({ milestone, index }: { milestone: Milestone; index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.92', 'start 0.55'] })
  const opacity = useTransform(scrollYProgress, [0, 1], [0, 1])
  const x = useTransform(scrollYProgress, [0, 1], [-18, 0])

  return (
    <div ref={ref} className="relative pl-14 sm:pl-20">
      <div className="absolute top-1 left-3 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-2 border-gold bg-navy font-mono text-[0.6rem] font-semibold text-gold sm:left-5">
        {index + 1}
      </div>
      <motion.div style={reduceMotion ? undefined : { opacity, x }}>
        <Card>
          <div className="flex flex-col-reverse items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs font-semibold tracking-[0.15em] text-gold uppercase">{milestone.year}</p>
              <h2 className="mt-1 font-medium text-ink">{milestone.title}</h2>
              <p className="mt-2 text-sm text-ink-muted">{milestone.body}</p>
              {milestone.link && (
                <Link to={milestone.link.to} className="mt-3 inline-block text-sm text-gold underline underline-offset-2 hover:text-gold-warm">
                  {milestone.link.label} &rarr;
                </Link>
              )}
            </div>
            <div className="shrink-0 self-center opacity-90 sm:self-auto">{milestone.illustration}</div>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}

/** The line this whole site sits on, told as six real, dated events rather than asserted in a
 * single paragraph -- from the idea of public-key cryptography to RSA's eventual successors
 * already shipping. The connecting line fills via continuous scroll progress (useScroll+
 * useTransform on the whole container), not a single IntersectionObserver toggle -- the same
 * class of bug that once left the homepage's train/car scenes stuck invisible on a mistimed
 * first check doesn't apply here, since a continuously-tracked scroll fraction can't get stuck. */
export default function HistoryPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start 0.75', 'end 0.6'] })

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Where this all comes from"
        title="A brief history of RSA and Shor's algorithm"
        description="Six real, dated milestones from the idea of public-key cryptography to the standards already replacing it -- the actual timeline this project's two labs sit on either end of."
      />

      {/* A short watch-first companion to the six milestones below, not a replacement for them --
          video on one side, a tight paragraph on the other on wide screens (stacked on mobile),
          so neither crowds out the six real, linkable, dated cards that are the actual substance
          of this page. No autoplay: same reduced-motion-respecting posture the scroll-progress
          line below already takes, and a visitor arriving mid-scroll shouldn't get sound/motion
          sprung on them uninvited. */}
      <Card className="mb-8">
        <div className="grid gap-5 sm:grid-cols-5 sm:items-center">
          <div className="sm:col-span-3">
            <video
              controls
              preload="metadata"
              className="w-full rounded-sm border border-line bg-navy"
              src={`${import.meta.env.BASE_URL}rsa-history.mp4`}
            >
              Your browser doesn't support embedded video --{' '}
              <a href={`${import.meta.env.BASE_URL}rsa-history.mp4`} className="text-gold underline underline-offset-2">
                download it directly
              </a>
              .
            </video>
          </div>
          <div className="sm:col-span-2">
            <p className="font-mono text-xs font-semibold tracking-[0.15em] text-gold uppercase">Watch first</p>
            <p className="mt-2 text-sm text-ink-muted">
              A short walkthrough of the same six milestones below, start to finish: from the idea
              of public-key cryptography in 1976 to the post-quantum standards already replacing
              RSA today. The timeline underneath has the full detail, real links, and the exact
              sources each date comes from.
            </p>
          </div>
        </div>
      </Card>

      {/* Jump-to-era chips -- real anchor links, not decoration, so the timeline is something you
          can navigate directly (e.g. straight to '1994' for the Shor's Lab context) rather than
          only ever scrolled through top to bottom. */}
      <nav className="mb-2 flex flex-wrap gap-2" aria-label="Jump to a year">
        {MILESTONES.map((m) => (
          <a
            key={m.year}
            href={`#milestone-${m.year}`}
            className="focus-ring rounded-full border border-line px-3 py-1 font-mono text-xs text-ink-muted transition-colors hover:border-gold/50 hover:text-gold-warm"
          >
            {m.year}
          </a>
        ))}
      </nav>

      <div ref={containerRef} className="relative">
        <div className="absolute top-1 bottom-1 left-3 w-px bg-line sm:left-5" aria-hidden />
        <motion.div
          className="absolute top-1 left-3 w-px origin-top bg-gold sm:left-5"
          style={reduceMotion ? { height: '100%' } : { scaleY: scrollYProgress, height: '100%' }}
          aria-hidden
        />
        <div className="flex flex-col gap-6">
          {MILESTONES.map((m, i) => (
            <div key={m.year} id={`milestone-${m.year}`} className="scroll-mt-24">
              <TimelineEntry milestone={m} index={i} />
            </div>
          ))}
        </div>
      </div>

      <p className="mt-8 border-t border-line pt-6 text-center text-sm text-ink-muted">
        Every algorithm named above is the real thing running elsewhere on this site -- not a description of it.
      </p>
    </div>
  )
}
