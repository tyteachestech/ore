# Diagramming and canvas: tools and groundwork brief

Date: 2026-10-23. Audience: the planner. Scope: which diagram/canvas library and file format would fit Ore, whether today's IDs let a diagram node point at library objects, and what (if anything) to build now. Nothing here changes a decision; D34.1 still bans a canvas.

Confidence tags (as in `brief-tech.md`): **[V]** checked against a primary source today (npm registry, GitHub API, official docs, package source); **[T]** tested here (bundle builds, scratch library); **[S]** secondary source; **[M]** from memory, not re-verified. **Unverified** claims are also listed in §6.

---

## 0. Summary

1. **Format: JSON Canvas 1.0** (`.canvas`, the Obsidian spec, MIT). It is the smallest format that does the job: nodes with `x/y/width/height`, Markdown text, `file` nodes that point at a path plus `#subpath`, and labelled edges. Agents already write it well, the text indexes trivially, and it diffs one node per line.
2. **Renderer: React Flow (`@xyflow/react` 12.12.0, MIT).** It renders custom React nodes (a highlight, a card, a My notes section) with keyboard focus, select, move and delete built in, at about 61 KB gzip over React.
3. **tldraw is out:** production use needs a license key; the free hobby key is discretionary and keeps a watermark. **Excalidraw (MIT)** is the right pick only if "diagramming" means freehand whiteboard sketching rather than arranging library objects; it can be added later as a sketch file that a canvas node embeds.
4. **Groundwork now: none in code.** Items, highlights, highlight notes, cards and prequestions already have IDs that survive edits and re-index. The two gaps (My notes sections, topics after a future merge) are best closed when the feature is built, without rework. Two invariants to keep, listed in §5.
5. **Decision conflict:** D34.1 bans a canvas outright, and the research behind it (`brief-notetaking-practice.md` §10, the Ahrens and Fiorella & Mayer checks) argues against one. Building this needs Tyler to amend D34.1 explicitly; §4 lists every decision it touches.

---

## 1. Options (Part A)

Versions and dates from the npm registry and GitHub API on 2026-10-23 [V]. Bundle sizes [T]: `bun build --minify --splitting`, production React 19, a bare `<Library />` mount; a React-only baseline is 65 KB gzip. "Total" counts every emitted chunk, including lazy ones.

