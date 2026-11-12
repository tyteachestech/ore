# Diagram editor UX parity audit

One plain miss, affecting three menu contexts, and two behavior choices for Tyler. No implementation files were changed.

Audited commit: `74e5708f41868aa696f664d7b24b43b249fec343`. The [80-item checklist](checklist.md) was written before opening Ore or reading its UI implementation. Results below use two completed attempts per engine. The primary WebKit pass preceded Chromium; focused confirmations followed.

WebKit 26.6 and Chromium 153.0.8010.12, 1440×900 viewport, deviceScaleFactor 2. Screenshots are 2880×1800 PNGs. Only the supplied browser mock and bridge 1532 were used. All creation, selection, drawing, clipboard paste and menu interactions used real mouse/keyboard input. [Execution notes](method-notes.md), [runner](audit.cjs), and [final raw observations](final-results.json) preserve the method and limits. Native app, real library, and servers were untouched.

**1. Every checklist item**

“Works” means the named behavior was exercised successfully twice in both engines within the noted scope. “Untested” means a complete verdict could not be established; it is not a guessed pass. A row may contain several explicitly named variants, each exercised. Findings count root causes; item totals count checklist rows.

| # | Behavior | Result | Engines | Evidence / scope |
|---|---|---|---|---|
| 1 | Rectangle: drag creates a rectangle matching the dragged bounds. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-01-1.png) · [C1](shots/chromium-01-1.png) |
| 2 | Ellipse: drag creates an ellipse matching the dragged bounds. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-02-1.png) · [C1](shots/chromium-02-1.png) |
| 3 | Diamond: drag creates a diamond matching the dragged bounds. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-03-1.png) · [C1](shots/chromium-03-1.png) |
| 4 | Arrow: drag creates an arrow from the press to release. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-04-1.png) · [C1](shots/chromium-04-1.png) |
| 5 | Line: drag creates a line from the press to release. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-05-1.png) · [C1](shots/chromium-05-1.png) |
| 6 | Free draw: a held pointer stroke follows the drawn path. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-06-1.png) · [C1](shots/chromium-06-1.png) |
| 7 | Text tool: clicking a position and typing creates text there. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-07-1.png) · [C1](shots/chromium-07-1.png) |
| 8 | Plain click with rectangle, ellipse, diamond, arrow and line tools has a deliberate result at the clicked position (record size and placement; verify the reference before treating no shape as a gap). | **works** | WebKit ×2; Chromium ×2 | Rectangle/ellipse/diamond: 160×64, centered on click. Arrow/line: click-to-place points, Enter finishes. This satisfies the checklist’s deliberate-result criterion; Excalidraw discards a click-only geometric shape. |
| 9 | Shift-drag constrains rectangle/ellipse to a square/circle. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-09-1.png) · [C1](shots/chromium-09-1.png) |
| 10 | Alt-drag creates rectangle/ellipse/diamond from the press point as center. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-10-1.png) · [C1](shots/chromium-10-1.png) |
| 11 | Rectangle/ellipse/diamond/arrow/line can be drawn right-to-left and upward. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-11-1.png) · [C1](shots/chromium-11-1.png) |
| 12 | A tiny drag with each geometric tool has a usable or deliberately discarded result, never an invisible selected remnant. | **works** | WebKit ×2; Chromium ×2 | 2×1 drag: geometric shapes become usable defaults; unfinished tiny linear objects can be canceled. |
| 13 | A newly drawn shape can receive a label immediately with Enter then typing. | **differs** | WebKit ×2; Chromium ×2 | B1: Enter closes the automatically opened label editor; direct typing works. |
| 14 | Double-clicking empty canvas creates editable text at that point. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-14-1.png) · [C1](shots/chromium-14-1.png) |
| 15 | Double-clicking a shape opens its label for editing. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-15-1.png) · [C1](shots/chromium-15-1.png) |
| 16 | A finished shape is selected so it can immediately be moved or styled (record active tool without reporting persistence). | **differs** | WebKit ×2; Chromium ×2 | B1: focus is in label editing; no handles or immediate arrow-key nudge. |
| 17 | After drawing, keyboard input reaches the canvas without another focus click. | **works** | WebKit ×2; Chromium ×2 | Direct typing goes to the auto-open label, without another click. |
| 18 | Drawing an arrow between two shapes binds both ends. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-18-1.png) · [C1](shots/chromium-18-1.png) |
| 19 | A bound arrow follows either connected shape when moved. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-19-1.png) · [C1](shots/chromium-19-1.png) |
| 20 | An arrow may end on empty canvas without snapping to an unrelated shape. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-20-1.png) · [C1](shots/chromium-20-1.png) |
| 21 | An arrow supports a readable label on its path. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-21-1.png) · [C1](shots/chromium-21-1.png) |
| 22 | Elbow arrows can be created or selected as a routing type. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-22-1.png) · [C1](shots/chromium-22-1.png) |
| 23 | Start and end arrowheads can be changed independently. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-23-1.png) · [C1](shots/chromium-23-1.png) |
| 24 | Dragging an arrow endpoint onto another shape rebinds that end. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-24-1.png) · [C1](shots/chromium-24-1.png) |
| 25 | Clicking a shape selects it alone. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-25-1.png) · [C1](shots/chromium-25-1.png) |
| 26 | Shift-click adds/removes a shape from the selection. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-26-1.png) · [C1](shots/chromium-26-1.png) |
| 27 | Marquee selects enclosed shapes in either drag direction. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-27-1.png) · [C1](shots/chromium-27-1.png) |
| 28 | A member inside a group can be selected for individual editing. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-28-1.png) · [C1](shots/chromium-28-1.png) |
| 29 | Esc clears an active shape selection before leaving the editor. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-29-1.png) · [C1](shots/chromium-29-1.png) |
| 30 | Command-A selects all drawing objects when the canvas has focus. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-30-1.png) · [C1](shots/chromium-30-1.png) |
| 31 | Clicking a shape label selects the same object as clicking its edge. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-31-1.png) · [C1](shots/chromium-31-1.png) |
| 32 | A thin line is selectable with a small pointer tolerance around its stroke. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-32-1.png) · [C1](shots/chromium-32-1.png) |
| 33 | A transparent shape remains selectable from its outline without an exact-pixel hit. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-33-1.png) · [C1](shots/chromium-33-1.png) |
| 34 | Dragging a selected shape moves it by the dragged distance. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-34-1.png) · [C1](shots/chromium-34-1.png) |
| 35 | Every visible resize handle resizes its corresponding edge/corner. | **works** | WebKit ×2; Chromium ×2 | All eight visible edge/corner handles exercised separately. |
| 36 | A rotation handle rotates a selected shape. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-36-1.png) · [C1](shots/chromium-36-1.png) |
| 37 | Arrow keys nudge selected objects by a small step. | **works** | WebKit ×2; Chromium ×2 | 1-unit nudge; undo/redo also checked. |
| 38 | Shift-arrow keys nudge by a larger step. | **works** | WebKit ×2; Chromium ×2 | Larger nudge; undo/redo also checked. |
| 39 | Alignment/grid snapping can align two shapes while moving. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-39-1.png) · [C1](shots/chromium-39-1.png) |
| 40 | Command-D duplicates the selection and selects the copy. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-40-1.png) · [C1](shots/chromium-40-1.png) |
| 41 | Alt-drag makes a copy while preserving the original. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-41-1.png) · [C1](shots/chromium-41-1.png) |
| 42 | Delete/Backspace removes the selected object. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-42-1.png) · [C1](shots/chromium-42-1.png) |
| 43 | Drawing a shape is one undo step and one redo step. | **works** | WebKit ×2; Chromium ×2 | One shape creation, one Undo, one Redo. |
| 44 | Moving a shape is one undo step and one redo step. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-44-1.png) · [C1](shots/chromium-44-1.png) |
| 45 | Resizing a shape is one undo step and one redo step. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-45-1.png) · [C1](shots/chromium-45-1.png) |
| 46 | Rotating a shape is one undo step and one redo step. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-46-1.png) · [C1](shots/chromium-46-1.png) |
| 47 | Duplicating with Command-D or Alt-drag is one undo step and one redo step. | **works** | WebKit ×2; Chromium ×2 | Both Command-D and Alt-drag checked. |
| 48 | Deleting a selection is one undo step and one redo step. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-48-1.png) · [C1](shots/chromium-48-1.png) |
| 49 | Enter on a selected labeled shape edits its existing label. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-49-1.png) · [C1](shots/chromium-49-1.png) |
| 50 | Enter while editing a label inserts a new line. | **differs** | WebKit ×2; Chromium ×2 | B2: Enter commits the shape label; Shift-Enter adds a line. |
| 51 | Shift-Enter while editing a label inserts a new line. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-51-1.png) · [C1](shots/chromium-51-1.png) |
| 52 | Esc finishes text editing and retains the typed text. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-52-1.png) · [C1](shots/chromium-52-1.png) |
| 53 | Text in a shape wraps within the shape's available width. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-53-1.png) · [C1](shots/chromium-53-1.png) |
| 54 | Finishing an empty label leaves no stray text object or editing box. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-54-1.png) · [C1](shots/chromium-54-1.png) |
| 55 | A very long label remains readable/editable without clipping or losing its contents. | **works** | WebKit ×2; Chromium ×2 | 795 characters preserved; zoom-to-fit makes the whole label visible/editable. Excalidraw also clips oversized labels at 100%. |
| 56 | Space-drag pans the canvas without moving a shape. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-56-1.png) · [C1](shots/chromium-56-1.png) |
| 57 | Trackpad-style scroll pans the canvas. | **works** | WebKit ×2; Chromium ×2 | Real wheel deltas approximate trackpad scroll; no physical trackpad gesture. |
| 58 | The Hand tool pans the canvas. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-58-1.png) · [C1](shots/chromium-58-1.png) |
| 59 | Command-plus and Command-minus zoom the drawing. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-59-1.png) · [C1](shots/chromium-59-1.png) |
| 60 | Pinch or Command-scroll zooms around the pointer (record which real input is available). | **works** | WebKit ×2; Chromium ×2 | Command-wheel tested. Physical pinch unavailable; the permitted alternative passed. |
| 61 | Zoom-to-fit brings all drawn objects into view. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-61-1.png) · [C1](shots/chromium-61-1.png) |
| 62 | Drawing/moving at the sheet edge preserves the object and permits reaching it (do not fault D175's sheet layout). | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-62-1.png) · [C1](shots/chromium-62-1.png) |
| 63 | A drawing moved far off-screen can be recovered with zoom-to-fit. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-63-1.png) · [C1](shots/chromium-63-1.png) |
| 64 | The style picker changes selected objects' stroke/fill/width. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-64-1.png) · [C1](shots/chromium-64-1.png) |
| 65 | Style choices are operable with the keyboard from the picker. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-65-1.png) · [C1](shots/chromium-65-1.png) |
| 66 | A newly drawn shape inherits the last chosen applicable style. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-66-1.png) · [C1](shots/chromium-66-1.png) |
| 67 | Copy style and paste style transfer appearance between objects. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-67-1.png) · [C1](shots/chromium-67-1.png) |
| 68 | Command-C/Command-V copies and pastes diagram objects within the editor. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-68-1.png) · [C1](shots/chromium-68-1.png) |
| 69 | Pasting external plain text creates editable diagram text. | **works** | WebKit ×2; Chromium ×2 | Text copied from a separate page with real Meta+C; editable after paste. |
| 70 | Pasting an external image adds a visible movable image. | **works** | WebKit ×2; Chromium ×2 | PNG copied from a separate page by a real button click; real Meta+V, then image movement. |
| 71 | Pasted objects appear near the pointer/visible viewport instead of off-screen. | **works** | WebKit ×2; Chromium ×2 | Paste stays in the visible canvas; Ore places it at viewport center. |
| 72 | Toolbar buttons show action names and available shortcuts on hover through Hint, with no bare title attribute (settled convention; suppress as a new finding). | **untested** | WebKit ×2; Chromium ×2 | Chromium matched all toolbar hints twice. WebKit had one full pass and one attempt without the Keep the tool hint. Complete repeatability is unverified; no bare titles found. No new finding under the Conventions exclusion. |
| 73 | The active tool is visibly indicated in the toolbar. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-73-1.png) · [C1](shots/chromium-73-1.png) |
| 74 | After clicking a toolbar tool, a canvas shortcut works without an extra canvas click. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-74-1.png) · [C1](shots/chromium-74-1.png) |
| 75 | A shape's right-click menu offers applicable edit/duplicate/delete/group/order/copy actions. | **missing** | WebKit ×2; Chromium ×2 | A1: standard Cut, Copy and Paste absent. |
| 76 | A multi-selection right-click menu acts on the selection and offers grouping. | **missing** | WebKit ×2; Chromium ×2 | A1: Group is present; standard Cut, Copy and Paste absent. |
| 77 | Empty-canvas right-click exposes applicable paste/select-all/view actions. | **missing** | WebKit ×2; Chromium ×2 | A1: Paste absent. |
| 78 | Leaving by Esc, Done, or scrim preserves drawn content (test each exit path, respecting selection/text Esc first). | **works** | WebKit ×2; Chromium ×2 | All three exits tested twice per engine, reopening after each. |
| 79 | Shift-Command-Enter switches full window and back without losing content. | **works** | WebKit ×2; Chromium ×2 | [W1](shots/webkit-79-1.png) · [C1](shots/chromium-79-1.png) |
| 80 | Reopening a diagram retains its objects and their positions. | **works** | WebKit ×2; Chromium ×2 | Object coordinates preserved to the saved 0.01-unit precision. This checks object positions, not remembered pan/zoom. |

