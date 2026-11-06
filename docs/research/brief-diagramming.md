# Brief: diagramming and maps (2026-10-23)

Tyler wants to diagram while learning: lay ideas out, see them, draw connections (tldraw, Excalidraw, Obsidian Canvas). This brief combines the two research briefs and records the decisions made before anything is built.

- Evidence: `brief-diagramming-evidence.md` (Fiorella & Mayer ch03–04, Karpicke & Blunt, O'Day & Karpicke, Schroeder 2018, Leutner 2025).
- Tools and groundwork: `brief-diagramming-tools.md` (licenses, formats, bundle sizes, ID audit of `packages/core`).

## Answer

Build it as a **map you make from memory**, not as a canvas you arrange while reading.
- A map built closed-book works as well as written free recall (Blunt & Karpicke 2014, d = 0.07–0.19, not significant) and beats the same work with the text open (d = 0.46–0.50).
- A map built with the text open lost to plain recall by d = 1.07–1.50 (Karpicke & Blunt 2011). For readers who already know the field, open-book mapping is near zero (F&M ch03: high-ability d = −0.08). Mapping first, then recalling, added nothing and cost 10 minutes (O'Day & Karpicke 2021).
- The tool's mechanics are the main risk. The same drawing task went from d = 0.87 on paper to −0.16 with an on-screen drag-and-drop tool (F&M ch04, Schwamborn 2010a vs 2011). The evidence points to typed boxes and labeled arrows with automatic layout; Tyler chose freehand anyway (below).
- The large drawing effects come from comparing your drawing with a correct one afterwards (Van Meter 2001: 0.94 vs 0.37; Leutner 2025: integration support g = 0.35 vs −0.15 for other support). An AI map shown first or instead is studying a provided map (g = 0.43, 0.32 for adults; Schroeder 2018).
- Cross-source "graph of my ideas" boards have no learning evidence; every user community reports piles of cards never revisited. Practitioner opinion only.

## Decided shape (D35, 2026-10-23)

Tyler took the recommendations on purpose, AI role and review, and chose a freehand whiteboard over typed boxes and arrows.
1. **Editor and format: Excalidraw** (`@excalidraw/excalidraw`, MIT), stored as `map.excalidraw` beside `notes.md`. tldraw is out (license key, watermark).
   - Bundle its fonts (`EXCALIDRAW_ASSET_PATH`; it loads them from esm.sh by default) and hide the library browser and Excalidraw+ menus, so it stays local (D4).
   - A shape can point at a library object with `customData.ore` (`highlight:01…`).
   - Costs accepted: about 2.5 MB gzip in lazy chunks; noisier git diffs (every edit bumps `version`, `versionNonce`, `updated`); agents can write it but verbosely.
   - Risk accepted: the mechanics evidence (paper 0.87 vs on-screen tool −0.16). Retention of map-recall items vs typed-recall items (D34.8) decides whether it stays.
2. **When:** the finish and chapter recalls (D18) accept typed recall **or** a map from memory, never both. The map is then his, like My notes (D31): editable later with the text open, hidden during recalls, no AI drawing or text in it.
3. **AI:** after the attempt only. It reads the map's text, arrows and a PNG export, shows its own map beside his (written as Mermaid, rendered read-only) with comparison prompts, and names missing ideas and wrong links. Never edits his map, never rates (D21, D34.2, D34.3).
4. **Review:** relationships he drew seed `prompt` items, credited "from your map" (inference from retrieval > restudy, untested).
5. **Judge on retention** (D34.8).

## Groundwork now

No code. The ID audit (`brief-diagramming-tools.md` §2) found stable IDs for items, highlights, highlight notes, cards, prequestions and skills. Two gaps close at build time without migrations:
- My notes sections have no IDs: reference them by item + heading + a text quote, resolved with the existing `anchor()`. Never write ID markers into his notes.
- Topics are referenced by slug and D25 says topics get merged, but no merge code exists. When it is built, the merged-away slug goes into the survivor's `aliases`. This protects items and cards today, not only maps.

What changed now is paper only: D34.1 amended, D35 added, and the two invariants and the reserved file location recorded in SPEC.

## Build later, with the feature

- `map` search kind in `db.ts` (~20 lines); `ore map <item> [--set]` (the app writes only through the CLI, D30); `ore resolve <ref…>`; a `doctor` check for links that no longer resolve.
- A one-hour spike: Excalidraw inside the Tauri webview (not yet tested).
- Before building, read the full texts flagged in the evidence brief (Lechuga 2015, Schroeder 2018 moderators, Ortega-Tudela 2019 on map-then-write order).

## Deferred

- Compare-and-contrast matrix: the strongest single effect (d = 1.07, 8 of 8, equal time), but only for compare-and-contrast material and it needs its own UI.
- Cross-source maps (D33).

## Decisions

Recorded as D35 with amendments to D18, D19, D34.1 and D34.4; build notes in SPEC §8 ("Maps"). SPEC §2 now states the reference invariants and the planned `map.excalidraw` file.

## Spike result (2026-10-23, branch `spike/excalidraw`, not merged)

Excalidraw 0.18 runs inside the Tauri app (WKWebView). The self-test passed 8 of 8 on three launches. Tyler tried freehand drawing briefly and found it fine; frame rate was not measured.
- **Fonts:** bundled fonts load with a CSP of `font-src 'self'`; all esm.sh fallbacks were blocked. CSP also needs `blob:` for workers and images.
- **PNG export, Mermaid → Excalidraw, and save/reload through `ore map --set`** all worked. Text, arrow labels and arrow bindings can be read out ("rectangle 'Spaced study' → rectangle 'Long-term retention', label 'improves'"), which is what enrich and the AI comparison need.
- **Rules the build must keep:**
  - Wait for Excalifont before creating or measuring text, including AI/Mermaid maps, or labels are stored too narrow and clip.
  - Leave the canvas background at its default (dark theme inverts colours).
  - Use timers, not `requestAnimationFrame`, for background work (it stalls while the window is covered).
- **Keys while the editor has focus:**
  - Excalidraw takes ⌘K (its link editor), 1–4 (tools), Backspace and Esc.
  - App keys N and Tab still fire, and ↵ fires in both.
  - The map screen must own the keyboard while it is focused. Esc leaves the editor; the palette needs a key Excalidraw doesn't take.
- **Size:**
  - Main bundle +2 KB.
  - Opening a map loads 528 KB gzip; all lazy JS is 2.49 MB.
  - Fonts are 13.1 MB, of which 12.7 MB is the CJK fallback (Xiaolai). Drop it.
  - The debug .app grew from 25 to 41 MiB.
- **Files are pretty-printed JSON**, so diffs are long; write them compactly (one element per line) in `ore map --set`.
- **Repo gotcha:** `.githooks/post-commit` reinstalls `/Applications/Ore.app` on any commit touching `apps/desktop`, from any worktree. Spike commits used `git -c core.hooksPath=/dev/null`, and the spike branch disables `app:install`.
