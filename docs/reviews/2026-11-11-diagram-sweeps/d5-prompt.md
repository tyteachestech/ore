# Diagram sweep 5: confirm sweep 4's fixes, then call it

Same rules, setup, classes and exclusions as `codex-out/d4/prompt.md` (read it and `codex-out/d4/report.md`), writing only under `codex-out/d5/`. Make sure the browser endpoint answers before you start (`webkit.connect("ws://[::1]:1661/")`); if it doesn't, stop and say so in one line.

1. Confirm each of sweep 4's three findings is fixed, twice in WebKit, with their exact steps: Top label placement survives close and reopen; an elbow's dragged middle survives close, reopen and moving an end node; right-click Copy then right-click Paste on blank canvas makes the copy. Also check a compare matrix (⇧M) still walks with Tab after close and reopen.
2. Then one quick first-hour pass over the study tasks. Report only what a new user would hit in their first hour, ranked; if nothing rises to that, say "clean" plainly.

Finish by printing the ranked findings one line each, or "clean".
