import { useSyncExternalStore } from "react";
import { load, save } from "./util";

/** A key combo as `Ctrl+Alt+Shift+Meta+<KeyboardEvent.code>`, e.g. "Meta+KeyK", "Digit1". Physical keys, so ⌥ and ⇧ do not change it. */
export type Combo = string;

/** `scope`: where a binding works, when not everywhere in the app. "diagram" is the diagram editor (it owns the
 *  keyboard). "sound" is a source with sound of its own (a video or a recording), "silent" one without: one
 *  source is never both, so their keys never meet (L is Listen on an article, Forward on a video). */
type Binding = { id: string; label: string; group: string; combo: Combo; global?: boolean; system?: boolean; scope?: "diagram" | "sound" | "silent" };

// Editable bindings. `global` ones also fire in text fields, so they need ⌘, ⌃ or ⌥. `system` ones are
// registered with macOS and work in any app; they can be turned off ("").
const DEFAULTS = [
  { id: "palette", label: "Command palette", group: "General", combo: "Meta+KeyK", global: true },
  { id: "add", label: "Add source", group: "General", combo: "Meta+KeyN", global: true },
  { id: "file", label: "Open file", group: "General", combo: "Meta+KeyO", global: true },
  { id: "sidebar", label: "Toggle sidebar", group: "General", combo: "Shift+Meta+KeyS", global: true },
  { id: "nav-back", label: "Go back", group: "General", combo: "Meta+BracketLeft" },
  { id: "nav-forward", label: "Go forward", group: "General", combo: "Meta+BracketRight" },
  { id: "settings", label: "Settings", group: "General", combo: "Meta+Comma", global: true },
  { id: "shortcuts", label: "Keyboard shortcuts", group: "General", combo: "Meta+Slash", global: true },
  { id: "go-toread", label: "Go to To read", group: "General", combo: "Meta+Digit1", global: true },
  { id: "go-done", label: "Go to Done", group: "General", combo: "Meta+Digit2", global: true },
  { id: "original", label: "Open original", group: "General", combo: "Shift+Meta+KeyO" },
  { id: "reveal", label: "Reveal in Finder", group: "General", combo: "Shift+Meta+KeyR", global: true },
  { id: "home", label: "Go to Home", group: "General", combo: "Meta+Digit0", global: true },
  { id: "go-feed", label: "Go to Feed", group: "General", combo: "Meta+Digit3", global: true },
  { id: "mark-read", label: "Mark post read or unread", group: "Feed", combo: "Shift+Meta+KeyU" },
  { id: "tutor", label: "Tutor chat", group: "General", combo: "Meta+KeyJ", global: true },
  { id: "tutor-stop", label: "Stop the tutor's reply", group: "General", combo: "Meta+Period", global: true },
  { id: "review", label: "Start review", group: "General", combo: "Meta+KeyR", global: true },
  { id: "quick-quiz", label: "Quick quiz, from any app", group: "General", combo: "Ctrl+Alt+KeyQ", global: true, system: true },
  { id: "undo", label: "Undo", group: "General", combo: "Meta+KeyZ" },
  { id: "redo", label: "Redo", group: "General", combo: "Shift+Meta+KeyZ" },
  { id: "finish-source", label: "Finish source (opens the quiz)", group: "Reader", combo: "Shift+Meta+Enter" },
  { id: "finish", label: "Next quiz step / check answer / save", group: "Reader", combo: "Meta+Enter", global: true },
  { id: "side-panel", label: "Toggle side panel", group: "Reader", combo: "Alt+Meta+KeyS", global: true },
  { id: "notes", label: "Toggle source note / skill note", group: "Reader", combo: "KeyN" },
  { id: "section", label: "Recall this chapter", group: "Reader", combo: "KeyM" },
  { id: "hide-source", label: "Hide / show the source while you write", group: "Reader", combo: "Alt+KeyH" },
  { id: "collected", label: "Collected (side panel)", group: "Reader", combo: "KeyC" },
  { id: "questions", label: "Your questions (side panel)", group: "Reader", combo: "KeyQ" },
  { id: "rename", label: "Rename source", group: "Sources", combo: "Alt+Meta+KeyR" },
  { id: "copy", label: "Copy with the source (a highlight, a source, picked sources)", group: "General", combo: "Meta+KeyC" },
  { id: "link", label: "Copy link to original", group: "Reader", combo: "Shift+Meta+KeyC", global: true },
  { id: "path", label: "Copy path (the original file, else doc.md)", group: "General", combo: "Alt+Meta+KeyC", global: true },
  { id: "listen", label: "Listen / stop listening", group: "Reader", combo: "KeyL", scope: "silent" },
  { id: "look-up", label: "Explain a word (Learn this from there)", group: "Reader", combo: "Ctrl+Meta+KeyD" },
  { id: "lesson-prev", label: "Previous lesson in the course", group: "Reader", combo: "Alt+Meta+ArrowLeft" },
  { id: "lesson-next", label: "Next lesson in the course", group: "Reader", combo: "Alt+Meta+ArrowRight" },
  { id: "highlight", label: "Highlight the focused text (↑ ↓ move the focus)", group: "Reader", combo: "KeyH" },
  { id: "bigger", label: "Bigger text", group: "Reader", combo: "Meta+Equal", global: true },
  { id: "smaller", label: "Smaller text", group: "Reader", combo: "Meta+Minus", global: true },
  { id: "archive", label: "Archive source", group: "Sources", combo: "Shift+Meta+KeyA" },
  { id: "pin", label: "Pin or unpin source", group: "Sources", combo: "Alt+Meta+KeyP" },
  { id: "filter", label: "Find: filter sources, or search the open source", group: "General", combo: "Meta+KeyF", global: true },
  { id: "passage-next", label: "Next supporting passage", group: "Quiz", combo: "ArrowDown" },
  { id: "passage-prev", label: "Previous supporting passage", group: "Quiz", combo: "ArrowUp" },
  { id: "no-idea", label: "No idea", group: "Review", combo: "Meta+Backspace", global: true },
  { id: "in-head", label: "Answered in my head", group: "Review", combo: "Alt+Enter", global: true },
  { id: "edit-card", label: "Edit exercise", group: "Review", combo: "KeyE" },
  { id: "retire-card", label: "Retire exercise", group: "Review", combo: "Shift+Meta+Backspace", global: true },
  { id: "ask", label: "Ask about this exercise", group: "Review", combo: "Slash" },
  { id: "bad-version", label: "Bad version: show the original exercise", group: "Review", combo: "KeyB" },
  // ⌘L, L for Later: it works with the answer half typed (a plain key would type into it), as ⌘⌫ No idea does.
  { id: "later", label: "Later: at the end of this session", group: "Review", combo: "Meta+KeyL", global: true },
  // YouTube's K J L sit beside Space ← →, on a video or a recording only (D195).
  { id: "play", label: "Play / pause", group: "Video and listening", combo: "Space" },
  { id: "play-alt", label: "Play / pause (second key)", group: "Video and listening", combo: "KeyK", scope: "sound" },
  { id: "back", label: "Back 15 seconds", group: "Video and listening", combo: "ArrowLeft" },
  { id: "back-alt", label: "Back 15 seconds (second key)", group: "Video and listening", combo: "KeyJ", scope: "sound" },
  { id: "forward", label: "Forward 30 seconds", group: "Video and listening", combo: "ArrowRight" },
  { id: "forward-alt", label: "Forward 30 seconds (second key)", group: "Video and listening", combo: "KeyL", scope: "sound" },
  { id: "slower", label: "Slower", group: "Video and listening", combo: "BracketLeft" },
  { id: "faster", label: "Faster", group: "Video and listening", combo: "BracketRight" },
  { id: "keep", label: "Highlight (no key point or question)", group: "Highlight", combo: "Digit1" },
  { id: "card", label: "Key point (nothing selected: a key point of your own, here)", group: "Highlight", combo: "Digit2" },
  { id: "question", label: "Question", group: "Highlight", combo: "Digit3" },
  { id: "apply", label: "Try it (a technique to try on your own work)", group: "Highlight", combo: "Digit4" },
  { id: "note", label: "Write note", group: "Highlight", combo: "Tab" },
  { id: "remove", label: "Remove highlight", group: "Highlight", combo: "Backspace" },
  // The note editor's blocks (Notion's keys): the caret's block, or the one the ⋮⋮ handle is on.
  { id: "block-up", label: "Move block up", group: "Notes", combo: "Shift+Meta+ArrowUp" },
  { id: "block-down", label: "Move block down", group: "Notes", combo: "Shift+Meta+ArrowDown" },
  { id: "block-duplicate", label: "Duplicate block", group: "Notes", combo: "Meta+KeyD" },
  { id: "note-bold", label: "Bold", group: "Notes", combo: "Meta+KeyB" },
  { id: "note-italic", label: "Italic", group: "Notes", combo: "Meta+KeyI" },
  { id: "note-underline", label: "Underline", group: "Notes", combo: "Meta+KeyU" },
  { id: "note-strike", label: "Strikethrough", group: "Notes", combo: "Shift+Meta+KeyX" },
  { id: "note-code", label: "Inline code", group: "Notes", combo: "Meta+KeyE" },
  { id: "note-last-color", label: "Last text colour or highlight", group: "Notes", combo: "Shift+Meta+KeyH" },
  { id: "cut-text", label: "Remove the selected text (from a heading: its section)", group: "Highlight", combo: "Shift+Backspace" },
  // The diagram editor (D103) owns the keyboard while it is open, so its keys only clash with each other.
  // Tools take Excalidraw's letters and numbers, so his muscle memory carries over.
  { id: "d-select", label: "Select", group: "Diagram", combo: "KeyV", scope: "diagram" },
  { id: "d-hand", label: "Hand (pan)", group: "Diagram", combo: "KeyH", scope: "diagram" },
  { id: "d-rectangle", label: "Box", group: "Diagram", combo: "KeyR", scope: "diagram" },
  { id: "d-diamond", label: "Diamond", group: "Diagram", combo: "KeyD", scope: "diagram" },
  { id: "d-ellipse", label: "Ellipse", group: "Diagram", combo: "KeyO", scope: "diagram" },
  { id: "d-arrow", label: "Arrow", group: "Diagram", combo: "KeyA", scope: "diagram" },
  { id: "d-line", label: "Line", group: "Diagram", combo: "KeyL", scope: "diagram" },
  { id: "d-freedraw", label: "Pen", group: "Diagram", combo: "KeyP", scope: "diagram" },
  { id: "d-text", label: "Text", group: "Diagram", combo: "KeyT", scope: "diagram" },
  { id: "d-eraser", label: "Eraser", group: "Diagram", combo: "KeyE", scope: "diagram" },
  { id: "d-lock", label: "Keep the tool after drawing", group: "Diagram", combo: "KeyQ", scope: "diagram" },
  { id: "d-map", label: "Type a map (A -label-> B)", group: "Diagram", combo: "KeyM", scope: "diagram" },
  { id: "d-matrix", label: "Compare matrix", group: "Diagram", combo: "Shift+KeyM", scope: "diagram" },
  { id: "d-child", label: "New linked node (label the link, then the node)", group: "Diagram", combo: "Tab", scope: "diagram" },
  { id: "d-sibling", label: "New node beside this one (same parent)", group: "Diagram", combo: "Shift+Enter", scope: "diagram" },
  { id: "d-link", label: "Link to a node already drawn, by name", group: "Diagram", combo: "Shift+KeyL", scope: "diagram" },
  { id: "d-url", label: "Add or edit link", group: "Diagram", combo: "Shift+Meta+KeyK", scope: "diagram" },
  { id: "d-shape", label: "Change shape", group: "Diagram", combo: "Shift+KeyR", scope: "diagram" },
  { id: "d-tidy", label: "Tidy up the map", group: "Diagram", combo: "Shift+KeyT", scope: "diagram" },
  { id: "d-edit", label: "Edit text of the selection", group: "Diagram", combo: "Enter", scope: "diagram" },
  { id: "d-commands", label: "All diagram commands", group: "Diagram", combo: "Slash", scope: "diagram" },
  { id: "d-help", label: "Diagram shortcuts", group: "Diagram", combo: "Shift+Slash", scope: "diagram" },
  { id: "d-duplicate", label: "Duplicate", group: "Diagram", combo: "Meta+KeyD", scope: "diagram" },
  { id: "d-delete", label: "Delete", group: "Diagram", combo: "Backspace", scope: "diagram" },
  { id: "d-all", label: "Select all", group: "Diagram", combo: "Meta+KeyA", scope: "diagram" },
  { id: "d-group", label: "Group", group: "Diagram", combo: "Meta+KeyG", scope: "diagram" },
  { id: "d-ungroup", label: "Ungroup", group: "Diagram", combo: "Shift+Meta+KeyG", scope: "diagram" },
  { id: "d-forward", label: "Bring forward", group: "Diagram", combo: "Meta+BracketRight", scope: "diagram" },
  { id: "d-backward", label: "Send backward", group: "Diagram", combo: "Meta+BracketLeft", scope: "diagram" },
  { id: "d-front", label: "Bring to front", group: "Diagram", combo: "Shift+Meta+BracketRight", scope: "diagram" },
  { id: "d-back", label: "Send to back", group: "Diagram", combo: "Shift+Meta+BracketLeft", scope: "diagram" },
  { id: "d-align-left", label: "Align left", group: "Diagram", combo: "Shift+Meta+ArrowLeft", scope: "diagram" },
  { id: "d-align-right", label: "Align right", group: "Diagram", combo: "Shift+Meta+ArrowRight", scope: "diagram" },
  { id: "d-align-top", label: "Align top", group: "Diagram", combo: "Shift+Meta+ArrowUp", scope: "diagram" },
  { id: "d-align-bottom", label: "Align bottom", group: "Diagram", combo: "Shift+Meta+ArrowDown", scope: "diagram" },
  { id: "d-align-hcenter", label: "Align centres horizontally", group: "Diagram", combo: "Alt+KeyH", scope: "diagram" },
  { id: "d-align-vcenter", label: "Align centres vertically", group: "Diagram", combo: "Alt+KeyV", scope: "diagram" },
  { id: "d-dist-h", label: "Space evenly across", group: "Diagram", combo: "Alt+Shift+KeyH", scope: "diagram" },
  { id: "d-dist-v", label: "Space evenly down", group: "Diagram", combo: "Alt+Shift+KeyV", scope: "diagram" },
  { id: "d-flip-h", label: "Flip horizontal", group: "Diagram", combo: "Shift+KeyH", scope: "diagram" },
  { id: "d-flip-v", label: "Flip vertical", group: "Diagram", combo: "Shift+KeyV", scope: "diagram" },
  { id: "d-lock-el", label: "Lock or unlock", group: "Diagram", combo: "Shift+Meta+KeyL", scope: "diagram" },
  { id: "d-copy-style", label: "Copy style", group: "Diagram", combo: "Alt+Meta+KeyC", scope: "diagram" },
  { id: "d-paste-style", label: "Paste style", group: "Diagram", combo: "Alt+Meta+KeyV", scope: "diagram" },
  { id: "d-png", label: "Copy as PNG", group: "Diagram", combo: "Alt+Shift+KeyC", scope: "diagram" },
  { id: "d-zoom-in", label: "Zoom in", group: "Diagram", combo: "Meta+Equal", scope: "diagram" },
  { id: "d-zoom-out", label: "Zoom out", group: "Diagram", combo: "Meta+Minus", scope: "diagram" },
  { id: "d-zoom-reset", label: "Zoom to 100%", group: "Diagram", combo: "Meta+Digit0", scope: "diagram" },
  { id: "d-fit", label: "Zoom to fit everything", group: "Diagram", combo: "Shift+Digit1", scope: "diagram" },
  { id: "d-fit-sel", label: "Zoom to the selection", group: "Diagram", combo: "Shift+Digit2", scope: "diagram" },
  { id: "d-grid", label: "Snap to grid", group: "Diagram", combo: "Meta+Quote", scope: "diagram" },
  { id: "d-snap", label: "Snap to other shapes", group: "Diagram", combo: "Alt+KeyS", scope: "diagram" },
  { id: "d-done", label: "Close the diagram (Done)", group: "Diagram", combo: "Meta+Enter", scope: "diagram" },
  { id: "d-expand", label: "Full window, or back to the sheet", group: "Diagram", combo: "Shift+Meta+Enter", scope: "diagram" },
  { id: "d-find", label: "Find text in the diagram", group: "Diagram", combo: "Meta+KeyF", scope: "diagram" },
  { id: "d-style", label: "Style at the pointer (then 1–5 stroke, ⇧1–5 fill, Q W E width, Z X C line, A D F arrow ends)", group: "Diagram", combo: "KeyS", scope: "diagram" },
] as const satisfies readonly Binding[];

