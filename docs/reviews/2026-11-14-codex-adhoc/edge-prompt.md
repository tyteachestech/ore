Your name is `edge`. First read `codex-out/preamble.md` and follow it.

Your ports: Mac app page http://localhost:1652/ with `window.__ORE_BRIDGE = 1653` (library `/tmp/claude-501/adhoc/lib-edge`); iPhone app http://localhost:1657/.

## Your focus: edge cases on the surfaces a learner uses every day (Home, Add, a source's reader, notes, Review, the end screen, skill pages, All sources)
Work through each group, on the Mac first, then the iPhone where the surface exists:
1. **Empty, error and offline states.** An empty skill, a library with nothing due, a source with no highlights. Make writes fail (`__ORE_FAIL` for add, rate, highlight, note save, rename, archive) and slow (`__ORE_SLOW`): is there always a visible wait, an error that says what happened and what to do, and no half-saved state? Add a URL that is unreachable, one that is a login wall, one that 404s; go offline (`page.context().setOffline(true)`) in the middle of an add and a review.
2. **Huge and tiny.** A 1-word source, a 200,000-character paste, a source with a 300-character title, a skill name of one letter and of 200 characters, emoji and right-to-left text in titles and notes, a highlight across the whole source.
3. **Undo everywhere.** Every change you make on those surfaces: is there an Undo (⌘Z and a toast), does it restore exactly, and do several stacked undos come back in order? Undo after leaving the screen.
4. **Rapid input.** Double and triple clicks on Add, Start review, rating buttons; rating keys pressed fast; Esc and Enter mashed during transitions; typing while a list reloads.
5. **Window size.** Resize the Mac window down to 600×400 and up to 2560×1440 on each surface; check nothing important is cut off, overlaps, or scrolls sideways. On iPhone, try 320×568 (SE), 390×844 and 440×956 (Pro Max), portrait and landscape.
6. **Reduce Motion** (`page.emulateMedia({ reducedMotion: "reduce" })`): the review end screen, the ring and bonus lap, the mole's endings, any transition. Nothing should move that the rules say shouldn't, and nothing should be lost (a number that only appears during an animation).
