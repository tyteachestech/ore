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
