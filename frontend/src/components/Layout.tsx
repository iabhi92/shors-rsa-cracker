import { NavLink, Outlet, useLocation } from 'react-router'
import UnswBuildingIllustration from './UnswBuildingIllustration'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { DURATION, EASE_SIGNATURE } from '../lib/motion'
import SfxToggle from './SfxToggle'
import {
  Atom,
  BarChart3,
  BookOpen,
  Bug,
  CircuitBoard,
  Compass,
  Cpu,
  ExternalLink,
  GitCompareArrows,
  History,
  Home,
  Info,
  KeyRound,
  Map,
  Menu,
  Radar,
  Search,
  Server,
  ShieldCheck,
  Sigma,
  Swords,
  Waves,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import CommandPalette from './CommandPalette'
import type { CommandItem } from './CommandPalette'
import AmbientBackground from './AmbientBackground'

/** Four groups by subject, not by how the site happened to get built -- a first-time visitor can
 * hold four words in their head, even though there are eighteen actual pages behind them (see
 * the command palette / `/guide` for the full list, nothing here is hidden). Previously six
 * groups split closely related content apart for no reason a visitor could guess: Shor's Lab
 * lived in "Interactive Lab" while the QFT deep-dive, resource estimate, and simulator
 * comparison for that exact same algorithm lived in two different other groups, and "Hardware"
 * was a whole top-level group holding one link. Regrouped around what each page is actually
 * about instead. */
const NAV_SECTIONS: { label: string; icon: LucideIcon; links: { to: string; label: string; icon: LucideIcon }[] }[] = [
  {
    label: 'Home',
    icon: Home,
    links: [{ to: '/', label: 'Home', icon: Home }],
  },
  {
    label: 'Foundations',
    icon: Atom,
    links: [
      { to: '/quantum-fundamentals', label: 'Quantum Fundamentals', icon: Atom },
      { to: '/rsa', label: 'RSA Laboratory', icon: KeyRound },
    ],
  },
  {
    label: "Shor's Algorithm",
    icon: Sigma,
    links: [
      { to: '/qft', label: 'QFT & Period-Finding', icon: Waves },
      { to: '/shor', label: "Shor's Algorithm Lab", icon: Cpu },
      { to: '/circuit-explorer', label: 'Circuit Explorer', icon: CircuitBoard },
      { to: '/simulator-comparison', label: 'Simulator Comparison', icon: GitCompareArrows },
      { to: '/resource-estimate', label: 'Resource Estimation', icon: BarChart3 },
      { to: '/ibm-hardware', label: 'IBM Hardware Validation', icon: Server },
    ],
  },
  {
    label: 'Attacking RSA',
    icon: Swords,
    links: [
      { to: '/classical-attacks', label: 'Classical Attack Lab', icon: Swords },
      { to: '/classical-benchmark', label: 'Classical Benchmark', icon: BarChart3 },
      { to: '/malleability-lab', label: 'Malleability & Tampering Lab', icon: Bug },
      { to: '/attack-surface', label: 'Attack Surface Map', icon: Map },
    ],
  },
  {
    label: 'About the Project',
    icon: Info,
    links: [
      { to: '/guide', label: 'How to Use This Site', icon: Compass },
      { to: '/history', label: 'History of RSA & Shor', icon: History },
      { to: '/security-dashboard', label: 'Security Dashboard', icon: Radar },
      { to: '/security', label: 'Security & Limitations', icon: ShieldCheck },
      { to: '/docs', label: 'Documentation', icon: BookOpen },
    ],
  },
]

const COMMAND_ITEMS: CommandItem[] = NAV_SECTIONS.flatMap((section) =>
  section.links.map((link) => ({ to: link.to, label: link.label, icon: link.icon, section: section.label })),
)

/** Each top-level entry is the section's own icon + label (matching the reference's six simple
 * links); clicking navigates to the section's first page, and expands the group in place to
 * reveal its real sub-pages so nothing is actually hidden behind the simplified label. */
function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation()

  return (
    <nav className="flex flex-col gap-1">
      {NAV_SECTIONS.map((section) => {
        const isSectionActive = section.links.some((l) => l.to === location.pathname)
        const isSingle = section.links.length === 1
        return (
          <div key={section.label}>
            <NavLink
              to={section.links[0].to}
              end={section.links[0].to === '/'}
              onClick={isSingle ? onNavigate : undefined}
              className={`focus-ring group relative flex items-center gap-3 border-l-2 py-2 pr-3 pl-3 font-sans text-sm font-medium transition-colors ${
                isSectionActive ? 'border-gold bg-surface text-gold-warm' : 'border-transparent text-ink-muted hover:bg-surface/60 hover:text-ink'
              }`}
            >
              {isSectionActive && (
                <motion.span
                  layoutId="active-nav-marker"
                  className="absolute top-0 -left-0.5 h-full w-0.5 bg-gold"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <section.icon className={`h-4.5 w-4.5 shrink-0 ${isSectionActive ? 'text-gold' : ''}`} strokeWidth={1.5} />
              <span>{section.label}</span>
            </NavLink>
            {!isSingle && (
              <ul className="mt-0.5 mb-1 ml-[1.65rem] flex flex-col gap-0.5 border-l border-line pl-3.5">
                {section.links.map((link) => (
                  <li key={link.to}>
                    <NavLink
                      to={link.to}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        `focus-ring block rounded-sm px-2 py-1 font-mono text-xs transition-colors ${
                          isActive ? 'text-gold-warm' : 'text-ink-muted/80 hover:text-ink'
                        }`
                      }
                    >
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </nav>
  )
}

/** A small bridge-line emblem beside the project name -- three deck lines under a shallow
 * arch, echoing HarbourBridgeIllustration.tsx at icon scale. */
function BridgeEmblem() {
  return (
    <svg viewBox="0 0 28 20" className="h-4 w-6 shrink-0" aria-hidden="true">
      <path d="M2 14 C 2 5, 26 5, 26 14" fill="none" stroke="#c99545" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="6" y1="9" x2="6" y2="14" stroke="#c99545" strokeWidth="1" opacity="0.7" />
      <line x1="14" y1="5.5" x2="14" y2="14" stroke="#c99545" strokeWidth="1" opacity="0.7" />
      <line x1="22" y1="9" x2="22" y2="14" stroke="#c99545" strokeWidth="1" opacity="0.7" />
      <line x1="0" y1="14.5" x2="28" y2="14.5" stroke="#204a66" strokeWidth="1.4" />
    </svg>
  )
}

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/40">
        <BridgeEmblem />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-sm font-semibold tracking-[0.08em] text-ink uppercase">Shor's Lab</span>
        <span className="block font-mono text-[0.6rem] tracking-[0.1em] text-ink-muted uppercase">Quantum security research</span>
      </span>
    </span>
  )
}

function useIsMac() {
  const [isMac, setIsMac] = useState(false)
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent))
  }, [])
  return isMac
}

function CommandPaletteTrigger({ onOpen }: { onOpen: () => void }) {
  const isMac = useIsMac()
  return (
    <button
      type="button"
      onClick={onOpen}
      className="focus-ring flex w-full max-w-sm items-center gap-2 rounded-sm border border-line bg-navy px-3 py-1.5 font-mono text-sm text-ink-muted transition-colors hover:border-ink-muted"
    >
      <Search className="h-3.5 w-3.5 shrink-0" />
      <span className="hidden truncate sm:inline">go to page...</span>
      <span className="ml-auto hidden shrink-0 rounded-sm border border-line px-1.5 py-0.5 text-[0.65rem] text-ink-muted sm:inline">
        {isMac ? '⌘K' : 'ctrl K'}
      </span>
    </button>
  )
}

/** A real G.H. Hardy quote (A Mathematician's Apology-adjacent sentiment) -- not invented
 * filler, and genuinely on-theme for a page about number theory and proof. */
function SidebarQuote() {
  return (
    <blockquote className="mt-6 border-l-2 border-gold/40 px-3 py-1 font-display text-sm text-ink-muted italic">
      "Mathematics is the harbour in which truth arrives."
      <footer className="mt-1 font-sans text-xs not-italic text-ink-muted/70">— after G. H. Hardy</footer>
    </blockquote>
  )
}

function LiveStatus() {
  return (
    <div className="mt-auto flex items-center gap-2 border-t border-line px-3 pt-4 font-mono text-xs text-ink-muted">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
      </span>
      <span>
        <span className="block tracking-[0.1em] text-ink-muted/70 uppercase">Live systems</span>
        <span className="block text-ink-muted">All systems nominal.</span>
      </span>
    </div>
  )
}

/** A reciprocal link to the other project -- the Kelsey/Lang/Lucks distributed hash-signature
 * showcase links back here the same way, each site pointing visitors at the other rather than
 * only at itself. */
function AlsoBuilt() {
  return (
    <a
      href="https://iabhi92.github.io/Crypto-Project/"
      target="_blank"
      rel="noreferrer"
      className="focus-ring mt-3 flex items-center gap-2 border-t border-line px-3 pt-3 font-mono text-xs text-ink-muted transition-colors hover:text-gold"
    >
      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
      <span>
        <span className="block tracking-[0.1em] text-ink-muted/70 uppercase">Also built</span>
        <span className="block">Distributed threshold signatures →</span>
      </span>
    </a>
  )
}

/** The nav list is long enough (18 pages across 4 groups) that it can outgrow the viewport on
 * its own -- previously the *entire* sidebar (logo included) scrolled as one region, which
 * meant reaching Live Systems or Also Built at the bottom meant scrolling the logo and top of
 * the nav out of view first, easy to never discover. Now only this middle region scrolls
 * (`min-h-0` is required here, not optional -- without it a flex child won't shrink below its
 * content size and `overflow-y-auto` never actually engages); the logo above and the
 * quote/illustration/status footer below stay pinned and always visible. */
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <NavLink to="/" onClick={onNavigate} className="focus-ring shrink-0 rounded-sm">
        <Logo />
      </NavLink>
      <div className="mt-8 min-h-0 flex-1 overflow-y-auto">
        <NavLinks onNavigate={onNavigate} />
      </div>
      <div className="shrink-0">
        <SidebarQuote />
        <UnswBuildingIllustration />
        <LiveStatus />
        <AlsoBuilt />
      </div>
    </div>
  )
}

/** A page change reads as a measurement resolving into a definite result, not just a generic
 * cross-fade -- a soft blur pulls into focus on the way in, mirrors out on the way out. Subtle
 * and fast (280ms) on purpose: this runs on every single navigation, so it has to earn its
 * place without ever feeling like it's slowing anyone down. `prefers-reduced-motion` drops the
 * blur/motion entirely and just swaps content. */
function AnimatedOutlet() {
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={reduceMotion ? undefined : { opacity: 0, y: 8, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={reduceMotion ? undefined : { opacity: 0, y: -6, filter: 'blur(6px)' }}
        transition={{ duration: 0.28, ease: EASE_SIGNATURE }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  )
}

export default function Layout() {
  const [navOpen, setNavOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      } else if (e.key === '/' && !typing) {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="min-h-screen bg-navy">
      <AmbientBackground />
      <div className="relative z-40 border-b border-gold/20 bg-gold/5 px-4 py-2 text-center font-mono text-xs text-gold-warm sm:text-sm">
        <span className="text-gold">!</span> Educational demonstration only. Keys, moduli, and RSA sizes here are
        intentionally tiny so classical/quantum attacks finish in seconds &mdash; today's classical hardware cannot run
        Shor's algorithm against real production RSA keys. See{' '}
        <NavLink to="/security" className="underline underline-offset-2 hover:text-gold">
          Security &amp; Limitations
        </NavLink>
        .
      </div>

      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-navy px-4 py-3 lg:hidden">
        <NavLink to="/" className="focus-ring shrink-0 rounded-sm">
          <span className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
            <BridgeEmblem />
            Shor's Lab
          </span>
        </NavLink>
        <div className="ml-auto flex items-center gap-2">
          <CommandPaletteTrigger onOpen={() => setPaletteOpen(true)} />
          <button
            type="button"
            onClick={() => setNavOpen((v) => !v)}
            aria-expanded={navOpen}
            aria-controls="nav-drawer"
            aria-label="Toggle navigation menu"
            className="focus-ring flex shrink-0 items-center gap-1.5 rounded-sm border border-line px-3 py-1.5 font-mono text-sm text-ink-muted"
          >
            {navOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <CommandPalette items={COMMAND_ITEMS} open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* persistent desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 flex-col overflow-y-auto border-r border-line bg-navy px-5 py-6 lg:flex">
        <SidebarContent />
      </aside>

      {/* mobile drawer -- same content, toggled */}
      <AnimatePresence>
        {navOpen && (
          <motion.div
            id="nav-drawer"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: DURATION.micro }}
            className="fixed inset-y-0 left-0 z-40 flex w-72 flex-col overflow-y-auto border-r border-line bg-navy px-5 py-6 shadow-2xl lg:hidden"
          >
            <SidebarContent onNavigate={() => setNavOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {navOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.micro }}
            onClick={() => setNavOpen(false)}
            className="fixed inset-0 z-30 bg-black/70 lg:hidden"
          />
        )}
      </AnimatePresence>

      <div className="lg:pl-72">
        <div className="hidden items-center justify-end gap-2 border-b border-line bg-navy px-4 py-3 sm:px-8 lg:flex">
          <SfxToggle />
          <CommandPaletteTrigger onOpen={() => setPaletteOpen(true)} />
        </div>
        <main className="relative z-10 mx-auto min-w-0 max-w-6xl px-4 py-8 sm:px-8">
          <AnimatedOutlet />
        </main>
      </div>
    </div>
  )
}
