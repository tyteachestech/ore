import { mock } from "bun:test";
import { Window } from "happy-dom";
import { act, useState } from "react";
import { strict as assert } from "node:assert";
import { rmSync } from "node:fs";
import { addText } from "../../../../packages/core/src/ingest/index.ts";
import { writeNewCard, findCard } from "../../../../packages/core/src/cards.ts";
import { tempLibrary } from "../../../../packages/core/test/helpers.ts";
import { studyCommands } from "../../../../packages/cli/src/cmd-study.ts";
import type { CardFull } from "../../src/ore";

const lib = await tempLibrary();
process.env.ORE_LIBRARY = lib.root;
const item = await addText(lib, "# Learning\n\nRecall helps memory.");
const original = { vendor: "claude", model: "first-author", prompt_version: "enrich@25" };
const card = writeNewCard(lib, { item: item.meta.id, kind: "card", skills: [], topics: [], content_type: "fact", question: "What helps?", answer: "Recall.", rubric: [], ai: original });
const result = {
  reply: "Try this wording.", proposal: { question: "What strengthens memory?", answer: "Retrieval practice." },
  session: "codex:rewrite", ai: { vendor: "codex", model: "rewrite-author", prompt_version: "chat@2" },
};
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
mock.module("../../src/ore.ts", () => ({ oreJob: async () => result, cancelOre: async () => {}, opt: (k: string, v: string) => `--${k}=${v}` }));
mock.module("@tauri-apps/api/event", () => ({ listen: async () => () => {} }));
const { Ask, NO_ASK } = await import("../../src/Ask.tsx");
const { createRoot } = await import("react-dom/client");
const { TooltipProvider } = await import("@radix-ui/react-tooltip");
let apply: Promise<unknown> | undefined;
function Host() {
  const [chat, setChat] = useState(NO_ASK);
  return <TooltipProvider><Ask
    card={{ ...card.meta, question: card.question, answer: card.answer, rubric: [] } as CardFull}
    answer="Recall" chat={chat} setChat={setChat} onClose={() => {}}
    onApply={async p => {
      apply = studyCommands.card!.run(["set", card.meta.id], { question: p.question, answer: p.answer, ai: JSON.stringify(p.ai) });
      await apply;
    }}
  /></TooltipProvider>;
}
const at = document.createElement("div");
document.body.appendChild(at);
const root = createRoot(at);
try {
  await act(async () => root.render(<Host />));
  const button = [...document.querySelectorAll("button")].find(b => b.textContent === "Make this exercise clearer")!;
  await act(async () => { button.click(); });
  const use = [...document.querySelectorAll("button")].find(b => b.textContent === "Use this exercise")!;
  assert.ok(use, "Ask offers the proposed wording");
  await act(async () => { use.click(); await apply; });
  const saved = findCard(lib, card.meta.id);
  assert.equal(saved.question, result.proposal.question);
  assert.deepEqual(saved.meta.ai, result.ai, "applying an AI rewrite must retain who wrote the new text");
} finally {
  await act(async () => root.unmount());
  w.happyDOM.abort();
  rmSync(lib.root, { recursive: true, force: true });
}
