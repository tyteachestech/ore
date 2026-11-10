# Tutor chat UX parity audit

Repository inspected read-only at `f796816eec6985bb7e29213c0c8e4f6af7a7d7f6`. No repo edits, commits, stashes, server changes, installed-app changes, or real-library access. Artifacts are in this folder. Test-created chats live only in the supplied mock library, written through the app.

The 60-item [checklist](checklist.md) was written at 12:51:15 PST on November 10, 2026, before opening Ore or reading its UI source. Reference behavior is the requested experience-based baseline for ChatGPT, Claude and Notion AI; these services were not live-audited in this run. Reference parity alone is not a decision to add a feature.

Playwright 1.63.0 drove Chromium and WebKit on macOS, twice per checklist scenario. All screenshots use `deviceScaleFactor: 2`. Main size: 1280 × 900 CSS pixels. Narrow test: 800 × 700 with a 300-pixel docked tutor. Keyboard input uses Meta for Command; pointer selections use real down/move/up. No `fill` or synthetic DOM input events were used on Ore. WebKit wins if engines differ.

## Results

Each engine entry shows run 1 / run 2. `untested` means the criterion could not be established, not that it failed. Item 50 is explicitly excluded by D128 and is included in the untested count only to account for every original checklist item.

| # | Behavior | Result | Engine runs | Class |
|---|---|---|---|---|
| 1 | ChatGPT: opening chat from the main/home surface exposes an editable composer. | **works** | Chromium: works / works; WebKit: works / works | — |
| 2 | Notion AI: opening contextual chat from a source retains the source context. | **works** | Chromium: works / works; WebKit: works / works | — |
| 3 | Notion AI: opening contextual chat from a subject/skill page retains that context. | **differs** | Chromium: differs / differs; WebKit: differs / differs | B |
| 4 | ChatGPT: the chat shortcut opens the chat with the composer focused. | **works** | Chromium: works / works; WebKit: works / works | — |
| 5 | Claude: Enter on an empty composer sends nothing. | **works** | Chromium: works / works; WebKit: works / works | — |
| 6 | Claude: Enter on a whitespace-only composer sends nothing. | **works** | Chromium: works / works; WebKit: works / works | — |
| 7 | ChatGPT: Enter submits a nonempty message exactly once. | **works** | Chromium: works / works; WebKit: works / works | — |
| 8 | ChatGPT: Shift+Enter inserts a newline without sending. | **works** | Chromium: works / works; WebKit: works / works | — |
| 9 | Claude: typing replaces the selected composer text. | **works** | Chromium: works / works; WebKit: works / works | — |
| 10 | Claude: Backspace at the start of the composer leaves preceding conversation intact. | **works** | Chromium: works / works; WebKit: works / works | — |
| 11 | Claude: Delete at the end of the composer leaves the conversation intact. | **works** | Chromium: works / works; WebKit: works / works | — |
| 12 | ChatGPT: Left/Right at composer boundaries do not navigate away from chat. | **works** | Chromium: works / works; WebKit: works / works | — |
| 13 | ChatGPT: Up/Down in multiline input move the caret without changing chat context. | **works** | Chromium: works / works; WebKit: works / works | — |
| 14 | Claude: Command+A in the composer selects only the draft. | **works** | Chromium: works / works; WebKit: works / works | — |
| 15 | Claude: Command+Z undoes typing inside the draft. | **works** | Chromium: works / works; WebKit: works / works | — |
| 16 | Claude: Shift+Command+Z redoes the undone draft edit. | **differs** | Chromium: works / works; WebKit: differs / differs | C |
| 17 | ChatGPT: Command+C copies selected composer text. | **works** | Chromium: works / works; WebKit: works / works | — |
| 18 | ChatGPT: Command+X removes and copies selected draft text. | **works** | Chromium: works / works; WebKit: works / works | — |
| 19 | ChatGPT: Command+V pastes plain text at the caret. | **works** | Chromium: works / works; WebKit: works / works | — |
| 20 | Claude: pasting multiline text preserves line breaks without submitting. | **works** | Chromium: works / works; WebKit: works / works | — |
| 21 | Claude: pasting a URL preserves the full URL without submitting. | **works** | Chromium: works / works; WebKit: works / works | — |
| 22 | ChatGPT: pasting rich text preserves readable text without executing markup. | **works** | Chromium: works / works; WebKit: works / works | — |
| 23 | Claude: double-click in the draft selects a word. | **works** | Chromium: works / works; WebKit: works / works | — |
| 24 | Claude: triple-click in the draft selects the line/paragraph. | **works** | Chromium: works / works; WebKit: works / works | — |
| 25 | ChatGPT: dragging inside the draft selects the traversed text. | **works** | Chromium: works / works; WebKit: works / works | — |
| 26 | ChatGPT: dragging inside a reply selects its text. | **works** | Chromium: works / works; WebKit: works / works | — |
| 27 | Claude: dragging across adjacent conversation messages selects the intervening text. | **works** | Chromium: works / works; WebKit: works / works | — |
| 28 | ChatGPT: right-click selected reply text permits the native Copy action. | **untested** | Chromium: untested / untested; WebKit: untested / untested | — |
| 29 | ChatGPT: copying a reply through its Copy control copies its answer text. | **works** | Chromium: works / works; WebKit: works / works | — |
| 30 | ChatGPT: a new send shows an in-progress indication during the wait. | **works** | Chromium: works / works; WebKit: works / works | — |
| 31 | ChatGPT: the composer remains editable while a response is pending. | **works** | Chromium: works / works; WebKit: works / works | — |
| 32 | ChatGPT: Stop during a pending reply ends that reply and ignores a late result. | **works** | Chromium: works / works; WebKit: works / works | — |
| 33 | Claude: the stop keyboard shortcut ends the pending reply. | **works** | Chromium: works / works; WebKit: works / works | — |
| 34 | Claude: retrying a stopped empty reply yields one answer without duplicating the user message. | **works** | Chromium: works / works; WebKit: works / works | — |
| 35 | ChatGPT: after a response finishes, focus allows the next message to be typed. | **works** | Chromium: works / works; WebKit: works / works | — |
| 36 | ChatGPT: second and third messages appear in chronological order with their answers. | **works** | Chromium: works / works; WebKit: works / works | — |
| 37 | Claude: a long draft remains editable and its send control remains reachable. | **works** | Chromium: works / works; WebKit: works / works | — |
| 38 | ChatGPT: a long thread scrolls while keeping the composer reachable. | **works** | Chromium: works / works; WebKit: works / works | — |
| 39 | ChatGPT: scrolling up to read older messages is not overridden by a pending response finishing. | **works** | Chromium: works / works; WebKit: works / works | — |
| 40 | Notion AI: a narrow chat keeps its composer and controls within the visible panel. | **works** | Chromium: works / works; WebKit: works / works | — |
| 41 | Notion AI: docking/undocking chat preserves the conversation and draft. | **works** | Chromium: works / works; WebKit: works / works | — |
| 42 | Notion AI: closing and reopening chat preserves the current conversation and draft. | **works** | Chromium: works / works; WebKit: works / works | — |
| 43 | Notion AI: typing @ opens a relevant context picker. | **works** | Chromium: works / works; WebKit: works / works | — |
| 44 | Notion AI: typing after @ filters the available contexts. | **works** | Chromium: works / works; WebKit: works / works | — |
| 45 | Notion AI: arrow keys move the highlighted mention option, including first/last boundaries. | **works** | Chromium: works / works; WebKit: works / works | — |
| 46 | Notion AI: Enter with a mention option selected inserts that option instead of sending. | **works** | Chromium: works / works; WebKit: works / works | — |
| 47 | Notion AI: Escape dismisses the mention picker without closing chat or losing the draft. | **works** | Chromium: works / works; WebKit: works / works | — |
| 48 | Notion AI: clicking a mention option inserts that context and restores composer focus. | **works** | Chromium: works / works; WebKit: works / works | — |
| 49 | Notion AI: a mention query with no matches shows an understandable empty state. | **works** | Chromium: works / works; WebKit: works / works | — |
| 50 | ChatGPT: a selected chat mode remains selected for the next message. | **untested** | Chromium: untested / untested; WebKit: untested / untested | — |
| 51 | ChatGPT: Tab and Shift+Tab can reach and operate chat controls with visible focus. | **untested** | Chromium: works / works; WebKit: untested / untested | — |
| 52 | Notion AI: clicking a source citation opens the cited source. | **works** | Chromium: works / works; WebKit: works / works | — |
| 53 | Notion AI: the response Sources list opens its listed source on a single click. | **works** | Chromium: works / works; WebKit: works / works | — |
| 54 | Claude: a response error preserves the user's message and provides a way to recover. | **works** | Chromium: works / works; WebKit: works / works | — |
| 55 | ChatGPT: a stopped partial streamed response retains the text already received. | **untested** | Chromium: untested / untested; WebKit: untested / untested | — |
| 56 | ChatGPT: hovering a control with a keyboard shortcut reveals that shortcut (Ore requires Hint, not title). | **missing** | Chromium: missing / missing; WebKit: missing / missing | C |
| 57 | Notion AI: toolbar controls expose informative hover hints (Ore requires Hint, not title). | **missing** | Chromium: missing / missing; WebKit: missing / missing | C |
| 58 | Notion AI: sibling context menu options use consistent icon treatment (Ore requires its dot icons). | **works** | Chromium: works / works; WebKit: works / works | — |
| 59 | Notion AI: chat control icons use the host app's consistent icon family (Ore dot set; no emoji or smooth glyphs). | **works** | Chromium: works / works; WebKit: works / works | — |
| 60 | Claude: Escape from a chat menu dismisses only that menu and returns focus to its trigger. | **differs** | Chromium: differs / differs; WebKit: differs / differs | A |