export type KeyId = (typeof DEFAULTS)[number]["id"];
export const BINDINGS: readonly (Binding & { id: KeyId })[] = DEFAULTS;

/** Shown in the shortcuts sheet but not editable. */
export const FIXED: { label: string; group: string; keys: string }[] = [
  { label: "Move through sources", group: "Sources", keys: "↑ ↓" },
  { label: "Open source", group: "Sources", keys: "↵" },
  { label: "Pick a run of sources", group: "Sources", keys: "⇧↑ ⇧↓  ⇧-click" },
  { label: "Pick or unpick one source", group: "Sources", keys: "⌘-click" },
  { label: "Pick every source in the list", group: "Sources", keys: "⌘A" },
  { label: "Clear the pick", group: "Sources", keys: "Esc" },
  { label: "Move through posts, open one", group: "Feed", keys: "↑ ↓  ↵" },
  { label: "Back to sources", group: "Reader", keys: "Esc" },
  { label: "Save main point", group: "Reader", keys: "↵" },
  { label: "Move the reading focus, widen it", group: "Reader", keys: "↑ ↓  ⇧↑ ⇧↓" },
  { label: "Clear the reading focus", group: "Reader", keys: "Esc" },
  { label: "Next / previous match in find", group: "Reader", keys: "↵ ⇧↵  ⌘G ⇧⌘G" },
  { label: "Highlight part of a word (no snapping to whole words)", group: "Reader", keys: "⌥ while selecting or dragging" },
  { label: "Highlight a sentence · its paragraph · one word", group: "Reader", keys: "double-click · triple-click · ⌥ double-click" },
  { label: "Save note", group: "Highlight", keys: "↵" },
  { label: "Close", group: "Highlight", keys: "Esc" },
  { label: "How sure: Guess, Think so, Sure", group: "Review", keys: "1 2 3" },
  { label: "Rate: Again, Hard, Good, Easy", group: "Review", keys: "1 2 3 4" },
  { label: "Accept the suggested rating", group: "Review", keys: "↵" },
  { label: "Leave review (ratings are saved)", group: "Review", keys: "Esc" },
  { label: "Tools by number, as in Excalidraw", group: "Diagram", keys: "1–8 0" },
  { label: "Typing a node: next linked node, or the next matrix cell", group: "Diagram", keys: "Tab ⇧Tab" },
  { label: "Typing a node: finish, or a new line", group: "Diagram", keys: "↵ ⇧↵" },
  { label: "New linked node that way", group: "Diagram", keys: "⌘← ⌘→ ⌘↑ ⌘↓" },
  { label: "Go to the nearest node that way", group: "Diagram", keys: "⌥← ⌥→ ⌥↑ ⌥↓" },
  { label: "Nudge the selection (by the grid)", group: "Diagram", keys: "← → ↑ ↓  ⇧" },
  { label: "Copy, cut, paste (as Excalidraw does)", group: "Diagram", keys: "⌘C ⌘X ⌘V" },
  { label: "Pan", group: "Diagram", keys: "Space-drag  scroll" },
  { label: "Zoom", group: "Diagram", keys: "⌘-scroll  pinch" },
  { label: "Copy while dragging", group: "Diagram", keys: "⌥-drag" },
  { label: "Keep proportions, grow from the centre", group: "Diagram", keys: "⇧ ⌥ while resizing" },
  { label: "Straight or 15° steps", group: "Diagram", keys: "⇧ while drawing or turning" },
  { label: "No snapping for this drag", group: "Diagram", keys: "⌘ while dragging" },
  { label: "Finish a line drawn point by point", group: "Diagram", keys: "↵ Esc  double-click" },
  { label: "Clear the selection, then close the diagram", group: "Diagram", keys: "Esc" },
];

