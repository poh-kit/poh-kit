# Source-verifying the identity contracts

The three identity contracts are deployed on **Optimism Sepolia** (chainId
`11155420`) — addresses in [`deployments/optimismSepolia.json`](./deployments/optimismSepolia.json).
This doc gets their **source** verified on a block explorer so anyone can read
the exact code behind the addresses.

## What's true today (measured, not assumed)

The contracts are on-chain but **not source-verified** on the public explorers
(Optimistic Etherscan / Blockscout both report the addresses as unverified
contracts).

The runtime bytecode compiled from **this repo's source** is **byte-identical**
to what's deployed — they diverge only in the trailing Solidity *metadata hash*.
That difference exists because poh-kit changed two things versus the source the
contracts were originally deployed from: the SPDX header
(`MIT` → `MIT OR Apache-2.0`) and a trim of unused errors in `Errors.sol`.
Comments and SPDX lines don't change opcodes, but they do change the metadata
IPFS hash the compiler appends — so:

- Verifying the **existing** addresses from this repo's source → **partial match**
  (runtime bytecode matches; metadata differs). Explorers show it as verified
  with a "partial/similar match" label.
- A **full match** needs the metadata to match too — achieved by either
  redeploying from this repo's source, or verifying from the original
  deploy-time source.

## Recommended: redeploy from poh-kit source → full match (cleanest story)

Makes the on-chain addresses run *exactly* this public source, full-match
verified. Best for grant/audit reviewers ("these addresses = this repo").

```bash
export EVM_DEPLOYER_KEY=0x<funded-optimism-sepolia-deployer-key>   # never commit
export ETHERSCAN_API_KEY=<your-etherscan-v2-api-key>              # never commit
npx hardhat run scripts/deploy.ts --network optimismSepolia
```

The script prints the new addresses and a ready-to-run `hardhat verify` line for
each (each constructor takes the admin address as its single argument). Then
update `deployments/optimismSepolia.json` with the new addresses.

## Quick path: verify the existing addresses on Sourcify (default, key-free)

No redeploy, no gas, no API key. `hardhat.config.ts` has Sourcify enabled and
Etherscan disabled, so `hardhat verify` submits to Sourcify only. The current
deployments were created with admin/relayer
`0x6090B362E6FCb55218E2d6bB4CBDd55573a71aF6` — the single constructor argument
each contract needs:

```bash
cd contracts/evm && npm install   # first time only
ADMIN=0x6090B362E6FCb55218E2d6bB4CBDd55573a71aF6
npx hardhat verify --network optimismSepolia 0x847833b501d5e60AB434CCFCd61b658a670a76af $ADMIN  # IdentityRegistry
npx hardhat verify --network optimismSepolia 0xA0A2aFC80ef2CA1d34a113287Ef6d3D16321D5a5 $ADMIN  # IdentityCommitments
npx hardhat verify --network optimismSepolia 0xfE30FB91427a6dcA257b3d0c90108C78EEa3e985 $ADMIN  # Attestations
```

Expect a **partial match** (runtime bytecode matches; metadata differs). Results
appear at https://repo.sourcify.dev and on Sourcify-reading explorers like
**Blockscout** (optimism-sepolia.blockscout.com). Note: Optimistic **Etherscan**
does *not* read Sourcify — for a verified badge there specifically, use the
Etherscan full-match path (redeploy from this source, above).

## Notes

- **Never commit `EVM_DEPLOYER_KEY` or `ETHERSCAN_API_KEY`** — export them in your
  shell only. `.env` is gitignored.
- Compiler settings are pinned in `hardhat.config.ts` (0.8.24, optimizer runs
  200) to match the deployed bytecode — don't change them before verifying.
- An Etherscan V2 API key is a single key that covers Optimism Sepolia; get one
  at etherscan.io/apis.