## Repeated findings

Only behavior repeated in both runs is a finding. Existing Stop/Copy, styling and interaction decisions are regression requirements, not new feature proposals.

### 1. Redo after a send inserts the previous message into the new draft — item 16, class C

1. In a fresh tutor chat, type `First message` and press Enter.
2. Wait for the reply, then click the composer and type `Second draft`.
3. Press Command+Z, then Shift+Command+Z.

Expected (Claude's native editing baseline): Redo restores exactly `Second draft`. Chromium does that. WebKit restores `First messageFirst messageSecond draft` on both runs, inserting the already-sent text twice. The longer isolated scenario restored `Clipboard and hint auditClipboard and hint auditundo after a sent message` instead of `undo after a sent message`, identically on both runs. Sending that draft would send text the user did not type for this turn.

This is **C**: the tutor clears React draft state after sending while keeping the same controlled textarea. Review's **Ask about this exercise** uses the same controlled `Grow` textarea and clears its draft the same way, so it is a concrete propagation lead. That other screen was not browser-tested for this bug. This is a WebKit-browser result; the installed Tauri app was not opened.

Likely responsible: [Tutor.tsx:384](apps/desktop/src/Tutor.tsx:384) clears the draft; [Tutor.tsx:675](apps/desktop/src/Tutor.tsx:675) controls the reused textarea's value; [Grow.tsx:5](apps/desktop/src/Grow.tsx:5) supplies that textarea. The analogous reset is [Ask.tsx:48](apps/desktop/src/Ask.tsx:48). This is a source-location hypothesis, not a verified root-cause fix.

[WebKit run 1](shots/webkit-1-redo-minimal.png) · [WebKit run 2](shots/webkit-2-redo-minimal.png) · [Chromium run 1](shots/chromium-1-redo-minimal.png) · [Chromium run 2](shots/chromium-2-redo-minimal.png). Exact values: [redo-results.json](redo-results.json); reproduction: [redo-check.cjs](redo-check.cjs).

### 2. Skill-page context is not passed to the tutor — item 3, class B

1. Open the Learning skill from the sidebar.
2. Open the tutor with the bottom-right button in a fresh chat.
3. Type `Explain this subject` and press Enter.
4. Inspect the visible context chips and the outgoing tutor request.

Ore shows no skill context chip. The request contains the message and stream ID, with no `--skill=learning`. Notion AI's contextual-chat baseline uses the open page as context; the analogous Ore behavior would be to scope the tutor to the open skill. This is **B, needs Tyler**: implicit skill scoping changes what the tutor searches. D128 explicitly provides source context and user-selected @ skills, but does not settle automatically using an open skill. This is not a proposal for a new mode.

[apps/desktop/src/App.tsx:2287](apps/desktop/src/App.tsx:2287) only passes an open source as `reading`; [apps/desktop/src/Tutor.tsx:322](apps/desktop/src/Tutor.tsx:322) derives context solely from it, and [apps/desktop/src/Tutor.tsx:383](apps/desktop/src/Tutor.tsx:383) sends that context.

[Chromium run 1](shots/chromium-1-item-3.png) · [Chromium run 2](shots/chromium-2-item-3.png)

[WebKit run 1](shots/webkit-1-item-3.png) · [WebKit run 2](shots/webkit-2-item-3.png)

### 3. Send has no hover hint or Enter hint — items 56–57, class C

1. Open the tutor and type a draft so Send is enabled.
2. Move away from all controls, then hover Send for at least 600 ms (800 ms in the controlled recheck).
3. Compare with the Close and Stop controls, whose hints show `⌘J` and `⌘.`.

Ore shows no tooltip for Send, although Enter sends. The reference baseline exposes control labels/shortcuts on hover; Ore's explicit rule requires its `Hint` component. The lack of a bare `title` attribute is correct, but does not supply the missing Hint. Items 56 and 57 are two failed checklist criteria for this **one** defect.

This is **C**, because the same bare Send control is also present in Review's **Ask about this exercise**. That second screen is a source-based propagation lead, not a claim that it was browser-tested here.

[apps/desktop/src/Tutor.tsx:714](apps/desktop/src/Tutor.tsx:714) renders Send without `Hint`; Enter is handled at [apps/desktop/src/Tutor.tsx:700](apps/desktop/src/Tutor.tsx:700). The repeated implementation is [apps/desktop/src/Ask.tsx:145](apps/desktop/src/Ask.tsx:145), with Enter at [apps/desktop/src/Ask.tsx:136](apps/desktop/src/Ask.tsx:136).

[Chromium run 1](shots/chromium-1-hover-Send.png) · [Chromium run 2](shots/chromium-2-hover-Send.png)

[WebKit run 1](shots/webkit-1-hover-Send.png) · [WebKit run 2](shots/webkit-2-hover-Send.png)

### 4. Escape from the chat switcher moves focus to the composer — item 60, class A

1. In a chat with messages, click the chat title/caret to open Chats.
2. The Find a chat field receives focus.
3. Press Escape without choosing a chat.
4. Observe the active element.

Ore closes the switcher and keeps the tutor open, but focuses `Message the tutor`. The reference menu/popover convention returns focus to the trigger that opened it. Ore's interaction-check Conventions table already requires that behavior. This is **A**, an existing focus-restoration requirement, not a proposal to change what selecting a chat does. Selecting a chat may still put focus in its composer.

[apps/desktop/src/Tutor.tsx:909](apps/desktop/src/Tutor.tsx:909) cancels automatic focus restoration for every close and calls `onPicked`; [apps/desktop/src/Tutor.tsx:491](apps/desktop/src/Tutor.tsx:491) passes the composer-focus callback.

[Chromium run 1](shots/chromium-1-item-60.png) · [Chromium run 2](shots/chromium-2-item-60.png)

[WebKit run 1](shots/webkit-1-item-60.png) · [WebKit run 2](shots/webkit-2-item-60.png)

## Untested and excluded

- **28 — Native right-click Copy menu:** actual pointer drags and right-clicks were performed in both engines twice. The native browser menu is outside Playwright's DOM and page screenshots, so its Copy item was not verified. The source's native-menu policy alone is not counted as a pass.
- **50 — Persistent mode:** excluded by D128.2 and D128.6. Practice is explicitly an action, not a mode, and Quiz me opens Review. No persistent-mode feature is proposed. Separate real-click checks exercise these actions; canned replies cannot verify pedagogical output.
- **51 — Tab navigation in WebKit:** ordinary native HTML buttons are also skipped by Tab in the control fixture. Chromium reaches the tutor controls with visible focus; the WebKit result is untested for Ore-specific behavior under this host configuration. No system setting was changed, and no keyboard-navigation bug is attributed to Ore from this evidence.
- **55 — Stop after partial streaming:** the supplied bridge emits a complete canned reply after the wait, with no partial response. The normal pending, Stop, late-result and retry paths were tested. No artificial streaming event was injected to pretend the partial-stream behavior had been observed.

## Evidence and test corrections

[run.cjs](run.cjs) and [run.log](run.log) retain the original passes; [results.json](results.json) holds their raw observations. [recheck.cjs](recheck.cjs) and [recheck-results.json](recheck-results.json) retain the controlled rechecks. [final-check.cjs](final-check.cjs), [final-check.log](final-check.log) and [final-results.json](final-results.json) contain the last isolated clipboard, hint, icon and native-keyboard control tests. [verification.json](verification.json) selects the final observation for each item, engine and run. Raw script verdicts are not the report: a faulty assertion or fixture is corrected explicitly before classifying app behavior.

- Newlines are entered using Shift+Enter in corrected keyboard tests. A literal newline passed to `keyboard.type` presses Enter and is not a paste test.
- Undo is checked as reversing an edit; it need not erase an entire phrase in one step. A fresh-draft redo passes, but the separate after-send sequence reproduces the WebKit defect above.
- A pause separates triple-click from drag checks so the drag is not interpreted as a fourth click.
- Clipboard permission is granted to Chromium for Copy-button testing. An initial permission-denied toast is a browser setup limit, not an Ore defect. Native keyboard Copy/Cut/Paste is still exercised.
- Multiline paste copies a real multiline draft through Command+C, then pastes it through Command+V. Rich paste copies a real rendered reply selection containing bold text.
- The very long sent message uses a helper-page clipboard fixture, actual Command+C/Command+V and Enter. No Ore field is assigned through the DOM. The main pass also types an 8,403-character draft directly.
- Canned citation IDs did not correspond to this seeded library. Citation rechecks intercept only the tutor response and return a citation to the real Testing Effect source, maintaining a six-second wait. Sources are opened through real clicks; no library files are patched.
- Tooltip checks move the pointer through intermediate positions and within each control. Single-jump automation temporarily suppressed some Radix tooltips; natural pointer movement reveals them. Only Send consistently lacks a hint. The final evidence is [hover-results.json](hover-results.json) from [hover-check.cjs](hover-check.cjs).
- Mention assertions compare matching text representations. Skill icons are CSS masks of the dot SVG set; UI dot icons use SVG paths, not individual `<circle>` nodes. Neither rendering is a missing icon.
- A transient Bun crash-report toast occurred in one supplemental pass; it was not reproduced twice and is not a finding. Later isolated tests verified the affected clipboard behavior.
- Focus checks use an empty chat and both Tab directions, avoiding the erroneous assumption that 22 Tabs will traverse a long thread and the entire app.

No findings concern sent-message editing, regeneration, attachments, suggested starter rows, emoji pickers, speech-bubble styling, rewards, or excluded team features. No fixes were made.

## Totals

- Checklist items accounted for: **60**.
- Tested to a repeatable result: **56**.
- **Works: 51; missing: 2; differs: 3; untested/excluded: 4.**
- Failed checklist items by class: **A 1; B 1; C 3**.
- Distinct repeated findings: **4** (A 1, B 1, C 2); the Send-hint finding covers two checklist items.
