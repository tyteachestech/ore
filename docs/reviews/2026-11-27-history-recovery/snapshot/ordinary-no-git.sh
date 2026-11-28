#!/bin/sh
set -u
BASE="$(pwd)/codex-out/snapshot"
BUN="$(command -v bun)"
export ORE_NO_ENRICH=1 ORE_NO_TOOLS=1 ORE_LIBRARY="$BASE/libs/session-no-git"
export PATH="$BASE/bin:$PATH"
"$BUN" "$BASE/setup-session.ts" || exit 2
PATH="$BASE/bin" "$BUN" packages/cli/src/ore.ts ls --json
STATUS=$?
if [ "$STATUS" -ne 0 ];then echo "FAIL: ordinary command failed without git";exit 1;fi
echo 'PASS: ordinary command catches missing git'