| | **tldraw SDK** | **Excalidraw** | **JSON Canvas + React Flow** | **Mermaid** (text diagrams) |
|---|---|---|---|---|
| Version checked | `tldraw` 5.5.2 (repo pushed 2026-10-23; minor release monthly, 5.0 May 2026) | `@excalidraw/excalidraw` 0.18.1 (npm 2026-04-20; previous 0.18.0 was 2025-03-10; repo pushed 2026-10-23, 134k stars) | Spec 1.0 (2024-03-11, unchanged since; repo only adds app listings) + `@xyflow/react` 12.12.0 (2026-10-11) | `mermaid` 12.2.0 (2026-10-13), monthly minors |
| License | Custom "tldraw license": **no production use without a license key** [V]. `@tldraw/tlschema` is MIT | MIT [V] | Spec MIT, React Flow MIT [V] | MIT [V] |
| Key / watermark for a personal local app | Key checked offline, but hobby keys are granted case by case, keep the "made with tldraw" watermark and send analytics pings; without a key in production it "stops rendering the editor" after 5 s [V]. A Tauri page (`tauri://localhost`, not HTTPS) probably reads as dev mode, but that would be using the SDK against its license terms. **Fails Tyler's "no license key" rule** | None | None. React Flow shows a small attribution; its docs say personal projects may hide it with `proOptions.hideAttribution` [V] | None |
| Embeds in React in Tauri's WKWebView | Supports Safari [M]; React 18/19 peer [V]. Not tested in Tauri | React 17–19 peer [V]. **Fonts load from `esm.sh` unless `window.EXCALIDRAW_ASSET_PATH` points at bundled copies** [V, read in the 0.18.1 source]; also has URLs for `libraries.excalidraw.com` and `plus.excalidraw.com` (library browser, export to Excalidraw+), which you hide. Not tested in Tauri | Plain React + SVG/HTML, no network [V]. Not tested in Tauri | Renders SVG; works in Safari [M]. Not tested in Tauri |
| File format | `.tldr` JSON: `tldrawFileFormatVersion`, `schema` (migration sequences), `records[]` [M]. Shape text is **TipTap rich-text JSON** (`richText`) [V] | `.excalidraw` JSON: `type`, `version: 2`, `source`, `elements[]`, `appState`, `files` (images as base64 data URLs) [V]. Text elements store `text` and `originalText` [V] | `{nodes[], edges[]}`. Node: `id, type (text/file/link/group), x, y, width, height, color?`; `text` is Markdown; `file` + optional `subpath` (`#heading`); `link` has `url`; edges have `fromNode/toNode`, sides, ends, `label` [V] | Plain text source (`graph TD; A-->B`); layout is computed, not stored |
| Custom data / link per shape | Every record has free-form `meta: {}`; custom shape types via `ShapeUtil` [V] | Every element has `link: string \| null` and `customData?: Record<string, any>` [V] | No extension rule in the spec [V]. Obsidian's API types allow extra top-level keys [S]; whether Obsidian keeps unknown **node** keys when it re-saves is **unverified**. Ore would be the only writer, so this matters only for opening the library in Obsidian | Node IDs, `click A href "…"` links [M] |
| Version stability | Schema migrations built in, but a major version roughly yearly (4.0 Sep 2025, 5.0 May 2026) [V] | `version: 2` for years; loader `restore()` fills missing fields [M] | Frozen at 1.0 for 2.5 years [V]. Very stable, but there is no versioning story if Ore extends it | Syntax stable within a major; 12.0 came out Sep 2026 [V] |
| Agent / CLI writes without the UI | Hard: needs valid record IDs, fractional `index` keys, rich-text JSON and the schema header [M] | Possible but verbose: each element carries ~25 fields (`seed`, `versionNonce`, `updated`, `boundElements`, …) [V]. `convertToExcalidrawElements` takes skeletons, but it lives in the browser package; running it headless in Bun is **unverified**. `@excalidraw/mermaid-to-excalidraw` 2.3.0 (MIT) converts Mermaid [V] | Easy: a few fields per node. kepano's `obsidian-skills` ships a `json-canvas` agent skill [S] | Easiest: agents write Mermaid fluently |
| Freehand / shapes / arrows | All three, best-in-class feel | All three, hand-drawn look (`roughness` 0 gives clean lines) [M] | **No freehand**; boxes (nodes), groups and arrows (edges) only. Freehand would need `perfect-freehand` 1.2.3 (MIT) as a custom node, outside the spec | Arrows and shapes only, auto-layout, no freehand, no free placement |
| Keyboard | Full tool shortcuts [M] | Full tool shortcuts (R, A, T, D…) [M] | Tab focuses nodes/edges, Enter/Space select, arrows move (Shift faster), Delete removes, Escape clears [V]. Creating nodes and edges needs our own keys | Text editing only |
| Dark, compact UI | Dark theme; heavy toolbar chrome [M] | `theme="dark"`; whiteboard chrome, hand-drawn fonts [M] | We draw every node ourselves, so it matches D26 | Theme variables [M] |
| Bundle (gzip) [T] | 643 KB total | 2,495 KB total over 179 chunks (244 KB entry); package ships 13 MB of fonts | 126 KB total (≈61 KB over React) | 1,455 KB total over 106 chunks (11 KB entry; diagram types load on demand) |
| Text searchable | Yes, after flattening rich-text JSON | Yes: text elements' `text` | Yes: `text` nodes, group `label`s, edge `label`s | Yes: the source is text |
| Node → library object | Custom shape with `props.ref` or `meta.ref` | Element `customData.ref` (and `link`) | `file` node with `file: "cards/<id>.md"` (or `doc.md`, `notes.md` + `subpath`) plus one `ore` field for the ID | Node ID plus `click … href` |
| Git-friendliness | Poor: rich-text JSON nests deeply; a header change on schema upgrades [M] | Poor: every edit bumps `version`, `versionNonce` and `updated`; pretty-printed elements span ~30 lines; freehand point arrays; base64 images inline [V fields, M diff behaviour] | Good: we control the serializer. One node per line (Obsidian's own layout [M]) means one line per moved or edited node; merges conflict only on the same node | Best: plain text. But no stored positions, so it is a different feature |

**Also considered**
- **Obsidian Excalidraw plugin format** (`.excalidraw.md`): Markdown wrapper whose "Text Elements" section repeats every text with a `^blockid` so Obsidian search sees it, then the drawing JSON, LZ-compressed by default [S]. The plugin is **AGPL-3.0** [V], so its code is off-limits. The wrapper idea is useful; the compressed JSON is not (agents cannot patch it [S]).
- **D2** (`terrastruct/d2` v0.9.0, MPL-2.0 [V]): text diagrams with better layout than Mermaid, but a Go binary; the npm WASM build (`@terrastruct/d2` 0.1.33) has not been updated since 2025-08-17 [V]. Its best layout engine (TALA) is paid [M]. Skip.
- **elkjs** (layout engine some Mermaid and React Flow setups use): licensed "EPL-2.0 OR GPL-3.0-or-later" [V]. Allowed under EPL, but not needed.

---

## 2. Groundwork audit (Part B)

Read: `packages/core/src/{ids,items,annotations,anchoring,cards,notes,topics,skills,db,doctor,library,init}.ts`. Nothing in core renames or deletes item folders, card files or topic files (only atomic temp-file renames in `fsutil.ts`) [V].

| Object | Stable ID that survives edits and re-index? | How it is addressed today | What is missing for a diagram node |
|---|---|---|---|
| **Source item** | **Yes.** ULID in `doc.md` frontmatter and as the folder suffix `items/<yyyy>/<slug>-<ULID>/`. A title change does not rename the folder. `.index` rebuilds from files | `findItem(ref)`: full ULID or unique prefix/suffix. Path is stable too | Nothing |
| **Highlight** (annotation) | **Yes.** ULID; an edit appends a new line with the same `id` and `rev + 1`; `reanchorItem` moves the selectors after body edits but keeps the ID; `status: deleted` hides it and keeps the ID | `findAnnotation(ref)` scans every `annotations.jsonl`; FTS rows carry `ref` = annotation ID and `item` | Nothing. A node should show "highlight deleted" or "anchor lost" when `doctor` reports an orphan |
| **Highlight note** | **Yes, through its highlight.** It is the `note` field of the latest revision, not a separate object | Annotation ID | Nothing. A node that shows "the note" is a view of the highlight |
| **Card / prompt** | **Yes.** ULID; file `cards/<ULID>.md`; wording edits keep the ID; `retired` keeps the file | `findCard(ref)` | Nothing |
| **Prequestion** (bonus) | **Yes, as item + n.** Never regenerated once attempted (SPEC §6) | `ore prequestion <item> <n>` | Nothing |
| **Section of My notes** (`notes.md`) | **No.** Blocks under `## ` headings have no IDs. The app autosaves the whole file (`setNotes`); headings can be renamed or duplicated | Only by heading text (`sectionLines()`, the append rule) | A reference that survives edits. Recommended: store `{item, heading}` and a TextQuote selector (`exact/prefix/suffix`) over notes.md, then resolve with the existing `anchor()` in `anchoring.ts`, which works on any string. JSON Canvas expresses the heading natively as `file: "<item>/notes.md", subpath: "#<heading>"`. **Do not** add `^block-id` markers: that writes app text into his notes (spirit of D34.2) |
| **Topic** | **Partly.** Frontmatter has a ULID that nothing references; items and cards reference the **slug**; the file is `topics/<slug>.md` | Slug | D25 says topics are "AI-merged", but no merge code exists yet [V]. When it is built, a merge must keep the old slug in `aliases` and resolve refs through it, or every reference (items, cards, and future diagrams) breaks. This rule applies with or without diagrams |
| **Skill** | **Yes, while Tyler keeps the ID.** Slug-like `id` in `skills.yaml`; only Tyler edits it | Skill ID | Nothing; `doctor` already warns on unknown skills |
| **Passage with no highlight** | No | Only offsets into `doc.md` | Not needed: dropping a passage onto a canvas can create a Keep highlight through `ore highlight` (D15), which gives it an ID and anchoring |

**Where a new file type goes** (SPEC §2 layout):
- Per source: `items/<yyyy>/<slug>-<id>/map.canvas`, beside `notes.md`. It sits outside `doc.md`, so `text_sha256` and anchoring are unaffected, and it is found with the item.
- Library level (cross-source, which the Ahrens check says is the useful version of D33): `maps/<slug>-<ULID>.canvas`, a new top-level folder like `cards/`. Add it to `init.ts` `DIRS` and to the library `AGENTS.md`.
- Tested in a scratch library [T]: `.canvas` files in both places are ignored today. `ore search` does not find their text, and `ore doctor` reports no issue.

**How FTS would pick up the text** (`db.ts`): add a `canvas` `FileKind` in `scan()` (one line per location), an `indexFile` branch that inserts one FTS row with `kind 'canvas'`, `ref` = canvas ULID (or the item ID for a per-source map), title = canvas name, and body = text-node Markdown + group labels + edge labels, a matching `dropFile` branch, and the new kind in the `SearchHit` union. About 20 lines. Linked nodes add no text: their objects are already indexed under their own kinds. No `SCHEMA_VERSION` bump is needed (`kind` is free text; new files count as changed on the next sync). `doctor` should then flag refs that no longer resolve.

**Git-friendliness** (library is under local git, D5): JSON Canvas with our own serializer (stable key order, one node or edge per line, integer coordinates) gives one-line diffs per change and rare conflicts; Tyler is the only writer, so merges are rare anyway. Excalidraw and tldraw rewrite many lines per touch (nonces, timestamps, nested rich text) and Excalidraw inlines images as base64; both would bloat history. Mermaid is the best diff but cannot store positions.

---

## 3. Recommendation (Part C)

**Pick: JSON Canvas 1.0 files, rendered with React Flow, nodes drawn as Ore's own React components.**
- It fits the job a learning library needs: placing his highlights, notes, cards and topics side by side and drawing labelled links between them (Ahrens's "spread notes out to compare", the cross-source D33). Freehand drawing is not that job.
- Files stay canonical, small, agent-writable and searchable (D5, D6). No license key, no network, MIT throughout (D4). The smallest bundle, and nodes look like the rest of the app (D26).
- One `ore` field per node carries the canonical reference; `file`/`subpath` stays meaningful in any JSON Canvas viewer:

```json
{"id":"a1","type":"file","file":"cards/01M5….md","ore":"card:01M5…","x":0,"y":0,"width":280,"height":120}
{"id":"a2","type":"file","file":"items/2026/spacing-01M5…/doc.md","ore":"highlight:01M5…","x":320,"y":0,"width":280,"height":120}
{"id":"a3","type":"file","file":"items/2026/spacing-01M5…/notes.md","subpath":"#Spacing","ore":"notes:01M5…","quote":{"exact":"…","prefix":"…","suffix":"…"},"x":0,"y":160,"width":280,"height":120}
```
Ref kinds: `item:`, `highlight:`, `card:`, `prequestion:<item>#<n>`, `notes:<item>` (+ `subpath`, `quote`), `topic:<slug>`, `skill:<id>`. Plain `text` nodes hold his own words.

**If Tyler means freehand sketching** (drawing a model of an idea, the "drawing" strategy in Fiorella & Mayer): use **Excalidraw** for that, as its own `sketch-<ULID>.excalidraw` file that a canvas `file` node embeds. Bundle its fonts and set `EXCALIDRAW_ASSET_PATH`, hide the library and Excalidraw+ menus, and index its text elements. Do not adopt tldraw.

**Mermaid** is worth keeping in mind for one narrow use: an agent drawing a *comparison* diagram after Tyler's attempt (Van Meter's supported drawing: compare your drawing with an expert one, 0.94 vs 0.37 unsupported; `brief-notetaking-check-fiorella-mayer.md`). Mermaid in the app would add 1.4 MB, and `react-markdown` cannot render it today. Not a reason to build anything now.

**Build with the feature, not now:** the `db.ts` FTS branch above; `ore canvas show|set <ref> [--stdin]` (atomic write + schema check, like `ore notes --set`, so the app writes only through the CLI, D30); `ore resolve <ref…> --json` so the app can render many linked nodes in one call; a `doctor` check for dangling refs; keyboard commands to add a node from the palette and to connect the selected nodes.

---

## 4. Decisions the feature touches

| Decision | Conflict |
|---|---|
| **D34.1** "No notes archive, notes-review screen or canvas" | **Direct.** Needs Tyler's explicit amendment. The evidence behind it: practitioner reports that canvases become "an overwhelming pile of cards" (`brief-notetaking-practice.md` §10); retrieval beats mapping, and closed-book recall beat concept mapping with the text open by d = 1.07–1.50 (Karpicke & Blunt 2011); free concept maps add little for high-ability learners. For a canvas: concept maps 0.62, drawing 0.40, provided matrix shells 1.07 (Fiorella & Mayer, via the repo check); Ahrens likes spreading notes out to compare them |
| **D33** deferred "one note linked to several highlights" | The canvas *is* this feature in another form. Re-scope it as cross-source (Ahrens check) and decide whether the canvas replaces it |
| **D29** "never a 'review your highlights' screen" | A canvas of all highlights would become one. Nodes should be placed by Tyler, not auto-populated |
| **D34.2 / D34.3** no AI text in his notes; nothing from AI before his attempt | A per-source map counts as his notes: agents may arrange or link objects only when he asks, never write text nodes into it. An AI diagram, if any, comes only after his attempt and lives outside his map |
| **D34.4** finish and chapter recall hide notes | Maps must be hidden during those steps too |
| **D26** add features only when necessary; compact and keyboard-first | Favors React Flow with Ore-drawn nodes over a whiteboard UI |
| **D30** writes go through the CLI | Needs `ore canvas set`; the React Flow state is serialized and written by the CLI, never by the webview |
| **D4 / D3** local only, Mac | Excalidraw must bundle its fonts (it uses `esm.sh` by default); tldraw hobby keys send analytics pings |

---

## 5. Groundwork: do now vs wait

**Do now: nothing in code.** AGENTS.md rules out speculative abstractions, and D34.1 still bans the feature. The audit shows the IDs a diagram needs are already stable for items, highlights, highlight notes, cards, prequestions and skills.

Keep these invariants, which already hold today (worth one line in SPEC when D34.1 is amended):
1. Item folders, `cards/<id>.md` and topic files are never renamed or deleted by core; references use ULIDs (slugs for topics and skills).
2. When topic merging is built (D25), the merged-away slug goes into the survivor's `aliases`, and lookups resolve aliases. This protects item and card references today, not only diagrams.

Can safely wait until the feature is approved: the `.canvas` location and FTS kind, the `ore:` ref grammar, the notes-section quote reference, `ore canvas`/`ore resolve`, the doctor check, and the renderer. None of these needs a migration of existing files, because a canvas only points at IDs that already exist.

---

## 6. Not verified

- None of the four renderers was run inside the Tauri WKWebView; the claims rest on Safari support. A one-hour spike in `apps/desktop` would settle it (Tauri apps on macOS are reported to be capped at 60 fps [S]).
- Whether Obsidian keeps unknown node fields (`ore`, `quote`) when it re-saves a `.canvas`. This matters only if Tyler opens the library in Obsidian.
- Whether `convertToExcalidrawElements` runs headless under Bun.
- tldraw's behaviour under `tauri://localhost` (it probably counts as development). Moot: production use without a key breaks the license.
- Git diff behaviour for Excalidraw and tldraw, Obsidian's one-node-per-line layout, Excalidraw `roughness` and tldraw `.tldr` top-level fields [M].
- The Obsidian Excalidraw `.excalidraw.md` layout [S, community skill docs only].

---

## Sources
- tldraw license: https://github.com/tldraw/tldraw/blob/main/LICENSE.md ; license key: https://tldraw.dev/sdk-features/license-key ; hobby: https://tldraw.dev/get-a-license/hobby ; license page: https://tldraw.dev/legal/tldraw-license ; npm: https://www.npmjs.com/package/tldraw (5.5.2)
- Excalidraw: https://github.com/excalidraw/excalidraw ; JSON schema: https://docs.excalidraw.com/docs/codebase/json-schema ; npm: https://www.npmjs.com/package/@excalidraw/excalidraw (0.18.1; types read from the 0.18.1 tarball) ; https://www.npmjs.com/package/@excalidraw/mermaid-to-excalidraw (2.3.0)
- JSON Canvas: https://jsoncanvas.org/spec/1.0/ ; https://github.com/obsidianmd/jsoncanvas ; Obsidian `CanvasData` types: https://www.mintlify.com/obsidianmd/obsidian-api/api/canvas-data ; agent skill: https://tessl.io/registry/skills/github/kepano/obsidian-skills/json-canvas
- React Flow: https://github.com/xyflow/xyflow ; https://www.npmjs.com/package/@xyflow/react (12.12.0) ; accessibility: https://reactflow.dev/learn/advanced-use/accessibility ; attribution: https://reactflow.dev/api-reference/types/pro-options , https://reactflow.dev/learn/troubleshooting/remove-attribution
- Mermaid: https://github.com/mermaid-js/mermaid ; https://www.npmjs.com/package/mermaid (12.2.0)
- D2: https://github.com/terrastruct/d2 (v0.9.0) ; https://www.npmjs.com/package/@terrastruct/d2 (0.1.33)
- Obsidian Excalidraw plugin: https://github.com/zsviczian/obsidian-excalidraw-plugin (2.29.0, AGPL-3.0) ; format notes: https://skills.cat/skills/arjunmahishi/dotfiles/excalidraw-obsidian
- perfect-freehand: https://www.npmjs.com/package/perfect-freehand (1.2.3) ; elkjs: https://www.npmjs.com/package/elkjs (0.12.0)
- Tauri 60 fps report: https://developer.apple.com/forums/tags/webkit?page=7
- Repo evidence: `docs/research/brief-notetaking-practice.md` §10, `brief-notetaking-check-ahrens.md` (D33, D34.1), `brief-notetaking-check-fiorella-mayer.md` (mapping, drawing, matrix), `brief-notetaking.md` (Karpicke & Blunt)
