import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import { lineKey, type Line } from "../src/lines";
import { lastKey, trackInput } from "../src/input-mode";

const w = new Window();
for (const k of ["window", "document", "HTMLElement", "Node", "navigator"] as const) (globalThis as any)[k] = (w as any)[k];
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
trackInput(document);
const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");

// Run the actual shared list's props in isolation, as focus-reload.test.ts does for App's loaders.
// No mock of the focus handler: this is also the integration guard for its wiring in App.
const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const start = source.indexOf('<div\n      className="list"');
const end = source.indexOf("\n    >", start);
if (start < 0 || end < 0) throw new Error("Shared source list opening tag not found");
const code = new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react" } } })
  .transformSync(`return (${source.slice(start, end)} />);`);
const draw = new Function("React", "listRef", "TABS", "status", "keyed", "currentLine", "lineKey", "onListKey", "setKeyed", "setCursor", "lastKey", code);
const row = (id: string) => ({ kind: "item", item: { id } }) as Line;

async function list(currentLine: Line | undefined, keyboard = true) {
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  let cursor: string | null = null;
  const scrolled: string[] = [];
  const Probe = () => {
    const [keyed, setKeyed] = React.useState(false);
    const listRef = React.useRef(null);
    return React.cloneElement(draw(React, listRef, [], "toread", keyed, currentLine, lineKey, () => {}, setKeyed, (id: string) => { cursor = id; }, lastKey), {},
      <div id={currentLine ? `row-${lineKey(currentLine)}` : "empty"} ref={(el) => { if (el) el.scrollIntoView = () => { scrolled.push(el.id); }; }}><button>Row actions</button></div>);
  };
  await act(async () => root.render(<Probe />));
  document.dispatchEvent(keyboard ? new w.KeyboardEvent("keydown", { key: "Tab", bubbles: true }) as unknown as Event : new w.Event("pointerdown", { bubbles: true }) as unknown as Event);
  const group = host.querySelector<HTMLElement>(".list")!;
  return { group, scrolled, cursor: () => cursor, close: async () => { await act(async () => root.unmount()); host.remove(); } };
}

test("Tab entering a source list makes its first or last-current row visible and current (F547)", async () => {
  for (const id of ["first", "last-current"]) {
    const a = await list(row(id));
    try {
      await act(async () => a.group.focus());
      expect(a.group.getAttribute("aria-activedescendant")).toBe(`row-${id}`);
      expect(a.cursor()).toBe(id);
      expect(a.scrolled).toEqual([`row-${id}`]);
    } finally { await a.close(); }
  }
});

test("pointer entry, child controls and an empty source list do not select a row (F547)", async () => {
  for (const [line, keyboard, child] of [[row("first"), false, false], [row("first"), true, true], [undefined, true, false]] as const) {
    const a = await list(line, keyboard);
    try {
      await act(async () => (child ? a.group.querySelector("button")! : a.group).focus());
      expect(a.group.hasAttribute("aria-activedescendant")).toBe(false);
      expect(a.cursor()).toBeNull();
      expect(a.scrolled).toEqual([]);
    } finally { await a.close(); }
  }
});
