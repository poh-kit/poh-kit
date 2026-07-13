# poh-kit EVM Hardhat Example

A runnable end-to-end example demonstrating the complete poh-kit flow on a local EVM chain.

> ⚠️ **Not yet implemented.** This directory is a placeholder for the reference example produced under the grant application's M2 milestone.

## Planned contents

- `contracts/PohKitVerifier.sol` — Solidity Groth16 verifier, generated from the Self Protocol circuit
- `contracts/SemaphoreGroup.sol` — thin wrapper around the official Semaphore verifier for group membership
- `scripts/deploy.ts` — Hardhat deployment script
- `scripts/enroll.ts` — mock Self-proof enrollment against the local chain
- `scripts/vote.ts` — cast an anonymous Semaphore signal
- `test/poh-kit.test.ts` — end-to-end test using Hardhat's local chain

## Planned flow

```
npm install
npx hardhat node                  # start local chain
npx hardhat run scripts/deploy.ts # deploy verifier + group contracts
npx hardhat run scripts/enroll.ts # enroll a mock passport proof
npx hardhat run scripts/vote.ts   # cast an anonymous vote
npx hardhat test                  # run the full test suite
```

## Why an EVM example first

poh-kit is chain-agnostic, but the reference example targets EVM + Hardhat because:

1. It's the lingua franca of ZK research demos
2. Semaphore's canonical verifier contract is Solidity
3. It maximizes reusability for Ethereum-ecosystem developers (grant's primary audience)
4. A Solana/Anchor example will follow, but is out of scope for the EF grant budget
