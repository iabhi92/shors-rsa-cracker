import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Crosshair } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Card, PageHeader, StatCard } from '../components/ui'
import { ATTACKS, CATEGORY_ICON, CATEGORY_STYLES, CATEGORY_VAR } from '../lib/attackSurface'
import type { AttackEntry } from '../lib/attackSurface'
import { DURATION, EASE_SIGNATURE } from '../lib/motion'
import NextStepNav from '../components/NextStepNav'
import DocLink from '../components/DocLink'

/** Evenly distributes `total` nodes around a circle, starting at the top and going clockwise --
 * independent of ATTACKS' current length of 8, so an added/removed row just changes the angle
 * step instead of needing hand-placed coordinates. */
function nodePosition(index: number, total: number) {
  const angle = ((-90 + (360 / total) * index) * Math.PI) / 180
  const radius = 40
  return { x: 50 + radius * Math.cos(angle), y: 50 + radius * Math.sin(angle) }
}

/** A radial topology instead of a flat table: eight attacks radiating from the RSA core they
 * all target reads as a map of the actual attack surface, not just a list. Category is always
 * encoded in both color AND icon (never color alone), so it stays legible for colorblind
 * visitors and reduced-motion visitors get the graph fully drawn instead of animated in. */
function AttackTopologyMap({ selected, onSelect }: { selected: number; onSelect: (i: number) => void }) {
  const reduceMotion = useReducedMotion()

  return (
    <div className="relative mx-auto aspect-square w-full max-w-md sm:aspect-[3/2] sm:max-w-none" role="group" aria-label="RSA attack surface topology">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {ATTACKS.map((a, i) => {
          const { x, y } = nodePosition(i, ATTACKS.length)
          return (
            <motion.line
              key={a.name}
              x1={50}
              y1={50}
              x2={x}
              y2={y}
              stroke={CATEGORY_VAR[a.category]}
              strokeWidth={0.4}
              initial={reduceMotion ? undefined : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: i === selected ? 0.85 : 0.35 }}
              transition={{ pathLength: { duration: DURATION.base, delay: reduceMotion ? 0 : i * 0.05, ease: EASE_SIGNATURE }, opacity: { duration: DURATION.fast } }}
            />
          )
        })}
      </svg>

      {/* central target -- a slow outward radar pulse, echoing the "live" ping dot already used
          in the sidebar's status indicator rather than inventing a second motion language. */}
      <div className="absolute top-1/2 left-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 border-gold bg-navy text-center">
        {!reduceMotion && (
          <motion.span
            className="absolute inset-0 rounded-full border border-gold"
            animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
            aria-hidden
          />
        )}
        <span className="font-mono text-[0.6rem] leading-tight text-gold-warm">RSA-2048</span>
        <span className="font-mono text-[0.55rem] text-ink-muted">core target</span>
      </div>

      {ATTACKS.map((a, i) => {
        const { x, y } = nodePosition(i, ATTACKS.length)
        const Icon = CATEGORY_ICON[a.category]
        const isSelected = i === selected
        return (
          <button
            key={a.name}
            type="button"
            onClick={() => onSelect(i)}
            aria-label={a.name}
            aria-pressed={isSelected}
            title={a.name}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              borderColor: CATEGORY_VAR[a.category],
              boxShadow: isSelected ? `0 0 16px -3px ${CATEGORY_VAR[a.category]}` : undefined,
            }}
            className={`focus-ring absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-surface transition-transform duration-150 hover:scale-110 sm:h-12 sm:w-12 ${
              isSelected ? 'scale-110' : 'opacity-80'
            }`}
          >
            <Icon className={`h-4 w-4 ${CATEGORY_STYLES[a.category]}`} />
          </button>
        )
      })}
    </div>
  )
}

function AttackDetailPanel({ attack }: { attack: AttackEntry }) {
  const Icon = CATEGORY_ICON[attack.category]
  return (
    <Card className="flex h-full flex-col gap-4">
      <div className="flex items-start gap-2.5">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${CATEGORY_STYLES[attack.category]}`} />
        <div className="min-w-0">
          <span className={`font-mono text-[0.65rem] tracking-wide uppercase ${CATEGORY_STYLES[attack.category]}`}>{attack.category}</span>
          <h3 className="font-display text-lg text-ink">{attack.name}</h3>
        </div>
      </div>
      <p className="text-sm text-ink-muted">{attack.detail}</p>
      <dl className="grid gap-2.5 border-t border-line pt-3 text-xs">
        <div>
          <dt className="font-mono tracking-wide text-ink-muted uppercase">Compromises</dt>
          <dd className="mt-0.5 text-ink">{attack.compromises}</dd>
        </div>
        <div>
          <dt className="font-mono tracking-wide text-ink-muted uppercase">Attacker needs</dt>
          <dd className="mt-0.5 text-ink">{attack.attackerNeeds}</dd>
        </div>
        <div>
          <dt className="font-mono tracking-wide text-ink-muted uppercase">Real RSA's defense</dt>
          <dd className="mt-0.5 text-ink">{attack.defense}</dd>
        </div>
      </dl>
      <Link
        to={attack.to}
        className="focus-ring mt-auto inline-flex items-center gap-1.5 self-start rounded-sm bg-gold px-3 py-1.5 font-mono text-xs font-medium text-navy transition-colors hover:bg-gold-warm"
      >
        Run this attack <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </Card>
  )
}

export default function AttackSurfacePage() {
  const [selected, setSelected] = useState(0)
  const keyRecoveryCount = ATTACKS.filter((a) => a.category === 'Key recovery').length

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Every attack on this site, in one place"
        title="Attack Surface Map"
        description="Eight real attacks against RSA, demonstrated live elsewhere on this site, mapped against what each one actually compromises, what an attacker needs to pull it off, and what stops it in real-world RSA. Not a wishlist -- every node links to a real, running demo."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Attacks demonstrated" value={ATTACKS.length} />
        <StatCard label="Break the key entirely" value={keyRecoveryCount} hint="p, q, or d recovered" />
        <StatCard label="Need the private key?" value="No" hint="not one row does" />
        <StatCard label="Mocked or hardcoded" value={0} hint="every row is real code" />
      </div>

      <h2 className="mb-3 font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">Attack topology</h2>
      <div className="mb-10 grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <AttackTopologyMap selected={selected} onSelect={setSelected} />
        </Card>
        <motion.div key={selected} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.fast, ease: EASE_SIGNATURE }}>
          <AttackDetailPanel attack={ATTACKS[selected]} />
        </motion.div>
      </div>

      <h2 className="mb-3 font-mono text-sm font-semibold tracking-wide text-ink-muted uppercase">
        The full picture, one attack at a time
      </h2>
      <div className="flex flex-col gap-4">
        {ATTACKS.map((a) => {
          const Icon = CATEGORY_ICON[a.category]
          return (
            <Card key={a.name} interactive>
              <Link to={a.to} className="group flex items-start gap-3">
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${CATEGORY_STYLES[a.category]}`} />
                <div className="min-w-0">
                  <h3 className="font-medium text-ink group-hover:text-gold">
                    {a.name} <Crosshair className="ml-1 inline h-3.5 w-3.5 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100" />
                  </h3>
                  <p className="mt-1 text-sm text-ink-muted">{a.detail}</p>
                </div>
              </Link>
            </Card>
          )
        })}
      </div>

      <DocLink to="/security" title="Security & Limitations" />
      <NextStepNav />
    </div>
  )
}
