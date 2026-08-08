// SPDX-License-Identifier: MIT OR Apache-2.0
//
// End-to-end local-validator test: proves the gate actually works, not just that
// it compiles. `mock-attestations` (see programs/mock-attestations/src/lib.rs)
// stands in for poh-kit's real attestations program — same PDA scheme, deployed
// locally by `anchor test` since the real program has no local/devnet deployment
// yet to clone. `vote-gate` itself has zero dependency on which one is real.
import { createHash } from "node:crypto";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { deriveVerifiedHumanPda } from "@poh-kit/solana";
import { assert } from "chai";
import type { VoteGate } from "../target/types/vote_gate";
import type { MockAttestations } from "../target/types/mock_attestations";

describe("solana-dao-vote-gate", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const voteGate = anchor.workspace.VoteGate as Program<VoteGate>;
  const mockAttestations = anchor.workspace.MockAttestations as Program<MockAttestations>;

  const authority = provider.wallet as anchor.Wallet;
  const verifiedVoter = Keypair.generate();
  const unverifiedVoter = Keypair.generate();

  const question = "Should poh-kit ship the SDK this week?";
  // Solana caps each individual PDA seed at 32 bytes — a freeform question
  // can't be a seed directly. Hash it instead, same pattern the real
  // attestations program uses for context_hash.
  const proposalId = createHash("sha256").update(question).digest();

  let proposalPda: PublicKey;

  before(async () => {
    // Fund both test wallets so they can pay for their own vote transactions.
    for (const kp of [verifiedVoter, unverifiedVoter]) {
      const sig = await provider.connection.requestAirdrop(kp.publicKey, 2e9);
      await provider.connection.confirmTransaction(sig, "confirmed");
    }

    // Issue a VERIFIED_HUMAN-shaped attestation for verifiedVoter only —
    // unverifiedVoter deliberately gets none. `record` is passed explicitly
    // (rather than relying on client-side PDA auto-resolution) using the
    // exact same derivation the gate itself checks — dogfooding
    // @poh-kit/solana even for the test's own setup.
    const [recordPda] = deriveVerifiedHumanPda(verifiedVoter.publicKey, mockAttestations.programId);
    await mockAttestations.methods
      .issueVerifiedHuman(verifiedVoter.publicKey)
      .accounts({ record: recordPda, payer: authority.publicKey })
      .rpc();

    [proposalPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("proposal"), authority.publicKey.toBuffer(), proposalId],
      voteGate.programId,
    );

    await voteGate.methods
      .initializeProposal([...proposalId], question, mockAttestations.programId)
      .accounts({ proposal: proposalPda, authority: authority.publicKey })
      .rpc();
  });

  it("accepts a vote from a verified-human wallet", async () => {
    const [attestationPda] = deriveVerifiedHumanPda(verifiedVoter.publicKey, mockAttestations.programId);

    await voteGate.methods
      .castVote(true)
      .accounts({
        proposal: proposalPda,
        verifiedHumanAttestation: attestationPda,
        voter: verifiedVoter.publicKey,
      })
      .signers([verifiedVoter])
      .rpc();

    const proposal = await voteGate.account.proposal.fetch(proposalPda);
    assert.equal(proposal.yesVotes.toNumber(), 1);
    assert.equal(proposal.noVotes.toNumber(), 0);
  });

  it("rejects a vote from a wallet with no attestation", async () => {
    // Derived exactly as the gate itself derives it — this address was never
    // initialized by mock-attestations, so it's empty and system-owned.
    const [attestationPda] = deriveVerifiedHumanPda(unverifiedVoter.publicKey, mockAttestations.programId);

    let threw = false;
    try {
      await voteGate.methods
        .castVote(true)
        .accounts({
          proposal: proposalPda,
          verifiedHumanAttestation: attestationPda,
          voter: unverifiedVoter.publicKey,
        })
        .signers([unverifiedVoter])
        .rpc();
    } catch (err) {
      threw = true;
      assert.include(String(err), "NotVerifiedHuman");
    }
    assert.isTrue(threw, "expected cast_vote to reject an unverified wallet");

    const proposal = await voteGate.account.proposal.fetch(proposalPda);
    assert.equal(proposal.yesVotes.toNumber(), 1, "unverified vote must not have counted");
  });

  it("rejects a second vote from the same already-verified wallet", async () => {
    const [attestationPda] = deriveVerifiedHumanPda(verifiedVoter.publicKey, mockAttestations.programId);

    let threw = false;
    try {
      await voteGate.methods
        .castVote(false)
        .accounts({
          proposal: proposalPda,
          verifiedHumanAttestation: attestationPda,
          voter: verifiedVoter.publicKey,
        })
        .signers([verifiedVoter])
        .rpc();
    } catch {
      threw = true; // ballot PDA already exists — Anchor's `init` fails outright.
    }
    assert.isTrue(threw, "expected a second vote from the same wallet to be rejected");

    const proposal = await voteGate.account.proposal.fetch(proposalPda);
    assert.equal(proposal.yesVotes.toNumber(), 1, "double-vote must not have counted");
  });
});
