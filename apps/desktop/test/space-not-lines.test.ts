// Space separates, not lines (D329, Tyler 2026-11-18): no rule under a section label, no line
// between rows a picture, icon or checkbox already marks.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = ["styles.css", "retro.css"].map((f) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8")).join("\n");
/** Every rule whose selector list names `sel` exactly, as one string of declarations. */
const rules = (sel: string) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[1].split(",").some((s) => s.replace(/\/\*.*?\*\//gs, "").trim() === sel)).map((m) => m[2]).join(";");

const LINE = /border-(top|bottom):\s*1px|inset 0 -?1px 0 var\(--border\)/;

test("labels and rows carry no line", () => {
  for (const sel of [
    ".home-h", ".phone .home-h", ".phone .home-read", ".phone .home-skill", ".phone-sources h2", ".phone-sources li button",
    ".phone-waiting", ".phone .phone-note-row", ".settings-group h2", ".forge-band h2", ".preq", ".preq-row", ".linked-from", ".skill-col.side .question + .question",
  ]) expect([sel, LINE.test(rules(sel))]).toEqual([sel, false]);
});

test("a line that does a job stays", () => {
  for (const sel of [".settings-row + .settings-row", ".list-bar", ".panel-input"]) expect([sel, LINE.test(rules(sel))]).toEqual([sel, true]);
});
