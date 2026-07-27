// Mirrors backend/app/schemas/*.py -- kept in sync by hand (no codegen step in this project).

// --- meta ---
export interface ProjectMeta {
  test_count: number
  classical_attack_methods: string[]
  quantum_backends: string[]
  supported_demonstrations: string[]
  ibm_hardware_validated: boolean
  ibm_hardware_backend_name: string | null
}

// --- rsa ---
export interface KeygenResponse {
  p: number
  q: number
  n: number
  e: number
  d: number
  phi: number
  n_bits: number
  warning: string
}
export interface EncryptResponse {
  ciphertext: number[]
  block_size_bytes: number
}
export interface DecryptResponse {
  plaintext: string
}

// --- security demo ---
export interface MalleabilityResponse {
  original_ciphertext: number
  tampered_ciphertext: number
  original_plaintext: number
  tampered_plaintext: number
  expected_tampered_plaintext: number
  matches_prediction: boolean
  explanation: string
}
export interface TamperResponse {
  block_size_bytes: number
  total_blocks: number
  original_ciphertext: number[]
  tampered_ciphertext: number[]
  forged_block_index: number
  forged_block_plaintext: string
  original_plaintext: string
  tampered_plaintext: string
  explanation: string
}

// --- classical ---
export type AttackMethod = 'trial_division' | 'fermat' | 'pollards_rho' | 'pollards_p_minus_1'
export interface AttackResponse {
  n: number
  method: AttackMethod
  succeeded: boolean
  timed_out: boolean
  factor: number | null
  other_factor: number | null
  operations: number
  elapsed_seconds: number
}
export interface CompareResponse {
  n: number
  results: AttackResponse[]
}
export interface BenchmarkRow {
  bits: number
  n: number
  trial_division_seconds: number
  trial_division_succeeded: boolean
  pollards_rho_seconds: number
  pollards_rho_succeeded: boolean
}
export interface BenchmarkResponse {
  rows: BenchmarkRow[]
  source_file: string
}

// --- quantum ---
export type GateName = 'X' | 'H' | 'Y' | 'Z'
export interface Amplitude {
  basis_state: string
  real: number
  imag: number
  probability: number
}
export interface StatevectorResponse {
  n_qubits: number
  amplitudes: Amplitude[]
}
export interface BellStateResponse {
  amplitudes: Amplitude[]
  explanation: string
}
export interface QftDemoResponse {
  n_qubits: number
  before: Amplitude[]
  after: Amplitude[]
  matches_exact_dft_matrix: boolean
  max_amplitude_error_vs_dft_matrix: number
}

// --- shor ---
export type ShorBackend = 'honest' | 'gate_level' | 'fast' | 'cirq'
export interface ShorAttempt {
  a: number
  measured: number | null
  period_candidate: number | null
  outcome: string
}
export interface ShorResponse {
  n: number
  backend_used: ShorBackend
  n_count_used: number | null
  factors: [number, number] | null
  succeeded: boolean
  attempts: ShorAttempt[]
  elapsed_seconds: number
  note: string | null
}
export interface ShorBackendsResponse {
  descriptions: Record<ShorBackend, string>
  allowed_n: number[]
  gate_level_allowed_n: number[]
}

// --- circuit ---
export interface CircuitMetadataResponse {
  n: number
  n_count: number
  n_target: number
  n_ancilla: number
  total_qubits: number
  single_qubit_gates: number
  controlled_gates: number
  doubly_controlled_gates: number
  swaps: number
  controlled_swaps: number
  toffoli_equivalent_gates: number
  total_gate_emissions: number
  measured_not_estimated: boolean
}

// --- simulators ---
export interface SimulatorInfo {
  name: string
  module: string
  simulates_amplitudes: boolean
  models_gates_directly: boolean
  uses_classically_known_period: boolean
  practical_limit: string
  intended_purpose: string
  known_limitations: string
  verified_by: string
}
export interface SimulatorCompareResponse {
  simulators: SimulatorInfo[]
}

// --- resource estimate ---
export interface ResourceEstimateResponse {
  bits: number
  this_project: {
    n_count: number
    n_target: number
    n_ancilla: number
    total_qubits: number
    toffoli_equivalent_gates: number
    total_gate_emissions: number
  }
  gidney_ekera_2019: {
    logical_qubits: number
    toffoli_gates: number
    physical_qubits_headline: string
  }
  methodology_note: string
}

// --- ibm hardware ---
export interface IbmHardwareResult {
  a: number
  N: number
  n_count: number
  r: number
  backend_name: string
  job_id: string
  shots: number
  timestamp_utc: string
  counts: Record<string, number>
  theoretical_distribution: Record<string, number>
  total_variation_distance: number
  probability_mass_on_theoretically_impossible_outcomes: number
}
export interface IbmHardwareResponse {
  runs: IbmHardwareResult[]
  disclaimer: string
}

// --- docs ---
export interface DocIndexEntry {
  slug: string
  title: string
  source_file: string
}
export interface DocIndexResponse {
  pages: DocIndexEntry[]
}
export interface DocPage {
  slug: string
  title: string
  source_file: string
  content_markdown: string
}
