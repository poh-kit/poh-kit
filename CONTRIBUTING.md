# Contributing

- TypeScript: `npm install && npm test` at the root (vitest, workspaces).
- EVM contracts: `cd contracts/evm && npm install && npx hardhat test`.
- Solana programs: `cargo check` in `contracts/solana`; `anchor build` with
  Anchor 0.31.1 for a full build.
- License: dual MIT/Apache-2.0. By contributing you agree your work is
  released under both; new source files carry
  `// SPDX-License-Identifier: MIT OR Apache-2.0`.
- Keep the README status table truthful — flip a row in the same PR that
  lands the code.