const STORE = "ore.keys";
const MODS = ["Ctrl", "Alt", "Shift", "Meta"] as const;
const MOD_KEYS = new Set(["Control", "Alt", "Shift", "Meta", "CapsLock", "Fn"]);

function read(): Record<string, Combo> {
  try {
    return JSON.parse(load(STORE) ?? "{}") as Record<string, Combo>;
  } catch {
    return {};
  }
}

// Read at the end of this module (`kept`), once the rules a saved shortcut must still pass are defined.
let overrides: Record<string, Combo> = {};
let keymap = build();
const listeners = new Set<() => void>();

function build(): Record<KeyId, Combo> {
  return Object.fromEntries(DEFAULTS.map((b) => [b.id, overrides[b.id] ?? b.combo])) as Record<KeyId, Combo>;
}

function commit(next: Record<string, Combo>) {
  overrides = next;
  keymap = build();
  save(STORE, JSON.stringify(overrides));
  for (const f of listeners) f();
}

/** The current key map; re-renders when a binding changes. */
export function useKeymap(): Record<KeyId, Combo> {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    () => keymap,
  );
}

export function comboOf(e: KeyboardEvent): Combo | null {
  if (MOD_KEYS.has(e.key)) return null;
  const mods = [e.ctrlKey && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift", e.metaKey && "Meta"].filter(Boolean);
  return [...mods, e.code].join("+");
}

/** A menu click replays its binding as a keydown carrying its command (menubar.ts). */
export type CommandEvent = KeyboardEvent & { command?: KeyId };

const byId = (id: KeyId) => DEFAULTS.find((x) => x.id === id)!;

/** Whether a keydown runs `id`. A menu click's replay never runs a command its own can't meet (Listen's
 *  L is not the player's L, D195); with no keys, only the command matches. */
export const is = (e: KeyboardEvent, id: KeyId) => {
  const command = (e as CommandEvent).command;
  if (!keymap[id]) return command === id;
  return comboOf(e) === keymap[id] && !(command && command !== id && apart(byId(command), byId(id)));
};

/** Keeps a key press inside a popover or menu (its arrows and letters aren't for the row under it),
 *  but lets ⌘Z and ⇧⌘Z through to the app history, so undo works wherever focus is. */
export const keepKeysIn = (e: { stopPropagation(): void; nativeEvent: KeyboardEvent }) => {
  if (!is(e.nativeEvent, "undo") && !is(e.nativeEvent, "redo")) e.stopPropagation();
};

/** Whether a keydown lands in a text field, where a plain letter is typing. */
export const inTextField = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA");
};

