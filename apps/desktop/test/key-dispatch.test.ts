import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { inTextField, is, keepKeysIn, rebind, resetKeys, reviewDigit } from "../src/keys";

// Execute the production callbacks with explicit component state. No React effects, browser,
// AI or library writes. This tests dispatch; native composition delivery needs a device check.
function callback(file: string, start: string, end: string, scope: Record<string, unknown>, after = "") {
  const source = readFileSync(new URL(`../src/${file}.tsx`, import.meta.url), "utf8");
  const from = source.indexOf(start, after ? source.indexOf(after) : 0);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw Error(`Missing ${file} callback`);
  const js = new Bun.Transpiler({ loader: "tsx" }).transformSync(`const fn = ${source.slice(from + start.length, to + (start === "onKeyDown={" ? 1 : 0))};`);
  return new Function(...Object.keys(scope), `${js}; return fn;`)(...Object.values(scope));
}
function event(key: string, extra: Record<string, unknown> = {}) {
  const e = { key, code: key, keyCode: 0, repeat: false, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false,
    isComposing: false, defaultPrevented: false, stopPropagation() {}, preventDefault() { this.defaultPrevented = true; }, ...extra };
  return Object.assign(e, { nativeEvent: e });
}
const surface = { tagName: "DIV", contains: () => false, closest: () => null };
function review(scope: Record<string, unknown> = {}) {
  return callback("Review", "keyRef.current = ", ";\n  useEffect", {
    paused: false, under: false, root: { current: surface }, document: { body: surface, querySelectorAll: () => [] },
    is, inTextField, reviewDigit, s: { busy: false }, phase: "checked", asking: false, end: null, quick: false,
    card: { id: "A", kind: "card" }, shownAnswerAt: { current: Date.now() - 1000 }, suggested: 3, PHONE: false, passage: null,
    ...scope,
  });
}
afterEach(() => resetKeys());

describe("KEYS-01 composition stays in text editing", () => {
  for (const composition of [{ isComposing: true, keyCode: 13 }, { isComposing: false, keyCode: 229 }]) {
    test(`Add, Tutor, Review and TitleField ignore composition commands ${JSON.stringify(composition)}`, () => {
      const calls: string[] = [];
      const add = callback("Add", "onKeyDown={", "}}\n", { is, go: () => calls.push("add"), skillsRef: { current: null }, onClose: () => calls.push("close add") });
      const tutor = callback("Tutor", "onKeyDown={", "}}\n", { at: null, input: "日本", send: () => calls.push("send"), files: [], busy: false, lastTurn: null }, 'aria-label="Message the tutor"');
      const settled = { current: false };
      const title = callback("TitleField", "onKeyDown={", "}}\n", { keepKeysIn, busy: { current: false }, settled, onClose: () => calls.push("close title"), commit: () => calls.push("save") });
      const onReview = review({ phase: "answer", s: { busy: false, finish: () => calls.push("finish") } });
      for (const key of ["Enter", "Escape"]) {
        for (const on of [add, tutor, title, onReview]) {
          const e = event(key, { ...composition, target: { tagName: "TEXTAREA" } });
          on(e);
          expect(e.defaultPrevented).toBe(false);
        }
      }
      expect(settled.current).toBe(false);
      expect(calls).toEqual([]);
      add(event("Enter"));
      tutor(event("Enter"));
      title(event("Enter"));
      onReview(event("Escape"));
      expect(calls).toEqual(["add", "send", "save", "finish"]);
    });
  }
  test("Tutor's mention picker leaves composing navigation and confirmation to the IME", () => {
    const calls: string[] = [];
    const on = callback("Tutor", "onKeyDown={", "}}\n", {
      at: {}, matches: ["source"], pick: 0, input: "日本", files: [], busy: false, lastTurn: null,
      setPick: () => calls.push("pick"), choose: () => calls.push("choose"), setAt: () => calls.push("close"), send: () => calls.push("send"),
    }, 'aria-label="Message the tutor"');
    for (const key of ["Enter", "Tab", "ArrowDown", "Escape"]) on(event(key, { keyCode: 229 }));
    expect(calls).toEqual([]);
    on(event("Enter"));
    expect(calls).toEqual(["choose"]);
  });
});

