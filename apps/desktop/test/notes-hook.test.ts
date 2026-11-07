import { expect, test } from "bun:test";
import { Window } from "happy-dom";

// useNotes headless: the `ore` CLI answered through Tauri's invoke bridge, rendered with React.
const w = new Window();
for (const k of ["window", "document", "HTMLElement", "Node", "MutationObserver", "getComputedStyle", "navigator"] as const) {
  const v = (w as unknown as Record<string, unknown>)[k];
  (globalThis as Record<string, unknown>)[k] = typeof v === "function" && /^[a-z]/.test(k) ? (v as (...a: unknown[]) => unknown).bind(w) : v;
}
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const disk: Record<string, string> = { a: "note A", b: "note B" };
const calls: string[][] = [];
/** How long the mocked CLI takes to answer (ms): a real `ore notes` call outlives a React commit. */
let slow = 0;
/** Saves (`--set`) fail while true: a full disk, a synced folder that went away. */
let failSets = false;
(w as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
  invoke: async (_cmd: string, { args }: { args: string[] }) => {
    calls.push(args);
    if (slow) await new Promise((r) => setTimeout(r, slow));
    const [, id, set] = args;
    if (failSets && set?.startsWith("--set=")) throw "disk full";
    if (set?.startsWith("--set=")) disk[id!] = set.slice(6);
    return { text: disk[id!], dir: `/lib/${id}`, merged: false };
  },
};

const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { useSourceNote } = await import("../src/Notes");
type Notes = ReturnType<typeof useSourceNote>;

test("switching notes drops the last one's draft and loads the new one", async () => {
  let notes!: Notes;
  const Probe = ({ id }: { id: string }) => {
    notes = useSourceNote(id, () => {});
    return null;
  };
  const root = createRoot(document.createElement("div") as unknown as Element);
  await act(async () => root.render(React.createElement(Probe, { id: "a" })));
  expect(notes.text).toBe("note A");
  await act(async () => notes.edit("note A, edited"));
  await act(async () => root.render(React.createElement(Probe, { id: "b" })));
  await act(async () => new Promise((r) => setTimeout(r, 0)));
  expect(disk.a).toBe("note A, edited"); // leaving A saved its draft to A
  expect(notes.text).toBe("note B");
  await act(async () => notes.flush());
  expect(disk.b).toBe("note B"); // A's draft never lands in B
  expect(calls.some((c) => c[1] === "b" && c[2]?.startsWith("--set="))).toBe(false);
  await act(async () => root.unmount());
});

test("a save queued behind another is based on what the first one wrote", async () => {
  let notes!: Notes;
  const Probe = ({ id }: { id: string }) => {
    notes = useSourceNote(id, () => {});
    return null;
  };
  disk.c = "hello";
  calls.length = 0;
  const root = createRoot(document.createElement("div") as unknown as Element);
  await act(async () => root.render(React.createElement(Probe, { id: "c" })));
  await act(async () => {
    notes.edit("helo");
    const first = notes.flush(); // in flight while he keeps typing
    notes.edit("hello there");
    await Promise.all([first, notes.flush()]);
  });
  const sets = calls.filter((c) => c[1] === "c" && c[2]?.startsWith("--set="));
  expect(sets.map((c) => c[3])).toEqual(["--base=hello", "--base=helo"]);
  expect(notes.text).toBe("hello there");
  await act(async () => root.unmount());
});

test("leaving a note with two saves in flight bases the second on the first", async () => {
  let notes!: Notes;
  const Probe = ({ id }: { id: string }) => {
    notes = useSourceNote(id, () => {});
    return null;
  };
  disk.d = "hello";
  calls.length = 0;
  const root = createRoot(document.createElement("div") as unknown as Element);
  await act(async () => root.render(React.createElement(Probe, { id: "d" })));
  slow = 10;
  await act(async () => {
    notes.edit("helo");
    void notes.flush(); // in flight
    notes.edit("hello there");
  });
  // Switching notes saves the second behind the first; the switch must not lose what the first wrote.
  await act(async () => root.render(React.createElement(Probe, { id: "b" })));
  await act(async () => new Promise((r) => setTimeout(r, 60)));
  slow = 0;
  const sets = calls.filter((c) => c[1] === "d" && c[2]?.startsWith("--set="));
  expect(sets.map((c) => c[3])).toEqual(["--base=hello", "--base=helo"]);
  expect(disk.d).toBe("hello there");
  await act(async () => root.unmount());
});

test("coming back to a note while its saves are in flight shows what they wrote", async () => {
  let notes!: Notes;
  const Probe = ({ id }: { id: string }) => {
    notes = useSourceNote(id, () => {});
    return null;
  };
  disk.e = "hello";
  calls.length = 0;
  const root = createRoot(document.createElement("div") as unknown as Element);
  await act(async () => root.render(React.createElement(Probe, { id: "e" })));
  slow = 10;
  await act(async () => {
    notes.edit("helo");
    void notes.flush(); // in flight
    notes.edit("hello there");
  });
  // Away and straight back: the load must not read the file before his saves land.
  await act(async () => root.render(React.createElement(Probe, { id: "b" })));
  await act(async () => root.render(React.createElement(Probe, { id: "e" })));
  await act(async () => new Promise((r) => setTimeout(r, 80)));
  slow = 0;
  expect(disk.e).toBe("hello there");
  expect(notes.text).toBe("hello there");
  await act(async () => notes.edit("hello there!"));
  await act(async () => notes.flush());
  const sets = calls.filter((c) => c[1] === "e" && c[2]?.startsWith("--set="));
  expect(sets.map((c) => c[3])).toEqual(["--base=hello", "--base=helo", "--base=hello there"]);
  await act(async () => root.unmount());
});

test("an append after a failed save keeps his unsaved text", async () => {
  let notes!: Notes;
  const Probe = ({ id }: { id: string }) => {
    notes = useSourceNote(id, () => {});
    return null;
  };
  disk.f = "start";
  const root = createRoot(document.createElement("div") as unknown as Element);
  await act(async () => root.render(React.createElement(Probe, { id: "f" })));
  failSets = true;
  await act(async () => notes.edit("start, then my words"));
  let ok = true;
  await act(async () => {
    ok = await notes.append("recall", "Recall");
  });
  failSets = false;
  expect(ok).toBe(false); // nothing appended over a draft that isn't on disk
  expect(notes.text).toBe("start, then my words");
  await act(async () => notes.flush());
  expect(disk.f).toBe("start, then my words");
  await act(async () => root.unmount());
});

test("leaving a note whose save failed keeps the draft for when he comes back", async () => {
  let notes!: Notes;
  const Probe = ({ id }: { id: string }) => {
    notes = useSourceNote(id, () => {});
    return null;
  };
  disk.g = "start";
  const root = createRoot(document.createElement("div") as unknown as Element);
  await act(async () => root.render(React.createElement(Probe, { id: "g" })));
  failSets = true;
  await act(async () => notes.edit("start, unsaved"));
  await act(async () => root.render(React.createElement(Probe, { id: "b" })));
  await act(async () => new Promise((r) => setTimeout(r, 0)));
  failSets = false;
  await act(async () => root.render(React.createElement(Probe, { id: "g" })));
  await act(async () => new Promise((r) => setTimeout(r, 0)));
  expect(notes.text).toBe("start, unsaved");
  await act(async () => new Promise((r) => setTimeout(r, 0)));
  expect(disk.g).toBe("start, unsaved"); // saved again once it can be
  await act(async () => root.unmount());
});