**2. Repeatable missing/different behavior**

**A1 — Standard clipboard commands are missing from right-click menus. Class A. Items 75, 76, 77.**

A new user reaches this on the first attempt to copy a shape with the mouse. Keyboard copy/paste works, but the menus expose export commands and style copying without ordinary editable-object Copy, Cut, or Paste.

Exact reproduction, at 100% zoom with the tool lock off:

1. Open a note, type `/diagram`, and press Enter.
2. Press R, drag a rectangle, and press Esc to finish its empty label. Draw a second rectangle and finish its label.
3. For item 75, right-click the first rectangle. Ore offers Edit text, Duplicate, ordering, Copy style and export actions, but no Cut, Copy, or Paste.
4. For item 76, press Esc to dismiss the menu, then ⌘A and right-click either selected rectangle. Group and alignment actions are present, but Cut, Copy, and Paste are absent.
5. For item 77, dismiss the menu and right-click empty canvas. Select all and view actions are present, but Paste is absent.

Excalidraw exposes ordinary Cut/Copy/Paste on selected objects and Paste on empty canvas. This was checked in the live reference: [shape menu](shots/ref-shape-menu.png), [empty menu](shots/ref-empty-menu.png), and [captured menu text](reference-behavior.json). Its specialized export commands are additional actions, not substitutes for copying editable shapes.

