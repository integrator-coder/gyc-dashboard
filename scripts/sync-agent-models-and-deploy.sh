#!/bin/bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

REPO="/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard"
GENERATED="data/agent-models.generated.json"
LOCK_DIR="/tmp/gyc-agent-model-sync.lock"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Agent model sync already running; skipping."
  exit 0
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

cd "$REPO"

if [ -n "$(git diff --cached --name-only)" ]; then
  echo "Refusing to run with pre-existing staged changes."
  exit 1
fi

/usr/bin/env node scripts/sync-agent-models.mjs

if git diff --quiet -- "$GENERATED"; then
  echo "No agent model changes; nothing to deploy."
  exit 0
fi

git add -- "$GENERATED"

STAGED="$(git diff --cached --name-only)"
if [ "$STAGED" != "$GENERATED" ]; then
  git restore --staged -- "$GENERATED"
  echo "Unexpected staged files detected; refusing to commit."
  exit 1
fi

git commit -m "chore: sync Mission Control agent models"
git push origin main
echo "Mission Control agent model roster pushed; Render deploy triggered by post-push hook."
