import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const { EVM_RPC_URL, EVM_DEPLOYER_KEY, ETHERSCAN_API_KEY } = process.env;

// Solidity settings MUST stay 0.8.24 / optimizer runs 200 — these are the
// exact settings the deployed contracts were compiled with, so a redeploy
// from this source reproduces byte-identical runtime bytecode. See VERIFY.md.
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    optimismSepolia: {
      url: EVM_RPC_URL ?? "https://sepolia.optimism.io",
      accounts: EVM_DEPLOYER_KEY ? [EVM_DEPLOYER_KEY] : [],
      chainId: 11155420,
    },
  },
  // Sourcify is the default here: key-free, verifies the existing addresses as
  // a partial match (runtime bytecode matches; metadata differs). `npx hardhat
  // verify` runs Sourcify only, since Etherscan is disabled below.
  sourcify: {
    enabled: true,
  },
  // Etherscan is OFF by default (it would demand ETHERSCAN_API_KEY and needs an
  // EXACT metadata match — which the existing addresses don't have). To use it,
  // flip `enabled: true`, export ETHERSCAN_API_KEY, and verify freshly-redeployed
  // contracts (full match). See VERIFY.md.
  etherscan: {
    enabled: false,
    apiKey: ETHERSCAN_API_KEY ?? "",
  },
};

export default config;
