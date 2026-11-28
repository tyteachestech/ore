import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import type { Reveal } from "../src/Finish";
import type { Doc } from "../src/ore";

test("Finish links both key points to one shared passage (F-new-finish-shared-passage)", async () => {
  const w = new Window();
  w.document.write("<!doctype html><html><body></body></html>");
  const globals = [
    "window", "document", "HTMLElement", "Element", "Node", "navigator", "localStorage", "ResizeObserver",
    "getComputedStyle", "addEventListener", "removeEventListener", "requestAnimationFrame", "cancelAnimationFrame",
    "IS_REACT_ACT_ENVIRONMENT",
  ] as const;
  const g = globalThis as Record<string, unknown>;
  const previous = globals.map((key) => Object.getOwnPropertyDescriptor(g, key));
  for (const key of globals) {
    const value = (w as unknown as Record<string, unknown>)[key];
    Object.defineProperty(g, key, {
      configurable: true, writable: true,
      value: key === "IS_REACT_ACT_ENVIRONMENT" ? true : typeof value === "function" && /^[a-z]/.test(key) ? value.bind(w) : value,
    });
  }
  const [{ createRoot }, { Finish }, { HintProvider }] = await Promise.all([
    import("react-dom/client"), import("../src/Finish"), import("../src/Hint"),
  ]);
  const shared = "Cuando era joven trabajó como enfermera en un hospital.";
  const other = "Ahora vive en Barcelona.";
  const body = `${shared}\n\n${other}`;
  const quote = (exact: string) => {
    const start = body.indexOf(exact);
    return { exact, prefix: "", suffix: "", start, end: start + exact.length };
  };
  const question = {
    q: "What did your grandmother do when she was young, and where does she live now?",
    after: body,
    points: [
      { text: "When she was young", evidence: [quote(shared)] },
      { text: "Worked as a nurse", evidence: [quote(shared)] },
      { text: "Lives in Barcelona", evidence: [quote(other)] },
    ],
  };
  const doc = { id: "finish-shared-passage", title: "Mi familia", body, skills: [], prequestions: [question] } as Doc;
  Object.assign(w, {
    __TAURI_INTERNALS__: {
      invoke: async (_cmd: string, { args }: { args: string[] }) => {
        if (args[0] === "prequestion") return question;
        if (args[0] === "check") return { ...question, check: { covered: [true, true, true] } };
        throw new Error(`Unexpected ore command: ${args[0]}`);
      },
    },
  });
  const at = document.createElement("div");
  document.body.append(at);
  const root = createRoot(at);
  const reveals: Reveal[] = [];
  const button = (text: string) => [...at.querySelectorAll("button")].find((el) => el.textContent?.startsWith(text))!;
  const click = (text: string) => act(async () => { button(text).click(); });
  const current = () => {
    const reveal = reveals.at(-1);
    return reveal?.quotes[reveal.at]?.exact;
  };
  try {
    await act(async () => root.render(<HintProvider><Finish
      doc={doc} blocked={false} setReveal={(r) => reveals.push(r)}
      onCancel={() => {}} onDone={() => {}} flushNotes={async () => true} onNotes={() => {}}
      notify={(message) => { throw new Error(message); }}
    /></HintProvider>));
    await click("Skip to questions");
    await click("Check");
    expect(at.textContent).toContain("You got it");
    expect(reveals.at(-1)?.quotes.map((e) => e.exact)).toEqual([shared, other]);
    for (const text of ["When she was young", "Worked as a nurse"]) {
      expect(button(text).textContent).toBe(text);
      expect(button(text).disabled).toBe(false);
      await click("Lives in Barcelona");
      expect(current()).toBe(other);
      await click(text);
      expect(current()).toBe(shared);
    }
  } finally {
    await act(async () => root.unmount());
    for (const [i, key] of globals.entries()) {
      const descriptor = previous[i];
      if (descriptor) Object.defineProperty(g, key, descriptor);
      else delete g[key];
    }
    await w.happyDOM.abort();
  }
});
