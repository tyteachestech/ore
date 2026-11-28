#!/bin/sh
set -u
BASE="$(pwd)/codex-out/snapshot"
BUN="$(command -v bun)"
export ORE_NO_ENRICH=1 ORE_NO_TOOLS=1 ORE_LIBRARY="$BASE/libs/session-no-git"
export PATH="$BASE/bin:$PATH"
"$BUN" "$BASE/setup-session.ts" || exit 2
PATH="$BASE/bin" "$BUN" packages/cli/src/ore.ts session end --json > "$BASE/output/end-session-no-git.txt" 2>&1
STATUS=$?
cat "$BASE/output/end-session-no-git.txt"
python3 - <<'CHECK'
from pathlib import Path
import json
p=Path('codex-out/snapshot/libs/session-no-git/sessions')
rows=[json.loads(l) for f in p.glob('*.jsonl') for l in f.read_text().splitlines()]
print('end receipt saved:',any(r.get('type')=='end' for r in rows))
CHECK
if [ "$STATUS" -ne 0 ]; then
 echo "FAIL: session end exited $STATUS although its end receipt was saved; history must never fail a command (D5)"
 exit 1
fi
echo 'PASS: session end survives missing git'
