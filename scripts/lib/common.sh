# shellcheck shell=bash
# Shared helpers for scripts/deploy.sh and scripts/run.sh. Sourced, not run.
# bash 3.2 compatible (macOS default bash).

DRY_RUN="${DRY_RUN:-0}"
ASSUME_YES="${ASSUME_YES:-0}"
if [ "${CI:-}" = "1" ] || [ "${CI:-}" = "true" ]; then ASSUME_YES=1; fi

say()  { printf '%s\n' "$*"; }
step() { printf '\n==> %s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die()  { printf 'error: %s\n' "$*" >&2; exit 1; }

# fail "<message>": stop with an error, except under --dry-run (warn and carry on).
fail() {
  if [ "$DRY_RUN" = "1" ]; then warn "$*"; return 0; fi
  die "$*"
}

# Print a command, then run it (or only print it under --dry-run).
run() {
  printf '+ %s\n' "$*"
  if [ "$DRY_RUN" = "1" ]; then return 0; fi
  "$@"
}

# confirm "Question?" -> returns 0 on yes. --yes / CI=1 answer yes; --dry-run answers no.
confirm() {
  if [ "$DRY_RUN" = "1" ]; then say "$1 [y/N] (dry run: not asking)"; return 1; fi
  if [ "$ASSUME_YES" = "1" ]; then say "$1 [y/N] yes (--yes / CI=1)"; return 0; fi
  if [ ! -t 0 ]; then warn "no terminal to ask '$1'; pass --yes to answer yes"; return 1; fi
  printf '%s [y/N] ' "$1"
  local reply=""
  read -r reply || true
  case "$reply" in y|Y|yes|YES|Yes) return 0 ;; *) return 1 ;; esac
}

# install_hint <tool> -> one line on how to install it on a Mac.
install_hint() {
  case "$1" in
    node|npm|npx) echo "install Node 22: brew install node@22 (or nvm install 22)" ;;
    firebase)     echo "npm install -g firebase-tools, then: firebase login" ;;
    gcloud)       echo "brew install --cask google-cloud-sdk, then: gcloud auth login" ;;
    gh)           echo "brew install gh, then: gh auth login" ;;
    java)         echo "brew install openjdk@21 (the Firestore emulator needs Java 11+)" ;;
    anchor)       echo "cargo install --git https://github.com/coral-xyz/anchor avm && avm install 0.31.1 && avm use 0.31.1" ;;
    solana)       echo "sh -c \"\$(curl -sSfL https://release.anza.xyz/stable/install)\"" ;;
    cargo)        echo "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh" ;;
    curl|git)     echo "xcode-select --install" ;;
    *)            echo "install $1 and re-run" ;;
  esac
}

# need_tools tool... -> fails listing every missing tool (dry run: warns only).
need_tools() {
  local missing="" t
  for t in "$@"; do
    command -v "$t" >/dev/null 2>&1 || missing="$missing $t"
  done
  [ -z "$missing" ] && return 0
  for t in $missing; do warn "missing tool '$t': $(install_hint "$t")"; done
  if [ "$DRY_RUN" = "1" ]; then warn "dry run: continuing without:$missing"; return 0; fi
  die "install the missing tool(s) above and re-run"
}

# If the repo installs anything from npm.pkg.github.com (an .npmrc registry line or a
# lockfile "resolved" URL), make sure NODE_AUTH_TOKEN is set, from `gh auth token` when
# gh is logged in. The token is never printed or written anywhere.
ensure_node_auth_token() {
  if ! grep -qs 'npm.pkg.github.com' .npmrc ./*/.npmrc ./*/*/.npmrc \
       package-lock.json ./*/package-lock.json ./*/*/package-lock.json 2>/dev/null; then
    return 0
  fi
  if ! grep -qs '//npm.pkg.github.com/:_authToken' .npmrc ./*/.npmrc ./*/*/.npmrc "$HOME/.npmrc" 2>/dev/null; then
    warn "packages come from npm.pkg.github.com but no .npmrc (repo or ~/.npmrc) has an auth line for it."
    warn "fix once: echo '//npm.pkg.github.com/:_authToken=\${NODE_AUTH_TOKEN}' >> ~/.npmrc"
  fi
  if [ -n "${NODE_AUTH_TOKEN:-}" ]; then return 0; fi
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    NODE_AUTH_TOKEN="$(gh auth token 2>/dev/null || true)"
    export NODE_AUTH_TOKEN
    if [ -n "$NODE_AUTH_TOKEN" ]; then say "NODE_AUTH_TOKEN set from 'gh auth token' (not shown)."; return 0; fi
  fi
  local msg="NODE_AUTH_TOKEN is not set and gh is not logged in, so npm.pkg.github.com would answer 401. Fix: gh auth login && gh auth refresh -h github.com -s read:packages, then re-run (or export NODE_AUTH_TOKEN yourself)."
  if [ "$DRY_RUN" = "1" ]; then warn "$msg"; return 0; fi
  die "$msg"
}