| Affected context | Ore 2× screenshot, WebKit | Ore 2× screenshot, Chromium |
|---|---|---|
| 75 — one shape | [attempt 1](shots/webkit-75-1.png), [attempt 2](shots/webkit-75-2.png) | [attempt 1](shots/chromium-75-1.png), [attempt 2](shots/chromium-75-2.png) |
| 76 — multiple shapes | [attempt 1](shots/webkit-76-1.png), [attempt 2](shots/webkit-76-2.png) | [attempt 1](shots/chromium-76-1.png), [attempt 2](shots/chromium-76-2.png) |
| 77 — empty canvas | [attempt 1](shots/webkit-77-1.png), [attempt 2](shots/webkit-77-2.png) | [attempt 1](shots/chromium-77-1.png), [attempt 2](shots/chromium-77-2.png) |

Likely source: `apps/desktop/src/draw/Editor.tsx:1542–1548`, specifically the selected and empty menu action lists at lines 1545 and 1546. The clipboard handlers already exist at lines 764–787, but ordinary clipboard commands are absent from the menu command list. [Open Editor.tsx](../../apps/desktop/src/draw/Editor.tsx).

This is one plain miss with three demonstrated contexts. The same omission is already observed across the editor’s menu branches; no speculative extra C finding is added.

**B1 — Finishing a shape starts text editing immediately. Class B. Items 13 and 16.**

