// Three real, published, citable numbers -- shared by DoomsdayClock.tsx and
// WhatBreaksFirst.tsx so both components stay in sync with a single source of truth instead of
// two hand-copied constants that could quietly drift apart.
//   - 20,000,000 physical qubits: Gidney & Ekera, "How to factor 2048 bit RSA integers in 8
//     hours using 20 million noisy qubits" (2019, arXiv:1905.09749).
//   - 1,000,000 physical qubits: Gidney, "How to factor 2048 bit RSA integers with less than a
//     million noisy qubits" (2025, arXiv:2505.15917) -- the same target, 20x cheaper six years
//     later via better arithmetic and magic-state handling, not new hardware.
//   - 1,121 qubits: IBM's Condor chip (announced 2023) -- among the largest gate-model
//     superconducting processors publicly announced, cited with its date rather than asserted
//     as "the current record" since this figure moves faster than any static page can track.
export const QUBITS_NEEDED_2019_ESTIMATE = 20_000_000
export const QUBITS_NEEDED_2025_ESTIMATE = 1_000_000
export const LARGEST_ANNOUNCED_CHIP_QUBITS = 1_121
export const LARGEST_ANNOUNCED_CHIP_NAME = "IBM's Condor (2023)"
