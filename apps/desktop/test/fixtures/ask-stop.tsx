import { strict as assert } from "node:assert";
import { mock } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import type { CardFull } from "../../src/ore";

const w = new Window();
w.document.write("<!doctype html><html><body></body></html>");
for (const k of ["window", "document", "HTMLElement", "Node", "MutationObserver", "ResizeObserver", "getComputedStyle", "navigator"]) {
  const v = (w as unknown as Record<string, unknown>)[k];
  (globalThis as Record<string, unknown>)[k] = typeof v === "function" && /^[a-z]/.test(k) ? v.bind(w) : v;
}
const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
g.requestAnimationFrame = (f: (time: number) => void) => setTimeout(() => f(performance.now()), 1);
g.cancelAnimationFrame = clearTimeout;
let listening!: () => void;
let removed = 0;
const waiting = new Promise<() => void>(r => listening = () => r(() => { removed++; }));
const events: string[] = [];
const ids: string[] = [];
const normal = process.argv[2] === "normal";
mock.module("@tauri-apps/api/event", () => ({ listen: () => waiting }));
mock.module("../../src/ore.ts", () => ({
  ore: async () => ({ id: "ask-exercise", exercise: "exercise", turns: [] }),
  oreWith: async () => {},
  oreJob: async (job: string) => { ids.push(job); events.push("START"); return { reply: "Done.", proposal: null, session: "claude:fake" }; },
  cancelOre: async (job: string) => { ids.push(job); events.push("STOP"); },
  opt: (k: string, v: string) => `--${k}=${v}`,
}));
const { Ask, useAskChats } = await import("../../src/Ask.tsx");
const { createRoot } = await import("react-dom/client");
const { TooltipProvider } = await import("@radix-ui/react-tooltip");
let state: ReturnType<typeof useAskChats>["chats"][string] | undefined;
function Host() {
  const asks = useAskChats((message) => { throw new Error(message); });
  state = asks.chats.exercise;
  return <TooltipProvider><Ask
    card={{ id: "exercise", question: "What helps?", answer: "Recall.", rubric: [], kind: "card" } as CardFull}
    answer="Recall" store={asks} onApply={async () => {}} onClose={() => {}}
  /></TooltipProvider>;
}
const at = document.createElement("div");
document.body.appendChild(at);
const root = createRoot(at);
try {
  await act(async () => root.render(<Host />));
  await act(async () => { [...document.querySelectorAll("button")].find(b => b.textContent === "Why is this the answer?")!.click(); });
  assert.ok(state?.run, "the request waits for its progress listener");
  const job = state.run.id;
  if (!normal) {
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Stop the reply"]')!.click());
    assert.equal(state.run, undefined);
    assert.equal(state.turns.at(-1)?.error, "Stopped.");
  }
  await act(async () => { listening(); });
  assert.deepEqual(events, normal ? ["START"] : ["STOP"], "a stopped request never starts after its listener resolves");
  assert.deepEqual(ids, [job]);
  if (normal) assert.equal(state.turns.at(-1)?.reply, "Done.");
  assert.equal(removed, 1, "the progress listener is removed on cancellation and completion");
} finally {
  await act(async () => root.unmount());
  w.happyDOM.abort();
}
