import { expect, test } from "bun:test";
import { Window } from "happy-dom";

// useSideWidth headless: the width he chose survives a window that shrinks and grows again, and a stored
// width outside the bounds is clamped.
const w = new Window({ width: 1280, height: 800 });
for (const k of ["window", "document", "HTMLElement", "Node", "MutationObserver", "getComputedStyle", "navigator", "localStorage"] as const) {
  const v = (w as unknown as Record<string, unknown>)[k];
  (globalThis as Record<string, unknown>)[k] = typeof v === "function" && /^[a-z]/.test(k) ? (v as (...a: unknown[]) => unknown).bind(w) : v;
}
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { useSideWidth, setSidebarShown } = await import("../src/Notes");

const resize = (width: number) => act(async () => w.happyDOM.setViewport({ width, height: 800 }));

async function mount(key: string, initial: number, min: number, opts?: Parameters<typeof useSideWidth>[3]) {
  let width = 0;
  const Probe = () => {
    width = useSideWidth(key, initial, min, opts).width;
    return null;
  };
  const root = createRoot(document.createElement("div") as unknown as Element);
  await act(async () => root.render(React.createElement(Probe)));
  return { width: () => width, unmount: () => act(async () => root.unmount()) };
}

test("a narrow window clamps the sidebar, and widening it again brings back the width he chose", async () => {
  await resize(1280);
  localStorage.setItem("ore.sidebarwidth", "340");
  const side = await mount("ore.sidebarwidth", 216, 180, { left: true, share: 0.4, cap: 360 });
  expect(side.width()).toBe(340);
  await resize(720);
  expect(side.width()).toBe(288);
  await resize(1280);
  expect(side.width()).toBe(340);
  await side.unmount();
});

test("the note panel keeps its chosen width through a narrow window too", async () => {
  await resize(1280);
  localStorage.setItem("ore.notewidth", "700");
  const note = await mount("ore.notewidth", 380, 280);
  expect(note.width()).toBe(700);
  await resize(900);
  expect(note.width()).toBe(540);
  await resize(1280);
  expect(note.width()).toBe(700);
  await note.unmount();
});

test("a stored width below the min comes back at the min", async () => {
  await resize(1280);
  localStorage.setItem("ore.tutorwidth", "40");
  const tutor = await mount("ore.tutorwidth", 380, 300);
  expect(tutor.width()).toBe(300);
  await tutor.unmount();
});

test("a wider sidebar takes its extra room from a right-hand panel's max", async () => {
  await resize(1100);
  localStorage.setItem("ore.notewidth", "2000");
  const note = await mount("ore.notewidth", 380, 280);
  expect(note.width()).toBe(660);
  await act(async () => setSidebarShown(360));
  expect(note.width()).toBe(516);
  await act(async () => setSidebarShown(0));
  expect(note.width()).toBe(660);
  await note.unmount();
});