/** The source note's toggle: N like Q for questions, outside text fields; ⇧⌘N, its old binding,
 *  still works anywhere, so he can close the note while typing in it. */
export const isNotes = (e: KeyboardEvent) => (is(e, "notes") && !inTextField(e)) || comboOf(e) === "Shift+Meta+KeyN";

/** As `is`, but also with ⇧ held: ⌘+ is ⇧⌘= on most layouts, and Books takes both. */
export const isLoose = (e: KeyboardEvent, id: KeyId) => is(e, id) || (e.shiftKey && comboOf(e)?.replace("Shift+", "") === keymap[id]);

const SYMBOL: Record<string, string> = { Ctrl: "⌃", Alt: "⌥", Shift: "⇧", Meta: "⌘" };
const KEY: Record<string, string> = {
  Enter: "↵", Backspace: "⌫", Delete: "⌦", Escape: "Esc", Space: "Space", Tab: "Tab",
  ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
  Slash: "/", Backslash: "\\", Comma: ",", Period: ".", Semicolon: ";", Quote: "'",
  BracketLeft: "[", BracketRight: "]", Minus: "-", Equal: "=", Backquote: "`",
};

/** "Meta+Shift+KeyK" → "⇧⌘K" */
export function label(combo: Combo): string {
  if (!combo) return "";
  const parts = combo.split("+");
  const code = parts.pop()!;
  const key = KEY[code] ?? code.replace(/^(Key|Digit|Numpad)/, "");
  return MODS.filter((m) => parts.includes(m)).map((m) => SYMBOL[m]).join("") + key;
}

