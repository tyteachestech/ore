import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { attachToChat, chatFilePath, deleteChat, listChats, readChat, saveChat } from "../src/chats.ts";
import { tempLibrary } from "./helpers.ts";

// D172: the tutor's chats are saved in the library, one file each.

const chat = (id: string, title: string, extra: object = {}) =>
  JSON.stringify({ id, title, carry: [{ kind: "skill", id: "memory", name: "Memory" }], turns: [{ id, message: "what is a Leitner box?", reply: "A box of cards [1].", citations: [{ n: 1 }] }], ...extra });

describe("tutor chats", () => {
  test("a saved chat reads back whole, with the turn fields core doesn't know about", async () => {
    const lib = await tempLibrary();
    const c = await saveChat(lib, chat("abc-1", "Leitner boxes"));
    expect(c.created).toBe(c.updated!);
    const back = readChat(lib, "abc-1");
    expect(back.title).toBe("Leitner boxes");
    expect(back.carry).toEqual([{ kind: "skill", id: "memory", name: "Memory" }]);
    expect(back.turns[0]).toEqual({ id: "abc-1", message: "what is a Leitner box?", reply: "A box of cards [1].", citations: [{ n: 1 }] });
    expect(JSON.parse(readFileSync(join(lib.root, "chats", "abc-1.json"), "utf8")).id).toBe("abc-1");
  });

  test("saving again keeps when it was started and moves it to the top of the list", async () => {
    const lib = await tempLibrary();
    const first = await saveChat(lib, chat("a-1", "First"));
    await Bun.sleep(5);
    await saveChat(lib, chat("b-1", "Second"));
    expect(listChats(lib).map((r) => r.title)).toEqual(["Second", "First"]);
    await Bun.sleep(5);
    const again = await saveChat(lib, chat("a-1", "First", { created: "2000-01-01T00:00:00.000Z" }));
    expect(again.created).toBe(first.created!);
    expect(listChats(lib).map((r) => r.title)).toEqual(["First", "Second"]);
  });

  test("delete returns the chat, and setting it back with its time puts it where it was", async () => {
    const lib = await tempLibrary();
    await saveChat(lib, chat("a-1", "First"));
    await Bun.sleep(5);
    await saveChat(lib, chat("b-1", "Second"));
    const gone = await deleteChat(lib, "a-1");
    expect(listChats(lib).map((r) => r.id)).toEqual(["b-1"]);
    expect(() => readChat(lib, "a-1")).toThrow('no chat "a-1"');
    const back = await saveChat(lib, JSON.stringify(gone), { touch: false });
    expect(back.updated).toBe(gone.updated!);
    expect(listChats(lib).map((r) => r.id)).toEqual(["b-1", "a-1"]);
  });

  // F316: a second window on the same chat saved its copy over the first's, deleting its turn.
  const twoWindows = async () => {
    const lib = await tempLibrary();
    const save = (turns: object[]) => saveChat(lib, JSON.stringify({ id: "c-1", title: "Two windows", turns }), { merge: true });
    const turn = (id: string) => readChat(lib, "c-1").turns.find((t) => t.id === id)!;
    return { lib, save, turn };
  };
  const shared = { id: "c-1", message: "first", reply: "One." };

  test("a save from a window that never saw a turn keeps that turn, in its place", async () => {
    const { lib, save } = await twoWindows();
    const a = { id: "c-2", message: "from window A", reply: "A." };
    const b = { id: "c-3", message: "from window B", reply: "B." };
    await save([shared]);
    await save([shared, a]); // window A
    await save([shared, b]); // window B, opened before A's turn
    expect(readChat(lib, "c-1").turns.map((t) => t.id)).toEqual(["c-1", "c-2", "c-3"]);
    await save([shared, a, { id: "c-4", message: "A again" }]); // A, still without B's
    expect(readChat(lib, "c-1").turns.map((t) => t.id)).toEqual(["c-1", "c-2", "c-3", "c-4"]);
  });

  test("a turn both windows have keeps its reply, every version and the kept card, whichever window saved last", async () => {
    const { save, turn } = await twoWindows();
    // B, opened while A's reply was on its way, said none came; A's reply had landed.
    await save([shared, { id: "c-2", message: "why?", reply: "Because." }]);
    await save([shared, { id: "c-2", message: "why?", error: "No reply came: Ore closed before it did." }]);
    expect(turn("c-2")).toMatchObject({ reply: "Because." });
    expect(turn("c-2").error).toBeUndefined();
    // A tried another reply (D201) and kept a card from the first; B, still on the first, saves again.
    await save([shared, { id: "c-2", message: "why?", reply: "Since.", alts: [{ message: "why?", reply: "Because.", kept: "card1" }], alt: 1 }]);
    await save([shared, { id: "c-2", message: "why?", reply: "Because." }]);
    const t = turn("c-2") as unknown as { reply: string; alts: { reply: string; kept?: string }[]; alt: number };
    expect([t.reply, ...t.alts.map((v) => v.reply)].sort()).toEqual(["Because.", "Since."]);
    expect([t, ...t.alts].find((v) => v.reply === "Because.")).toMatchObject({ kept: "card1" });
    expect(t.alt).toBeLessThanOrEqual(t.alts.length);
  });

  test("two windows' replies in the same words from different AIs both stay, each with its own stamp (F587)", async () => {
    const { save, turn } = await twoWindows();
    const claude = { vendor: "claude", model: "claude-model", prompt_version: "tutor@16" };
    const codex = { vendor: "codex", model: "codex-model", prompt_version: "tutor@16" };
    await save([shared, { id: "c-2", message: "What is 2+2?", reply: "4.", ai: claude }]);
    await save([shared, { id: "c-2", message: "What is 2+2?", reply: "4.", ai: codex }]); // a window that never saw Claude's
    const t = turn("c-2") as unknown as { ai: object; alts?: { ai: object }[] };
    expect([t.ai, ...(t.alts ?? []).map((v) => v.ai)]).toEqual(expect.arrayContaining([claude, codex]));
    // The same version saved again by both windows stays one.
    await save([shared, { id: "c-2", message: "What is 2+2?", reply: "4.", ai: codex }]);
    expect((turn("c-2") as unknown as { alts?: object[] }).alts).toHaveLength(1);
  });

  test("a retry still being written is the saving window's: the reply it set aside stays a version, not back on top", async () => {
    const { save, turn } = await twoWindows();
    await save([shared, { id: "c-2", message: "why?", reply: "Because." }]);
    await save([shared, { id: "c-2", message: "why?", alts: [{ message: "why?", reply: "Because." }], alt: 1 }]);
    expect(turn("c-2")).toMatchObject({ alts: [{ reply: "Because." }], alt: 1 });
    expect(turn("c-2").reply).toBeUndefined();
  });

  test("refuses what isn't a chat: no title, no message, a path for an id", async () => {
    const lib = await tempLibrary();
    await expect(saveChat(lib, chat("a-1", "  "))).rejects.toThrow("title");
    await expect(saveChat(lib, JSON.stringify({ id: "a-1", title: "x", turns: [] }))).rejects.toThrow("at least one message");
    await expect(saveChat(lib, chat("../items/x", "x"))).rejects.toThrow("letters, digits and dashes");
    await expect(saveChat(lib, "{not json")).rejects.toThrow("not JSON");
    expect(() => readChat(lib, "../skills")).toThrow("no chat");
    expect(listChats(lib)).toEqual([]);
  });

  test("`ore chat <id> --set` refuses a chat with another id before writing anything", async () => {
    const lib = await tempLibrary();
    const cli = join(import.meta.dir, "../../cli/src/ore.ts");
    const p = Bun.spawnSync(["bun", cli, "chat", "a-1", "--set"], { env: { ...process.env, ORE_LIBRARY: lib.root }, stdin: Buffer.from(chat("b-1", "Other")), stderr: "pipe" });
    expect(p.exitCode).not.toBe(0);
    expect(p.stderr.toString()).toContain("the chat on stdin is b-1, not a-1");
    expect(listChats(lib)).toEqual([]);
  });

  test("`ore chat --set` replaces the chat, so a turn can be taken out; `--merge` keeps turns it never saw (the app's saves)", async () => {
    const lib = await tempLibrary();
    const cli = join(import.meta.dir, "../../cli/src/ore.ts");
    const set = (turns: object[], ...flags: string[]) => Bun.spawnSync(["bun", cli, "chat", "c-1", "--set", ...flags], { env: { ...process.env, ORE_LIBRARY: lib.root }, stdin: Buffer.from(JSON.stringify({ id: "c-1", title: "T", turns })), stderr: "pipe" });
    const b = { id: "c-2", message: "second", reply: "Two." };
    expect(set([shared, b]).exitCode).toBe(0);
    expect(set([shared], "--merge").exitCode).toBe(0);
    expect(readChat(lib, "c-1").turns.map((t) => t.id)).toEqual(["c-1", "c-2"]);
    expect(set([shared]).exitCode).toBe(0);
    expect(readChat(lib, "c-1").turns.map((t) => t.id)).toEqual(["c-1"]);
  });

  test("the list skips a file that isn't a chat (Finder junk, a half-synced copy)", async () => {
    const lib = await tempLibrary();
    await saveChat(lib, chat("a-1", "First"));
    writeFileSync(join(lib.root, "chats", "broken.json"), "{");
    writeFileSync(join(lib.root, "chats", ".DS_Store"), "junk");
    expect(listChats(lib).map((r) => r.id)).toEqual(["a-1"]);
  });
});

