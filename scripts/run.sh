#!/usr/bin/env bash
#
# Run poh-kit locally. It is a library, so "run" means build and test; nothing here
# touches a live chain or a live service. No mode = build every package and run the tests.
#
# Usage: scripts/run.sh [mode] [--help]

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=SCRIPTDIR/lib/common.sh
. scripts/lib/common.sh

usage() {
  cat <<EOF
Usage: scripts/run.sh [mode] [--help]

Modes:
  test       (default) build all packages, run the TypeScript tests (what CI 'ts' runs)
  typecheck  tsc --noEmit in every package
  watch      vitest in watch mode
  evm        compile and test the EVM contracts (what CI 'evm' runs; local Hardhat chain)
  evm-e2e    the end-to-end example on a local Hardhat chain (examples/evm-hardhat)
  solana     cargo check of the Anchor programs (what CI 'solana' runs)
EOF
}

MODE="test"
for arg in "$@"; do
  case "$arg" in
    -h|--help) usage; exit 0 ;;
    test|typecheck|watch|evm|evm-e2e|solana) MODE="$arg" ;;
    *) usage >&2; die "unknown mode '$arg'" ;;
  esac
done

need_tools node npm
ensure_node_auth_token

case "$MODE" in
  test)
    npm_install_if_stale .
    run npm run build
    run npm test
    ;;
  typecheck)
    npm_install_if_stale .
    run npm run typecheck
    ;;
  watch)
    npm_install_if_stale .
    run npx vitest
    ;;
  evm)
    npm_install_if_stale contracts/evm
    (cd contracts/evm && run npx hardhat compile && run npx hardhat test)
    ;;
  evm-e2e)
    npm_install_if_stale examples/evm-hardhat
    (cd examples/evm-hardhat && run npm run e2e)
    ;;
  solana)
    need_tools cargo
    (cd contracts/solana && run cargo check --workspace)
    ;;
esac
