import { KeyRound, MessageSquareWarning, Radio, ShieldAlert } from 'lucide-react'

export type Category = 'Key recovery' | 'Message recovery' | 'Message manipulation' | 'Side-channel'

export interface AttackEntry {
  name: string
  category: Category
  compromises: string
  attackerNeeds: string
  defense: string
  detail: string
  to: string
}

export const CATEGORY_STYLES: Record<Category, string> = {
  'Key recovery': 'text-red-300',
  'Message recovery': 'text-gold-warm',
  'Message manipulation': 'text-violet',
  'Side-channel': 'text-harbour',
}

export const CATEGORY_ICON: Record<Category, typeof KeyRound> = {
  'Key recovery': KeyRound,
  'Message recovery': MessageSquareWarning,
  'Message manipulation': ShieldAlert,
  'Side-channel': Radio,
}

// Every row here is a real, live demo elsewhere on this site -- AttackSurfacePage.tsx is a map
// of what's already built, not a wishlist. Lives in lib/ (not inlined in AttackSurfacePage.tsx
// itself) specifically so HomePage.tsx's "attacks demonstrated" stat can import ATTACKS.length
// directly -- a second hardcoded number on the homepage would drift the moment an attack is
// added here, and HomePage.tsx is eagerly bundled (not lazy, unlike AttackSurfacePage), so it
// must not pull in that page's own Card/Table-heavy component code just to read a count.
export const ATTACKS: AttackEntry[] = [
  {
    name: 'Classical factoring',
    category: 'Key recovery',
    compromises: 'Full private key (p, q, d)',
    attackerNeeds: 'Public key only (N)',
    defense: 'N large enough that factoring is computationally infeasible (2048+ bits)',
    detail:
      'Trial division, Fermat, Pollard\'s rho, and Pollard\'s p-1 all just try to factor N directly. Every one of them is exponential in N\'s bit length -- fast enough to break this site\'s tiny teaching keys in milliseconds, hopeless against a real key.',
    to: '/classical-attacks',
  },
  {
    name: "Shor's algorithm",
    category: 'Key recovery',
    compromises: 'Full private key (p, q, d)',
    attackerNeeds: 'Public key (N) + a large fault-tolerant quantum computer',
    defense: 'None, long-term -- migrate to post-quantum algorithms (FIPS 203/204/205) before one exists',
    detail:
      "The whole reason this project exists: a quantum computer can find N's factors in polynomial time via period-finding, not exponential. Today's real hardware can run this exact algorithm on toy numbers like 15 -- see Resource Estimation for how far that is from a real 2048-bit key.",
    to: '/shor',
  },
  {
    name: "Wiener's attack",
    category: 'Key recovery',
    compromises: 'Full private key -- d directly, then p and q',
    attackerNeeds: 'Public key only (N, e) -- no oracle, no ciphertext',
    defense: 'Never choose an abnormally small private exponent; standard keygen (large e, derived d) is immune',
    detail:
      "Continued-fraction convergents of e/N leak d outright whenever d was chosen too small (roughly d < N^0.25 / 3) -- pure number theory against the public key alone, reusing the exact same math Shor's algorithm uses to turn a measurement into a period.",
    to: '/malleability-lab',
  },
  {
    name: 'RSA-CRT fault injection',
    category: 'Key recovery',
    compromises: 'Full private key (p, q) -- from ONE signature',
    attackerNeeds: 'One faulted signature (a real hardware glitch) + the message it signed',
    defense: 'Verify s^e == m before ever releasing a CRT-signed output -- catches any single-branch fault',
    detail:
      "Boneh-DeMillo-Lipton (1997): CRT-optimized signing computes mod p and mod q separately for speed. A single physical fault (voltage glitch, laser pulse) in just one branch, and gcd(s'^e - m mod n, n) hands over a full factor. No weak key needed -- this works against a completely ordinary one.",
    to: '/malleability-lab',
  },
  {
    name: 'Parity/LSB oracle attack',
    category: 'Message recovery',
    compromises: 'One message, fully -- zero access to the private key',
    attackerNeeds: 'Chosen ciphertexts + an oracle leaking 1 bit (parity) per query',
    defense: 'OAEP padding -- breaks the multiplicative homomorphism this attack depends on',
    detail:
      "RSA's multiplicative homomorphism plus any single-bit leak per query -- a timing gap, a distinct error page, anything that collapses to one bit -- is enough to binary-search out an entire message in ceil(log2(N)) queries, using only the public key.",
    to: '/malleability-lab',
  },
  {
    name: 'Multiplicative malleability',
    category: 'Message manipulation',
    compromises: 'Predictable control over what a ciphertext decrypts to, without ever touching d',
    attackerNeeds: 'An intercepted ciphertext + the ability to modify it in transit',
    defense: 'OAEP padding, or any authenticated encryption wrapping',
    detail:
      'Textbook RSA has no ciphertext integrity: c\' = c * s^e mod n decrypts to m*s mod n for any attacker-chosen s. The attacker never sees the plaintext or the key, yet fully controls the multiplicative relationship of what comes out the other end.',
    to: '/malleability-lab',
  },
  {
    name: 'Block substitution (splicing)',
    category: 'Message manipulation',
    compromises: 'Undetected forged content spliced into a decrypted multi-block message',
    attackerNeeds: 'An intercepted ciphertext + the public key (to forge a replacement block)',
    defense: 'Authenticated encryption -- a MAC over the whole ciphertext catches any splice',
    detail:
      'Textbook RSA encrypts each block independently, like ECB mode in a block cipher -- no chaining between blocks. An attacker can encrypt a block of their own choosing with just the public key and swap it into a non-final position, completely undetected.',
    to: '/malleability-lab',
  },
  {
    name: 'PKCS7 padding timing side-channel',
    category: 'Side-channel',
    compromises: 'A measurable timing leak -- the real bug this project itself shipped and fixed',
    attackerNeeds: 'Many precisely-timed chosen-ciphertext queries',
    defense: 'Constant-time padding checks, or OAEP entirely -- measurably closes the gap, live, on this site',
    detail:
      "PKCS7 unpadding's early-exit branching leaks whether padding was valid through response time (>200 sigma, measured live) -- the exact building block a Bleichenbacher-style oracle attack chains into full decryption. OAEP's always-run-every-check design shows <1 sigma: no measurable leak.",
    to: '/security-dashboard',
  },
]
