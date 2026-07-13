// SPDX-License-Identifier: MIT OR Apache-2.0
import { Group } from "@semaphore-protocol/group";
import { TIERS, TIER_RANK, type TrustTier } from "@poh-kit/core";
import type { CachedGroup, GroupStore, NullifierStore } from "./stores.js";

/**
 * Build the three tier-filtered Semaphore groups from all attached
 * commitments and cache them. Tier expansion is baked in: a member of tier T
 * appears in every group with minTier rank ≤ rank(T), so verification is a
 * single group lookup.
 */
export async function buildGroups(
  nullifiers: NullifierStore,
  groups: GroupStore,
): Promise<Record<TrustTier, CachedGroup>> {
  const members = (await nullifiers.listCommitments()).filter(
    (m) => m.commitment && /^\d+$/.test(m.commitment),
  );
  const result = {} as Record<TrustTier, CachedGroup>;
  for (const tier of TIERS) {
    const minRank = TIER_RANK[tier];
    const eligible = members
      .filter((m) => TIER_RANK[m.trustTier] >= minRank)
      .map((m) => m.commitment);
    const group = new Group(eligible.map((c) => BigInt(c)));
    const cached: CachedGroup = {
      tier,
      commitments: eligible,
      memberCount: eligible.length,
      root: group.root.toString(),
    };
    await groups.put(tier, cached);
    result[tier] = cached;
  }
  return result;
}
