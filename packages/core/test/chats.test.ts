import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deleteChat, listChats, readChat, saveChat } from "../src/chats.ts";
import { tempLibrary } from "./helpers.ts";

// D171: the tutor's chats are saved in the library, one file each.

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

  test("the list skips a file that isn't a chat (Finder junk, a half-synced copy)", async () => {
    const lib = await tempLibrary();
    await saveChat(lib, chat("a-1", "First"));
    writeFileSync(join(lib.root, "chats", "broken.json"), "{");
    writeFileSync(join(lib.root, "chats", ".DS_Store"), "junk");
    expect(listChats(lib).map((r) => r.id)).toEqual(["a-1"]);
  });
});
