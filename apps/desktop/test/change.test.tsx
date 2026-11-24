import { afterEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";

// One change he can take back (change.ts), through the real toasts and history: what shows, what is written and in
// what order, with a write that is slow or fails. The class of F146, F156, F459 to F487, once for every screen.
const w = new Window();
for (const k of ["window", "document", "HTMLElement", "Node", "MutationObserver", "getComputedStyle", "navigator"] as const) {
  const v = (w as unknown as Record<string, unknown>)[k];
  (globalThis as Record<string, unknown>)[k] = typeof v === "function" && /^[a-z]/.test(k) ? (v as (...a: unknown[]) => unknown).bind(w) : v;
}
const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
g.requestAnimationFrame = (fn: (t: number) => void) => setTimeout(() => fn(performance.now()), 16);
g.cancelAnimationFrame = (id: number) => clearTimeout(id);
const { createRoot } = await import("react-dom/client");
const { TooltipProvider } = await import("@radix-ui/react-tooltip");
const { useToast } = await import("../src/Toast");
const { change } = await import("../src/change");

type Toasts = ReturnType<typeof useToast>;
const open = new Set<() => Promise<void>>();
afterEach(async () => {
  for (const done of [...open]) await done();
});
async function mount(): Promise<Toasts> {
  const at = document.createElement("div");
  document.body.appendChild(at);
  const root = createRoot(at);
  let toasts!: Toasts;
  const Host = () => {
    toasts = useToast();
    return <TooltipProvider>{toasts.view}</TooltipProvider>;
  };
  await act(async () => root.render(<Host />));
  const done = async () => {
    open.delete(done);
    await act(async () => root.unmount());
    at.remove();
  };
  open.add(done);
  // The newest render's functions each time, as a screen's props are.
  return new Proxy({} as Toasts, { get: (_, k) => toasts[k as keyof Toasts] });
}

/** A fake library: each write waits until the test lets it land or fail. */
function library() {
  const calls: { what: string; land: () => void; fail: (why: string) => void }[] = [];
  const landed: string[] = [];
  const write = (what: string) =>
    new Promise<void>((land, fail) => calls.push({ what, land: () => (landed.push(what), land()), fail: (why) => fail(new Error(why)) }));
  return { calls, landed, write };
}
const tick = () => act(() => new Promise<void>((r) => setTimeout(r, 0)));
const said = () => [...document.querySelectorAll(".toast")].map((t) => t.textContent ?? "");

test("the change shows at once and ⌘Z during its save takes it back, the inverse written after it", async () => {
  const t = await mount();
  const lib = library();
  const shown: boolean[] = [];
  let reads = 0;
  let ok: boolean | undefined;
  await act(async () => {
    void change(t.notify, { message: "Archived “A”", show: (on) => shown.push(on), write: (on) => lib.write(on ? "archive" : "restore"), settled: () => reads++ }).then((r) => (ok = r));
  });
  expect(shown).toEqual([true]);
  expect(t.history.undoName).toBe("Archived “A”");
  expect(lib.calls.map((c) => c.what)).toEqual(["archive"]);

  await act(async () => t.undo());
  // Off the screen at once; its write waits for the archive.
  expect(shown).toEqual([true, false]);
  expect(lib.calls.map((c) => c.what)).toEqual(["archive"]);
  lib.calls[0]!.land();
  await tick();
  expect(ok).toBe(true);
  expect(lib.calls.map((c) => c.what)).toEqual(["archive", "restore"]);
  // Not read between the two: that read would show the row still archived.
  expect(reads).toBe(0);
  lib.calls[1]!.land();
  await tick();
  expect(reads).toBe(1);

  await act(async () => t.redo());
  expect(shown).toEqual([true, false, true]);
  lib.calls[2]!.land();
  await tick();
  expect(lib.landed).toEqual(["archive", "restore", "archive"]);
  expect(reads).toBe(2);
});

test("a change whose save fails goes back, says why and leaves nothing to undo", async () => {
  const t = await mount();
  const lib = library();
  const shown: boolean[] = [];
  let ok: boolean | undefined;
  await act(async () => {
    void change(t.notify, { message: "Archived “A”", show: (on) => shown.push(on), write: () => lib.write("archive") }).then((r) => (ok = r));
  });
  lib.calls[0]!.fail("The library is locked");
  await tick();
  expect(ok).toBe(false);
  expect(shown).toEqual([true, false]);
  expect(t.history.canUndo).toBe(false);
  expect(said().some((s) => s.includes("The library is locked"))).toBe(true);
  expect(said().some((s) => s.includes("Undo"))).toBe(false);
});

test("⌘Z pressed before a save that then fails writes no inverse", async () => {
  const t = await mount();
  const lib = library();
  const shown: boolean[] = [];
  await act(async () => {
    void change(t.notify, { message: "Archived “A”", show: (on) => shown.push(on), write: (on) => lib.write(on ? "archive" : "restore") });
  });
  await act(async () => t.undo());
  lib.calls[0]!.fail("no");
  await tick();
  expect(lib.calls.map((c) => c.what)).toEqual(["archive"]);
  expect(shown.at(-1)).toBe(false);
  expect(t.history.canUndo).toBe(false);
  expect(t.history.canRedo).toBe(false);
});

test("an undo whose save fails shows the change again and can be tried again", async () => {
  const t = await mount();
  const lib = library();
  const shown: boolean[] = [];
  await act(async () => {
    void change(t.notify, { message: "Archived “A”", show: (on) => shown.push(on), write: (on) => lib.write(on ? "archive" : "restore") });
  });
  lib.calls[0]!.land();
  await tick();
  await act(async () => t.undo());
  lib.calls[1]!.fail("offline");
  await tick();
  expect(shown).toEqual([true, false, true]);
  expect(t.history.undoName).toBe("Archived “A”");
  expect(said().some((s) => s.includes("offline"))).toBe(true);
});

test("two changes to one thing are written in the order he made them", async () => {
  const t = await mount();
  const lib = library();
  await act(async () => {
    void change(t.notify, { message: "Renamed to “B”", kind: "quiet", key: "item-1", write: (on) => lib.write(on ? "title B" : "title A") });
    void change(t.notify, { message: "Renamed to “C”", kind: "quiet", key: "item-1", write: (on) => lib.write(on ? "title C" : "title B") });
  });
  expect(lib.calls.map((c) => c.what)).toEqual(["title B"]);
  lib.calls[0]!.land();
  await tick();
  expect(lib.calls.map((c) => c.what)).toEqual(["title B", "title C"]);
  // A quiet change shows no toast and is still a step.
  expect(said()).toEqual([]);
  expect(t.history.undoName).toBe("Renamed to “C”");
});

test("every write is told to `out` as it is asked for, so a list read begun before it never lands over it", async () => {
  const t = await mount();
  const lib = library();
  const out: Promise<unknown>[] = [];
  await act(async () => {
    void change(t.notify, { message: "Archived “A”", write: (on) => lib.write(on ? "archive" : "restore"), out: (p) => out.push(p) });
  });
  await act(async () => t.undo());
  // The undo's write has not started, and is counted already.
  expect(lib.calls.length).toBe(1);
  expect(out.length).toBe(2);
});

test("⌘Z then ⇧⌘Z before a save that then fails leaves the change off the screen", async () => {
  const t = await mount();
  const lib = library();
  const shown: boolean[] = [];
  await act(async () => {
    void change(t.notify, { message: "Renamed to “B”", kind: "quiet", show: (on) => shown.push(on), write: (on) => lib.write(on ? "title B" : "title A") });
  });
  await act(async () => t.undo());
  await act(async () => t.redo());
  lib.calls[0]!.fail("no");
  await tick();
  // The Redo's turn came after the failure: it shows nothing again.
  expect(shown.slice(1).includes(true)).toBe(false);
  expect(t.history.canRedo).toBe(false);
  expect(lib.calls.map((c) => c.what)).toEqual(["title B"]);
  expect(t.history.canUndo).toBe(false);
});

test("a change of several writes that fails part-way writes back the ones that landed", async () => {
  const { allOrNone } = await import("../src/change");
  const wrote: string[] = [];
  const step = (name: string, fails = false) => async (on: boolean) => {
    if (fails) throw new Error("locked");
    wrote.push(`${name} ${on ? "archive" : "restore"}`);
  };
  await expect(allOrNone([step("a"), step("b"), step("c", true), step("d")], true)).rejects.toThrow("locked");
  expect(wrote).toEqual(["a archive", "b archive", "b restore", "a restore"]);
});
