export interface PathStep {
  to: string
  label: string
}

// The actual suggested order across every lab on the site, previously described only once, in
// prose, on the Guide page -- a visitor navigating via the sidebar (or landing on a page
// directly from a search engine or shared link) never saw it. NextStepNav.tsx reads this same
// list to render real prev/next links at the bottom of every page in the sequence, so the path
// is something the pages themselves enforce, not just something described once and hoped for.
export const LEARNING_PATH: PathStep[] = [
  { to: '/quantum-fundamentals', label: 'Quantum Fundamentals' },
  { to: '/rsa', label: 'RSA Laboratory' },
  { to: '/qft', label: 'QFT & Period-Finding' },
  { to: '/shor', label: "Shor's Algorithm Lab" },
  { to: '/circuit-explorer', label: 'Circuit Explorer' },
  { to: '/simulator-comparison', label: 'Simulator Comparison' },
  { to: '/resource-estimate', label: 'Resource Estimation' },
  { to: '/ibm-hardware', label: 'IBM Hardware Validation' },
  { to: '/classical-attacks', label: 'Classical Attack Lab' },
  { to: '/classical-benchmark', label: 'Classical Benchmark' },
  { to: '/malleability-lab', label: 'Malleability & Tampering Lab' },
  { to: '/attack-surface', label: 'Attack Surface Map' },
]