describe("KEYS-03 modified Review shortcuts", () => {
  for (const [modifier, flag] of [["Meta", "metaKey"], ["Ctrl", "ctrlKey"], ["Alt", "altKey"], ["Shift", "shiftKey"]]) {
    test(`accepted ${modifier} shortcuts reach every checked-answer action`, () => {
      for (const id of ["edit-card", "ask", "bad-version", "passage-next", "passage-prev"] as const) {
        resetKeys();
        expect(rebind(id, `${modifier}+KeyE`, true)).toBeNull();
        const calls: string[] = [];
        const on = review({ card: { id: "A", kind: "card", variant: "v1" }, passage: { quotes: [1, 2, 3] },
          edit: () => calls.push("edit-card"), setAsking: () => calls.push("ask"), badVersion: () => calls.push("bad-version"),
          setQuoteAt: (next: (i: number) => number) => calls.push(next(1) === 2 ? "passage-next" : "passage-prev"),
        });
        on(event("e", { code: "KeyE", [flag!]: true, target: surface }));
        expect(calls).toEqual([id]);
      }
    });
  }
  test("modified shortcuts keep text focus, repeat and answer-delay protection; fixed ratings stay unmodified", () => {
    resetKeys();
    expect(rebind("edit-card", "Meta+KeyE")).toBeNull();
    let edits = 0, ratings = 0;
    const scope = { edit: () => edits++, rate: () => ratings++ };
    const on = review(scope);
    on(event("e", { code: "KeyE", metaKey: true, target: { tagName: "TEXTAREA" } }));
    on(event("e", { code: "KeyE", metaKey: true, repeat: true, target: surface }));
    review({ ...scope, shownAnswerAt: { current: Date.now() } })(event("e", { code: "KeyE", metaKey: true, target: surface }));
    for (const flag of ["metaKey", "ctrlKey", "altKey"]) {
      on(event("3", { code: "Digit3", [flag]: true, target: surface }));
      on(event("Enter", { [flag]: true, target: surface }));
    }
    expect(edits).toBe(0);
    expect(ratings).toBe(0);
    expect(rebind("edit-card", "Meta+Digit3")).toBeNull();
    on(event("3", { code: "Digit3", metaKey: true, target: surface }));
    expect(edits).toBe(1);
    expect(ratings).toBe(0);
  });
});

test("KEYS-04 one held Retire press removes only one exercise after its save completes", async () => {
  const { ReviewSession } = await import("../src/review-session");
  resetKeys();
  const calls: string[] = [];
  const s = new ReviewSession(false, (async (...args: string[]) => { calls.push(args.join(" ")); return null; }) as never);
  s.queue = ["A", "B", "C"].map((id) => ({ id, state: "live", kind: "card", skills: [] })) as never;
  s.screen = { notify: () => Object.assign(() => {}, { undo() {}, hold() {} }), shown: () => null, unrated() {}, press() {}, onClose() {} };
  async function press(repeat: boolean) {
    const card = { id: s.queue![0]!.id, state: "live" };
    let write = Promise.resolve(false);
    const on = review({ s, phase: "answer", card, retire: () => { write = s.retire(card, false); } });
    const e = event("Backspace", { code: "Backspace", metaKey: true, shiftKey: true, repeat, target: surface });
    on(e);
    await write;
    expect(e.defaultPrevented).toBe(true);
  }
  await press(false);
  expect(s.busy).toBe(false);
  await press(true);
  await press(true);
  expect(calls).toEqual(["card retire A"]);
  expect(s.queue?.map((c) => c.id)).toEqual(["B", "C"]);
  await press(false);
  expect(calls).toEqual(["card retire A", "card retire B"]);
  expect(s.queue?.map((c) => c.id)).toEqual(["C"]);
});

describe("KEYS-05 Review accepts keypad confidence and ratings", () => {
  test("top-row and keypad digits choose confidence 1–3 and ratings 1–4", () => {
    resetKeys();
    for (const prefix of ["Digit", "Numpad"]) {
      const confidence: number[] = [], ratings: number[] = [];
      const answer = review({ phase: "answer", pickSure: (n: number) => confidence.push(n) });
      const checked = review({ rate: (n: number) => ratings.push(n) });
      for (let n = 0; n <= 5; n++) {
        const e = event(String(n), { code: `${prefix}${n}`, target: surface });
        answer(e);
        checked(e);
      }
      expect(confidence).toEqual([1, 2, 3]);
      expect(ratings).toEqual([1, 2, 3, 4]);
    }
  });
  test("keypad navigation, modifiers, typing and held ratings do not rate", () => {
    const ratings: number[] = [], confidence: number[] = [];
    const on = review({ rate: (n: number) => ratings.push(n) });
    const answer = review({ phase: "answer", pickSure: (n: number) => confidence.push(n) });
    for (const extra of [{ key: "PageDown" }, { metaKey: true }, { ctrlKey: true }, { altKey: true }, { target: { tagName: "INPUT" } }, { keyCode: 229 }]) {
      const e = event("3", { code: "Numpad3", target: surface, ...extra });
      on(e);
      answer(e);
    }
    on(event("3", { code: "Numpad3", target: surface, repeat: true }));
    expect(ratings).toEqual([]);
    expect(confidence).toEqual([]);
    on(event("Enter", { code: "NumpadEnter", target: surface }));
    expect(ratings).toEqual([3]);
  });
  test("an existing custom keypad shortcut still runs instead of rating or choosing confidence", () => {
    resetKeys();
    expect(rebind("edit-card", "Numpad3")).toBeNull();
    let edits = 0, ratings = 0, confidence = 0;
    const e = event("3", { code: "Numpad3", target: surface });
    review({ phase: "answer", pickSure: () => confidence++ })(e);
    review({ edit: () => edits++, rate: () => ratings++ })(e);
    expect(edits).toBe(1);
    expect(ratings).toBe(0);
    expect(confidence).toBe(0);
  });
});
