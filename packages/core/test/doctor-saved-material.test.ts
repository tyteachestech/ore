import { expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { saveChat } from "../src/chats.ts";
import { doctor } from "../src/doctor.ts";
import { sha256 } from "../src/fsutil.ts";
import { stringifyFrontmatter } from "../src/frontmatter.ts";
import { queueFile } from "../src/inbox.ts";
import { addText } from "../src/ingest/index.ts";
import { paths } from "../src/library.ts";
import { tempLibrary } from "./helpers.ts";

for (const kind of ["chat", "inbox", "variant", "image"] as const) test(`doctor reports damaged ${kind} material without rewriting it`, async () => {
  const lib = await tempLibrary();
  let file: string;
  if (kind === "chat") {
    await saveChat(lib, JSON.stringify({ id: "chat-one", title: "Lesson", turns: [{ id: "one", message: "Saved words" }] }));
    file = paths.chat(lib, "chat-one");
    writeFileSync(file, readFileSync(file, "utf8").slice(0, -8));
  } else if (kind === "inbox") {
    const q = queueFile(lib, paths.skills(lib), [], "lesson.md");
    file = join(paths.inbox(lib), `${q.id}.file.json`);
    rmSync(join(paths.inbox(lib), q.file!));
  } else if (kind === "variant") {
    file = paths.variants(lib, "MISSING");
    writeFileSync(file, JSON.stringify({ id: "V1", rev: 1, card: "MISSING", type: "new-case", setting: "garden", question: "Why space?", answer: "Recall.", rubric: ["Recall"], maps: [0], status: "ready", created: new Date().toISOString(), ai: { vendor: "claude", model: "stub", prompt_version: "variant@1" } }) + "\n");
  } else {
    const item = await addText(lib, "# Lesson\n\nThe diagram matters.\n");
    file = item.docPath;
    const body = item.body + "\n![Learning loop][loop]\n\n[loop]: assets/missing.png\n";
    writeFileSync(file, stringifyFrontmatter({ ...item.meta, text_sha256: sha256(body) }, body));
  }
  const before = readFileSync(file, "utf8");
  for (const fix of [false, true]) {
    const result = await doctor(lib, { fix });
    const issue = result.issues.find((i) => i.path === file.slice(lib.root.length + 1));
    expect(issue).toBeDefined();
    expect(issue!.message).toMatch(/restore|recover|sync|repair/i);
    expect(readFileSync(file, "utf8")).toBe(before);
    expect(result.fixed).toEqual([]);
  }
});

test("doctor accepts older chats and inbox descriptors and checks only rendered local images", async () => {
  const lib = await tempLibrary();
  mkdirSync(paths.chats(lib), { recursive: true });
  writeFileSync(paths.chat(lib, "older"), JSON.stringify({ id: "older", title: "Old chat", turns: [{ id: "one", message: "Words", reply: "Reply" }] }));
  writeFileSync(join(paths.inbox(lib), "older.link.json"), JSON.stringify({ url: "https://example.test" }));
  writeFileSync(join(paths.inbox(lib), "older.file.json"), JSON.stringify({ file: "old name.md" }));
  writeFileSync(join(paths.inbox(lib), "old name.md"), "Older file");
  const item = await addText(lib, "# Lesson\n\nWords.\n");
  mkdirSync(join(item.dir, "assets"));
  writeFileSync(join(item.dir, "assets", "old image.svg"), "<svg/>");
  const body = item.body + '\n![Old](assets/old%20image.svg#view)\n![Remote](https://example.test/p.png)\n![Remote](//example.test/p.png)\n![Inline](data:image/png;base64,YQ==)\n`![Example](missing.png)`\n\n```md\n![Example](absent.png)\n```\n';
  writeFileSync(item.docPath, stringifyFrontmatter({ ...item.meta, text_sha256: sha256(body) }, body));
  expect((await doctor(lib)).issues).toEqual([]);
});
