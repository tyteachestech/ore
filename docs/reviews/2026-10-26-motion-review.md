# Motion review, 2026-10-26

Every animation in `apps/desktop/src`, checked against `.claude/skills/review-animations/STANDARDS.md` (Emil Kowalski). Decisions D57, D62 and D64 set some motion on purpose; where Emil's rules and a decision disagree, the decision stands and the gap is listed for Tyler.

## Findings

| Before | After | Why |
| --- | --- | --- |
| `.review-card` `card-in 240ms cubic-bezier(0.2,0.9,0.3,1.2)`, from `opacity 0, translateY(10px) scale(0.99)` (styles.css) | `160ms cubic-bezier(0.23,1,0.32,1)`, from `opacity 0.4, translateY(4px)` | Replays on every rating, many times a session from the keyboard. Emil: keyboard and 100x/day actions get little or no motion; the overshoot and fade-from-0 made the next question unreadable for ~100 ms. D62 keeps "the card springs in", so it is reduced, not removed. |
| `.home-meter > span { transition: width 300ms }` | removed | Animates a layout property, and the meter renders at its final width on mount, so the transition almost never showed. Delete beats converting to `scaleX` (which would squash the rounded end). |

## Checked and kept

- Radix menus, popovers, tooltips and toasts snap with no motion. Right for a keyboard-first app (Raycast has none either).
- Sidebar peek (140 ms ease-out), drop hint (160 ms), drag lift (120 ms), dnd-kit settle (180 ms), carets (120 ms), switch (150 ms), hint fade (100 ms), delayed loading fade (400 ms delay): within budget, purposeful.
- Collected dot flight (520 ms, ease-in-out arc) and the "+1" (D64): on-screen movement correctly uses ease-in-out; longer than 300 ms but explanatory (shows where the highlight went) and occasional.
- Goal ring fill (600 ms), ring burst, level-up pop, rubric ticks with overshoot (D62): rare celebration moments, where Emil allows delight.
- Smooth scroll to an answer passage in the reader and to new chat messages: keeps your place in the text; occasional.
- Reduce Motion turns every transition and animation off (styles.css). Emil prefers keeping fades, but D62 says "all off", and off is the safe reading.

## For Tyler

- Emil's rule would remove the review card entry entirely (keyboard, high frequency). D62 asks for it. Kept, trimmed; say if you want it gone.