The shape tool has returned to Select in this probe. Focus is nevertheless in a blank label textarea, and resize handles are hidden. This changes the first action after drawing.

Exact reproduction:

1. With the tool lock off, press R and drag a rectangle.
2. For item 13, follow the checklist’s Excalidraw sequence: press Enter, then type `Concept`. Ore’s Enter closes its already-open label editor. The following letters run tool shortcuts; they do not label the rectangle. Typing directly without that Enter works, as independently observed in the earlier immediate-label probe and item 17.
3. For item 16, draw another rectangle and immediately press Right Arrow. The rectangle does not move because the label field owns the key. Press Esc, then Right Arrow: it moves by one unit. The raw records compare the geometry before and after both keys.

Excalidraw leaves the completed rectangle selected with handles, and Enter begins label editing. Its [getting-started sequence](https://plus.excalidraw.com/how-to-start) and the [live post-draw screenshot](shots/ref-drawn.png) support that expectation. See also the [live reference state](reference-behavior.json).

| Affected behavior | Ore 2× screenshots |
|---|---|
| 13 — Enter then typing | [WebKit 1](shots/webkit-13-enter-1.png), [WebKit 2](shots/webkit-13-enter-2.png), [Chromium 1](shots/chromium-13-enter-1.png), [Chromium 2](shots/chromium-13-enter-2.png) |
| 16 — automatic label focus, before the nudge probe | [WebKit 1](shots/webkit-16-focus-1.png), [WebKit 2](shots/webkit-16-focus-2.png), [Chromium 1](shots/chromium-16-focus-1.png), [Chromium 2](shots/chromium-16-focus-2.png) |

Likely source: `apps/desktop/src/draw/Editor.tsx:1155` always calls `startEdit` after geometric-shape creation. Line 1478 suppresses handles while editing. [Open Editor.tsx](../../apps/desktop/src/draw/Editor.tsx).

Why B: automatic label entry is useful for D103’s keyboard-first concept mapping, and changing it would be noticeable. Tyler’s choice is whether a dragged shape should land in ordinary selection, as Excalidraw does, or immediately accept a label. This finding does not ask for a change to tool persistence. The source branch is shared by rectangles, ellipses and diamonds; the exact focus/nudge reproduction above used rectangles.

**B2 — Enter commits a shape label instead of adding a line. Class B. Item 50.**

Exact reproduction:

1. Select a rectangle and press Enter to edit its label.
2. Type `Line one`, then press Enter.
3. Ore closes the text field and leaves the one-line label selected. Shift-Enter creates a newline successfully in the separate item 51 check.

Excalidraw keeps editing and inserts a newline with either Enter or Shift-Enter; Esc or ⌘Enter finishes. This is visible in its [captured shortcuts](reference-shortcuts.txt), [shortcut screenshot](shots/reference-shortcuts.png), and the [live two-line label probe](shots/ref-label-enter.png).

Ore screenshots: [WebKit 1](shots/webkit-50-1.png), [WebKit 2](shots/webkit-50-2.png), [Chromium 1](shots/chromium-50-1.png), [Chromium 2](shots/chromium-50-2.png).

Likely source: `apps/desktop/src/draw/Editor.tsx:1533–1536` deliberately calls `endEdit("done")` for unmodified Enter on a label. The displayed key guide also documents this at `apps/desktop/src/keys.ts:179`. [Editor.tsx](../../apps/desktop/src/draw/Editor.tsx), [keys.ts](../../apps/desktop/src/keys.ts).

Why B: this is an explicit existing interaction, not a missing key handler. Aligning it with Excalidraw changes how Tyler finishes labels. The choice is Enter for a newline with Esc/⌘Enter to finish, or retaining Ore’s Enter-to-finish convention. The runtime reproduction used a rectangle label; the source suggests the same rule also reaches arrow labels, which is not counted as an additional runtime finding.

**3. Class A priority**

1. **A1: add standard Cut/Copy/Paste to the applicable right-click menus.** This is the only independently established plain miss. It is encountered on the first mouse-driven copy/paste attempt, and the underlying keyboard operations already work. Apply the menu fix across selected objects, multiple selection, and empty canvas together.

Reference scope and exclusions:

- Excalidraw was the primary comparison, including its live shortcut dialog and targeted interactive probes. The [tldraw action documentation](https://tldraw.dev/sdk-features/actions) corroborates shared menu/keyboard actions. [FigJam’s connector guide](https://help.figma.com/hc/en-us/articles/1500004414542-Create-diagrams-and-flows-with-connectors-in-FigJam) corroborates bound connectors that follow moved shapes, endpoint rebinding, labels and different routes. Those connector behaviors passed in Ore.
- No findings concern frames, collaboration, libraries, the laser pointer, rough drawing, the Terminal look, emoji, sheet layout, note-preview behavior, colors, spacing, or wording. Tool persistence is excluded as requested.
- Existing interaction-check Conventions were read first. No new finding is filed for their settled policies. Toolbar hover has its own conservative coverage note in row 72.
- The oversized-label case was compared live with Excalidraw before adjudication. Both can extend beyond the viewport at 100%; Ore preserved all 795 characters and recovered the full label through zoom-to-fit. No text-loss or clipping defect is claimed from that case.

**4. Totals**

| Metric | Count |
|---|---:|
| Checklist items attempted | 80 |
| Completed browser attempts represented | 320 (80 × 2 × 2 engines) |
| Items checked with a verdict | 79 |
| Works | 73 |
| Missing | 3 |
| Differs | 3 |
| Untested / incomplete verdict | 1 |

| Class | Findings | Affected checklist items |
|---|---:|---:|
| A — plain miss | 1 | 3 |
| B — needs Tyler | 2 | 3 |
| C — separate likely-repeated miss | 0 | 0 |

Per-engine verdicts: WebKit — 79 checked, 73 works, 3 missing, 3 differs, 1 untested. Chromium — 80 checked, 74 works, 3 missing, 3 differs, 0 untested. The combined table keeps the incomplete WebKit hint verdict, because WebKit is authoritative.

The A issue is already observed in all three menu contexts; it is one root cause, not three independent defects. No additional C hypothesis is counted.
