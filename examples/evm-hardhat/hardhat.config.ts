// SPDX-License-Identifier: MIT OR Apache-2.0
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

// `contracts/` here is a symlink to ../../contracts/evm/contracts, so the
// default `paths.sources: "contracts"` resolves to the real IdentityCommitments
// + Attestations sources without pulling this example into the root npm
// workspaces. A literal `paths.sources: "../../contracts/evm/contracts"`
// (i.e. a source dir outside the project root) doesn't work: Hardhat 2's
// resolver rejects it with HH1007 "EXTERNAL_AS_LOCAL" — it requires every
// local source file to resolve to a path *inside* `paths.root`, and
// pointing `paths.root` itself at the monorepo root instead breaks
// `@openzeppelin/contracts` resolution (Hardhat walks node_modules upward
// from `paths.root`, and this example's own node_modules — where
// `@openzeppelin/contracts` is installed — is a descendant, not an
// ancestor, of the monorepo root). The symlink keeps `paths.root` as this
// directory, so both source resolution and npm dependency resolution work.
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
};

export default config;