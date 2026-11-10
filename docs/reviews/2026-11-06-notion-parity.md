# Note editor: Notion parity audit (2026-11-06)

Tyler found that `# ` in a numbered item didn't make a heading. A behaviour of the app we copy should never
reach him as a bug, so this lists Notion's editing behaviours, block by block, and checks each one in our
editor. Every row is a case in `apps/desktop/test/notion-parity.test.ts` (headless, on the real editor) or
the e2e journey "note shortcuts as in Notion". Before = on master before this pass.

## Markdown shortcuts at the start of a line

| Behaviour (Notion) | Before | Now |
| --- | --- | --- |
| `#` `##` `###` + space make headings, also with text already after the caret | pass | pass |
| `##` typed in a heading sets that level | fail (added levels: H1 became H3) | fixed |
| `#` in a list item turns the item into a heading, splitting the list | fail (stayed `2. # …`) | fixed |
| `-` `*` `+` make a bullet, `1.` a numbered list, `[]` a to-do | pass | pass |
| `-` in a numbered item, `1.` in a bullet switch the item's kind | fail | fixed |
| `"` + space makes a quote | fail | fixed |
| `>` + space makes a toggle (Tyler: Notion's way), its line the title; in a list item and inside a quote too | quote | fixed |
| ```` ``` ```` + space (or ```` ```ts ````) makes a code block; in a list item too | top level only | fixed |
| `---` makes a divider | pass | pass |
| In a quote, callout or toggle body the shortcuts make blocks there | pass | pass |
| In a table cell, and mid-line, they stay text | pass | pass |

## Inline

| Behaviour | Before | Now |
| --- | --- | --- |
| `**bold**` `*italic*` `` `code` `` `~strike~` `~~strike~~` | pass | pass |
| A typed web address becomes a link at the space after it | fail (saved as `https\://…`) | fixed |

## Enter, Backspace, Tab

| Behaviour | Before | Now |
| --- | --- | --- |
| Enter at the end of a heading starts text | pass | pass |
| Enter on an empty item leaves the list; on an empty nested item it outdents | pass | pass |
| Enter after a ticked to-do starts an unticked one | fail (came ticked) | fixed |
| Enter after a numbered item starts the next number | pass | pass |
| Enter in a quote starts text below it; Shift-Enter breaks the line inside | fail (stayed in the quote) | fixed |
| Backspace at the start of a heading makes it text (any level) | fail (H2 became H1) | fixed |
| Backspace at the start of a list item or to-do makes it text, leaving the list | fail (joined the item above) | fixed |
| … of a nested item makes it text under its parent | pass | pass |
| … of a quote, callout or toggle makes it text (a toggle keeps its body below) | fail | fixed |
| Backspace at the start of text joins it to the block above | pass | pass |
| Tab / Shift-Tab indent and outdent a list item | pass | pass |
| Tab on a line that can't indent stays in the note | fail (focus left the note) | fixed |
| Tab on a line under a list nests it in the last item; under a toggle, in its body; Shift-Tab takes it out (Tyler) | missing | added |
| Tab in a code block indents the line | fail | fixed |

## Keys

| Behaviour | Before | Now |
| --- | --- | --- |
| ⌘B ⌘I ⌘E on the selection | pass | pass |
| Strikethrough: ⌘⇧X, since ⌘⇧S toggles the sidebar in Ore | pass | pass |
| ⌘U underline, also on the format bar, saved as `<u>…</u>` (Tyler) | missing | added |
| ⌘⌥0 text, ⌘⌥1–3 headings | top level only | fixed (list items too) |
| ⌘⌥4 to-do, 5 bullet, 6 numbered, 7 toggle, 8 code | fail (H4–H6, numbered, bullet) | fixed |
| ⌘Enter ticks and unticks a to-do | fail | fixed |
| ⌘Z right after a shortcut gives back what was typed | fail (took the line away) | fixed |
| `/heading`, `/quote`… on a line with text turn that line, in a list item too | fail in list items | fixed |

## Paste

