// SPDX-License-Identifier: MIT OR Apache-2.0
/**
 * Airdrop Sybil-filter — reference integration for poh-kit's Solana attestations.
 *
 * Takes a candidate wallet list and outputs only the wallets holding a live
 * VERIFIED_HUMAN attestation. Every check is a pure on-chain read via
 * `@poh-kit/solana` — no poh-kit API key, no network dependency on poh-kit's
 * own infrastructure. Batches lookups (100 wallets per RPC call, the
 * `getMultipleAccountsInfo` ceiling) so a real airdrop-sized list doesn't
 * mean thousands of round-trips.
 *
 * Scope, stated plainly: this filters for "has this wallet completed
 * proof-of-humanity", not "is this the only wallet this human controls".
 * One-human-one-claim uniqueness is enforced upstream, at verification time
 * (the Semaphore nullifier binds one human to one identity commitment) — this
 * script deliberately doesn't re-implement that; it only reads what's already
 * on-chain.
 *
 * Usage:
 *   npm run filter -- --wallets ./candidates.json --program <PROGRAM_ID> [--cluster mainnet-beta|devnet] [--out eligible.csv]
 *
 * candidates.json: a JSON array of base58 wallet address strings.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { deriveVerifiedHumanPda } from "@poh-kit/solana";

interface FilterResult {
  wallet: string;
  pda: string;
  verified: boolean;
}

const MAX_ACCOUNTS_PER_RPC_CALL = 100;

function parseArgs(argv: string[]) {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };
  const walletsPath = get("--wallets");
  const programId = get("--program");
  if (!walletsPath || !programId) {
    console.error(
      "Usage: npm run filter -- --wallets <path.json> --program <PROGRAM_ID> [--cluster mainnet-beta|devnet] [--out eligible.csv]",
    );
    process.exit(1);
  }
  return {
    walletsPath,
    programId,
    cluster: get("--cluster") ?? "devnet",
    outPath: get("--out"),
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main() {
  const { walletsPath, programId: programIdStr, cluster, outPath } = parseArgs(process.argv.slice(2));

  const programId = new PublicKey(programIdStr);
  const connection = new Connection(
    cluster.startsWith("http") ? cluster : clusterApiUrl(cluster as "devnet" | "mainnet-beta"),
    "confirmed",
  );

  const raw = JSON.parse(readFileSync(walletsPath, "utf8"));
  if (!Array.isArray(raw)) throw new Error(`${walletsPath} must contain a JSON array of wallet address strings`);
  const wallets: PublicKey[] = raw.map((w: string) => new PublicKey(w));

  console.log(`Checking ${wallets.length} candidate wallet(s) against ${programId.toBase58()} on ${cluster}...`);

  const pdas = wallets.map((w) => deriveVerifiedHumanPda(w, programId)[0]);
  const results: FilterResult[] = [];

  for (const batch of chunk(
    pdas.map((pda, i) => ({ pda, wallet: wallets[i] })),
    MAX_ACCOUNTS_PER_RPC_CALL,
  )) {
    const infos = await connection.getMultipleAccountsInfo(batch.map((b) => b.pda));
    infos.forEach((info, i) => {
      const { pda, wallet } = batch[i];
      results.push({
        wallet: wallet.toBase58(),
        pda: pda.toBase58(),
        verified: info !== null && info.owner.equals(programId),
      });
    });
  }

  const eligible = results.filter((r) => r.verified);
  console.log(`\n${eligible.length} / ${results.length} wallets verified.\n`);

  if (outPath) {
    const csv = ["wallet,pda", ...eligible.map((r) => `${r.wallet},${r.pda}`)].join("\n");
    writeFileSync(outPath, csv);
    console.log(`Wrote ${eligible.length} eligible wallet(s) to ${outPath}`);
  } else {
    eligible.forEach((r) => console.log(r.wallet));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