/** The Mac's own keys (its Edit menu, Quit, Hide): a global shortcut on one would take it from every
 *  text field, so only the command whose default it is may have it (Raycast refuses them too). */
const MAC: Record<Combo, string> = {
  "Meta+KeyA": "Select All", "Meta+KeyC": "Copy", "Meta+KeyX": "Cut", "Meta+KeyV": "Paste", "Meta+KeyZ": "Undo", "Shift+Meta+KeyZ": "Redo",
  "Meta+KeyQ": "Quit", "Meta+KeyW": "Close Window", "Meta+KeyH": "Hide", "Alt+Meta+KeyH": "Hide Others", "Meta+KeyM": "Minimize",
};
/** Fixed keys outside the diagram (FIXED, and the source note's old ⇧⌘N that `isNotes` still takes). */
const APP: Record<Combo, string> = { "Meta+KeyG": "Find's next match", "Shift+Meta+KeyG": "Find's previous match", "Shift+Meta+KeyN": "Toggle source note" };

/** Why `combo` can't go on `id` at all, or null. "" leaves it not assigned (ChatGPT's "Not assigned"). */
export function invalid(id: KeyId, combo: Combo): string | null {
  const b = DEFAULTS.find((x) => x.id === id)!;
  if ("global" in b && combo !== "" && b.global && !/(Ctrl|Alt|Meta)\+/.test(combo)) return "Needs ⌘, ⌃ or ⌥";
  if (combo === b.combo) return null;
  if (combo === "Escape" || combo === "Enter" || combo.startsWith("Arrow")) return `${label(combo)} is reserved`;
  if (MAC[combo]) return `${label(combo)} is the Mac's ${MAC[combo]}`;
  if (APP[combo] && !("scope" in b && b.scope === "diagram")) return `${label(combo)} is ${APP[combo]}`;
  // Review's fixed 1–4 (the rating, and 1–3 for how sure) go before any binding there.
  if (/^Digit[1-4]$/.test(combo) && (IN_REVIEW.has(id) || IN_REVIEW_TOO.has(id))) return `${label(combo)} rates the exercise in Review`;
  return null;
}

