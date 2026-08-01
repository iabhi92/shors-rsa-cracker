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
  // Decimal strings, not numbers: with use_oaep these carry ~1024-bit values, well past what a
  // JS float64 can represent exactly -- see the matching Pydantic schema's own docstring.
  original_ciphertext: string
  tampered_ciphertext: string
  original_plaintext: string
  tampered_plaintext: string
  expected_tampered_plaintext: string
  matches_prediction: boolean
  explanation: string
  oaep_used: boolean
  original_oaep_valid: boolean | null
  tampered_oaep_valid: boolean | null
  original_message_int: number | null
  tampered_message_int: number | null
}
export interface ParityOracleStep {
  query_number: number
  oracle_bit: 0 | 1
  lo: number
  hi: number
}
export interface ParityOracleResponse {
  original_message: number
  recovered_message: number
  matches_original: boolean
  total_queries: number
  steps: ParityOracleStep[]
}
export interface WienerKeygenResponse {
  n: string
  e: string
  d: string
  p: string
  q: string
  n_bits: number
  d_bits: number
  wiener_bound_bits: number
}
export interface WienerAttackResponse {
  succeeded: boolean
  recovered_d: string | null
  recovered_p: string | null
  recovered_q: string | null
  convergents_tried: number
  total_convergents: number
}
// n/e/d/p/q/phi are decimal strings for the same reason as MalleabilityResponse above -- this
// is a real ~1024-bit key, unlike every other KeygenResponse on this site.
export interface OaepKeygenResponse {
  p: string
  q: string
  n: string
  e: string
  d: string
  phi: string
  n_bits: number
  warning: string
}
export interface TimingScenario {
  label: string
  mean_ns: number
  median_ns: number
  min_ns: number
  stddev_ns: number
}
export interface TimingComparisonResult {
  scenarios: TimingScenario[]
  gap_ns: number
  gap_percent: number
  gap_in_std_errors: number
  verdict: string
}
export interface TimingOracleResponse {
  trials: number
  pkcs7: TimingComparisonResult
  oaep: TimingComparisonResult
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
export interface TrialDivisionTraceStep {
  divisor: number
  remainder: number
  is_factor: boolean
}
export interface TrialDivisionTraceResponse {
  n: number
  succeeded: boolean
  factor: number | null
  other_factor: number | null
  operations: number
  elapsed_seconds: number
  steps: TrialDivisionTraceStep[]
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
export interface ResourceCurvePoint {
  bits: number
  total_qubits: number
  toffoli_equivalent_gates: number
  ge_logical_qubits: number
  ge_toffoli_gates: number
}
export interface ResourceCurveResponse {
  points: ResourceCurvePoint[]
}
export interface ClassicalTimeEstimateResponse {
  bits: number
  reference_bits: number
  trial_division_log10_seconds: number
  trial_division_human: string
  pollards_rho_log10_seconds: number
  pollards_rho_human: string
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

// Mirrors backend/app/schemas/ibm.py's AllowedLiveA -- every a coprime with 15 whose
// multiplicative order is automatically a power of two (see quantum/ibm_hardware.py).
export const ALLOWED_LIVE_A_VALUES = [2, 4, 7, 8, 11, 13, 14] as const
export type AllowedLiveA = (typeof ALLOWED_LIVE_A_VALUES)[number]

export interface IbmLiveSubmitResponse {
  run_id: string
  a: number
  N: number
  n_count: number
  r: number
  shots: number
  backend_name: string
  job_id: string
  status: 'queued'
}

export type IbmLiveStatus = 'queued' | 'running' | 'done' | 'error'

export interface IbmLiveStatusResponse {
  run_id: string
  status: IbmLiveStatus
  a: number
  N: number
  n_count: number
  r: number
  shots: number
  backend_name: string
  job_id: string
  counts: Record<string, number> | null
  theoretical_distribution: Record<string, number> | null
  total_variation_distance: number | null
  probability_mass_on_theoretically_impossible_outcomes: number | null
  error_message: string | null
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
