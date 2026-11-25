# Your run: keys (keyboard, focus, text input and accessibility, from the code)

Your name is `keys`. Read the keymap and every key handler; prove each finding with a headless test of the handler, or with the state it would get.

1. **The keymap** (`apps/desktop/src/keys.ts`, `list-keys.ts`, `Shortcuts.tsx`, `Hint.tsx`, `native-menu.ts`): two actions on one key in one context; a shortcut that fires while focus is in a text field, the note editor, a title field, the search box or the tutor's input (should it?); a shortcut that a menu item also binds (double fire); shortcuts on non-US layouts (⌥ producing characters, `Key` vs `Code`, AZERTY, Dvorak); keys shown in hints that differ from what the handler binds.
2. **Text input and IME** (`input-mode.ts`, `typing.ts`, `TitleField.tsx`, `Grow.tsx`, the editor): Enter, Esc and arrows during IME composition (Japanese, Chinese, Korean: `isComposing` / keyCode 229), dead keys, emoji picker; does Enter during composition save, submit an answer or rate an exercise?
3. **Focus** (`Trap.tsx`, `focus-near.ts`, `Focus.tsx`, Radix popovers and menus, `Palette.tsx`): focus lost to `body` after a dialog, a row removed, an undo, a screen change; focus trapped; Esc closing two layers at once.
4. **Review by keyboard** (`Review.tsx`, `rate.ts`, `review-session.ts`): a held key or key repeat rating twice, a rating key pressed while the answer field has focus, number keys on the numpad.
5. **Accessibility** (roles, labels, live regions in the main screens): controls with no accessible name, state not exposed (pressed, selected, expanded), a live region that announces on every render.
