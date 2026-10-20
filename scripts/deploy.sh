#!/usr/bin/env bash
#
# Release poh-kit. No targets = publish to npm every public @poh-kit/* package whose
# current version is not on npm yet (build and tests first). Contract deploys are
# explicit targets only. No CI publishes or deploys anything in this repo.
#
# Usage: scripts/deploy.sh [target ...] [--yes] [--dry-run] [--help]

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=SCRIPTDIR/lib/common.sh
. scripts/lib/common.sh

# Publish order: core first, the rest depend on it.
PACKAGES="core verifier gaas-client solana"

usage() {
  cat <<EOF
Usage: scripts/deploy.sh [target ...] [--yes] [--dry-run] [--help]

Targets:
  packages      (default) npm ci, build, test, then npm publish every public package
                whose version is not on npm yet, in order: $PACKAGES
  pkg:<name>    one package, e.g. pkg:solana (same checks; skipped if already published)
  evm           deploy NEW EVM contracts to Optimism Sepolia (contracts/evm/scripts/deploy.ts).
                Gives new addresses; update contracts/evm/deployments/optimismSepolia.json
                by hand afterwards. Needs EVM_DEPLOYER_KEY (and optionally EVM_RPC_URL).
  anchor        anchor build + anchor deploy of contracts/solana to devnet, upgrading the
                programs at their declared IDs. Needs the upgrade-authority wallet
                (~/.config/solana/id.json, per Anchor.toml).

Options:
  --yes, -y     do not ask for confirmation (CI=1 does the same)
  --dry-run     print the plan and the commands without running them
  --help, -h    this text

To publish a new release: bump "version" in packages/<name>/package.json, merge, then run this.
EOF
}

TARGETS=""
PKGS=""
for arg in "$@"; do
  case "$arg" in
    -h|--help) usage; exit 0 ;;
    -y|--yes) ASSUME_YES=1 ;;
    --dry-run) DRY_RUN=1 ;;
    packages) TARGETS="$TARGETS packages"; PKGS="$PACKAGES" ;;
    pkg:*)
      name="${arg#pkg:}"
      case " $PACKAGES " in *" $name "*) ;; *) die "unknown package '$name' (one of: $PACKAGES)" ;; esac
      TARGETS="$TARGETS packages"; PKGS="$PKGS $name" ;;
    evm|anchor) TARGETS="$TARGETS $arg" ;;
    *) usage >&2; die "unknown target or option '$arg'" ;;
  esac
done
if [ -z "$TARGETS" ]; then TARGETS=" packages"; PKGS="$PACKAGES"; fi
has() { case " $TARGETS " in *" $1 "*) return 0 ;; *) return 1 ;; esac; }

pkg_field() { node -p "require('./packages/$1/package.json').$2"; }

# --- pre-flight ---------------------------------------------------------------
step "Pre-flight"
need_tools git node npm
has evm && need_tools npx
has anchor && need_tools anchor solana cargo
ensure_node_auth_token
git_checks

TO_PUBLISH=""
if has packages; then
  if npm whoami >/dev/null 2>&1; then
    say "npm: logged in as $(npm whoami)"
  else
    fail "not logged in to npm. Fix: npm login (an account with publish rights on the @poh-kit scope)"
  fi
  for p in $PKGS; do
    name="$(pkg_field "$p" name)"; ver="$(pkg_field "$p" version)"
    if [ "$(pkg_field "$p" private)" = "true" ]; then say "  $name: private, skipped"; continue; fi
    if npm view "$name@$ver" version >/dev/null 2>&1; then
      say "  $name@$ver: already on npm, skipped"
    else
      say "  $name@$ver: not on npm yet, will publish"
      TO_PUBLISH="$TO_PUBLISH $p"
    fi
  done
fi
if has evm && [ -z "${EVM_DEPLOYER_KEY:-}" ]; then
  fail "EVM_DEPLOYER_KEY is not set. Fix: export EVM_DEPLOYER_KEY=<funded deployer key> in this shell (never commit it)"
fi
if has anchor && [ ! -f "$HOME/.config/solana/id.json" ]; then
  warn "no wallet at ~/.config/solana/id.json (Anchor.toml's provider wallet); anchor deploy will fail"
fi

# --- plan ---------------------------------------------------------------------
step "Plan"
if has packages; then
  if [ -n "$TO_PUBLISH" ]; then
    for p in $TO_PUBLISH; do say "  npm publish $(pkg_field "$p" name)@$(pkg_field "$p" version) -> https://www.npmjs.com/package/$(pkg_field "$p" name)"; done
  else
    say "  npm: every selected package is already published at its current version; nothing to publish."
  fi
fi
has evm && say "  evm   : NEW IdentityRegistry, IdentityCommitments, Attestations on Optimism Sepolia (chainId 11155420)"
has anchor && say "  anchor: upgrade identity_registry, identity_commitments, attestations on Solana devnet"
if has packages && [ -z "$TO_PUBLISH" ] && ! has evm && ! has anchor; then
  say "Nothing to deploy."; exit 0
fi
if [ "$DRY_RUN" != "1" ]; then
  confirm "Deploy?" || die "aborted."
fi

# --- packages -----------------------------------------------------------------
if has packages && [ -n "$TO_PUBLISH" ]; then
  step "Install, build, test"
  npm_install_ci .
  run npm run build
  run npm test
  step "Publish"
  for p in $TO_PUBLISH; do
    run npm publish --workspace "packages/$p" --access public
  done
fi

# --- evm ----------------------------------------------------------------------
if has evm; then
  step "EVM contracts (Optimism Sepolia)"
  npm_install_ci contracts/evm
  (cd contracts/evm && run npx hardhat test && run npx hardhat run scripts/deploy.ts --network optimismSepolia)
  say "Copy the printed addresses into contracts/evm/deployments/optimismSepolia.json and commit."
fi

# --- anchor -------------------------------------------------------------------
if has anchor; then
  step "Solana programs (devnet)"
  (cd contracts/solana && run anchor build && run anchor deploy --provider.cluster devnet)
fi

# --- check --------------------------------------------------------------------
step "Done"
if [ "$DRY_RUN" = "1" ]; then say "(dry run: nothing was deployed)"; exit 0; fi
if has packages; then
  for p in $TO_PUBLISH; do
    name="$(pkg_field "$p" name)"
    say "  $name: npm latest = $(npm view "$name" version 2>/dev/null || echo '? (can take a minute)')  https://www.npmjs.com/package/$name"
  done
fi
if has anchor; then
  for id in EgWb3fdVLp7Qon3p1UEAA3iwrbCGu4ro56MY7hrBFaoV 2eLQB1hoLv7nXvu1RYWFZw6eSkVjzUZEYeLDWpms1WkC GQrFse7NiB6QdqtagGayNYwrr8zn4W4uWhji57VkKGky; do
    say "  https://explorer.solana.com/address/$id?cluster=devnet"
  done
fi