// D189: a file attached to a message is copied into chats/files/, named by its content.
describe("chat attachments", () => {
  test("a file by path and a pasted one are copied in; the same bytes are kept once; the list of chats ignores them", async () => {
    const lib = await tempLibrary();
    const src = join(lib.root, "..", `chart-${Date.now()}.PNG`);
    writeFileSync(src, new Uint8Array([137, 80, 78, 71, 1]));
    const a = await attachToChat(lib, src);
    expect(a).toMatchObject({ name: src.split("/").pop(), kind: "image" });
    expect(a.path).toMatch(/^chats\/files\/[0-9a-f]{16}\.png$/);
    expect([...readFileSync(chatFilePath(lib, a.path))]).toEqual([137, 80, 78, 71, 1]);
    const b = await attachToChat(lib, { name: "Pasted image.png", data: new Uint8Array([137, 80, 78, 71, 1]) });
    expect(b.path).toBe(a.path);
    expect(readdirSync(join(lib.root, "chats", "files"))).toHaveLength(1);
    expect((await attachToChat(lib, { name: "paper.pdf", data: new Uint8Array([37, 80, 68, 70]) })).kind).toBe("pdf");
    expect((await attachToChat(lib, { name: "notes.md", data: new TextEncoder().encode("# hi") })).kind).toBe("text");
    expect(listChats(lib)).toEqual([]);
  });

  test("what the tutor can't read is refused with the next step, and nothing is saved", async () => {
    const lib = await tempLibrary();
    await expect(attachToChat(lib, { name: "book.epub", data: new Uint8Array([1]) })).rejects.toThrow("the tutor can't read a .epub file: attach an image, a PDF or a text file, or add it as a source (⌘N)");
    await expect(attachToChat(lib, { name: "empty.png", data: new Uint8Array() })).rejects.toThrow("empty.png is empty");
    await expect(attachToChat(lib, { name: "big.pdf", data: new Uint8Array(20 * 1024 * 1024 + 1) })).rejects.toThrow("big.pdf is over 20 MB");
    await expect(attachToChat(lib, join(lib.root, "nope.png"))).rejects.toThrow("no file at");
    expect(existsSync(join(lib.root, "chats", "files"))).toBe(false);
    expect(() => chatFilePath(lib, "skills.yaml")).toThrow('no attached file "skills.yaml"');
  });
});
