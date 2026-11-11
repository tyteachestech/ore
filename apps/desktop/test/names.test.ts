import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// D181: what review brings back is an exercise in everything the app shows. `card` stays in files,
// the CLI, key ids, class names and code, so only words he can read are checked: quoted strings,
// template text and JSX text that say Card, or card among other words.
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []));
}

const says = (text: string) => /\bCards?\b/.test(text) || (/\bcards?\b/.test(text) && text.trim().includes(" "));

/** The strings and JSX text of a source file that say card, without its comments, imports, class names and selectors. */
export function shown(src: string): string[] {
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s\/\/ .*$/gm, "")
    .replace(/^import .*$/gm, "")
    .replace(/className=(?:"[^"]*"|\{`[^`]*`\})/g, "");
  const texts = [
    ...[...code.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1]!),
    ...[...code.matchAll(/`((?:[^`\\\n]|\\.)*)`/g)].flatMap((m) => m[1]!.split(/\$\{[^{}]*\}/)),
    ...[...code.matchAll(/>([^<>{}=;()]+)</g)].map((m) => m[1]!),
  ];
  // A lone "card" or "cards" is a code id (an intent, a kind, a command) unless it is shown: a literal inside a JSX
  // child's braces (`>{n} {n === 1 ? "card" : "cards"}<`), or one half of a singular/plural pair, which no id is.
  const lone = [
    ...[...code.matchAll(/(?<=(?:[^=\-]>|\})[^<>{}=;:,()[\]]*)\{([^{}]*)\}/g)].flatMap((m) => [...m[1]!.matchAll(/"(cards?)"/g)].map((l) => l[1]!)),
    ...(/"card"\s*:\s*"cards"|"cards"\s*:\s*"card"/.test(code) ? ["card", "cards"] : []),
  ];
  return [...texts.map((t) => t.replace(/\s+/g, " ").trim()).filter((t) => says(t) && !/^[.#]/.test(t)), ...new Set(lone)];
}

test("the check sees a label, a message with a name in it and JSX text, and leaves code alone", () => {
  expect(shown('<Hint text="Edit card" keys="edit-card">')).toEqual(["Edit card"]);
  expect(shown("notify(`Couldn’t make the card: ${errorText(e)}`)")).toEqual(["Couldn’t make the card:"]);
  expect(shown("<button>\n  Card\n</button>")).toEqual(["Card"]);
  expect(shown('if (a.intent === "card" && card.kind !== "prompt") el.closest(".video-card");')).toEqual([]);
  expect(shown('<span className="due">{due} {due === 1 ? "card" : "cards"} ready</span>')).toEqual(["card", "cards"]);
  expect(shown('const unit = n === 1 ? "card" : "cards";')).toEqual(["card", "cards"]);
  expect(shown('<Hint keys="card">{x}</Hint>; setIntentOf(id, passageKey ? "keep" : "card"); { kind: "card" }')).toEqual([]);
});

test("nothing the app shows says card: it is an exercise (D181)", () => {
  const src = join(import.meta.dir, "../src");
  expect(files(src).flatMap((f) => shown(readFileSync(f, "utf8")).map((t) => `${f.slice(src.length + 1)}: ${t}`))).toEqual([]);
});
