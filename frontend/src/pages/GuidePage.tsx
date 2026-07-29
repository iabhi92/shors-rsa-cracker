import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Command, Compass, Eye, FlaskConical, Lightbulb, Search, Swords, Terminal } from 'lucide-react'
import { Card, PageHeader } from '../components/ui'

/** The exact same bounds the real command palette uses to recognize a bare composite number as
 * "Factor n = ..." (see CommandPalette.tsx) -- mirrored here, not re-guessed, so this preview
 * never claims the palette accepts something it actually wouldn't. */
const MIN_N = 4
const MAX_N = 10_000_000

function QuickActionTry() {
  const [value, setValue] = useState('3233')
  const asInt = Number(value.trim())
  const valid = value.trim() !== '' && Number.isInteger(asInt) && asInt >= MIN_N && asInt <= MAX_N

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-sm border border-line bg-navy p-3">
      <span className="font-mono text-xs text-ink-muted">try it --</span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="focus-ring w-28 rounded-sm border border-line bg-surface px-2 py-1 font-mono text-sm text-ink"
        aria-label="A number to factor"
      />
      {valid ? (
        <Link
          to={`/classical-attacks?n=${asInt}`}
          className="focus-ring flex items-center gap-1.5 rounded-sm border border-gold/40 bg-gold/10 px-2.5 py-1 font-mono text-xs text-gold-warm transition-colors hover:border-gold/70"
        >
          <Swords className="h-3.5 w-3.5" /> Factor n = {asInt} <ArrowRight className="h-3 w-3" />
        </Link>
      ) : (
        <span className="font-mono text-xs text-ink-muted">
          type a whole number from {MIN_N} to {MAX_N.toLocaleString()}
        </span>
      )}
    </div>
  )
}

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="start here"
        title="How to Use This Site"
        description="What everything on this site actually means, and the fastest way to get around it. Five minutes here saves you clicking through fifteen pages blind."
      />

      <Card title="0. New to this topic entirely? Start here.">
        <div className="flex items-start gap-3">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
          <div className="space-y-3 text-sm text-ink-muted">
            <p>
              <strong className="text-ink">What is RSA, actually?</strong> It's the math behind the little padlock icon in your browser. The trick:
              multiplying two numbers together is easy (even for huge numbers), but going backwards -- given only the answer, finding which two numbers
              were multiplied -- is brutally hard, <em>if</em> the numbers are prime and the answer is big enough. RSA turns "hard to undo" into "hard to
              break the encryption without the secret key." Your public key is basically a giant number N; your private key is the two primes that
              multiply to make it. Anyone can lock a message with N. Only someone who knows the two primes can unlock it.
            </p>
            <p>
              <strong className="text-ink">So why can't computers just find those two primes?</strong> They can -- for small N, instantly (try it on
              the <Link to="/rsa" className="text-gold underline underline-offset-2">RSA Laboratory</Link> page). The problem is how fast the
              difficulty grows. Real RSA keys are 600+ digits long, and the best known classical method still takes longer than the age of the universe.
              That gap between "small demo" and "real key" is exactly what the{' '}
              <Link to="/classical-benchmark" className="text-gold underline underline-offset-2">Classical Benchmark</Link> page measures and plots.
            </p>
            <p>
              <strong className="text-ink">Where does quantum computing come in?</strong> An ordinary bit is 0 or 1. A qubit can be in a mix of both
              at once (called superposition), and multiple qubits can become correlated with each other (entanglement) in ways that let a quantum computer
              explore many possibilities in parallel. That doesn't make it magic -- it's only actually faster for a small number of very specific
              problems. Factoring large numbers happens to be one of them.
            </p>
            <p>
              <strong className="text-ink">What does Shor's algorithm do, in one sentence?</strong> It reframes "find the two primes" as "find a
              repeating pattern (a period) hiding inside a huge sequence of numbers" -- and a quantum computer can find that hidden pattern efficiently
              using a trick called the quantum Fourier transform, where the right answer reinforces itself (like sound waves in tune) while every wrong
              answer cancels out. Once you have that pattern, plain classical arithmetic (no quantum computer needed) turns it into the two prime factors.
              See it happen for real on the <Link to="/shor" className="text-gold underline underline-offset-2">Shor's Algorithm Lab</Link> page, and
              the reinforcement/cancellation trick itself on the <Link to="/" className="text-gold underline underline-offset-2">homepage</Link>.
            </p>
            <p>
              <strong className="text-ink">Should you be worried?</strong> Not today. Building a quantum computer with enough stable qubits to attack
              a real 2048-bit RSA key is still a hard, unsolved engineering problem -- today's real hardware (see{' '}
              <Link to="/ibm-hardware" className="text-gold underline underline-offset-2">IBM Hardware Validation</Link>) can run this exact
              algorithm on toy numbers like 15, not on anything resembling a real key. This site exists to make the actual mechanism concrete instead of a
              vague headline -- not to claim the sky is falling.
            </p>
          </div>
        </div>
      </Card>

      <Card title="1. Getting around without the sidebar" className="mt-4">
        <div className="flex items-start gap-3">
          <Command className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
          <div>
            <p className="text-sm text-ink-muted">
              There's no permanent sidebar -- press <kbd className="rounded-sm border border-line bg-navy px-1.5 py-0.5 text-xs">/</kbd> or{' '}
              <kbd className="rounded-sm border border-line bg-navy px-1.5 py-0.5 text-xs">Ctrl/⌘ K</kbd> anywhere on the site (or click the{' '}
              <span className="font-mono text-ink-muted">go to page...</span> box in the header) to open the command palette. Type a few letters of any
              page name, use the arrow keys or your mouse, and hit Enter.
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              Prefer a full list? Click <span className="font-mono text-ink-muted">Menu</span> in the top-right for every page, grouped by section.
            </p>
          </div>
        </div>
      </Card>

      <Card title="2. Quick actions" className="mt-4">
        <div className="flex items-start gap-3">
          <Search className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
          <div>
            <p className="text-sm text-ink-muted">
              The command palette isn't just navigation. Type a plain composite number --{' '}
              <span className="font-mono text-gold-warm">3233</span>, say -- and it offers{' '}
              <span className="font-mono text-gold-warm">Factor n = 3233</span>. Hit Enter and you land on the{' '}
              <Link to="/classical-attacks" className="text-gold underline underline-offset-2">
                Classical Attack Lab
              </Link>{' '}
              with all four attacks already run against it. This is that exact same command, live:
            </p>
            <QuickActionTry />
          </div>
        </div>
      </Card>

      <Card title="3. The pattern every lab follows" className="mt-4">
        <div className="flex items-start gap-3">
          <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
          <div>
            <p className="text-sm text-ink-muted">Every interactive page (RSA Laboratory, Classical Attack Lab, Shor's Algorithm Lab, the Malleability Lab) follows the same three-step shape:</p>
            <ol className="mt-2 space-y-1.5 text-sm text-ink-muted">
              <li>
                <span className="font-mono text-gold">1.</span> configure inputs (a bit size, a number, a backend) --
                every field has a sane, pre-filled default, so you can skip straight to step 2 if you just want to see it work.
              </li>
              <li>
                <span className="font-mono text-gold">2.</span> run it -- this is always a real, live request to the FastAPI backend
                (<span className="font-mono text-ink-muted">backend/app/</span>), which calls this project's actual Python implementation.
                Nothing on this site is a canned or hardcoded result.
              </li>
              <li>
                <span className="font-mono text-gold">3.</span> read the result -- laid out as data first (numbers, tables, attempt
                logs), with the plain-English explanation underneath it, not instead of it.
              </li>
            </ol>
          </div>
        </div>
      </Card>

      <Card title="4. What the badges and chrome actually mean" className="mt-4">
        <div className="flex items-start gap-3">
          <Eye className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
          <ul className="space-y-2 text-sm text-ink-muted">
            <li>
              <span className="mr-1.5 inline-flex items-center gap-1 font-mono text-[0.65rem] text-success uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                live
              </span>
              on the homepage terminal means that panel just made a real API call on page load -- refresh and the numbers can change, because it's a genuine
              quantum period-finding run, not a recording.
            </li>
            <li>
              The amber banner at the very top of every page is the one disclaimer worth actually reading: key sizes here are intentionally tiny (8-24
              bits) so the attacks finish in human time. That's a deliberate teaching choice, not a limitation anyone's hiding -- see{' '}
              <Link to="/security" className="text-gold underline underline-offset-2">
                Security &amp; Limitations
              </Link>{' '}
              for the full, honest list of what this implementation does and doesn't defend against.
            </li>
            <li>The three-dot window chrome on code/terminal panels is decorative framing (like a terminal emulator's title bar) -- the content inside is real, not the chrome.</li>
          </ul>
        </div>
      </Card>

      <Card title="5. Where things live" className="mt-4">
        <div className="flex items-start gap-3">
          <Compass className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
          <div className="grid gap-x-6 gap-y-3 text-sm text-ink-muted sm:grid-cols-2">
            <div>
              <p className="font-medium text-ink">Classical</p>
              <p className="mt-1 text-ink-muted">RSA keygen/encrypt/decrypt, the four classical factoring attacks, the malleability &amp; tampering demos, and measured benchmark data.</p>
            </div>
            <div>
              <p className="font-medium text-ink">Quantum</p>
              <p className="mt-1 text-ink-muted">Qubit/entanglement basics, the QFT, the full Shor's algorithm lab, a real gate-level circuit explorer, simulator comparisons, resource estimates, and actual IBM hardware results.</p>
            </div>
            <div>
              <p className="font-medium text-ink">Project</p>
              <p className="mt-1 text-ink-muted">A live security dashboard (self-checking headers and rate limits), the honest security/limitations writeup, and this project's own markdown notes rendered directly from the repo.</p>
            </div>
            <div className="sm:col-span-2">
              <p className="font-medium text-ink">Not sure where to start? Follow this order:</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {[
                  { to: '/rsa', label: 'RSA Laboratory', hint: 'build a real key, lock a message' },
                  { to: '/classical-attacks', label: 'Classical Attack Lab', hint: 'break it by hand' },
                  { to: '/shor', label: "Shor's Algorithm Lab", hint: 'watch quantum change the math' },
                ].map((step, i, arr) => (
                  <span key={step.to} className="flex items-center gap-1.5">
                    <Link
                      to={step.to}
                      title={step.hint}
                      className="focus-ring flex items-center gap-1.5 rounded-sm border border-line px-2.5 py-1.5 transition-colors hover:border-gold/50 hover:bg-gold/5"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/60 font-mono text-[0.65rem] text-gold">
                        {i + 1}
                      </span>
                      <span className="text-sm text-ink">{step.label}</span>
                    </Link>
                    {i < arr.length - 1 && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-muted" />}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-6 flex items-start gap-3 rounded-sm border border-line bg-surface/50 p-4">
        <Terminal className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" />
        <p className="text-sm text-ink-muted">
          This page is itself an example of the site's one house rule: explain the real mechanism, not just the vibe. If something here doesn't match
          what you actually see, that's a bug -- not a simplification.
        </p>
      </div>
    </div>
  )
}
