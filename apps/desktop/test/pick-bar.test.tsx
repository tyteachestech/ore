import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot } from "react-dom/client";

const w = new Window();
for (const k of ["window", "document", "HTMLElement", "Node", "navigator", "localStorage"] as const) {
  const v = (w as unknown as Record<string, unknown>)[k];
  (globalThis as Record<string, unknown>)[k] = typeof v === "function" && /^[a-z]/.test(k) ? (v as (...a: unknown[]) => unknown).bind(w) : v;
}
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
import { HintProvider } from "../src/Hint";
import { PickBar } from "../src/PickBar";

// D283: while several sources are picked, a bar says how many and offers what fits them all.
const run = () => {};
const html = (actions: { id: string; label: string; sub?: unknown[] }[]) => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el as unknown as Element);
  act(() => root.render(<HintProvider><PickBar n={3} actions={actions.map((a) => ({ run, ...a })) as never} onClear={run} /></HintProvider>));
  const out = el.innerHTML;
  act(() => root.unmount());
  return out;
};

test("the bar counts the pick and offers Done, Skills and Archive", () => {
  const out = html([{ id: "done", label: "Move 3 sources to Done" }, { id: "skills", label: "Skills", sub: [{ id: "ai", label: "AI", run }] }, { id: "archive", label: "Archive 3 sources" }]);
  expect(out).toContain("3 picked");
  expect(out).toContain(">Done<");
  expect(out).toContain("Skills");
  expect(out).toContain(">Archive<");
  expect(out).toContain('aria-label="Clear the pick"');
});

test("a pick already done offers To read; an archived one only Restore", () => {
  expect(html([{ id: "toread", label: "Move 3 sources to To read" }])).toContain(">To read<");
  const archived = html([{ id: "restore", label: "Restore 3 sources" }]);
  expect(archived).toContain(">Restore<");
  expect(archived).not.toContain(">Archive<");
});

test("picked rows that touch join into one block", () => {
  const css = readFileSync(join(import.meta.dir, "../src/styles.css"), "utf8");
  expect(css).toContain(".row.sel:has(+ .row.sel) { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }");
  expect(css).toContain(".row.sel + .row.sel { border-top-left-radius: 0; border-top-right-radius: 0; }");
});

test("the pick bar hides under the palette, Settings, Add, a dialog and Review", () => {
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  expect(app).toContain("!openId && !overlay && many.length > 1 && <PickBar");
});