/** Review's own commands: they work only in Review, where the app's other keys are off (App.tsx). */
export const IN_REVIEW: ReadonlySet<string> = new Set<KeyId>(["no-idea", "in-head", "later", "edit-card", "retire-card", "ask", "bad-version"]);
/** App keys that work in Review too (⌘↵, the passage arrows, Undo and Redo, by its button and the toast), and the quick quiz, which works from any app. */
const IN_REVIEW_TOO: ReadonlySet<string> = new Set<KeyId>(["finish", "passage-next", "passage-prev", "undo", "redo", "quick-quiz"]);

const scope = (x: Binding) => (x.scope === "diagram" ? "diagram" : IN_REVIEW.has(x.id) ? "review" : "app");
/** A source has sound of its own or it hasn't, so their keys are never live together. */
function apart(x: Binding, y: Binding) {
  return (x.scope === "sound" && y.scope === "silent") || (x.scope === "silent" && y.scope === "sound");
}
/** Whether two bindings can be live at once (the app, Review, the diagram editor, a source with or without sound). */
const meet = (x: Binding, y: Binding) =>
  !apart(x, y) && (scope(x) === scope(y) || (scope(x) !== "diagram" && scope(y) !== "diagram" && (IN_REVIEW_TOO.has(x.id) || IN_REVIEW_TOO.has(y.id))));

