import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { z } from "zod";
import { visible, writeAtomic } from "./fsutil.ts";
import { isUlid, nowIso } from "./ids.ts";
import { AiStamp } from "./items.ts";
import { paths, type Library } from "./library.ts";
import { withLock } from "./lock.ts";

// D172 and D61: each chat is saved in the library as chats/<id>.json. Tutor names its own chats
// by their first turn; Review uses the exercise id so the same exercise can reopen its chat.

const Turn = z.looseObject({ id: z.string().min(1), message: z.string(), stepsShown: z.number().int().positive().optional() });
const ExerciseText = z.object({ question: z.string(), answer: z.string(), rubric: z.array(z.string()).optional() });
const ExerciseTurn = Turn.extend({
  reply: z.string().optional(),
  session: z.string().optional(),
  proposal: ExerciseText.nullish(),
  was: ExerciseText.optional(),
  stopped: z.boolean().optional(),
  error: z.string().optional(),
  ai: AiStamp.optional(),
});
export type ExerciseChatTurn = z.infer<typeof ExerciseTurn>;
const exerciseChatId = (id: string) => `ask-${id}`;

export const Chat = z.strictObject({
  // The first turn's id for Tutor, or ask-<exercise> for Review.
  id: z.string().regex(/^[A-Za-z0-9-]{1,40}$/, "a chat id is letters, digits and dashes"),
  exercise: z.string().refine(isUlid, "must be an exercise id").optional(),
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
  if (r.data.exercise) {
    if (r.data.id !== exerciseChatId(r.data.exercise)) throw new Error(`${where}: the chat id must match its exercise`);
    ExerciseTurn.array().parse(r.data.turns);
  }
  return r.data;
}

// What the list needs of a chat, checked without walking every turn's citations and steps.
const Head = z.looseObject({ id: Chat.shape.id, exercise: Chat.shape.exercise, title: Chat.shape.title, created: z.string().optional(), updated: z.string().optional(), turns: z.array(z.unknown()).min(1) });

/** Tutor chats, last changed first. Exercise chats open from Review. A file that isn't a chat is skipped. */
export function listChats(lib: Library): ChatRow[] {
  const dir = paths.chats(lib);
  return visible(dir)
    .filter((n) => n.endsWith(".json"))
    .flatMap((n) => {
      try {
        const c = Head.parse(JSON.parse(readFileSync(join(dir, n), "utf8")));
        if (c.exercise) return [];
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

/** The chat that belongs to this exercise. A first visit has no turns to reopen. */
export function readExerciseChat(lib: Library, exercise: string) {
  if (!isUlid(exercise)) throw new Error("expected an exercise id");
  const id = exerciseChatId(exercise);
  const f = file(lib, id);
  // A file that can't be read (cut off mid-write on another device, edited by hand) opens as a new chat, which the
  // next message writes over: Ask never stays shut for an exercise. The library's history keeps the old file.
  try {
    const c = existsSync(f) ? parse(readFileSync(f, "utf8"), `chat ${id}`) : null;
    if (c && c.exercise !== exercise) throw new Error(`chat ${id} does not belong to this exercise`);
    return { id, exercise, turns: c ? ExerciseTurn.array().parse(c.turns) : [] };
  } catch {
    return { id, exercise, turns: [] };
  }
}

type Turn = Chat["turns"][number];
/** One message and its reply, as a turn shows it or keeps it among its other versions (D201, the app's chat-versions.ts). */
type Version = Record<string, unknown>;
const hasReply = (v: Version) => typeof v.reply === "string";
/** A version is its words and the AI that wrote them: the same words from another vendor, model or prompt
 *  are another version, so neither's stamp is lost in a merge (Codex deep scan 2). */
const key = (v: Version) => {
  const ai = (v.ai ?? {}) as Record<string, unknown>;
  return JSON.stringify([v.message, v.reply, ai.vendor, ai.model, ai.prompt_version, v.steps ?? []]);
};
const shown = ({ id: _i, alts: _a, alt: _n, ...v }: Turn): Version => v;
const versionsOf = (t: Turn): Version[] => [...((t.alts as Version[] | undefined) ?? []), ...(hasReply(t) ? [shown(t)] : [])];
const keptOf = (v: Version) => (typeof v.kept === "string" && v.kept !== "adding" ? v.kept : undefined);
const stepsShownOf = (v: Version) => (typeof v.stepsShown === "number" && Number.isSafeInteger(v.stepsShown) ? v.stepsShown : 1);

/** One turn as both copies have it. The new copy's, unless the file's has a reply the new one never saw (a
 *  window that said "No reply came" while another's reply landed); either way every reply either holds stays a
 *  version, and its kept card and revealed steps stay with it. */
function mergeTurn(saved: Turn, next: Turn): Turn {
  const nextVersions = versionsOf(next);
  const useNext = hasReply(next) || !hasReply(saved) || nextVersions.some((v) => key(v) === key(saved));
  const [base, other] = useNext ? [next, saved] : [saved, next];
  const known = new Set(versionsOf(base).map(key));
  const otherVersions = versionsOf(other);
  const extra = otherVersions.filter((v) => !known.has(key(v)) && (known.add(key(v)), true));
  const keptIn = new Map(otherVersions.flatMap((v) => (keptOf(v) ? [[key(v), keptOf(v)!] as const] : [])));
  const revealedIn = new Map<string, number>();
  for (const v of otherVersions) {
    const id = key(v);
    revealedIn.set(id, Math.max(revealedIn.get(id) ?? 1, stepsShownOf(v)));
  }
  const withProgress = <V extends Version>(v: V): V => {
    if (!hasReply(v)) return v;
    const id = key(v);
    const kept = keptOf(v) ?? keptIn.get(id);
    const stepsShown = revealedIn.get(id) ?? 1;
    return { ...v, ...(kept ? { kept } : {}), ...(stepsShown > stepsShownOf(v) ? { stepsShown } : {}) };
  };
  const alts = [...((base.alts as Version[] | undefined) ?? []), ...extra].map(withProgress);
  if (!alts.length) return withProgress(base);
  return { ...withProgress(base), alts, alt: typeof base.alt === "number" ? base.alt : ((base.alts as Version[] | undefined)?.length ?? 0) };
}

/** The saved turns with the new copy's. A turn only the file has (another window's, sent after this copy was
 *  read) stays, after the turn it followed: the app never takes a turn out of a chat, so a missing turn is one
 *  this copy never saw, not one deleted. A turn in both is merged (F316). */
function merged(saved: Chat["turns"], next: Chat["turns"]): Chat["turns"] {
  const was = new Map(saved.map((t) => [t.id, t]));
  const out = next.map((t) => (was.has(t.id) ? mergeTurn(was.get(t.id)!, t) : t));
  const ids = new Set(next.map((t) => t.id));
  saved.forEach((t, i) => {
    if (ids.has(t.id)) return;
    const after = i ? out.findIndex((x) => x.id === saved[i - 1]!.id) : -1;
    out.splice(after + 1, 0, t);
    ids.add(t.id);
  });
  return out;
}

/** Writes the chat. Given whole, it replaces the file (`ore chat --set`, which can take a turn out); with
 *  `merge`, as the app saves after each message and reply, it keeps what another window saved since this copy
 *  was read. `created` is kept from the file once it exists; `updated` is now, unless `touch` is false (Undo
 *  of a delete puts it back as it was). */
export async function saveChat(lib: Library, json: string, { touch = true, merge = false } = {}): Promise<Chat> {
  const c = parse(json, "the chat");
  const f = file(lib, c.id);
  return withLock(paths.lock(lib), () => {
    const was = existsSync(f) ? (() => { try { return parse(readFileSync(f, "utf8"), c.id); } catch { return null; } })() : null;
    const now = nowIso();
    const out: Chat = { ...c, turns: was && merge ? merged(was.turns, c.turns) : c.turns, created: was?.created ?? c.created ?? now, updated: touch || !c.updated ? now : c.updated };
    writeAtomic(f, JSON.stringify(out, null, 1) + "\n");
    return out;
  });
}

/** Deletes a chat and returns it, so Undo can save it back. */
export async function deleteChat(lib: Library, id: string): Promise<Chat> {
  return withLock(paths.lock(lib), () => {
    const c = readChat(lib, id);
    rmSync(file(lib, id));
    // What its session was sent goes too; brought back by Undo, the chat starts a new one from its turns.
    rmSync(paths.tutorSession(lib, id), { force: true });
    // So does any left with no chat: one deleted on another Mac, or written back by a reply that landed after its delete.
    const kept = dirname(paths.tutorSession(lib, id));
    try { for (const f of readdirSync(kept)) if (!existsSync(file(lib, f.replace(/\.json$/, "")))) rmSync(join(kept, f), { force: true }); } catch { /* none kept yet */ }
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
