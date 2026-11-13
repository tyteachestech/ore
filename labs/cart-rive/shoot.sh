#!/bin/bash
# Films the scene with Rive's own headless renderer, 25 frames a second: one run of the CLI per frame, because a
# second capture in one --commands run comes back blank on this machine's software GL.
# usage: shoot.sh <outdir> [seconds] [from-seconds] [--data=k=v ...]
OUT=$(realpath -m "${1:-frames}"); SECS=${2:-6.6}; FROM=${3:-0}; shift 3 2>/dev/null
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$OUT"
A=$(python3 -c "print(int(round($FROM*25)))"); B=$(python3 -c "print(int(round($SECS*25)))")
export OUT HERE; export EXTRA="$*"
seq $A $B | xargs -P 6 -I{} bash -c 'f=$(printf "%03d" {}); "$HOME/.rive/bin/rive" "$HERE/rive" $EXTRA --advance=$(( {} * 40 ))ms --screenshot="$OUT/f$f.png" >/dev/null 2>&1'
ls "$OUT" | wc -l
