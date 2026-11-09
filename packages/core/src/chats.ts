import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { visible, writeAtomic } from "./fsutil.ts";
import { nowIso } from "./ids.ts";
import { paths, type Library } from "./library.ts";
import { withLock } from "./lock.ts";

// D172: every tutor chat is saved in the library, one file each (chats/<id>.json), so + starts a new one
// without losing the old and a restart loses nothing. The app keeps the turns as it shows them; core
// checks the shape it relies on (an id, a title, his messages) and keeps the rest as given.

const Turn = z.looseObject({ id: z.string().min(1), message: z.string() });
export const Chat = z.strictObject({
  // The first turn's id, which the app makes before anything is saved.
  id: z.string().regex(/^[A-Za-z0-9-]{1,40}$/, "a chat id is letters, digits and dashes"),
  title: z.string().trim().min(1).max(120),
  created: z.string().optional(),
  updated: z.string().optional(),
  // The @ context still in effect (D128.3), so a chat picked up later reads the same material.
  carry: z.array(z.looseObject({ kind: z.string(), id: z.string() })).default([]),
  turns: z.array(Turn).min(1, "a chat holds at least one message"),
});
export type Chat = z.infer<typeof Chat>;
export type ChatRow = { id: string; title: string; updated: string };

const file = (lib: Library, id: string) => {
  if (!Chat.shape.id.safeParse(id).success) throw new Error(`no chat "${id}"`);
  return paths.chat(lib, id);
};

function parse(text: string, where: string): Chat {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${where} is not JSON`);
  }
  const r = Chat.safeParse(json);
  if (!r.success) throw new Error(`${where}: ${r.error.issues[0]!.path.join(".") || "chat"} ${r.error.issues[0]!.message}`);
  return r.data;
}

/** Every chat, last changed first: what the tutor's list shows. A file that isn't a chat is skipped. */
export function listChats(lib: Library): ChatRow[] {
  const dir = paths.chats(lib);
  return visible(dir)
    .filter((n) => n.endsWith(".json"))
    .flatMap((n) => {
      try {
        const c = parse(readFileSync(join(dir, n), "utf8"), n);
        return [{ id: c.id, title: c.title, updated: c.updated ?? c.created ?? "" }];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.updated.localeCompare(a.updated) || b.id.localeCompare(a.id));
}

export function readChat(lib: Library, id: string): Chat {
  const f = file(lib, id);
  if (!existsSync(f)) throw new Error(`no chat "${id}"`);
  return parse(readFileSync(f, "utf8"), `chat ${id}`);
}

/** Writes the whole chat (the app sends it after each message and reply). `created` is kept from the
 *  file once it exists; `updated` is now, unless `touch` is false (Undo of a delete puts it back as it was). */
export async function saveChat(lib: Library, json: string, { touch = true } = {}): Promise<Chat> {
  const c = parse(json, "the chat");
  const f = file(lib, c.id);
  return withLock(paths.lock(lib), () => {
    const was = existsSync(f) ? (() => { try { return parse(readFileSync(f, "utf8"), c.id); } catch { return null; } })() : null;
    const now = nowIso();
    const out: Chat = { ...c, created: was?.created ?? c.created ?? now, updated: touch || !c.updated ? now : c.updated };
    writeAtomic(f, JSON.stringify(out, null, 1) + "\n");
    return out;
  });
}

/** Deletes a chat and returns it, so Undo can save it back. */
export async function deleteChat(lib: Library, id: string): Promise<Chat> {
  return withLock(paths.lock(lib), () => {
    const c = readChat(lib, id);
    rmSync(file(lib, id));
    return c;
  });
}
