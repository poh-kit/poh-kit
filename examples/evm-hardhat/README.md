# End-to-end EVM example

The full poh-kit loop on a local Hardhat chain: deploy the identity contracts,
create Semaphore identities, anchor commitments, build tier groups, cast an
anonymous tier-gated signal (real Groth16 proof), reject a replay, and issue a
soulbound VERIFIED_HUMAN attestation.

```bash
npm install
npm run e2e   # first run downloads Semaphore snark artifacts (~few MB)
```

Passport verification is mocked here; the production flow
(`@poh-kit/verifier`'s `createSelfVerifier`) verifies Self Protocol proofs
against the Celo hub and needs a real ePassport scan from the Self app.

## Symlinked contracts

`contracts/` in this directory is a git-tracked symlink to
`../../contracts/evm/contracts`, so Hardhat compiles the same identity
contracts used by the deployed OP Sepolia record rather than a copy. This
requires a symlink-enabled checkout — on Windows or on a clone with
`core.symlinks=false`, the symlink degrades to a plain text file containing
the target path, and `npm run e2e` fails with a confusing Hardhat "contract
not found" error rather than a clear symlink error. Fix: `git config
core.symlinks true` and re-checkout the repo (`git checkout -- contracts` or
a fresh clone).