/** The binding that already has `combo` where `id` works, if any. */
export function clash(id: KeyId, combo: Combo): (Binding & { id: KeyId }) | null {
  if (!combo) return null;
  const b = byId(id);
  return DEFAULTS.find((x) => x.id !== id && meet(x, b) && keymap[x.id] === combo) ?? null;
}

const put = (next: Record<string, Combo>, id: KeyId, combo: Combo) => {
  const b = DEFAULTS.find((x) => x.id === id)!;
  if (combo === b.combo) delete next[id];
  else next[id] = combo;
};

/** Assigns `combo` to `id`, or returns why it cannot. With `replace`, the binding that had it is left
 *  not assigned. */
export function rebind(id: KeyId, combo: Combo, replace = false): string | null {
  const why = invalid(id, combo);
  if (why) return why;
  const taken = clash(id, combo);
  if (taken && !replace) return `${label(combo)} is used by ${taken.label}`;
  const next = { ...overrides };
  put(next, id, combo);
  if (taken) put(next, taken.id, "");
  commit(next);
  return null;
}

export function resetKeys(): void {
  commit({});
}

/** The changes from the defaults, to put back on undo. */
export const saved = () => ({ ...overrides });
export const restore = (o: Record<string, Combo>) => commit({ ...o });

export const isCustom = (id: KeyId) => id in overrides;
export const defaultOf = (id: KeyId): Combo => DEFAULTS.find((x) => x.id === id)!.combo;

/** The saved shortcuts the rules still allow: one saved before a key was reserved (the palette on ⌘A)
 *  or for a command since removed is dropped, and that command gets its default back. A default that
 *  came later on a key he gave another command (the player's J, D195) gives way: it loads not assigned. */
function kept(saved: Record<string, Combo>): Record<string, Combo> {
  const ok = Object.fromEntries(Object.entries(saved).filter(([id, combo]) => typeof combo === "string" && DEFAULTS.some((b) => b.id === id) && !invalid(id as KeyId, combo)));
  for (const b of DEFAULTS) {
    if (b.id in ok || !b.combo) continue;
    if (DEFAULTS.some((x) => x.id in ok && ok[x.id] === b.combo && meet(x, b))) ok[b.id] = "";
  }
  return ok;
}
overrides = kept(read());
keymap = build();
