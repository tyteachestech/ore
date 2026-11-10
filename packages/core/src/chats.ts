import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative, resolve, sep } from "node:path";
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

// What the list needs of a chat, checked without walking every turn's citations and steps.
const Head = z.looseObject({ id: Chat.shape.id, title: Chat.shape.title, created: z.string().optional(), updated: z.string().optional(), turns: z.array(z.unknown()).min(1) });

/** Every chat, last changed first: what the tutor's list shows. A file that isn't a chat is skipped. */
export function listChats(lib: Library): ChatRow[] {
  const dir = paths.chats(lib);
  return visible(dir)
    .filter((n) => n.endsWith(".json"))
    .flatMap((n) => {
      try {
        const c = Head.parse(JSON.parse(readFileSync(join(dir, n), "utf8")));
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

// D189: a file he attaches to a message (an image, a PDF, a text file) is copied into chats/files/, named by
// its content, so the same file attached twice is kept once and a saved chat can show it again. It is for
// the chat only: it is not a source, is never indexed, and learning from it for good means adding it (⌘N).
const FILE_KINDS: Record<string, "image" | "pdf" | "text"> = {
  ".png": "image", ".jpg": "image", ".jpeg": "image", ".gif": "image", ".webp": "image",
  ".pdf": "pdf",
  ".txt": "text", ".md": "text", ".csv": "text", ".json": "text", ".py": "text", ".js": "text", ".ts": "text", ".tsx": "text", ".html": "text", ".css": "text", ".sql": "text", ".sh": "text", ".yaml": "text", ".yml": "text", ".tex": "text", ".ipynb": "text",
};
const FILE_MAX = 20 * 1024 * 1024;
export type ChatFile = { name: string; path: string; kind: "image" | "pdf" | "text" };

/** Copies a file into chats/files/ and returns its name, its path from the library's root and its kind.
 *  `file` is a path, or a pasted one's name and bytes. Refused with the next step when the tutor can't read it. */
export async function attachToChat(lib: Library, file: string | { name: string; data: Uint8Array }): Promise<ChatFile> {
  const name = (typeof file === "string" ? basename(file) : basename(file.name)).trim() || "file";
  if (typeof file === "string" && !(existsSync(file) && statSync(file).isFile())) throw new Error(`no file at ${file}`);
  const ext = extname(name).toLowerCase();
  const kind = FILE_KINDS[ext];
  if (!kind) throw new Error(`the tutor can't read ${ext ? `a ${ext} file` : "that file"}: attach an image, a PDF or a text file, or add it as a source (⌘N)`);
  const size = typeof file === "string" ? statSync(file).size : file.data.length;
  if (!size) throw new Error(`${name} is empty`);
  if (size > FILE_MAX) throw new Error(`${name} is over 20 MB: add it as a source (⌘N) and @ it instead`);
  const data = typeof file === "string" ? readFileSync(file) : file.data;
  return withLock(paths.lock(lib), () => {
    const dir = join(paths.chats(lib), "files");
    mkdirSync(dir, { recursive: true });
    const to = join(dir, `${new Bun.CryptoHasher("sha256").update(data).digest("hex").slice(0, 16)}${ext}`);
    if (!existsSync(to)) typeof file === "string" ? copyFileSync(file, to) : writeFileSync(to, data);
    return { name, path: relative(lib.root, to).split(sep).join("/"), kind };
  });
}

/** The absolute path of an attached file, given as `attachToChat` returned it; only a file in chats/files/. */
export function chatFilePath(lib: Library, path: string): string {
  const dir = join(paths.chats(lib), "files");
  const abs = resolve(lib.root, path);
  if (!abs.startsWith(dir + sep) || !existsSync(abs)) throw new Error(`no attached file "${path}"`);
  return abs;
}