# Default branch of origin (falls back to main).
default_branch() {
  local ref
  ref="$(git symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null || true)"
  ref="${ref#origin/}"
  [ -n "$ref" ] || ref="main"
  echo "$ref"
}

# Warn about wrong branch / dirty tree / behind origin and ask to continue.
git_checks() {
  command -v git >/dev/null 2>&1 || return 0
  git rev-parse --git-dir >/dev/null 2>&1 || return 0
  local def branch problems=""
  def="$(default_branch)"
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
  git fetch --quiet origin "$def" 2>/dev/null || warn "could not fetch origin/$def; 'behind' check uses the last fetch"
  if [ "$branch" != "$def" ]; then problems="${problems}  - on branch '$branch', not '$def'
"; fi
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then problems="${problems}  - uncommitted changes in the working tree (they would ship too)
"; fi
  local behind
  behind="$(git rev-list --count "HEAD..origin/$def" 2>/dev/null || echo 0)"
  if [ "${behind:-0}" != "0" ]; then problems="${problems}  - $behind commit(s) behind origin/$def (git pull first)
"; fi
  [ -z "$problems" ] && return 0
  warn "git state:"
  printf '%s' "$problems" >&2
  if [ "$DRY_RUN" = "1" ]; then return 0; fi
  confirm "Continue anyway?" || die "stopped. Fix the above, or re-run with --yes to skip this question."
}

# npm_in <dir> <npm args...>: run npm in <dir> (no --prefix for the repo root).
npm_in() {
  local dir="$1"; shift
  if [ "$dir" = "." ]; then run npm "$@"; else run npm "$@" --prefix "$dir"; fi
}

# npm_install_ci <dir>: clean install from the lockfile (npm install when there is none).
# Fails when package-lock.json is out of sync with package.json, so a deploy never
# ships dependencies nobody committed.
npm_install_ci() {
  local dir="$1"
  if [ ! -f "$dir/package-lock.json" ]; then npm_in "$dir" install; return; fi
  npm_in "$dir" ci && return 0
  [ "$DRY_RUN" = "1" ] && return 0
  die "npm ci failed in $dir. If it says the lockfile is out of sync: run 'npm install' in $dir, commit package-lock.json, and re-run."
}

# npm_install_local <dir>: for run.sh. Like npm_install_ci, but falls back to
# 'npm install' (which may update package-lock.json) when npm ci refuses.
npm_install_local() {
  local dir="$1"
  if [ -f "$dir/package-lock.json" ] && npm_in "$dir" ci; then return 0; fi
  [ -f "$dir/package-lock.json" ] && warn "npm ci failed in $dir (lockfile out of sync?); falling back to npm install, which may update package-lock.json."
  npm_in "$dir" install
}

# npm_install_if_stale <dir>: install only if node_modules is missing, unfinished, or
# older than the lockfile (npm writes node_modules/.package-lock.json at the end of an install).
npm_install_if_stale() {
  local dir="$1" lock="$1/package-lock.json" stamp="$1/node_modules/.package-lock.json"
  [ -f "$dir/package.json" ] || return 0
  if [ ! -f "$stamp" ]; then
    npm_install_local "$dir"
  elif [ -f "$lock" ] && [ "$lock" -nt "$stamp" ]; then
    say "$lock is newer than $dir/node_modules; reinstalling."
    npm_install_local "$dir"
  fi
}

# Background-process bookkeeping for run.sh: Ctrl-C stops every child.
CHILD_PIDS=""
start_bg() {
  printf '+ %s &\n' "$*"
  "$@" &
  CHILD_PIDS="$CHILD_PIDS $!"
}
stop_children() {
  local p
  for p in $CHILD_PIDS; do kill "$p" 2>/dev/null || true; done
  for p in $CHILD_PIDS; do wait "$p" 2>/dev/null || true; done
  CHILD_PIDS=""
}
# Wait until any child exits (bash 3.2 has no `wait -n`), then stop the rest.
wait_children() {
  trap 'echo; say "stopping..."; stop_children; exit 130' INT TERM
  local p
  while :; do
    for p in $CHILD_PIDS; do
      if ! kill -0 "$p" 2>/dev/null; then
        say "a process exited (pid $p); stopping the others."
        stop_children
        return 0
      fi
    done
    sleep 1
  done
}
