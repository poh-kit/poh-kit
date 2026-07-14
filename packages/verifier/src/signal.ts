// SPDX-License-Identifier: MIT OR Apache-2.0
import { verifyProof } from "@semaphore-protocol/proof";
import type { TrustTier } from "@poh-kit/core";
import { silentLogger, type GroupStore, type NullifierStore, type PohLogger, type UsedSignalStore } from "./stores.js";

/**
 * Mirrors @semaphore-protocol/proof v4's `SemaphoreProof` shape. Declared
 * locally rather than imported: the installed v4.14.3 package's declaration
 * entrypoint does `export * from "./types"`, where `./types` is a directory
 * (`dist/types/types/index.d.ts`) — an extensionless directory-index import
 * that TypeScript's `NodeNext` module resolution refuses to follow in
 * strict ESM mode. `import type { SemaphoreProof } from
 * "@semaphore-protocol/proof"` fails with TS2305 even though the runtime
 * `verifyProof` export resolves fine (it's a separately bundled JS file).
 * `merkleTreeRoot`/`message`/`nullifier`/`scope` are `NumericString`
 * (decimal strings) at runtime; `points` is an opaque packed Groth16 proof
 * we never inspect, so it's typed `unknown` here.
 */
export interface SemaphoreProof {
  merkleTreeDepth: number;
  merkleTreeRoot: string;
  message: string;
  nullifier: string;
  scope: string;
  points: unknown;
}

export interface VerifySignalInput {
  proof: SemaphoreProof;
  /** Minimum trust tier required by the signal's context (e.g. a proposal). */
  minTier: TrustTier;
  /** External-nullifier scope — one signal per member per scope. */
  scope: string;
}

export interface VerifySignalDeps {
  groups: GroupStore;
  usedSignals: UsedSignalStore;
  nullifiers?: NullifierStore;
  logger?: PohLogger;
}

export type VerifySignalResult =
  | { ok: true; nullifier: string }
  | { ok: false; code: "GROUP_EMPTY" | "TIER_ROOT_MISMATCH" | "ALREADY_SIGNALED" | "INVALID_PROOF"; message: string };

/**
 * Verify an anonymous Semaphore signal against the cached tier group.
 * Order matters and mirrors production hardening:
 *  1. group must exist and be non-empty            → GROUP_EMPTY
 *  2. proof root must equal the tier group's root  → TIER_ROOT_MISMATCH
 *     (gates a low-tier member out of a higher-tier scope)
 *  3. nullifier must be unspent in this scope      → ALREADY_SIGNALED
 *  4. the ZK proof itself must verify              → INVALID_PROOF
 * Only after all four does the nullifier get marked used.
 */
export async function verifySemaphoreSignal(
  input: VerifySignalInput,
  deps: VerifySignalDeps,
): Promise<VerifySignalResult> {
  const log = deps.logger ?? silentLogger;
  const cached = await deps.groups.get(input.minTier);
  if (!cached || cached.memberCount === 0) {
    return { ok: false, code: "GROUP_EMPTY", message: `Semaphore group for tier '${input.minTier}' is empty` };
  }
  // Defense-in-depth: a valid Semaphore proof always carries a root, so a
  // missing/empty one is rejected rather than allowed to skip the tier gate.
  const proofRoot = input.proof.merkleTreeRoot?.toString();
  if (!proofRoot || proofRoot !== cached.root) {
    log.warn("signal rejected: root missing or mismatched", { minTier: input.minTier });
    return { ok: false, code: "TIER_ROOT_MISMATCH", message: "Proof root missing or does not match the required tier group" };
  }
  const nullifier = input.proof.nullifier.toString();
  if (await deps.usedSignals.has(input.scope, nullifier)) {
    return { ok: false, code: "ALREADY_SIGNALED", message: "Nullifier already used in this scope" };
  }
  const valid = await verifyProof(input.proof);
  if (!valid) {
    log.warn("signal rejected: invalid proof", { scope: input.scope });
    return { ok: false, code: "INVALID_PROOF", message: "Invalid Semaphore proof" };
  }
  await deps.usedSignals.markUsed(input.scope, nullifier);
  return { ok: true, nullifier };
}
