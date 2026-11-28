import { expect, test } from "bun:test";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { Window } from "happy-dom";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { comingBackHome, Home } from "../src/Home";
import { lastToday, rememberToday } from "../src/ReviewPick";
import type { Item, Today } from "../src/ore";

test("Home returns focus to a clicked source and falls back after skills load", async () => {
  const w = new Window();
  const globals = [
    "window", "document", "HTMLElement", "Element", "Node", "navigator", "localStorage", "CSS", "ResizeObserver", "MutationObserver",
    "getComputedStyle", "addEventListener", "removeEventListener", "requestAnimationFrame", "cancelAnimationFrame",
    "matchMedia", "IS_REACT_ACT_ENVIRONMENT",
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
  const remembered = lastToday();
  const item = { id: "source", title: "Retrieval practice", status: "reading", type: "article", words: 300, skills: [] } as Item;
  let today = {
    goal_minutes: 10, goal_ms: 600_000, active_ms: 0, counts: true, due: 1,
    skills: [{ skill: "missing", due: 1 }], week: [], unreadable: [],
  } as Today;
  Object.assign(w, { __TAURI_INTERNALS__: { invoke: async () => today } });
  const slot = document.createElement("div");
  document.body.append(slot);
  const root = createRoot(slot);
  function Screen({ skillsLoading }: { skillsLoading: boolean }) {
    const [open, setOpen] = useState(false);
    return open ? <button onClick={() => { comingBackHome(); setOpen(false); }}>Back</button> : (
      <Home items={[item]} recent={[item.id]} skills={[]} skillsLoading={skillsLoading} reload={0}
        onReview={() => {}} onOpenSource={() => setOpen(true)} onOpenSkill={() => {}} onSettings={() => {}} notify={() => {}} />
    );
  }
  const render = (skillsLoading: boolean) => act(async () => root.render(<TooltipProvider><Screen skillsLoading={skillsLoading} /></TooltipProvider>));
  try {
    rememberToday(today);
    await render(true);
    expect(document.activeElement).toBe(document.body);
    await render(false);
    expect(document.activeElement?.textContent).toBe("Plan when you review");
    today = { ...today, skills: [] };
    await act(async () => { slot.querySelector<HTMLButtonElement>(".home-read .home-open")!.click(); });
    await act(async () => { slot.querySelector<HTMLButtonElement>("button")!.click(); });
    expect(document.activeElement?.textContent).toBe(item.title);
  } finally {
    await act(async () => root.unmount());
    if (remembered) rememberToday(remembered);
    await w.happyDOM.close();
    globals.forEach((key, i) => {
      if (previous[i]) Object.defineProperty(g, key, previous[i]!);
      else delete g[key];
    });
  }
});
