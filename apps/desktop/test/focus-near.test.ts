import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

// keepFocusNear (focus-near.ts) keeps focus near a row for the one action picked from its menu, then lets go:
// it must never move focus later, after he has done something else (a review long after an archive).
const w = new Window();
const g = globalThis as Record<string, unknown>;
const KEYS = ["window", "document", "HTMLElement", "Element", "Node", "MutationObserver", "getComputedStyle", "navigator", "addEventListener", "removeEventListener", "requestAnimationFrame"] as const;
// Put back as found: later files (the note editor's) set up their own page.
const had = Object.fromEntries(KEYS.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
afterAll(() => {
  for (const k of KEYS) had[k] ? Object.defineProperty(globalThis, k, had[k]!) : delete g[k];
});
for (const k of ["window", "document", "HTMLElement", "Element", "Node", "MutationObserver", "getComputedStyle", "navigator", "addEventListener", "removeEventListener", "requestAnimationFrame"] as const) {
  const v = (w as unknown as Record<string, unknown>)[k];
  g[k] = typeof v === "function" && /^[a-z]/.test(k) ? (v as (...a: unknown[]) => unknown).bind(w) : v;
}
// happy-dom lays nothing out: every element counts as on screen unless it is hidden.
(w.HTMLElement.prototype as unknown as { getClientRects: () => unknown[] }).getClientRects = function (this: HTMLElement) {
  return this.closest("[hidden]") ? [] : [{}];
};
const { keepFocusNear, keepingFocus, focusLimits } = await import("../src/focus-near");

const frames = () => new Promise((r) => setTimeout(r, 40));
const page = () => {
  document.body.innerHTML = `<main><div class="home"><section class="cont">
    <div class="read" id="a"><button>A</button></div><div class="read" id="b"><button>B</button></div><div class="read" id="c"><button>C</button></div>
  </section><section class="skills"><button id="tile">Skill</button></section><button id="other">Other</button></div></main>`;
  return (id: string) => document.getElementById(id) as unknown as HTMLElement;
};
const focused = () => (document.activeElement === document.body ? "body" : document.activeElement?.textContent);

afterEach(() => focusLimits(8000, 120000));

describe("focus after a row's menu action", () => {
  test("a removed row hands focus to the next, then the watch ends", async () => {
    const $ = page();
    keepFocusNear($("b"));
    $("b").remove();
    await frames();
    expect(focused()).toBe("C");
    expect(keepingFocus()).toBe(false);
  });

  test("the last row gone goes to the one before; the only one gone goes to what holds the list", async () => {
    const $ = page();
    keepFocusNear($("c"));
    $("c").remove();
    await frames();
    expect(focused()).toBe("B");
    $("a").remove();
    keepFocusNear($("b"));
    $("b").closest("section")!.remove();
    await frames();
    expect(focused()).toBe("Skill");
  });

  test("a rename field closing puts focus on its row, and only once", async () => {
    const $ = page();
    keepFocusNear($("a"));
    const field = document.createElement("input");
    $("a").append(field);
    field.focus();
    await frames();
    field.remove();
    await frames();
    expect(focused()).toBe("A");
    expect(keepingFocus()).toBe(false);
    ($("other") as HTMLButtonElement).focus();
    ($("other") as HTMLButtonElement).blur();
    $("a").remove();
    await frames();
    expect(focused()).toBe("body");
  });

  test("a press elsewhere ends it: a later removal, or a dialog closing, moves nothing", async () => {
    const $ = page();
    keepFocusNear($("a"));
    $("other").dispatchEvent(new w.PointerEvent("pointerdown", { bubbles: true }) as unknown as Event);
    expect(keepingFocus()).toBe(false);
    const review = document.createElement("div");
    review.setAttribute("role", "dialog");
    review.innerHTML = "<button>Rate</button>";
    document.body.append(review);
    (review.firstChild as HTMLButtonElement).focus();
    review.remove();
    $("a").remove();
    await frames();
    expect(focused()).toBe("body");
  });

  test("a key pressed with focus elsewhere ends it", async () => {
    const $ = page();
    keepFocusNear($("a"));
    ($("other") as HTMLButtonElement).focus();
    w.dispatchEvent(new w.KeyboardEvent("keydown", { key: "k", metaKey: true }));
    await frames();
    expect(keepingFocus()).toBe(false);
  });

  test("an action that changes nothing lets go after its time", async () => {
    const $ = page();
    focusLimits(30, 60);
    keepFocusNear($("a"));
    await new Promise((r) => setTimeout(r, 60));
    expect(keepingFocus()).toBe(false);
    $("a").remove();
    await frames();
    expect(focused()).toBe("body");
  });

  test("its list is the row's own: a row of the same kind in another list is never its neighbour", async () => {
    const $ = page();
    document.querySelector(".skills")!.insertAdjacentHTML("afterbegin", '<div class="read" id="x"><button>X</button></div>');
    keepFocusNear($("c"));
    $("c").remove();
    await frames();
    expect(focused()).toBe("B");
  });

  test("with several rows gone at once, focus goes to the true next survivor", async () => {
    const $ = page();
    keepFocusNear($("a"));
    $("a").remove();
    $("b").remove();
    await frames();
    expect(focused()).toBe("C");
  });

  test("the screen going (he went somewhere) ends it without moving focus", async () => {
    const $ = page();
    keepFocusNear($("a"));
    document.querySelector(".home")!.remove();
    await frames();
    expect(focused()).toBe("body");
    expect(keepingFocus()).toBe(false);
  });
});
