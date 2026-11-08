# shadcn-ecosystem components for Ore's learning loop (2026-11-08)

Tyler asked for shadcn-based alternatives to Ore's components, favouring ones that fit the learning
workflows over basic swaps. This is a pitch list: nothing here is built until he picks.

**Searched** (with `bunx shadcn search`, the same CLI the repo's shadcn MCP server runs): shadcn (471 items),
Cult UI (307), Rare UI (30), and the registries in shadcn's directory that hold learning or AI-chat pieces:
assistant-ui's Elements (175), Vercel AI Elements (141), Dice UI (267), Kibo UI (41), Magic UI (260),
prompt-kit (23), Motion Primitives (33). Plate, Animate UI and React Bits were skimmed: editors, icon sets and
marketing motion, nothing for the loop.

**Constraints kept:** purpose rule (each pitch names what he learns better), style tabled (pitches are
structure and behaviour, drawn in Ore's tokens, not the library's look), the 2026-11-08 element picks stand
(segmented control for tabs and the highlight menu, Reader rows, Linear question rows), D120 (every source
below is MIT, BSD or Apache-2.0; Rare UI is ideas only). Ore is on Radix with its own `DESIGN.md` tokens, so
"adopt" means copy the component's structure and logic, then restyle it by hand.

## Ranking

★ = the ones I'd build, in order.

| # | Pitch | Workflow | Replaces / adds | From | Effort |
|---|---|---|---|---|---|
| ★1 | Citation hover preview | Tutor / Ask | Tutor's bare `[n]` buttons | assistant-ui Inline citation, AI Elements Inline citation | S |
| ★2 | Evidence marked in his answer | Review, Practice | Review's got / missed key point list | assistant-ui Confidence marker | M |
| ★3 | Worked answer one step at a time | Tutor's Show me | Show me's whole worked answer | assistant-ui Math block | M |
| ★4 | Keep part of a reply | Tutor | + Card on a whole reply | Dice UI Selection toolbar, assistant-ui Quote reply | M |
| ★5 | Scroll that stays put while a reply streams | Tutor | `scrollIntoView` on every streamed word | assistant-ui Scroll anchor, shadcn Message scroller | S |
| 6 | Figure zoom | Reading | Figures fixed at column width | Kibo UI Image zoom | S |
| 7 | Next learning move after a reply | Tutor | Show me as the only follow-up | assistant-ui Suggestions, prompt-kit Prompt suggestion | S–M |
| 8 | Answer out loud | Review, Quick quiz, iPhone | Typing only | AI Elements Speech input | M–L |
| 9 | Diagram answers | Tutor → note | Text-only replies | assistant-ui Diagram | L |
| 10 | Highlights on the video timeline | Video and lecture files | Video.tsx's bare scrubber | Dice UI Media player | L |

★1, ★3, ★4, ★5 and 7 change `Tutor.tsx` or the tutor prompt, which the AI tutor loop is working on tonight:
they go to that loop, or wait until its PRs land. ★2 touches the grader prompt and `Review.tsx`; 6 touches
`Reader.tsx`.

## ★1 Citation hover preview

- **Replaces:** the tutor's `[n]`, a button that opens the passage (or web page) and shows nothing until clicked.
- **Workflow:** Ask your library and the tutor (D128, D137).
- **Behaviour:** hover `[n]` for half a second (Peek's timing) and a card shows the quoted passage, the source's
  title (a web page leads with its site, as D137's row does) and Open; a click still opens it. Arrow keys step
  through a reply's citations while the card is up.
- **Why it beats what exists:** checking a claim against his own source is the reason citations exist, and today
  it costs leaving the chat. In place, he checks more often, so a wrong citation is caught while he is still
  learning the idea.
- **From:** assistant-ui `elements-inline-citation` and `elements-document-reference` (MIT); AI Elements
  `inline-citation` (Apache-2.0, adds a carousel for several sources). Built on Base UI there; ours is Radix
  HoverCard, or Peek.tsx, which already does this for note links.
- **Effort:** S. The reply already carries each citation's passage text.

## ★2 Evidence marked in his answer

- **Replaces:** Review's check step, which lists each key point as got or missed with no link to what he wrote.
- **Workflow:** Review (D21) and Practice feedback in the tutor (D128.6).
- **Behaviour:** hovering a got key point underlines the words in his answer that earned it; a missed one
  shows the passage it comes from. The same marks on Practice feedback anchor "what holds" in the answer in
  his note. Painted with the CSS Custom Highlight API, as Find does, so his text is never rewritten.
- **Why it beats what exists:** feedback that points at the exact words works better than a right / wrong
  verdict (Shute 2008, elaborated feedback), and it shows when the grader credited the wrong thing, so his own
  rating (D21: he decides, the AI suggests) is better informed. It also gives `eval:grade` a check it lacks: a
  quoted span must be a substring of the answer.
- **From:** assistant-ui `elements-confidence-marker` (MIT): claims underlined by kind, the basis on hover.
  Magic UI `highlighter` (MIT) draws the same idea as marker strokes; style waits.
- **Effort:** M. The grader returns a quote per covered point (`grade@` prompt bump, eval rerun), Review
  draws them.

## ★3 Worked answer one step at a time

- **Replaces:** Show me (D128.4), which gives the whole worked answer at once.
- **Workflow:** tutor hints and practice.
- **Behaviour:** the worked answer arrives as numbered steps, the first shown. Enter shows the next; before it,
  the field invites him to say what comes next. Esc shows the rest.
- **Why it beats what exists:** worked examples teach best when the learner explains each step and the steps
  fade into his own work (Renkl & Atkinson 2003; self-explanation, Chi 1994). A wall of answer invites
  reading it once and nodding. Works for any procedure, not only maths; KaTeX already renders the formulas.
- **From:** assistant-ui `elements-math-block` (MIT): steps with a note under each, `visibleSteps` revealed.
- **Effort:** M. The tutor prompt returns `steps` on a worked answer (`tutor@` bump); the panel steps through them.

## ★4 Keep part of a reply

- **Replaces:** + Card, which proposes one card for a whole reply.
- **Workflow:** tutor → cards and notes.
- **Behaviour:** select words in a reply and the reader's highlight popup appears, with what fits a reply:
  Key point (drafts a card from those words, cited to the reply's source), Into note (pasted with its citation,
  as `cite.ts` does) and Ask about this.
- **Why it beats what exists:** he picks the one idea worth keeping, as he does in a source, and the card stays
  one idea (minimum information). One popup everywhere text can be kept.
- **From:** Dice UI `selection-toolbar` (MIT, floating-ui) for the positioning logic; assistant-ui
  `elements-quote-reply` (MIT) for the actions. The look is the reader's popup (D129.4).
- **Effort:** M.

## ★5 Scroll that stays put while a reply streams

- **Replaces:** `Tutor.tsx` scrolls to the end on every change to the turns, so since replies stream (D138) a
  reply being written drags him back down while he rereads an earlier explanation or a cited passage.
- **Workflow:** tutor.
- **Behaviour:** follow the end only while he is at the end; scrolled up, it stays, and a small "↓ New reply"
  pill takes him down. Sending a message always goes to the end.
- **Why it beats what exists:** rereading the last explanation while the next one arrives is how a tutor chat is
  used; being yanked loses his place in the very thing he is trying to understand.
- **From:** assistant-ui `elements-scroll-anchor` (MIT); shadcn `message-scroller` (MIT); prompt-kit
  `chat-container` (MIT, on `use-stick-to-bottom`).
- **Effort:** S. A test: stream into a scrolled-up panel, its scroll position holds.

## 6 Figure zoom

- **Adds:** a click on a figure, slide or chart in a source opens it to fill the window; Esc or a click puts it
  back (Medium, Readwise Reader, Notion).
- **Workflow:** reading. Figures now import whole (D122), but a slide or chart is drawn at column width and its
  labels are often too small to read.
- **Why:** a figure he can't read is a figure that didn't come in. Dual coding only helps if the picture is legible.
- **From:** Kibo UI `image-zoom` (MIT) on `react-medium-image-zoom` (BSD-3-Clause); Magic UI `lens` is a
  magnifier alternative.
- **Effort:** S.

## 7 Next learning move after a reply

- **Adds:** after an explanation, up to three pills that are learning moves, never topics: Test me on this,
  An example from my work, How does this connect to … (a source or skill he has).
- **Workflow:** tutor.
- **Why:** the moment after an answer is when he either reads the next one passively or does something with
  this one; a one-click generative move tips it (ICAP, Chi & Wylie 2014). Shown only when the move applies, so
  it isn't decoration.
- **From:** assistant-ui `elements-suggestions` (MIT); prompt-kit `prompt-suggestion` (MIT).
- **Effort:** S with a fixed set, M if the tutor picks them.

## 8 Answer out loud

- **Adds:** hold a key (or the mic on the phone) and say the answer; the words fill the field, then grading runs
  as usual.
- **Workflow:** Review, the quick quiz (D76), the iPhone.
- **Why:** saying an answer tests memory as well as writing it (Putnam & Roediger 2013), and it is faster, so a
  walk or a short break becomes a review session. The Explain cards (D1) are the ones that are slow to type.
- **From:** AI Elements `speech-input` (Apache-2.0) for the control and its states. The speech itself would be
  Apple's on-device recognizer through a Swift helper, as transcription already is, since the webview's
  Web Speech support isn't dependable.
- **Effort:** M–L.

## 9 Diagram answers

- **Adds:** when an idea is a structure (a cycle, a hierarchy, a sequence), the tutor can answer with a small
  diagram in Ore's own diagram format, with Into my note, where it opens in the D103 editor.
- **Workflow:** tutor → source note.
- **Why:** words plus a picture beat words alone (Mayer, multimedia principle), and redrawing it in his note is
  his own generative step.
- **From:** assistant-ui `elements-diagram` (MIT): a drawn answer with zoom and full view.
- **Effort:** L. The tutor has to emit valid scenes.

## 10 Highlights on the video timeline

- **Adds:** his highlights and key points as ticks on the video's scrubber, chapters as segments; a click jumps
  there.
- **Workflow:** video sources, and later lecture files read where they lie (D122).
- **Why:** reviewing a lecture means going back to the moments he marked; the ticks show where they are.
- **From:** Dice UI `media-player` (MIT, on `media-chrome`, MIT). Ore's YouTube player keeps its postMessage
  driver; only the control bar is borrowed.
- **Effort:** L. Video files come in as transcripts and aren't played in place yet (D51, D122); that call comes first.

## Looked at, left out

- **Activity graphs, contribution calendars, streak counters** (Kibo, assistant-ui, Rare UI): streaks (D23, D113).
- **Rating stars, polls, vote tallies** (Kibo, Cult): FSRS keys and his own rating already do this (D21).
- **Swipe deck for reviews** (Kibo `deck`): an Explain card needs a typed or spoken answer, not a swipe.
- **Faceted filters** (Dice UI): D130 waits for a filter worth having.
- **Multiple-choice question cards** (assistant-ui `option-list`, AI Elements `question`): free recall is the
  point (D1); picking from options is the weaker test.
- **Tutor memory chips, model pickers, reasoning traces, tool timelines** (assistant-ui, AI Elements): agent
  tooling; nothing he learns from.
- **Scroll-spy, rail TOC, sidebars, toasts, stacked notices, rolling numbers**: Ore has them (Outline, D113).
- **Editors** (Plate, Kibo `editor`): the note editor is Milkdown (D38).
- **Pixel headings, matrix loaders, shaders, glass, marketing heroes** (Cult, Magic UI, assistant-ui loading
  state): style is tabled; the matrix loader is worth a look when it isn't (Tyler's transitions.dev reference).
