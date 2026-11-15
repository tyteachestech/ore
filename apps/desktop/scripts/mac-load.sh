#!/bin/sh
# Keeps test runs from freezing Tyler's Mac (2026-11-15: five Codex testers at once nearly froze it).
#   mac-load.sh check        before starting Codex testers or test instances: fails if memory is tight
#                            or two Codex testers already run (across every thread)
#   mac-load.sh clean <dir>  when a run ends: stops every process started from <dir> (a worktree)
set -eu
case "${1:-}" in
check)
  free=$(memory_pressure -Q | sed -n 's/.*free percentage: \([0-9]*\)%.*/\1/p')
  testers=$(pgrep -f "codex exec" | wc -l | tr -d ' ')
  echo "memory free: ${free}%   Codex testers running: ${testers}"
  ps -axmo rss=,command= | head -8 | awk '{printf "%6d MB  %s\n", $1/1024, substr($0, index($0,$2), 90)}'
  [ "$free" -ge 25 ] || { echo "Too little free memory: stop stale runs first (mac-load.sh clean <dir>)."; exit 1; }
  [ "$testers" -lt 2 ] || { echo "Two Codex testers already run: wait for one to finish."; exit 1; }
  ;;
clean)
  dir=$(cd "${2:?usage: mac-load.sh clean <worktree dir>}" && pwd)
  case "$dir" in "$HOME/Developer/ore" | /Applications* | "$HOME/Ore"*) echo "Refusing $dir: that is Tyler's own."; exit 1 ;; esac
  pids=$( { pgrep -f "$dir" || true; lsof -d cwd -Fpn 2>/dev/null | awk -v d="$dir" '/^p/{p=substr($0,2)} /^n/ && index(substr($0,2)"/", d"/")==1{print p}'; } | sort -u | grep -vx -e "$$" -e "$PPID" || true)
  [ -n "$pids" ] || { echo "Nothing running from $dir."; exit 0; }
  ps -o pid=,command= -p $(echo $pids | tr ' ' ',') | cut -c1-120
  kill $pids 2>/dev/null || true; sleep 2; kill -9 $pids 2>/dev/null || true
  echo "Stopped $(echo $pids | wc -w | tr -d ' ') processes."
  ;;
*) sed -n '2,6p' "$0"; exit 1 ;;
esac
