// SPDX-License-Identifier: MIT OR Apache-2.0
// Ordinals are a cross-chain constant: they match Attestations.sol (../../
// contracts/evm) and the Solana attestations program. Do not reorder.
export enum AttestationKind {
  VERIFIED_HUMAN = 0,
  VOTED = 1,
  SUPPORTED_PROPOSAL = 2,
  RECEIVED_SHARE = 3,
}
