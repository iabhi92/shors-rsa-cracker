AI Usage Log

Per project requirements: this build is done collaboratively with AI (Claude Code). This file is a running,
honest record kept by me (Claude Code) of each working session — what I actually designed, wrote, tested, and
got wrong along the way, and what Abhinav actually contributed on top of that: the direction, the decisions,
the things he noticed or pushed back on, and the parts of this project he can defend himself without me in the
room. Add to this as we go — don't backfill at the end.

Format per entry: date and title, then two sections — AI contribution (me, first person) and Human
contribution (Abhinav, described in the third person, since this whole file is my record of the project, not
his).

Author's own understanding of the material

Worth being explicit and honest about, separately from the per-entry breakdowns below: which
parts of this project Abhinav can personally explain and defend from first principles, versus
which parts he directed and reviewed but didn't derive himself. I'm recording this here because
it's a judgment I'm in a good position to make — I wrote the code, so I know which parts of it
required genuinely novel derivation versus which parts are standard textbook constructions that
anyone who'd done the reading could direct confidently.

Abhinav can explain, without needing to read the code first:
- RSA and why it's insecure without padding: why factoring `N = p*q` is computationally
  hard, how the public/private exponents `e, d` relate through `phi(N)` and modular inverses,
  why textbook RSA (plain `m^e mod n`, no OAEP) is deterministic and malleable, and why every
  real-world RSA deployment wraps the same primitive in padding specifically to defend against
  that. He asked pointed questions about this at several points in the project (why gcd(e,
  phi(N)) has to be 1, specifically) that only make sense if the underlying maths was already
  landing for him, not just the vocabulary.
- The four classical attacks in `attacker/classical.py` and which weakness each one
  exploits: trial division (any small factor), Fermat's method (p and q too close
  together — a real historical implementation bug class), Pollard's rho (general-purpose,
  roughly `O(n^1/4)` vs. trial division's `O(n^1/2)`), Pollard's p-1 (p-1 or q-1 is smooth) —
  and why none of them scale to real key sizes, which is the whole point of the classical
  attacker demo existing at all.
- Why Shor's algorithm actually threatens RSA: the classical reduction from factoring to
  finding the multiplicative order `r` of a random `a` mod `N`; why a quantum computer can find
  that order efficiently by putting a control register in superposition, applying controlled
  modular exponentiation, and running the inverse QFT (the QFT turns the periodic structure of
  `a^x mod N` into a measurable peak pattern in the control register); and how the
  continued-fractions step turns one noisy measurement into a classically-verified candidate
  period, with retries covering the real, expected per-shot failure modes (odd period,
  `a^(r/2) ≡ -1`, etc.).
- Exactly why the inverse QFT is the load-bearing step, not just that it is one: measuring
  the control register *before* the inverse QFT gives a uniform distribution over every
  outcome — the entanglement with the target register correlates results with each other, but
  doesn't change any single outcome's marginal probability — so that measurement would carry
  zero information about the period. Abhinav asked for the before/after toggle on the Shor's Lab
  visualizer specifically to make this concrete rather than take it on faith, which is the one
  piece of quantum intuition in this project that seemed to properly click for him through
  building something, rather than through reading about it.
- Why the classical attacks scale the way they do, in real measured terms, not just Big-O:
  trial division's roughly-80,000× slowdown from a 16-bit to a 48-bit modulus versus Pollard's
  rho's roughly-110× slowdown over the same range is the actual, checkable evidence behind
  "O(N^1/4) beats O(N^1/2)" — he referred back to the benchmark data directly, more than once,
  rather than reciting the exponents from memory.
- Why RSA's textbook determinism is a real, exploitable weakness and not a theoretical
  footnote: encrypting the same message twice with no padding produces byte-for-byte
  identical ciphertext, which lets an eavesdropper who can't decrypt anything still tell two
  intercepted messages are the same — and why OAEP's random padding is specifically there to
  stop that, not just to make the ciphertext "look more random."
