# Diagram sweep 4: is it clean?

You are auditing Ore's diagram editor (`apps/desktop/src/draw/`, a Mac learning app; this repo). Read-only on the repo: do NOT edit, commit or stash anything in it. Write only under `codex-out/d4/`.

Read first: `codex-out/d1/report.md`, `codex-out/d2/report.md`, `codex-out/d3/report.md` (your earlier sweeps) and `docs/DECISIONS.md` D213 and D216. Every finding in d3 has been fixed in this build; confirm each one with its own reproduction, twice, in WebKit. Then do the seven study tasks of sweep 2 once more, as a new user would, and try to break the newest controls: the + handles (crowded maps, zoom 25% to 400%, rotated and grouped shapes, undo/redo of a + click), the elbow middle handle, Align and Place on multi-selections, and the 45° snapping with grid and shape snapping on.

This is meant to be the last sweep: report only what a new user would hit in their first hour of drawing to learn, ranked. If nothing rises to that, say "clean" plainly.

Setup, report format, classes and exclusions are exactly as in `codex-out/d3/prompt.md` (vite :1530, bridge 1532, `webkit.connect("ws://[::1]:1661/")`, write under `codex-out/d4/`). Finish by printing the ranked findings one line each, or "clean".
