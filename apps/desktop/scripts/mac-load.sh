#!/bin/sh
# Kept for runs that still call it: the check and clean live in mac-load.ts.
exec bun "$(dirname "$0")/mac-load.ts" "$@"