| Behaviour | Before | Now |
| --- | --- | --- |
| Markdown text pastes as blocks (headings, lists, bold) | fail (literal `\#`, `\-`) | fixed |
| A paste that replaced the line it landed on also added a source to the library | fail | fixed |
| A web address pasted over selected text links it; alone it pastes as a link | fail | fixed |
| HTML pastes as its blocks | pass | pass |
| Lines of plain text paste as lines | pass | pass |
| In a code block a paste stays code | pass | pass |

Copying from a note now puts Markdown on the clipboard as its text, so a copy pasted into Claude or ChatGPT
keeps its headings and lists.

## Second pass (2026-11-08), against Notion's own shortcut list

| Behaviour (notion.com/help/keyboard-shortcuts) | Before | Now |
| --- | --- | --- |
| `/h1` `/h2` `/h3`, `/#` `/##` `/###`, `/plain`, `/check`, `/hr`, `/img` find their block | fail (only words of the label) | fixed |
| `/date` | missing | added: opens the `@` dates |
| A `/` closed with Esc, then deleted, opens the menu again when typed anew | fail (stayed closed at that spot) | fixed |
| ⌘K with words selected adds a link (no selection: the palette, as Notion's search) | fail (the palette) | fixed |
| ⌘Enter in a toggle's title opens or closes it (still ticks a to-do) | fail (moved into the body) | fixed |
| ⌘⌥T closes every toggle, or opens them all | missing | added |
| ⌘⇧H puts the last text colour or highlight on the selection | missing | added |
| A pasted screenshot or copied image goes into the note | fail (nothing) | fixed |
| An image dropped from Finder on a note goes into it, a line showing where | fail (added as a source) | fixed |
| `/equation` (inline) and `/math` (block), and `$$x$$` typed, make equations drawn with KaTeX | missing (TeX stayed text; a `$$` block's `_` saved as `\_`) | added |

Left out: ⌘/ (Ore's shortcut list) and `/color` names (the format bar's colour menu does it).

## Drag to select, and blocks that stand alone (2026-11-10, D188)

From Tyler's clip: a drag down the gutter did nothing, and "Gh" typed beside a diagram became one block with it.

| Notion | Ore before | Now |
| --- | --- | --- |
| A drag that starts beside the page's blocks draws a box and selects the blocks it passes | missing (left out in the first pass) | added (`dragsel.ts`, e2e "note drag to select") |
| A drag from inside text into another block selects whole blocks | fail (a text selection across blocks) | fixed |
| An image or embed is a block of its own; words never share its block | fail (words typed with the caret beside a diagram joined its line, as did `/diagram` on a line with words) | fixed (`alone.ts`, `notion-parity.test.ts`) |

## Already covered elsewhere

Esc block selection, ⌘A twice, ⌘D, ⌘⇧↑↓, ⋮⋮ drag and Turn into (`blockops.test.ts`); `[[` links, `/`,
`@` dates, `:` emoji (`editor.test.ts`, `dates.test.ts`, `emoji.test.ts`); tables, including dragging a row or column by its grip (2026-11-07; the header row stays on top) (`tables.test.ts`).

## Tyler's answers (2026-11-06)

1. `>` makes a toggle, Notion's way; `"` makes a quote. Built.
2. Hints in empty blocks: yes, on the caret's block while the note has focus. Built.
3. Underline: wanted. ⌘U and a U on the format bar, saved as `<u>…</u>` like the colours' HTML. Built.
4. Tab nests: built where Markdown can hold it (under a list item or in a toggle). Under a heading or a line of
   text it does nothing, since Markdown has no child blocks there.
5. Code fences wait for a space, so ```` ```ts ```` names the language. Kept.

## The questions he was asked

1. `>` then space: Notion makes a toggle, Markdown means a quote. We do a quote; `"` is a quote in both.
2. Hints in empty blocks: Notion shows "Type '/' for commands" on the empty line the caret is on, and
   "Heading 1", "List", "To-do" in empty blocks of those kinds. We show nothing.
3. ⌘U underline: Markdown has no underline, so it would save as `<u>…</u>`. Left out.
4. Tab on a plain line: Notion nests it under the block above. Markdown can only nest under a list item, so
   Tab does nothing there.
5. ```` ``` ````: Notion makes the code block on the third backtick. We wait for a space, so ```` ```ts ````
   can name the language.
