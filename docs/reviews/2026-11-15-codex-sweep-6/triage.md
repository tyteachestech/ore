# Sweep 6 triage

Eleven candidates from four testers; each checked against the code before a fix. The `organize` tester's library had 238 sources, not 950: `seed-big.ts` makes ~950 only with `ORE_SEED_SCALE=4` (its prompt was wrong).

| report | finding | verdict | fix |
|---|---|---|---|
| today 1 | WebKit page crashes when a page-edge carry repeats over a saved highlight holding code | real (reproduced in WebKit) | #440 |
| today 2 | `/heading 2`: the / menu closes at the space (`menuTrigger` takes no spaces) | real | #440 |
| today 3 | A tutor reply that comes back empty leaves the wait up and Stop dead | real | #440 |
| exercises 1 | Ask about an exercise: an empty reply crashes Review ("This view hit a snag") | real | #440 |
| exercises 2 | Saving an edit to an exercise drops its history dots and next-review preview | real | #440 |
| exercises 3 | An exercise's math, code and images show as raw Markdown in Review | real | #440 |
| looks 1 | ⌘K at 150% zoom in a small window runs below the window; its last rows can't be reached | real | #440 |
| organize 1 | A text search plus a filter says nothing matches: the search takes 60 hits library-wide, then filters | real | #440 |
| organize 2 | Opening a list search result lands at the top, not at the note or highlight that matched | real | #440 |
| organize 3 | iPhone search doesn't find sources by author | real | #440 |
| organize 4 | Back to All sources loses the search typed there | real | #440 |
