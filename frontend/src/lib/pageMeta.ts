/** Per-route <title> and meta description text.
 *
 * This is a client-rendered SPA with one static index.html, so every route shipped the same
 * title/description to search engines and link previews until this existed -- a search result
 * for "/qft" and one for "/ibm-hardware" looked identical apart from the URL. Google's crawler
 * does execute JS and will pick up whatever document.title/meta[name=description] read at
 * render time (see usePageMeta in Layout.tsx), so this is a real, if partial, substitute for
 * having actual per-route HTML without taking on a server-rendering migration.
 *
 * Keys match the route paths in App.tsx exactly (including the leading slash); the default
 * export's fallback covers `/docs/:slug` and any route not listed here.
 */
const SITE_NAME = "Shor's Lab"
const SITE_TAGLINE = "Shor's Algorithm vs. RSA"

type PageMeta = { title: string; description: string }

export const PAGE_META: Record<string, PageMeta> = {
  '/': {
    title: `${SITE_TAGLINE} — Quantum Computing Breaks RSA, From Scratch`,
    description:
      "A hands-on demonstration of how Shor's algorithm breaks RSA encryption: from-scratch RSA, classical factoring attacks, a real quantum statevector simulator, and a live run on actual IBM quantum hardware.",
  },
  '/quantum-fundamentals': {
    title: `Quantum Fundamentals — Qubits, Superposition & Entanglement | ${SITE_NAME}`,
    description:
      'Learn qubits, superposition, and entanglement against a real from-scratch quantum statevector simulator, cross-validated against Google Cirq.',
  },
  '/rsa': {
    title: `RSA Laboratory — Build a Real Keypair From Scratch | ${SITE_NAME}`,
    description:
      'Generate a real RSA keypair, encrypt a message, and decrypt it -- implemented from scratch with no cryptography library, in your browser.',
  },
  '/qft': {
    title: `QFT & Period-Finding — The Math Behind Shor's Algorithm | ${SITE_NAME}`,
    description:
      "The quantum Fourier transform and period-finding explained and verified against the exact discrete Fourier transform matrix -- the mechanism that makes Shor's algorithm work.",
  },
  '/shor': {
    title: `Shor's Algorithm Lab — Run It Step by Step | ${SITE_NAME}`,
    description:
      "Run Shor's algorithm interactively: modular exponentiation, period-finding, and RSA factorization, step by step against a real quantum simulator.",
  },
  '/circuit-explorer': {
    title: `Quantum Circuit Explorer | ${SITE_NAME}`,
    description: "Inspect the actual quantum circuit Shor's algorithm compiles to, gate by gate.",
  },
  '/simulator-comparison': {
    title: `Simulator Comparison — Honest vs. Fast Quantum Simulation | ${SITE_NAME}`,
    description:
      'How a from-scratch honest quantum simulator compares to a fast sampling-based simulator for period-finding at scale, cross-validated statistically.',
  },
  '/resource-estimate': {
    title: `Quantum Resource Estimation — Qubits & Gates to Break RSA | ${SITE_NAME}`,
    description: "Real resource estimates: how many qubits and gates Shor's algorithm needs to factor RSA keys of different sizes.",
  },
  '/ibm-hardware': {
    title: `Real IBM Quantum Hardware Run | ${SITE_NAME}`,
    description: "Submit this project's real circuit to an actual IBM quantum computer, live, and see the result -- not a stored screenshot.",
  },
  '/classical-attacks': {
    title: `Classical Attack Lab — Break RSA Without a Quantum Computer | ${SITE_NAME}`,
    description: 'Classical factoring attacks against RSA: trial division, Pollard rho, Fermat, and more, run live against real keys.',
  },
  '/classical-benchmark': {
    title: `Classical Attack Benchmark | ${SITE_NAME}`,
    description: 'Measured performance of classical factoring algorithms across RSA key sizes -- where classical attacks stop scaling.',
  },
  '/malleability-lab': {
    title: `Malleability & Tampering Lab — Six Real Attacks on Textbook RSA | ${SITE_NAME}`,
    description: 'Six live attacks on textbook RSA, from ciphertext malleability to a fault attack that factors a key from a single signature.',
  },
  '/attack-surface': {
    title: `RSA Attack Surface Map | ${SITE_NAME}`,
    description: 'Every real attack against RSA in this project mapped by category -- key recovery, message recovery, and side-channels -- against what stops each one.',
  },
  '/guide': {
    title: `How to Use This Site | ${SITE_NAME}`,
    description: "A guided path through this project's demos, in the order they're meant to be explored.",
  },
  '/history': {
    title: `History of RSA & Shor's Algorithm | ${SITE_NAME}`,
    description: "The real history behind RSA encryption and Shor's algorithm, from 1977 to today's quantum hardware.",
  },
  '/security-dashboard': {
    title: `Security Dashboard | ${SITE_NAME}`,
    description: "A live overview of this project's own security posture: tests passing, attacks demonstrated, and known limitations.",
  },
  '/security': {
    title: `Security & Limitations | ${SITE_NAME}`,
    description: "What this project's demonstration keys can and can't tell you about real-world RSA security -- read before drawing conclusions from it.",
  },
  '/docs': {
    title: `Documentation | ${SITE_NAME}`,
    description: "This project's own technical notes, rendered directly from its repository.",
  },
}

export const DEFAULT_PAGE_META: PageMeta = {
  title: `${SITE_TAGLINE} | ${SITE_NAME}`,
  description:
    "From-scratch RSA, classical factoring attacks, a real quantum simulator, and a live IBM quantum hardware run -- an interactive demonstration of why quantum computing breaks RSA.",
}
