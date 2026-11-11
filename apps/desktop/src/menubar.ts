import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { BINDINGS, comboOf, IN_REVIEW, type Combo, type CommandEvent, type KeyId } from "./keys";

// The Mac menu bar (Apple's apps, Things): every command with its shortcut, built from the keymap
// so a rebinding updates the menu too, and found by name from Help ▸ Search. A menu click replays
// the binding as a keydown, so it runs exactly the handler the shortcut runs. When a shortcut
// reaches both the page and the menu (macOS offers it to the menu when the page did not
// preventDefault), the second of the two is dropped.

type Item = KeyId | "-" | `@${string}`; // a binding, a separator, or a standard macOS item
type Spec = { title: string; role?: "window" | "help"; when?: "reader" | "review"; items: Item[] };

const MENUS: Spec[] = [
  { title: "Ore", items: ["@about", "-", "settings", "-", "@services", "-", "@hide", "@hide_others", "@show_all", "-", "@quit"] },
  { title: "File", items: ["add", "file", "-", "reveal", "link", "path", "original", "-", "@close_window"] },
  { title: "Edit", items: ["undo", "redo", "-", "@cut", "@copy", "@paste", "@select_all", "-", "filter"] },
  { title: "View", items: ["palette", "sidebar", "side-panel", "notes", "collected", "questions", "-", "@fullscreen"] },
  { title: "Go", items: ["home", "go-feed", "go-toread", "go-done", "-", "nav-back", "nav-forward", "-", "lesson-prev", "lesson-next"] },
  { title: "Source", when: "reader", items: ["finish-source", "section", "look-up", "listen", "rename", "archive"] },
  { title: "Review", items: ["review", "quick-quiz", "-", "no-idea", "in-head", "later", "edit-card", "retire-card", "ask", "bad-version"] },
  { title: "Window", role: "window", items: ["@minimize", "@maximize"] },
  { title: "Help", role: "help", items: ["shortcuts"] },
];

// Review's own commands (IN_REVIEW) only work in Review; the rest of that menu works everywhere.

/** Menu wording where the keymap's label is written for the shortcuts sheet. */
const LABEL: Partial<Record<KeyId, string>> = {
  settings: "Settings…",
  add: "Add Source…",
  file: "Open File…",
  palette: "Command Palette…",
  "side-panel": "Toggle Side Panel",
  notes: "Toggle Note",
  questions: "Your Questions",
  "quick-quiz": "Quick Quiz",
  "finish-source": "Finish Source",
  section: "Main Point of Section…",
  "look-up": "Look Up Word",
  listen: "Listen / Stop Listening",
  rename: "Rename Source…",
  path: "Copy Path",
  shortcuts: "Keyboard Shortcuts",
  ask: "Ask About This Exercise…",
  "edit-card": "Edit Exercise…",
  later: "Later",
};

const binding = (id: KeyId) => BINDINGS.find((b) => b.id === id)!;

/** A menu shows a shortcut only when it has ⌘, ⌃ or ⌥: a plain letter as a menu key would fire
 * while he types. System-wide shortcuts are left off too, or one press would run them twice. */
function accel(id: KeyId, combo: Combo): string | null {
  if (!/(Ctrl|Alt|Meta)\+/.test(combo) || ("system" in binding(id) && binding(id).system)) return null;
  return combo.replace("Meta", "Super");
}

export type Where = { reader: boolean; review: boolean };

export function menuSpec(keymap: Record<KeyId, Combo>, where: Where) {
  return MENUS.map((m) => ({
    title: m.title,
    role: m.role ?? null,
    items: m.items.map((it) => {
      if (it === "-") return { predef: "separator" };
      if (it.startsWith("@")) return { predef: it.slice(1) };
      const id = it as KeyId;
      const enabled = IN_REVIEW.has(id) ? where.review : m.when ? where[m.when] && !where.review : true;
      return { id: `ore:${id}`, label: LABEL[id] ?? binding(id).label, accel: accel(id, keymap[id]), enabled };
    }),
  }));
}

export function setMenu(keymap: Record<KeyId, Combo>, where: Where) {
  void invoke("set_app_menu", { menus: menuSpec(keymap, where) }).catch(() => {});
}

const KEY: Record<string, string> = { BracketLeft: "[", BracketRight: "]", Comma: ",", Slash: "/", Backspace: "Backspace", Enter: "Enter", Space: " " };

/** The keydown a combo stands for, as the page's handlers read it (they match on `code`). */
export function keydownFor(combo: Combo): KeyboardEvent {
  const parts = combo.split("+");
  const code = parts.pop()!;
  const key = KEY[code] ?? (code.startsWith("Arrow") ? code : code.replace(/^(Key|Digit)/, "").toLowerCase());
  return new KeyboardEvent("keydown", {
    code, key, bubbles: true, cancelable: true,
    metaKey: parts.includes("Meta"), ctrlKey: parts.includes("Ctrl"), altKey: parts.includes("Alt"), shiftKey: parts.includes("Shift"),
  });
}

// One key press can arrive as both a keydown and a menu click, within a few milliseconds.
const SAME_PRESS = 120;
let lastKey: { combo: Combo; at: number } | null = null;
let lastMenu: { combo: Combo; at: number } | null = null;

if (typeof window !== "undefined") {
  window.addEventListener(
    "keydown",
    (e) => {
      if (!e.isTrusted) return;
      const combo = comboOf(e);
      if (!combo) return;
      if (lastMenu?.combo === combo && e.timeStamp - lastMenu.at < SAME_PRESS) {
        lastMenu = null;
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      lastKey = { combo, at: e.timeStamp };
    },
    true,
  );
}

/** A plain text field undoes its own typing: Edit ▸ Undo is ours (so a click reaches the app history,
 *  D82), and macOS's own item, which a field's typing undo hangs on, is gone from the menu. */
const textField = (el: Element | null): el is HTMLInputElement | HTMLTextAreaElement =>
  !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA") && !el.hasAttribute("data-app-undo");

/** Runs a menu click as its shortcut, unless the same key press already reached the page. */
export function runMenu(id: KeyId, keymap: Record<KeyId, Combo>, now = performance.now()) {
  // ⌘Z in a field reaches the menu too (the page left it alone), so it is never dropped as a repeat.
  if ((id === "undo" || id === "redo") && textField(document.activeElement)) {
    document.execCommand(id);
    return;
  }
  const combo = keymap[id];
  if (lastKey?.combo === combo && now - lastKey.at < SAME_PRESS) {
    lastKey = null;
    return;
  }
  lastMenu = { combo, at: now };
  // A field ignores plain-key shortcuts, so those go to the page; ⌘, ⌃ and ⌥ ones work where he is.
  const global = "global" in binding(id) && binding(id).global;
  const e: CommandEvent = keydownFor(combo);
  if (!combo) e.command = id; // not assigned: the handler matches the command instead of keys
  // Undo in the note or diagram editor is theirs: the press goes to where he is.
  const here = global || ((id === "undo" || id === "redo") && (document.activeElement as HTMLElement | null)?.isContentEditable);
  ((here && document.activeElement) || document.body).dispatchEvent(e);
}

export function listenMenu(keymap: () => Record<KeyId, Combo>) {
  return listen<string>("menu", (e) => {
    const id = e.payload.replace(/^ore:/, "") as KeyId;
    if (BINDINGS.some((b) => b.id === id)) runMenu(id, keymap());
  });
}