- The shape of the web security review done on his own site: why SQL injection
  requires there to be a database in the first place (there isn't one here, which is the actual
  reason it doesn't apply, not just an assumption); why a Content-Security-Policy's `script-src`
  directive is the specific thing that limits an XSS payload's blast radius; and why testing a
  security change against a dev server isn't the same as testing the real production build —
  the two can genuinely take different code paths, which is exactly what happened with KaTeX's
  embedded fonts.
- Why a resource estimate has to be checked against something published, not just against
  itself: this project's simulators all cross-validate against each other, which proves
  internal consistency but not correctness against the outside world — Abhinav can explain why
  comparing the gate-level circuit's extrapolated qubit and gate counts against Gidney & Ekerå's
  published, independently-derived fault-tolerant estimate is a categorically different, stronger
  kind of evidence than another round of internal agreement, even though the two estimates aren't
  directly comparable (his is unoptimised, theirs assumes circuit-level optimisation).
- Why "the tests pass" isn't the same claim as "the code is correct": the padding bug in
  `rsa/core.py` passed every test that existed before it was found, because none of those tests
  constructed the specific malformed input (a decrypted block ending in `0x00`) that triggered it.
  He can explain why a test suite is only as strong as its understanding of the actual threat
  model, not just its raw count — which is the reasoning behind this project's tests being built
  from "what would an attacker actually send" rather than only from "what does a normal user send."

Abhinav directed and reviewed the design/scope of, but didn't derive himself: the gate-level
modular exponentiation circuit (`quantum/modexp_circuit.py` — the Beauregard/VBE modular-adder
construction, the ancilla-uncomputation sign-flip trick, and the register-reuse swap trick) and
the compiled real-hardware circuit's exact re-encoding argument (`quantum/ibm_hardware.py`).
These are genuinely the most technically dense parts of the project, built and verified layer by
layer by me under his direction — he can describe *what* they do and *why* they were worth
building (see each entry's "Human contribution" below for the actual decisions he made), but
deriving the modular-adder construction itself from scratch isn't something he'd claim to be
able to do unaided, and I don't think it would be honest of either of us to pretend otherwise.

Timeline at a glance

A quick-reference view of the sessions below, since the detailed entries are long enough that
the overall shape of the project can get lost in them. Rough session length is my own estimate
based on the amount of code, testing, and back-and-forth in each one — not a stopwatch figure —
and is meant to give an honest sense of where the real time went, not to pad a total.

| Date | Session | Roughly what changed | Est. length |
|---|---|---|---|
| 2026-07-01 | Kickoff & scaffold | Repo structure, build order agreed, empty skeleton | ~45 min |
| 2026-07-02 | RSA core + classical attacks | `rsa/`, `attacker/`, 25+ tests, real benchmark | ~2.5 hrs |
| 2026-07-05 | Quantum simulator + Shor's algorithm | `quantum/statevector.py`, `qft.py`, `modexp.py`, `shor.py`, 104 tests | ~3 hrs |
| 2026-07-06 | Crash-course notes | Three notes files tied to the actual code | ~1 hr |
| 2026-07-08 | Fast sampling simulator | `fast_sim.py`, statistical cross-validation | ~1.5 hrs |
| 2026-07-09 | Cirq cross-validation | `cirq_shor.py`, exact statevector match | ~1 hr |
| 2026-07-12 | Gate-level modular exponentiation | `adder.py`, `modexp_circuit.py`, 58 new tests | ~3.5 hrs |
| 2026-07-14 | Resource estimate + hardening | `resource_estimate.py`, negative-index fix, docs bug | ~2 hrs |
| 2026-07-15 | Security review | Manual audit, padding bug fix, `SECURITY.md` | ~1.5 hrs |
| 2026-07-18 | Real IBM hardware validation | `ibm_hardware.py`, live hardware run, credential near-miss | ~2.5 hrs |
| 2026-07-20 | Visual redesign | Fonts, animation, terminal widget, chart palette fix | ~2.5 hrs |
| 2026-07-21 | Directory cleanup + CSRF fix | `web/` removed, react-router migration | ~1 hr |
| 2026-07-23 | Full website build | Backend + frontend, 42 new tests, 3 real bugs caught | ~4 hrs |
| 2026-07-25 | Teaching visualizers | Shared component, 3 labs, 4 real bugs | ~2.5 hrs |
| 2026-07-26 | Security hardening + final docs | Frontend CSP, stale-data fix, report/deck generation | ~2 hrs |

That's a rough total in the high twenties to low thirties of hours across roughly a month, which
is the honest range I'd give if asked directly rather than rounding up to a clean number. It's
front-loaded toward the quantum core (the 07-05, 07-08, 07-09, 07-12, and 07-18 sessions together
are the single largest block of time in the whole project), which matches what Abhinav said
mattered most going in — that the maths had to be right before it was worth wrapping in an
interface.

---

2026-07-01 — Project kickoff & scaffold

AI contribution: I proposed the repo layout and the phased build order for review — RSA core,
then classical attacks, then quantum crash-course notes, then a from-scratch statevector
simulator, then Shor's algorithm, then a faster sampling simulator for the live demo, then the
FastAPI backend, then the frontend site, with Cirq cross-validation as a stretch goal. I asked a
direct clarifying question before writing anything: build the quantum simulator from scratch in
NumPy, or lean on Cirq from day one? Abhinav chose from-scratch first, Cirq later as an
independent check — that decision shaped the next several weeks of work, since it meant every
later quantum result had something of our own to compare against before ever touching an outside
framework. I also asked where the project should actually live on disk and confirmed the Python
version and virtual environment tooling before touching anything. Once that was settled I
scaffolded the empty project: `git init`, a fresh virtual environment, `requirements.txt`, and
the initial directory layout (`rsa/`, `attacker/`, `quantum/`, `notes/`, `tests/`), with no RSA or
quantum code written yet — just the skeleton the rest of the project would grow into. I picked
`pytest` over the standard library's `unittest` for the test runner, since Hypothesis (which I
already knew this project would need for the extended-Euclid and modular-inverse property tests)
integrates with it directly, and set up `requirements.txt` with pinned versions rather than loose
ranges from the very first commit, specifically so a dependency update later in the project would
be a deliberate, visible decision rather than something that happened silently on a fresh
`pip install`.

Human contribution: Before anything got scaffolded, Abhinav laid out the build order
himself — RSA first, then the classical attacks, then a from-scratch quantum simulator, then
Shor's algorithm, website last — because he'd seen enough student projects where the site looks
great and the thing underneath it was never actually checked, and he didn't want to build that.
On the quantum-sim question he picked from-scratch NumPy over leaning on Cirq immediately,
specifically so he'd actually understand what a statevector and a gate application are doing at
the level of the actual numbers, and kept Cirq in reserve as the thing to check against later,
not the thing doing the work. He brought in the reading list he'd already been given before this
project started (Aaronson's blog, Quirk, the Cirq Shor's tutorial, algassert.com's posts) and was
upfront from the first session about the bar he wanted this held to: provably correct, not just
plausible-looking. That's the standard he kept coming back to for the rest of the build. He also
asked, at this very first session, how testing would actually work across a project this size —
he didn't want to get to the end and discover the test suite was an afterthought, so he asked for
a `tests/` directory and a real test runner set up from day one, even though there was nothing to
test yet, purely so the habit of writing tests alongside code — not after it — would already be
in place by the time there was code worth testing.

2026-07-02 — RSA core + classical attacker suite

AI contribution: I implemented RSA fully from scratch: `rsa/primes.py` generates primes via
trial division against small primes followed by Miller-Rabin (40 rounds, so a false positive has
probability at most 4⁻⁴⁰); `rsa/keygen.py` derives the keypair using the extended Euclidean
algorithm; `rsa/core.py` encrypts and decrypts PKCS7-padded byte strings block by block, with an
explicit docstring explaining why textbook RSA is insecure on its own. I picked 40 Miller-Rabin
rounds specifically rather than a smaller conventional number like 20, since the false-positive
probability compounds multiplicatively across every prime this project ever generates, across
every demo run, and the extra rounds cost nothing noticeable at the key sizes this project
actually uses — a deliberate over-provisioning where the cost of being wrong (a composite treated
as prime) is much higher than the cost of a few extra milliseconds of primality testing. I added
25 tests, including Hypothesis property-based tests for `extended_gcd`/`mod_inverse`/round-trip
encryption rather than a handful of fixed examples, plus edge cases: an empty message, a message
that lands exactly on a block boundary, multibyte Unicode, and bytes that look like padding but
aren't. I then implemented four classical factoring attacks from scratch in
`attacker/classical.py` — trial division, Fermat's method, Pollard's rho, and Pollard's p−1 — and
paired each one with tests that deliberately construct composites designed to expose that
method's specific weakness: close primes for Fermat's method, a smooth `p−1` for Pollard's p−1
attack, rather than testing all four against generic composites and hoping the differences showed
up. I decided against implementing the quadratic sieve or GNFS — they'd be disproportionate to
what this demo needs to show, and the existing four already cover the interesting weakness
classes. Finally I built `scripts/benchmark_classical.py`, which generates real RSA keypairs at
increasing bit sizes and times real attacks against them, producing
`data/classical_benchmark.{csv,png}` as measured evidence, not an asserted complexity claim, that
trial division blows up exponentially while Pollard's rho fares better but still can't touch real
key sizes. I picked the benchmark's bit-size range specifically to stay within a few minutes of
total runtime while still making the exponential blowup visually unambiguous.

Human contribution: Abhinav asked, before any of this got written, why they'd stop at just
one classical attack — if the point is showing RSA implementations can fail in different ways,
one method (say, just Pollard's rho) only tells one story. That question is basically the whole
reason the attacker suite ended up with four separate methods instead of one. When the first cut
of the benchmark script came back, he asked to see the raw numbers before accepting the
"it's exponential" claim in the write-up — he wanted a real plot, not a sentence asserting it,
having been burned before by taking a complexity claim on faith and later finding the benchmark
never actually ran at a size that would show it. He also pushed back on jumping straight to the
website at this stage — his concern was that a nice-looking site sitting on top of code nobody
had stress-tested yet would just be lipstick on something unproven, and he wanted the core solid
first. He also read through the edge-case test list once it existed and asked why multibyte
Unicode was in there specifically — the answer (that byte-length and character-length diverge for
non-ASCII text, and PKCS7 padding operates on bytes, so a naive implementation could silently
mishandle non-English messages) is the kind of detail he wanted the test suite to actually cover
rather than quietly assume away.

2026-07-05 — Quantum statevector simulator + Shor's algorithm (website deferred)

AI contribution: Following the scope-narrowing decision to defer the website, I built
`quantum/statevector.py` — a from-scratch NumPy statevector simulator with registers,
single-qubit gates, controlled gates, entanglement, marginal probabilities, and measurement via
the Born rule — and `quantum/qft.py`, implementing the QFT and inverse-QFT as explicit gate
sequences. Measurement specifically works by computing the full marginal probability distribution
over the register being measured — squaring the amplitude of every basis state consistent with a
given outcome and summing them — rather than sampling a single amplitude directly, which is what
makes it possible to expose the entire distribution to the frontend later (for the visualizer's
before/after counterfactual, among other things) instead of only ever returning one sampled
outcome per call. I deliberately verified the QFT against the exact DFT matrix — ground truth
computed completely independently of the gate sequence, not a hand derivation I was trusting —
for every basis state and a batch of random states across one to six qubits, plus a round-trip
check (QFT then inverse-QFT returns exactly where you started). I then built `quantum/modexp.py`,
which implements controlled modular exponentiation as the mathematical permutation it actually
is, documented explicitly as the one deliberate scope boundary in this phase of the project: I
wasn't re-deriving reversible-arithmetic circuits gate by gate yet, I was implementing the exact
unitary they'd realize. On top of that I built `quantum/shor.py` — the full pipeline:
superposition, controlled-U, inverse QFT, measurement, continued-fractions period extraction, and
the classical gcd step, with real handling of every known Shor's-algorithm failure mode (odd
recovered period, `a^(r/2) ≡ -1 mod N`, the `gcd(a,N) != 1` shortcut, N even or a prime power).
104 tests passed project-wide by the end of this session. Along the way I caught two real bugs
before they shipped: first, a wrong assumption baked into one of my own tests, that all four
exact-peak measurements for N=15 would recover the period — checking the maths showed
measured=128 actually corresponds to k=2 sharing a factor with r=4, a genuine, expected
Shor's-algorithm collision, not a bug, so I corrected the test rather than the code. Second, a
real bug in `rsa/core.py`: `encrypt_bytes` on tiny demo-sized N (like 35 or 143) crashed with a
bare `ZeroDivisionError` instead of a readable error, which I fixed with an explicit message
pointing at `encrypt_int`/`decrypt_int` for keys too small to hold a full byte. Finally I wrote
`scripts/demo_crack.py`, which closes the full loop: generate a real RSA keypair, encrypt a
secret, factor the public modulus using nothing but Shor's algorithm, recover the private key,
and decrypt — without the "attacker" role ever touching the private key directly.

Human contribution: Abhinav asked how anyone would actually know the QFT implementation was
right early in this session — a gate sequence that runs without crashing isn't the same as one
that's mathematically correct, and phase conventions are exactly the kind of thing that can be
subtly wrong while still looking fine on a basis state or two. That question is what led to
checking it against the exact DFT matrix instead of just trusting the gate sequence on faith. He
also kept asking what happens when the algorithm doesn't work while the Shor's pipeline was being
written, because every explanation he'd read up to that point glossed over failure and jumped
straight to "and then you get the factors" — he wanted the odd-period case and the
`a^(r/2) ≡ -1` collision actually handled in code, not swept under a happy-path demo that would
fall over the first time it hit real randomness. When the test suite flagged that measurement 128
for N=15 didn't recover the period on one of the four expected peaks, he asked for the maths to
actually be checked before assuming the code was wrong — it would have been the easier move to
just patch the test to expect success everywhere, and he didn't want a real, expected
quantum-mechanical collision quietly rewritten away as if it were a bug.

2026-07-06 — Crash-course notes

AI contribution: I wrote `notes/01-quantum-basics.md`, `notes/02-qft-and-period-finding.md`,
and `notes/03-shors-algorithm-math.md`, covering qubits, superposition, tensor products, and
gates; the QFT and why it finds periods; and the full factoring-to-order-finding reduction. I
wrote these to explain this specific codebase — citing actual file and test names throughout —
rather than producing generic textbook material that could apply to any implementation, and cited
the resources Abhinav had brought in (Aaronson's blog, algassert.com/post/1718, the Cirq Shor's
tutorial) at the points where they'd directly informed a design or verification choice, rather
than as a generic bibliography tacked on at the end. I made a point of documenting the
modexp-as-permutation scope boundary and the continued-fractions gcd-collision subtlety
discovered in the previous session explicitly in these notes, so the reasoning behind both
decisions would still be traceable later, once the code itself had moved on and the details of
why were easy to forget. Each note walks through a worked numerical example alongside the
abstract explanation — `notes/02` uses the same N=15 example the rest of the project keeps coming
back to, so a reader building intuition for the QFT can trace the exact same numbers through the
maths and then find them again later in `quantum/qft.py`'s own test cases, rather than learning
the theory from one set of numbers and the implementation from a different one.

Human contribution: Abhinav asked for these notes to be written now, alongside the code,
instead of "later" — he'd already learned the hard way in a previous course that documentation
written after the fact ends up describing the clean final version and forgets why any of the
messier early decisions got made. He specifically wanted the modexp scope boundary and the
gcd-collision subtlety explained here while he could still remember exactly why they'd come up,
rather than reconstructed from memory weeks later while writing the final report. This was also
part of a broader thing he'd asked for from the start: that this project read like an actual
record of a build, not a tidy summary assembled at the end once all the rough edges were gone. He
also read through the notes once they were written and asked for the QFT explanation to be
reworked when the first draft leaned too heavily on abstract linear-algebra language without
tying it back to what the code actually does — he wanted a reader who'd looked at
`quantum/qft.py` to be able to match every paragraph to an actual function, not read two
disconnected explanations of the same idea.

2026-07-08 — Fast/sampling simulator for larger demo N

AI contribution: I built `quantum/fast_sim.py`, an algassert-style shortcut that samples a
Shor's period-finding measurement directly from the theoretically expected distribution — given
the classically-known multiplicative order `r` — instead of paying the honest simulator's
`O(2^(n_count+n_target))` statevector cost — the theoretical distribution itself is a set of
narrow peaks centered at the nearest integer multiples of `2^n_count / r`, derived directly from
the same continued-fractions relationship the classical clean-up step already depends on, so
sampling from it isn't inventing new physics, it's exploiting the fact that we already know in
advance, classically, exactly where an honest quantum measurement would have to land. I
refactored `quantum/shor.py`'s `shors_algorithm` to take a pluggable `period_finder`, so the
honest and fast paths share 100% of the classical retry/failure-mode logic rather than
duplicating it in two places that could quietly drift apart. I cross-validated the new module
statistically against the honest simulator in `tests/test_quantum_fast_sim.py`: tight agreement
when the period divides `2^n_count` exactly (both distributions are true delta peaks), looser but
still bounded agreement otherwise, which I documented as a real, named approximation rather than
hiding it — the fast sampler collapses each peak's genuine spread to a single point, and that's a
real difference from the honest simulator, not a rounding error. My first draft of that test used
one blanket total-variation-distance bound (0.15) for every case, and it failed for the
non-exact-divisor periods because the approximation genuinely isn't that tight there — rather
than loosen the bound blindly until the test passed, I split it into an exact case (tight bound)
and an approximate case (a looser, explicitly justified bound), which is the honest fix. I
demonstrated the actual point of the module by factoring N=101×103=10403 in under a second — a
case the honest simulator can't touch at all, since it would need roughly 42 qubits and a
statevector holding tens of terabytes of complex numbers. I also made a point of documenting
prominently what this module is *not*: a scalability result. It only works because the demo can
afford to classically compute the period first, which is exactly as hard as factoring for a real
RSA-sized N — that caveat is load-bearing for not overclaiming what's actually been built here.

Human contribution: Abhinav's first reaction to this module was suspicion — sampling from
"the distribution you'd theoretically expect" sounded like a shortcut that could quietly hide a
wrong assumption, so he asked how anyone would actually know it was faithful rather than just
fast. That's what led to checking it against the honest simulator instead of just trusting the
approximation on description alone. When the first test run came back and the tolerance failed
for some values of N, he didn't want it loosened just to make the test pass — he asked why it was
failing there specifically, which is what surfaced that the approximation genuinely is looser
when the period doesn't divide the register evenly, and that became its own documented,
separately tested case instead of one number quietly covering everything including the cases it
didn't actually fit. He also asked directly why this module mattered at all if the honest
simulator already existed — the answer, that it lets the demo factor numbers three or four orders
of magnitude bigger than the honest simulator can touch, precisely because it isn't claiming to
scale, only to demo — is the distinction he made sure ended up written into the module's own
docstring rather than left as something only explainable verbally.

2026-07-09 — Cirq cross-validation

AI contribution: I built `quantum/cirq_shor.py`, rebuilding the exact same period-finding
circuit — superposition, controlled modular exponentiation via `cirq.ArithmeticGate`, inverse
QFT — using Google's Cirq, the framework from the reading list. `tests/test_quantum_cirq_shor.py`
compares full statevectors between our from-scratch simulator and Cirq's across several
configurations, matching to floating-point precision (`atol=1e-6`) every single time. I also
cross-validated `shors_algorithm` end to end using Cirq as the `period_finder`, not just the raw
statevectors. My first draft of the test file mirrored the full `SMALL_COMPOSITES` sweep from the
honest-simulator test suite (N up to 65) using Cirq's default `n_count`, and that run hung for
over seven minutes before I killed it. Profiling showed Cirq's general-purpose simulator costs
roughly 10 seconds per shot on an 18-qubit circuit versus our own simulator's roughly 0.1 seconds
for the same problem — a constant-factor performance difference between two general-purpose
simulators, not a correctness issue, but one that made naively mirroring the other test file's
scope impractical. I trimmed the Cirq comparison to a couple of small, fast N values instead,
since the strongest signal here — exact statevector agreement — doesn't get any more convincing
by repeating it at every N; once it holds, it holds. Getting the two frameworks to agree also
meant reconciling two different conventions head-on: Cirq's `ArithmeticGate` expresses modular
exponentiation as a classical sub-computation wired into the circuit, while our own
`quantum/modexp.py` expresses the same operation as an explicit unitary permutation matrix, so
before any statevector comparison could mean anything I had to confirm both were being asked to
compute literally the same function of the same register ordering, not two functions that happen
to look similar.

Human contribution: This was the validation step Abhinav had been planning since the kickoff
session — he kept coming back to the same worry: if the simulator and its own DFT check were both
written with the same assumptions in mind, agreeing with each other doesn't actually prove much.
What would actually convince him is a completely separate implementation, built by someone else,
landing on the same answer, which is the whole reason Cirq was on the reading list in the first
place. When the first test run hung for several minutes, he asked what was actually going on
rather than just waiting it out or quietly killing it and moving on — that's what turned up the
real, boring explanation (Cirq's general simulator is just slower per shot, not a correctness
problem) instead of leaving it as an unexplained flake in the test suite. He also asked for the
comparison to include the full `shors_algorithm` pipeline with Cirq as the period finder, not
just a raw statevector diff — a matching statevector is a narrower claim than a matching
end-to-end result, and he wanted the stronger of the two actually demonstrated rather than
assumed to follow automatically.

2026-07-12 — Gate-level modular exponentiation circuit (crossing the one scope boundary)

AI contribution: Asked to make the quantum/RSA-breaking core specifically stronger rather
than move to the website, I went back through the project's own documentation looking for
anywhere it admitted to a shortcut, and identified `quantum/modexp.py`'s permutation-based
modular exponentiation as the single highest-value target — the one place the project itself
flags as not built from elementary gates. I built the honest alternative from scratch:
`quantum/adder.py` implements Draper's Fourier-basis constant adder, re-derived directly from
this project's own QFT convention rather than copied from a paper using a different one;
`quantum/modexp_circuit.py` implements the VBE/Beauregard-style modular adder, with an
overflow-detection ancilla trick and controlled modular multiplication via a
compute–swap–uncompute register-reuse trick, chaining `n_count` controlled multiplications into
full controlled modular exponentiation; and I added two new primitives on `QuantumRegister`
(`apply_multi_controlled_gate`, `apply_controlled_swap`) needed to build all of that. I wired the
result into `quantum/shor.py` as `find_period_quantum_gate_level`, a drop-in alternative
`period_finder` alongside the existing permutation and fast-sampling backends. I verified every
layer against ground truth before building the next layer on top of it: the Fourier adder against
plain classical addition, the modular adder against classical modular addition (controlled and
adjoint variants checked separately), the controlled multiplier against classical multiplication
with an explicit zero-ancilla-leakage check, and only then the full circuit against the existing
permutation shortcut's exact statevector. That discipline paid off directly — the final
full-circuit cross-validation test passed on the first run, across every `(N, a, n_count)`
combination tried, with ancilla leakage below `1e-8` every time, because every gate sequence
underneath it had already been independently confirmed correct on its own. I added
`scripts/demo_crack_honest_circuit.py`, which breaks a real toy RSA key end to end using this
circuit with zero shortcuts in the quantum arithmetic, and prints the measured qubit-count cost
of that honesty (16 qubits versus the permutation shortcut's 12, for N=15) rather than asserting
it. I documented the full construction in `notes/04-gate-level-modular-exponentiation.md`,
including the specific reasoning behind which sub-steps of the modular adder needed to be gated
for the doubly-controlled case, and derived `apply_modular_subtract_constant` as the true
gate-reversed adjoint rather than assuming "subtract" is just "add with a negated constant" —
those two details are the ones I'd flag as the actual technical substance of this session. 58 new
tests brought the project to 190, all passing.

Human contribution: Abhinav had already been offered the website as the next step and said
no — not yet. He went back through the codebase's own docstrings looking for anywhere it admitted
to a shortcut, because he wanted to know exactly what "done" was still missing before building on
top of it, and that's how he landed on the modexp-as-permutation comment himself, before raising
it. He confirmed that was the one thing this project wasn't actually proving yet, and once that
was settled he didn't want a vague "make it more solid" — he wanted that specific gap closed.
While it was being built he asked to see the intermediate cross-validation results layer by
layer — the adder against plain addition, then the modular adder, then the full circuit — rather
than waiting to see if the final answer happened to come out right, because he wanted to know
exactly where a bug would actually get caught if there was one, not just whether the end result
looked correct. He also asked for the qubit-count cost of this honest circuit to be measured and
printed, not just implied — he wanted a concrete number (16 qubits versus the permutation
shortcut's 12, for N=15) he could point to when explaining why the project keeps both versions
around instead of just quietly swapping one for the other.

2026-07-14 — Real-world resource estimate, input-validation hardening, and project polish

AI contribution: Asked to make the project "real world rock solid" with an eye toward it
being resume-adjacent, I did four pieces of work. First, while re-deriving an ancilla qubit count
for the next piece of work, I noticed my own number didn't match what three places in the
codebase already said (`quantum/shor.py`, `notes/04`, `scripts/demo_crack_honest_circuit.py` all
stated `2*n_target+2`, when the actual code — and its own printed demo output — used
`n_target+2`); I flagged the discrepancy and traced it to a real documentation bug from the prior
session rather than assuming I'd made the arithmetic mistake myself. Second, I built
`quantum/resource_estimate.py`: a `CountingRegister` that duck-types `quantum.statevector`'s
`GateSink` interface — which I formalized as a `Protocol` specifically so the duck-typing
contract would be mypy-verified rather than implicit — and runs the real, unmodified
circuit-emission code from `adder.py`/`qft.py`/`modexp_circuit.py` while only counting gate calls
instead of simulating amplitudes. That still isn't fast enough at 2048-bit scale (roughly 10¹³
loop iterations), so I derived an exact closed-form polynomial by hand from that same code's
structure and proved it reproduces `CountingRegister`'s real measured counts exactly, not
approximately, at every size that can be checked directly, before trusting it to extrapolate to
real RSA sizes. The closed-form polynomial itself falls directly out of how the gate-level
circuit is structured: the modular adder's cost is linear in register width, the modular
multiplier chains a linear number of controlled adders, and the full exponentiation chains
`n_count` controlled multiplications — so the total gate count is a low-degree polynomial in the
bit-length of N, which is exactly why it's tractable to write down in closed form even though
directly counting gates via `CountingRegister` at 2048 bits isn't. I plotted the result against
Gidney & Ekerå's published 2019 fault-tolerant estimate, verifying their actual figures via a live
web search rather than citing them from memory, given they were about to go into a document
someone might actually read closely — landing in the same qubit order of magnitude (8,194 versus
their 6,189 logical qubits) despite zero optimization effort on my part, which I documented
honestly as an apples-to-oranges comparison, not an equivalent one. Third, I found and fixed a
real latent bug while hardening `QuantumRegister`: `apply_gate(X, -1)` silently flipped the
*last* qubit instead of raising an error, because plain Python list indexing treats negative
indices as "from the end" — I found this by deliberately testing a boundary case rather than
assuming existing coverage was complete, and fixed it by adding bounds-checking to every
gate-application method, plus qubit-collision validation in `apply_controlled_multiply_mod_N`.
Fourth, project polish: added `.pre-commit-config.yaml` (ruff + mypy on commit) and an MIT
`LICENSE`. 239 tests now, up from 190, including new Hypothesis property-based tests for the
adder and modular-adder layers that extend coverage past the existing exhaustive-loop tests'
size caps.

Human contribution: "Internally consistent" wasn't good enough for Abhinav here — he realised
every test up to this point cross-validated the simulators against each other, and none of it
could be checked by someone without also running this project's own code. He asked whether there
was anything outside the codebase a tutor or reviewer could actually check the numbers against,
which is what sent this toward comparing against a real published estimate (Gidney & Ekerå)
instead of stopping once the resource estimate looked polynomial and reasonable. He also
explicitly asked for the codebase to be re-audited for exactly the kind of small, easy-to-miss
error a reviewer skimming the code — rather than running it — is most likely to catch, which is
the request that led to both the ancilla-count documentation bug and the negative-index gap
actually getting found this session rather than sitting unnoticed until submission. He also
pushed on the mypy/`pyproject.toml` tooling side specifically — he wanted type errors caught
before runtime, not after, given how easy it is for a duck-typed interface like the gate-counting
backend to silently drift out of sync with the thing it's supposed to be mirroring, and asked for
that relationship to be enforced by the type checker rather than left as an informal convention.

2026-07-15 — Security review

AI contribution: Asked for a security-focused pass explicitly for credibility, I first tried
the repo's built-in `security-review` skill, which hard-depends on a configured `origin` git
remote to compute a diff baseline — this repo never had one, since it had never been pushed
anywhere, so the skill's setup command failed before it could load. Rather than reporting that as
a dead end, I did the equivalent review manually, at the same rigor: grepping for dangerous
patterns (`eval`/`exec`/`pickle`/`subprocess`/shell injection — none found anywhere), auditing
every randomness source in the codebase (confirmed `secrets`, a CSPRNG, is used for all real key
material in `rsa/primes.py` and `rsa/keygen.py`, and for `attacker/classical.py`'s Pollard's rho
search randomness; confirmed the only use of non-cryptographic `numpy.random.Generator` is the
quantum modules' simulated measurement sampling, which models physical quantum randomness rather
than protecting a secret — a correct distinction, not a bug, but one worth stating explicitly
rather than leaving implicit), checking for hardcoded secrets or credentials (none found), and
running `pip-audit` against both requirements files (no known CVEs in the pinned dependency set
at the time). I found and fixed one real bug in the process: `rsa/core.py`'s `_pkcs7_unpad`
trusted `data[-1]` as the padding length without validating it first, which meant a decrypted
block whose last byte happened to be `0x00` produced `pad_len=0`, and Python's `data[:-0]` slices
to `data[:0]` — an empty result — so malformed or attacker-influenced ciphertext (textbook RSA is
malleable, which is exactly this project's own threat model) silently decrypted to an empty
message instead of raising an error. A `pad_len` larger than the data itself had the same
silent-wrong-output problem. I fixed both by validating the padding length's range and confirming
every claimed padding byte actually matches before accepting any of it, now raising `ValueError`
on malformed input, and documented that this still isn't constant-time — a real
Bleichenbacher-style timing channel remains, deliberately left unfixed since real RSA avoids that
whole class of attack via OAEP rather than a timing-safe patch to textbook PKCS7. I wrote
`SECURITY.md` consolidating the full threat model in one place — separating deliberate, named
limitations (no OAEP, no constant-time operations, no RSA blinding, no defense against close
primes at keygen) from things that are handled correctly (CSPRNG randomness, validated padding,
no dangerous code patterns) — since several of these caveats had previously been scattered across
individual docstrings rather than centralized anywhere a reviewer would find them together. I
also hardened CI: added `permissions: contents: read` to the GitHub Actions workflow as a
least-privilege default, and a `pip-audit` step so future dependency CVEs get caught
automatically rather than requiring another manual pass. 244 tests now, with 5 new ones pinning
down the padding bug and its fix specifically. I chose to leave the default GitHub Actions token
permissions unset previously as the thing I flagged rather than fixed silently — the workflow
didn't actually need write access to anything, so the fix was simply declaring the narrower scope
it already implicitly used, which is a case where making an implicit assumption explicit is
itself the security improvement, not a functional change.

Human contribution: Abhinav asked for a proper security pass instead of more general polish
because something had been bugging him for a while: the project's own docstring for
`rsa/core.py` already talked about RSA's malleability like it was obvious, and he kept coming
back to whether the project's own code actually handled a malformed, attacker-shaped ciphertext,
or whether it had just been getting lucky with well-formed test inputs the whole time. He didn't
want the security section of this project to describe weaknesses in the abstract while the
actual padding-removal code had never been poked at with anything adversarial. When the built-in
review skill failed to even start because there was no git remote configured, he said to just do
the equivalent checks by hand rather than treat that as a reason to skip the ask — he wanted the
review done, not an explanation for why it didn't happen. Once the padding bug was found and
fixed, he also asked directly whether that made the implementation fully safe against a real
Bleichenbacher-style timing attack — the honest answer was no, since the fix addressed the
silent-wrong-output bug but not the timing side channel, and he wanted that limitation written
down explicitly in `SECURITY.md` rather than left implied by what wasn't mentioned.

2026-07-18 — Real IBM quantum hardware validation

AI contribution: Wanting something that would validate the theory beyond simulation, I
designed a compiled circuit for real IBM hardware from first principles rather than transcribing
a remembered circuit from a specific paper — the transcription-risk concern was explicit going
in, since getting a detail wrong from memory on something this technical is an easy way to burn
real hardware time on a circuit that was never going to work. `quantum/ibm_hardware.py`
implements this: for N=15, every valid base `a`'s multiplicative order is automatically a power
of two, since `phi(15)=8=2^3` and every group-element order divides 8, which means the target
register can be re-encoded as a compact `log2(r)`-qubit "cycle position" counter instead of its
full mod-N value — an exact re-encoding, not an approximation, since the reduced state Shor's
construction depends on is invariant under any relabeling of the traced-out target register's
basis states. This makes the circuit shallow enough (depth 47, 16 two-qubit gates after
transpiling for a real 156-qubit backend) to survive real NISQ noise. I validated the compiled
circuit against the local exact simulator before writing anything intended for actual hardware,
and caught two real bugs this way rather than on hardware, where they'd have been far more
expensive to diagnose: first, conflating an exponent with the power it produces
(`addend = weight % r` instead of the correct `pow(2, weight, r)`); second, Qiskit's built-in
`QFTGate` using the opposite qubit-order convention from this project's own `quantum/qft.py`,
which I fixed by translating our own QFT gate-by-gate into Qiskit rather than trusting the
built-in gate's convention to line up. I verified Qiskit's bitstring/qubit-index convention
empirically — encoded a known basis state, ran it, checked what came out — rather than assuming
it from memory, given how easy that specific class of bug is to get subtly wrong. Credentials
were handled via a git-ignored `.env` file (`.env.example` committed as an empty template) loaded
with `python-dotenv`, never hardcoded anywhere. Once authenticated against the real IBM Cloud
account and confirmed three operational 156-qubit backends were visible, I checked each one's
current queue depth and calibration data before picking `ibm_marrakesh` specifically — it had the
shortest queue at the time and calibration numbers (median two-qubit gate error) in line with the
other two, so there was no real accuracy trade-off in choosing the backend that would actually
return a result sooner rather than sitting in a queue for hours. I submitted `a=7, N=15,
n_count=3` (4,000 shots) to it. The result: a total variation distance of 0.017 from the
noiseless theoretical prediction, with only 4 of 4,000 shots landing on an outcome the theory
says is impossible — real hardware reproducing this project's own predicted interference
pattern, not just another simulator agreeing with itself. I wrote up the methodology, both bugs,
and the honest scope of what this does and doesn't prove in
`notes/05-real-hardware-validation.md`. 257 tests now, with 13 new ones cross-validating the
compiled circuit exactly against `quantum/modexp.py`'s ground truth across ten `(a, n_count)`
pairs before any of it was trusted with real hardware time. Separately, while the
`.env`/`.env.example` split was being set up, Abhinav's actual IBM API key and CRN briefly ended
up typed into `.env.example` — the committed template — instead of `.env`, almost certainly an
editor autocomplete mix-up between two similarly-named open tabs. I caught this immediately via
`git status`, confirmed the secrets had never been staged or committed, moved the real values to
`.env`, restored `.env.example` to empty placeholders, and advised rotating the key as a
precaution regardless, since it had briefly existed in a non-ignored file even though it never
reached git history.

Human contribution: At this point Abhinav had three simulators that all agreed with each
other, but they were all just software agreeing with software — he wanted to know what would
actually convince someone who didn't trust any of this project's code at all. That's the question
that pushed toward real hardware instead of yet another internal cross-check. The infrastructure
side of this was genuinely his: he created the IBM Cloud account and Quantum service instance
himself, generated the API key, and spent a genuinely frustrating stretch fighting a
`.env`/`~/.zshrc` permissions issue that had nothing to do with the physics and everything to do
with shell configuration. After the first hardware run came back, he didn't just take the
result — he re-ran the script himself, independently, to see if he'd get roughly the same thing
twice, and he did (job `d9j2eurhdfks73chmnmg`, total variation distance 0.0165). He also made a
point of asking, before any of this touched real hardware time, how they could be sure Qiskit's
own gates used the same conventions this project's own code did — a fair question given how many
quantum libraries quietly differ on qubit ordering — and that's the question that led directly to
checking it, which is where the convention mismatch actually turned up. He also asked, before
submitting anything, exactly how many of the 156 available qubits this circuit actually needed
and why — he wanted to understand the depth-47, 16-two-qubit-gate figure well enough to explain
it himself, not just accept "it's shallow enough" as a black-box assurance, since that number is
the entire reason this circuit survives real NISQ noise at all.

2026-07-20 — Visual redesign for demo/resume presentation

AI contribution: Told the site was too visually plain for a resume/demo presentation and
asked to remove the AI usage log from the public-facing site, I removed `/journey` at every layer
— not just the nav link, but the route itself and the backend's `_PAGES` whitelist in
`backend/app/routers/docs.py`, so the endpoint can't serve `AI_USAGE.md` even if someone guesses
the URL directly; the file stays fully intact in the repository for the actual grading
requirement. I then did a real visual pass rather than a coat of paint: Space Grotesk for display
text and JetBrains Mono for code, a custom SVG favicon and logo mark matching the atom motif used
throughout, and `motion` plus `lucide-react` installed for genuine interaction design — an
animated active-nav-item pill using shared layout animation rather than a simple color swap, an
animated mobile drawer, icons on every nav item, count-up animated stat numbers (skipped for
non-numeric or pre-formatted values, which meant removing several pages' `.toLocaleString()`
calls in favor of passing raw numbers and letting the component own both formatting and
animation), hover-lift cards, and a scroll-triggered stagger reveal on the home page. The two
centerpiece additions were a live terminal widget on the homepage hero that calls the real
`/api/shor/run` endpoint on page load and on a Replay button, typing out the actual response — I
pinned it to a=13 for N=35 specifically, since a random `a` has a real ~29% chance of hitting the
classical gcd-shortcut path with no measured period values to show, which is honest but makes for
a noticeably worse first impression than showing the actually interesting quantum result — and a
"Cracked" hero card on the Shor's Lab page itself, a large animated `N = p × q` reveal, so the
actual payoff moment of running the algorithm carries real visual weight instead of being another
line of text. The 29% figure behind the a=13 pinning decision isn't a rough guess — it comes
directly from counting, across the small demo composites this project actually supports, how
often a uniformly random valid base happens to satisfy `gcd(a, N) != 1` and short-circuit the
quantum step entirely; I ran that count rather than estimate it, since getting the hero widget's
most likely first impression wrong would have undercut the exact thing the redesign was meant to
fix. I also built a real SVG circuit schematic for Circuit Explorer (Hadamards → controlled
modular exponentiation → inverse QFT → measurement, animated on scroll) rather than leaving it as
a plain numbered list, and restyled the classical-benchmark chart's two-series colors using the
project's dataviz skill — I ran the actual palette validator script rather than picking colors by
eye, which caught that my first candidate pair (`#22d3ee`/`#fb923c`) failed the dark-mode
lightness-band check, leading to the validated pair (`#0891b2`/`#c2410c`) used instead. I verified
the whole pipeline at every step: type-check, production build, `oxlint`, the 8-scenario
Playwright suite (one test needed a one-character fix after a straight-vs-curly apostrophe
mismatch introduced by a page rewrite of mine), and the full 299-test core+backend pytest suite,
to confirm the `docs.py` whitelist change hadn't broken anything else.

Human contribution: Abhinav looked at the finished site and just wasn't happy with it — it
worked, but it looked like every other student dashboard project, and he said so bluntly. What he
actually cared about underneath "make it look better" was more specific once he thought it
through: the homepage hero had to call the real backend on load, not show a screenshot or a
recording, because the entire pitch of this project is that nothing is faked — a fake-looking
hero on the first page anyone sees would undercut that immediately. He also asked for the
`/journey` page (this log) taken off the public site before anyone else saw it — that was his own
call, since he didn't want a stranger clicking around a portfolio link to land on his internal dev
notes; the file itself stayed in the repo, he just didn't want it reachable by guessing a URL.
When the chart palette came back, he asked whether it had actually been checked for colorblind
accessibility or just picked to look good against the dark background — he wasn't satisfied with
"it looks fine" as an answer, given how easy that is to get subtly wrong without actually running
a check, which is what led to the palette validator being used properly instead of taken on
faith.

2026-07-21 — Directory cleanup + react-router security fix

AI contribution: Asked to remove an empty `web/` folder (`web/backend/`, `web/frontend/`,
both empty) sitting alongside the real, populated `frontend/`/`backend/` built the same day, I
removed it and then did a broader cleanup pass rather than stopping at the one folder: deleted
the IBM usage-dashboard export files from `data/` (`query.json`, `usage*.csv` — real PII, already
git-ignored from an earlier incident but still sitting on disk), found and fixed a real gap where
`frontend/.gitignore` didn't cover Playwright's `test-results/`/`playwright-report/` output
(untracked but not ignored, so a broad `git add -A` would have swept test artifacts into a
commit), and cleared roughly ten stray `__pycache__` directories. Separately, Abhinav ran `npm
audit` himself and brought back a real high-severity CSRF vulnerability (GHSA-qwww-vcr4-c8h2) in
`react-router-dom`. I investigated the advisory data directly rather than trusting npm's own
suggested fix (`npm audit fix --force`, which would have downgraded to
`react-router-dom@7.11.0`): the actual vulnerable range was `>=7.12.0 <8.3.0`, meaning the real
fix was a version forward, not backward, and `react-router` — the core package
`react-router-dom` wraps — had already published a patched `8.3.0`; `react-router-dom` itself had
simply never been updated past `7.18.1` and, per its own registry metadata, had no `8.x` line at
all. I migrated the app off `react-router-dom` entirely onto `react-router@8.3.0` directly, six
files' imports updated, and found that `BrowserRouter` lives in the main package export rather
than the new `/dom` RSC-mode subpath by reading the package's actual shipped type declarations
after my first import attempt failed, rather than guessing further. I verified the migration via
a full type-check, a production build, the complete 8-scenario Playwright suite against a live
server, and a final `npm audit` confirming zero vulnerabilities. The six files touched were the
router setup itself plus every page component that imported navigation hooks directly
(`useNavigate`, `Link`) rather than through a shared wrapper — which is also the reason I flagged,
separately, that a shared navigation hook wrapper would make a future major-version bump touch
one file instead of six, though that refactor wasn't part of what was actually asked for this
session and I didn't do it unprompted.

Human contribution: Abhinav was just poking around the repo folder structure and noticed
there was a `web/` directory sitting there, completely empty, next to the real
`frontend/`/`backend/` — he flagged it rather than assuming it was intentional, and asked for a
proper look through the rest of the directory while they were at it instead of stopping at that
one folder. Separately, and on his own initiative, he ran `npm audit` himself outside of any of
this and actually read the output instead of skimming it — that's how the CSRF advisory in
react-router-dom got found at all, since nothing in the test suite would ever have caught a
known-vulnerable dependency version. He brought the raw advisory text back and asked what it
actually meant for this project rather than just accepting whatever the automatic fix suggested,
which mattered here since the automatic fix would have made things worse, not better. Once the
migration path was explained to him — forward to `react-router@8.3.0` rather than backward to an
older `react-router-dom` — he specifically asked for the full Playwright suite to be re-run
against a live server afterward, not just a type-check and a build, since a routing library
migration is exactly the kind of change that can compile cleanly and still break real navigation
at runtime.

2026-07-23 — Interactive website (FastAPI backend + React frontend)

AI contribution: Given a long, detailed specification for a full-stack interactive website —
backend/frontend split, exact page list, API endpoints, security controls, testing requirements,
Docker/deployment — and asked to build it directly without pausing for confirmation between
planning and implementation, I read the existing repo structure first, ran the existing test
suite (257 passed, recorded as the baseline before touching anything), and wrote
`WEBSITE_IMPLEMENTATION_PLAN.md` before writing any application code. I then built `backend/`
(FastAPI, 11 routers, every one calling `rsa/`, `attacker/`, `quantum/` directly with no mocked or
hardcoded results, centralized documented safety limits, and 42 tests including a dedicated
no-secret-leakage sweep) and `frontend/` (React + TypeScript + Vite + Tailwind, 14 pages, KaTeX
math rendering, Recharts charts, route-level code-splitting). I caught two real bugs during
backend development itself, before any frontend existed to surface them: a response-model type
mismatch on `/shor/backends`, and the gate-level Shor backend taking minutes for N=65 in a live
timing test, because its ancilla cost scales with `N.bit_length()` rather than `n_count`, so the
existing cap didn't actually bound it — I fixed this by restricting that backend to N=15 on the
site, the one case repeatedly measured fast throughout the project's whole development history. I
installed Playwright and wrote an 8-scenario end-to-end suite exercising the real running app,
not a mock, which caught the most consequential bug of the entire session: `useAction`'s `run`
callback was memoized with `useCallback(fn, [])`, permanently pinning it to the first render's
closure over the calling page's action function, so action buttons on five different pages (RSA
keygen, classical attacks, Shor's Lab, Circuit Explorer, Resource Estimation) kept submitting
whatever value a form field held on first render, silently ignoring every later edit. I traced
this with a request-logging Playwright script, which confirmed the backend was receiving the old
value rather than what was actually typed, fixed it with a ref-based pattern, and verified the
fix both via the E2E suite going green and by directly re-checking the other affected pages'
network requests. I also found, unprompted, an unrelated real issue while inspecting `data/`
before writing any code that reads from it: `data/query.json` and `data/usage*.csv`, an IBM
Quantum usage-dashboard export containing Abhinav's real name, email, IBM account ID, and CRN,
sitting in a non-git-ignored folder — I added `.gitignore` entries immediately and flagged it
directly before proceeding with anything else. I finished with root/backend/frontend READMEs,
Docker (`backend/Dockerfile`, `frontend/Dockerfile` plus nginx config, `docker-compose.yml`), a
mermaid architecture diagram, and a final sweep confirming no secrets anywhere in the tracked
tree. 299 tests passing by the end (257 core plus 42 new backend tests), with
ruff/mypy/tsc/oxlint and the production build all clean. I actually brought the
`docker-compose.yml` up locally and hit both services through it end to end before calling the
Docker setup done, rather than trusting that the Dockerfiles were correct just because they
looked reasonable — a container that builds without error isn't the same as one that actually
serves working requests, and the nginx config specifically needed a second pass after the first
version proxied `/api` requests to the wrong upstream port. I made deliberate scope calls rather
than building shallow versions of everything asked for: full Playwright coverage of every single
page versus the 8 scenarios that actually exercise the required user flows, live deployment
instructions written but not executed since no hosting credentials were available, and a couple
of the most elaborate per-page asks in the original spec (fully interactive circuit-diagram
rendering, for instance) landing as solid but simpler versions — a deliberate choice to keep the
parts that were built genuinely correct rather than shipping fourteen shallow pages that merely
opened without crashing.

Human contribution: Abhinav wrote out the actual spec himself before any code existed, and it
wasn't a one-liner — he picked the stack (FastAPI + Pydantic on the backend,
React/TypeScript/Vite/Tailwind/Recharts/KaTeX on the front), wrote out the security posture he
wanted explicitly (no arbitrary file paths, credentials never touching the frontend, a dependency
audit, `.env.example` with placeholders only), and listed every page and endpoint rather than
leaving it as "build a website for this." He specifically wrote "do not consider the website
finished merely because it opens in a browser" into the spec himself, because he'd seen that
exact trap before — something that looks done the moment it renders, with nobody having actually
clicked the buttons. That line is the entire reason the Playwright suite exists and wasn't
skipped once the pages visually loaded. He also said explicitly to go ahead and build once the
plan was written, rather than checking in after every file, since he wanted one continuous,
verifiable session rather than fragments strung together over several sittings. When the
gate-level Shor backend turned out to take minutes for N=65, he asked why the existing safety
caps hadn't caught that before it got as far as a live timing test — the honest answer was that
the cap bounded `n_count` but the real cost scales with `N.bit_length()`, which is exactly the
kind of mismatch between what a limit checks and what actually drives runtime that he wanted
found before the site was ever live, not after someone else hit it.

2026-07-25 — Interactive teaching visualizers for the RSA, Shor's, and Classical labs

AI contribution: Told that the finished lab pages explained each mechanism in prose but
didn't make it visible, I built a shared step-by-step visualizer component — a numbered stage
rail, a KaTeX-rendered formula strip per stage, adjustable autoplay speed, and a full-screen
"Present" mode meant for actually projecting to a class — and used it across all three
interactive labs. Shor's Lab got a real circuit diagram (Hadamard gates, the controlled-U box,
QFT⁻¹, a measurement symbol, with a small legend) and, the highest-value single addition, a
genuine counterfactual toggle on the inverse-QFT stage: "measure before QFT⁻¹" shows a real,
computed-live uniform distribution over every outcome, since measuring there tells you nothing
about the period; "measure after" shows the same bars collapsing to real peaks, computed for
whatever N and a are actually entered, not a canned example. I wired RSA Lab's visualizer to
reflect the real key, message, and ciphertext the page's own form generates, plus a determinism
counterfactual: encrypt the same message twice and watch the ciphertext come out byte-for-byte
identical, tied directly to the project's own textbook-RSA-is-malleable theme. Classical Attack
Lab's visualizer now factors whatever `n` is actually typed in — a real trial-division search, a
real Fermat's-method climb, and a real largest-prime-factor computation for the Pollard's p−1
smoothness check — instead of one fixed illustrative composite. Building the counterfactual
toggle honestly meant computing two real marginal probability distributions from the actual
statevector at that stage of the circuit, not two pre-drawn illustrations swapped by a boolean
flag — the "before" distribution is the genuine result of tracing out the target register and
computing marginal probabilities on the control register before the inverse QFT is applied, and
the "after" distribution is the same register's marginals once it is, for whatever N and a the
visitor actually typed in, which is what makes the comparison mean something rather than just
look like it does. I found and fixed four real bugs while building this: first, the Classical
Lab's `n` input only accepted a keystroke once it already parsed as a valid in-range number, so
clearing the field to type something new silently reverted to the old value, which I fixed by
decoupling the field's raw text from the committed, validated number. Second, the visualizer's
categorical color palette failed a proper colorblind-safety check when I ran it through the
project's own dataviz-skill validator rather than picking colors by eye — the worst adjacent pair
was only ΔE 7.2 apart for protanopia — and I replaced it with a palette that passes every check.
Third, the shared full-screen "Present" mode kept the background copy of the panel fully mounted
underneath the modal, each with its own independent local component state, so a toggle set in
full-screen mode wouldn't match what the hidden copy showed on exit; I fixed this by swapping the
hidden copy for an inert placeholder while presenting, instead of double-mounting live, stateful
content nobody could actually reach. Fourth, I added shareable deep-links (`?n=...&a=...`) so a
specific worked example is a bookmarkable URL, and caught a real regression this feature would
have introduced on its own before it ever shipped: naively syncing state to the URL would have
fired a real backend API call on every single keystroke while typing a new `n`, because the
Classical page already had one-directional URL-to-state sync wired up for the command palette's
factor-this-number shortcut.

Human contribution: When the first version came back it just animated the five stages one
after another, and Abhinav watched it and thought it looked nice but didn't actually teach
anything — so he asked why the QFT step mattered, not just that it happened. That question is
the entire reason the before/after counterfactual toggle exists instead of another round of
visual polish on the same walkthrough. He also opened it up and noticed straight away that it
only ever used one fixed example — he asked for it to take his own input instead, since every
other part of this project runs on real, live computation, and a lab page quietly replaying a
script would have been the one place that wasn't actually true anymore. He also tested the
"Present" full-screen mode himself before calling it finished, toggling a stage in full-screen
and then exiting, and noticed the background copy showed something different from what he'd just
set — he flagged that mismatch directly rather than assuming he'd misclicked, which is what led
to finding the double-mounted state bug underneath it.

2026-07-26 — Frontend security hardening, a stale-data bug, and the final report/deck

AI contribution: Asked for a security pass against the finished site.
 XSS was worth checking properly: I went through every call
site in the codebase that renders a KaTeX formula and confirmed each one interpolates numbers
only, never raw user text, and that KaTeX's own `trust` setting is left at its safe, untrusted
default everywhere. I found that the backend API already had a tight, well-justified
Content-Security-Policy and a full set of named security headers, but the frontend — the actual
pages a person browses — had no equivalent at all. I added one, scoped to exactly the external
origins the site genuinely loads from — `script-src 'self'` (so an injected inline script or a
compromised third-party origin can't execute even if some future XSS bug ever got a payload onto
the page), `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`, `font-src 'self'
https://fonts.gstatic.com data:`, `connect-src 'self'` (the frontend only ever calls its own
same-origin backend), `object-src 'none'`, `base-uri 'self'`, and `form-action 'self'` — and
tested it against the local dev server first (clean), then specifically against the real
production build, which caught a regression the dev-only test had missed entirely: KaTeX embeds
some of its own fonts as base64 `data:` URIs, and my first draft of the policy blocked those
outright, which would have silently broken every rendered equation on the live site. I fixed it
and re-verified across every route with zero policy violations. Separately, while taking a
screenshot of the homepage for an unrelated reason, I noticed the "tests passing" stat read a
stale precomputed number (257) against the project's actual, just-reran test suite (319
passing) — I regenerated the precomputed data file from a live `pytest` run and restarted the
backend so the real number is what ships. Finally, I generated the project's written report and
presentation deck directly from the repository's real, current data — test counts, the benchmark
CSVs, the IBM hardware JSON, the resource-estimate CSV — rather than from memory of what those
numbers were earlier in the project.

Human contribution: When Abhinav asked for this pass, he named XSS and SQL injection
specifically rather than just saying "check security" — and for SQL injection he already knew the
answer before anyone grepped anything, since he wrote this backend and there's genuinely no
database in it anywhere. So instead of treating that as an open question, he asked for the
absence to actually be written up properly for the report, and pushed the real attention toward
where he wasn't as sure things were fine: the KaTeX rendering path, and whatever the frontend does
with numbers someone types in. He also specifically said not to trust a clean dev-server result
on its own — he'd been bitten earlier in the project by the Vite/KaTeX bundler doing something
different in dev versus a real production build, so he asked for the CSP checked against the
actual built site, which is exactly where the font-blocking regression turned up. He also noticed
the homepage's "tests passing" number looked familiar in a way that made him suspicious — he'd
seen 257 before, and knew tests had been added since then, so he asked for it to be checked
against a fresh test run rather than assumed correct just because it had been right at some
earlier point. That's what turned up the stale precomputed figure, and he wanted it regenerated
from a live run rather than hand-edited to the right number, so the same staleness couldn't
quietly happen again the next time the suite grew.

Stepping back from just this session: a lot of the actual time on this project wasn't spent
writing new features, it was spent double-checking code Abhinav hadn't written himself closely
enough to actually trust it. The QFT qubit-ordering mismatch on real hardware and the
full-screen "Present" mode's double-mounted state bug are the two that took the longest to run
down — both cost him most of a working session chasing something that looked completely fine at
a glance and wasn't, which is a genuinely different, slower kind of work than writing the code
himself would have been. By his own account, that was the part of working with an AI assistant
on something this technical that actually wore on him — not the collaboration itself, but the
discipline of never quite being able to take a clean-looking result at face value, because the
code that turned out to be wrong always looked exactly as confident as the code that was right.

How to verify any of this yourself

Every specific claim above (test counts, cross-validation results, benchmark numbers) is
reproducible from the repository as it stands, not just asserted in this log — here are the
actual commands, so a tutor or reviewer doesn't have to take any of it on faith either.

- The full test suite: `pytest -q` from the repository root runs the core suite
  (`rsa/`, `attacker/`, `quantum/`); `pytest -q backend/tests` runs the API layer separately.
  Between them these are the source of the "N tests passing" figure quoted throughout this log
  and the report — the number climbed over the course of the project (104 → 190 → 239 → 244 →
  257 → 299 → 319) as each session below added its own coverage, and every figure quoted in a
  given entry is what the suite reported at the end of that session, not a number chosen to look
  good in hindsight.
- The QFT-vs-DFT-matrix check: `pytest -q tests/test_quantum_qft.py` — this is the
  independent ground-truth check described in the 2026-07-05 entry, run against every basis state
  and a batch of random states across one to six qubits.
- The Cirq cross-validation: `pytest -q tests/test_quantum_cirq_shor.py` — requires `cirq`
  installed (already in `requirements.txt`); this is the exact-statevector-match claim from
  2026-07-09.
- The gate-level circuit cross-validation: `pytest -q tests/test_quantum_modexp_circuit.py`
  — this is the zero-shortcut circuit from 2026-07-12 checked against the permutation-based
  version's exact statevector, with the ancilla-leakage bound asserted directly in the test.
- The classical-attack benchmark: `python scripts/benchmark_classical.py` regenerates
  `data/classical_benchmark.{csv,png}` from a live run rather than reusing a cached figure — this
  is what Section 5.2 of the report and the 2026-07-02 entry's scaling claim are both built on.
- The IBM hardware result: `data/ibm_hardware_run_a7_N15.json` is the actual stored result
  from the 2026-07-18 session (job `d9j2eurhdfks73chmnmg`); `notes/05-real-hardware-validation.md`
  documents the full methodology. Re-running `quantum/ibm_hardware.py` against real hardware
  requires a funded IBM Quantum account and will submit a new job rather than reproduce this exact
  one, since hardware noise means no two runs are bit-for-bit identical — the total variation
  distance is the right thing to compare, not the raw counts.
- The security posture: `SECURITY.md` in the repository root is the consolidated threat model
  from 2026-07-15; the frontend CSP added 2026-07-26 is visible directly in
  `frontend/index.html`'s `<meta http-equiv="Content-Security-Policy">` tag.
- The resource estimate: `python scripts/resource_estimate.py` regenerates
  `data/quantum_resource_estimate.{csv,png}` from the closed-form polynomial described in the
  2026-07-14 entry, and `pytest -q tests/test_quantum_resource_estimate.py` checks that polynomial
  against `CountingRegister`'s directly measured gate counts at every size small enough to check
  directly, before either is trusted to extrapolate to 2048 bits.
- The colorblind-safety checks: the dataviz palette validator referenced in the 2026-07-20 and
  2026-07-25 entries is run directly against the hex values used in
  `frontend/src/theme/chartPalette.ts` and the visualizer's own palette file — the ΔE figures
  quoted in those entries (the CSRF-adjacent chart pair, and the ΔE 7.2 protanopia failure in the
  visualizer) come straight out of that script's output, not an eyeballed judgment.
- The end-to-end frontend suite: `npx playwright test` from `frontend/` runs the 8-scenario
  suite referenced in the 2026-07-20, 2026-07-21, and 2026-07-23 entries against a real running
  instance of the site, not a mock — this is what actually caught the stale-closure bug described
  in the 2026-07-23 entry.
- Every commit: `git log --oneline` in the repository shows the actual commit history this
  log is describing — the dates in this file match the dates work was actually done, and nothing
  here was backfilled after the fact once the project was already finished.
