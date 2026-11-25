import { afterEach, beforeEach, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { markTried } from "../src/tries.ts";
import { tryLine } from "../src/ai/tries.ts";
import { runChatTurn } from "../src/ai/adapter.ts";
import { addHighlight, findAnnotation } from "../src/annotations.ts";
import { digAnswer, digAsk } from "../src/ai/dig.ts";
import { endDig, readDigs, startDig } from "../src/digs.ts";
import { addText } from "../src/ingest/index.ts";
import { checkPrequestion } from "../src/ai/check.ts";
import { recallFeedback } from "../src/ai/recall.ts";
import { updateItemMeta, findItem } from "../src/items.ts";
import { setSkillLook } from "../src/skills.ts";
import { tempLibrary } from "./helpers.ts";

let dir: string;
let lib: Awaited<ReturnType<typeof tempLibrary>>;
let env: { PATH?: string; ORE_AI?: string; ORE_AI_MODEL?: string };
beforeEach(async () => {
  env = { PATH: process.env.PATH, ORE_AI: process.env.ORE_AI, ORE_AI_MODEL: process.env.ORE_AI_MODEL };
  dir = mkdtempSync(join(tmpdir(), "ore-ai-regression-"));
  lib = await tempLibrary();
  process.env.PATH = `${dir}:${env.PATH}`;
  process.env.ORE_AI = "claude";
  delete process.env.ORE_AI_MODEL;
  const script = `#!${process.execPath}
const fs = require('node:fs');
const dir = ${JSON.stringify(dir)};
const count = Number(fs.readFileSync(dir+'/count','utf8'));
fs.writeFileSync(dir+'/count',String(count+1));
const cases = JSON.parse(fs.readFileSync(dir+'/cases','utf8'));
const c = cases[Math.min(count,cases.length-1)];
fs.writeFileSync(dir+'/ready','yes');
if (c.hold) {
  const end = Date.now()+5000;
  while (!fs.existsSync(dir+'/release')) { if (Date.now()>end) process.exit(88); await Bun.sleep(5); }
}
const args=process.argv.slice(2);
if (process.argv[1].endsWith('codex')) {
  fs.writeFileSync(args[args.indexOf('-o')+1],JSON.stringify(c.data));
  console.log(JSON.stringify({type:'thread.started',thread_id:'fake-thread'}));
} else {
  console.log(JSON.stringify({type:'result',is_error:false,structured_output:c.data,modelUsage:{[c.model??'fake-model']:{outputTokens:1}}}));
}
if(c.stderr) console.error(c.stderr);
process.exit(c.exit??0);
`;
  for (const name of ["claude", "codex"]) {
    writeFileSync(join(dir, name), script);
    chmodSync(join(dir, name), 0o755);
  }
});
afterEach(() => {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  rmSync(dir, { recursive: true, force: true });
  rmSync(lib.root, { recursive: true, force: true });
});
function fake(cases: { data: unknown; model?: string; hold?: boolean; exit?: number; stderr?: string }[]) {
  writeFileSync(join(dir, "cases"), JSON.stringify(cases));
  writeFileSync(join(dir, "count"), "0");
  for (const name of ["ready", "release"]) rmSync(join(dir, name), { force: true });
}
async function dig() {
  const item = await addText(lib, "# Learning\n\nRecall strengthens memory.\n\nSpace practice over time.", { skills: ["learning"] });
  await setSkillLook(lib, "learning", { goal: "Explain learning" });
  for (const exact of ["Recall strengthens memory.", "Space practice over time."]) addHighlight(findItem(lib, item.meta.id), { exact, intent: "card" });
  return startDig(lib, "learning", "I remember retrieval.");
}

test.each([false, true])("a Dig retains both stages' authors after a vendor switch (legacy: %s)", async (legacy) => {
  await dig();
  fake([{ data: { came: [1], asks: [{ n: 2, q: "What about spacing?" }] }, model: "first-author" }]);
  const first = await digAsk(lib, "learning");
  if (legacy) {
    const path = join(lib.root, "skills/learning/digs.json");
    const records = JSON.parse(readFileSync(path, "utf8"));
    delete records[0].ask_ai;
    writeFileSync(path, JSON.stringify(records));
  }
  process.env.ORE_AI = "codex";
  process.env.ORE_AI_MODEL = "second-author";
  fake([{ data: { came: [2], asks: [] } }]);
  await digAnswer(lib, "learning", ["Space practice."]);
  const saved = readDigs(lib, "learning")[0]!;
  expect(saved.ask_ai).toEqual(first.ai);
  expect(saved.ai).toEqual({ vendor: "codex", model: "second-author", prompt_version: "dig@1" });
});

// A file barrier proves the vendor has captured its input before the library changes.
async function during<T>(running: Promise<T>, edit: () => Promise<unknown>) {
  const settled = running.then(value => ({ value, error: undefined }), error => ({ value: undefined, error }));
  try {
    const end = Date.now() + 4000;
    while (!existsSync(join(dir, "ready"))) {
      if (Date.now() > end) throw new Error("fake vendor did not start");
      await Bun.sleep(5);
    }
    await edit();
  } finally {
    writeFileSync(join(dir, "release"), "yes");
    await settled;
  }
  return settled;
}

test.each(["after", "before", "question", "skipped", "removed", "reordered", "unchanged", "marks"])("recall feedback checks its prequestion input at save (%s)", async (change) => {
  const item = await addText(lib, "Recall strengthens memory.");
  await updateItemMeta(lib, item.meta.id, m => ({ ...m, prequestions: [
    { q: "What helps?", before: "Rereading.", after: "Practice." },
    { q: "When?", after: "Tomorrow." },
  ] }));
  fake([{ data: { feedback: "Try recalling.", questions: [{ n: 1, feedback: "Name retrieval." }], missed: ["Retrieval"], section_lines: null }, hold: true }]);
  const result = await during(recallFeedback(lib, item.meta.id), async () => {
    await updateItemMeta(lib, item.meta.id, m => {
      const ps = m.prequestions!;
      if (change === "removed") ps.shift();
      else if (change === "reordered") ps.reverse();
      else if (change === "after" || change === "before") ps[0]![change] = "Retrieval.";
      else if (change === "question") ps[0]!.q = "What hurts memory?";
      else if (change === "skipped") ps[0]!.skipped = "past";
      else if (change === "marks") ps[0]!.check = { covered: [true], edited: true, ai: { vendor: "claude", model: "old", prompt_version: "check@1" } };
      return m;
    });
  });
  const feedback = findItem(lib, item.meta.id).meta.recall?.feedback;
  if (change === "unchanged" || change === "marks") {
    expect(result.error).toBeUndefined();
    expect(feedback?.feedback).toBe("Try recalling.");
  } else {
    expect(String(result.error)).toMatch(/changed.*feedback/);
    expect(feedback).toBeUndefined();
  }
});

test.each(["more", "text", "order", "question", "unchanged", "evidence"])("a late prequestion check matches the current question and ordered points (%s)", async (change) => {
  const item = await addText(lib, "Recall strengthens memory.");
  await updateItemMeta(lib, item.meta.id, m => ({ ...m, prequestions: [{ q: "What helps?", after: "Practice.", points: [
    { text: "Retrieval", evidence: [] }, { text: "Spacing", evidence: [] },
  ] }] }));
  fake([{ data: { covered: [true, false] }, hold: true }]);
  const result = await during(checkPrequestion(lib, item.meta.id, 1), async () => {
    await updateItemMeta(lib, item.meta.id, m => {
      const p = m.prequestions![0]!;
      if (change === "more") p.points!.push({ text: "Sleep", evidence: [] });
      else if (change === "text") p.points![0]!.text = "Sleep";
      else if (change === "order") p.points!.reverse();
      else if (change === "question") p.q = "What hurts?";
      else if (change === "evidence") p.points![0]!.evidence = [{ exact: "Recall", prefix: "", suffix: " strengthens", start: 0, end: 6 }];
      return m;
    });
  });
  const check = findItem(lib, item.meta.id).meta.prequestions![0]!.check;
  if (change === "unchanged" || change === "evidence") {
    expect(result.error).toBeUndefined();
    expect(check?.covered).toEqual([true, false]);
  } else {
    expect(String(result.error)).toMatch(/changed.*checking/);
    expect(check).toBeUndefined();
  }
});

test("ending a Dig prevents the late first-stage reply from changing its saved record", async () => {
  const d = await dig();
  fake([{ data: { came: [1], asks: [{ n: 2, q: "What about spacing?" }] }, hold: true }]);
  const path = join(lib.root, "skills/learning/digs.json");
  let closed = "";
  const result = await during(digAsk(lib, "learning"), async () => {
    await endDig(lib, "learning", d.id);
    closed = readFileSync(path, "utf8");
  });
  expect(String(result.error)).toMatch(/dig changed/);
  expect(readFileSync(path, "utf8")).toBe(closed);
});

async function tried() {
  const item = await addText(lib, "Recall strengthens memory.");
  const a = addHighlight(item, { exact: "Recall strengthens memory.", intent: "apply", note: "I will recall." });
  await markTried(lib, a.id, { reflection: "It helped." });
  return a;
}

test("a failed Claude process cannot save its otherwise valid Try feedback", async () => {
  const a = await tried();
  fake([{ data: { line: "Keep recalling." }, exit: 1, stderr: "fatal transport failure" }]);
  await expect(tryLine(lib, a.id)).rejects.toThrow(/claude failed \(exit 1\): fatal transport failure/);
  expect(findAnnotation(lib, a.id).annotation.line).toBeUndefined();
  expect(readFileSync(join(dir, "count"), "utf8")).toBe("1");
});

test.each([false, true])("Claude chat rejects a failed process with a valid result (stream: %s)", async (stream) => {
  fake([{ data: { reply: "Partial candidate", card: null }, exit: 1, stderr: "fatal transport failure" }]);
  await expect(runChatTurn(lib, { system: "Explain", message: "Why?", schema: {}, cwd: lib.root, ...(stream ? { onProgress: () => {} } : {}) })).rejects.toThrow(/claude failed \(exit 1\): fatal transport failure/);
});

test("blank Try feedback is rejected after retry and never saved", async () => {
  const a = await tried();
  fake([{ data: { line: " \n\t " } }]);
  await expect(tryLine(lib, a.id)).rejects.toThrow();
  expect(findAnnotation(lib, a.id).annotation.line).toBeUndefined();
  expect(readFileSync(join(dir, "count"), "utf8")).toBe("2");
});

test("Try feedback retries a blank reply and trims the readable replacement", async () => {
  const a = await tried();
  fake([{ data: { line: " \n\t " } }, { data: { line: " Keep recalling. " } }]);
  await tryLine(lib, a.id);
  expect(findAnnotation(lib, a.id).annotation.line?.text).toBe("Keep recalling.");
  expect(readFileSync(join(dir, "count"), "utf8")).toBe("2");
});
