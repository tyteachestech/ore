import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export interface Library {
  root: string;
}

export function libraryRoot(explicit?: string): string {
  if (explicit) return resolve(explicit);
  if (process.env.ORE_LIBRARY) return resolve(process.env.ORE_LIBRARY);
  return join(homedir(), "Ore");
}

export function openLibrary(explicit?: string): Library {
  const root = libraryRoot(explicit);
  if (!existsSync(join(root, "skills.yaml"))) {
    // A library that lost only its skills.yaml (iCloud hasn't downloaded it, a sync renamed it "skills 2.yaml")
    // must not read as "no library": the app answers that with `ore init`, which would write a fresh one over his.
    // Folders that hold something, so an `ore init` cut off before it wrote skills.yaml can still run again.
    if (existsSync(join(root, ".skills.yaml.icloud")) || ["items", "cards", "reviews"].some((d) => existsSync(join(root, d)) && readdirSync(join(root, d)).some((n) => !n.startsWith(".")))) {
      const why = existsSync(join(root, ".skills.yaml.icloud"))
        ? "iCloud hasn't downloaded it yet: open the folder in Finder to download it"
        : "put it back (a synced copy may be named “skills 2.yaml”), or restore it from the library's history";
      throw new Error(`skills.yaml is missing from your library at ${root}: ${why}`);
    }
    throw new Error(`no library at ${root} (run \`ore init\`, or set ORE_LIBRARY)`);
  }
  return { root };
}

export const paths = {
  agents: (l: Library) => join(l.root, "AGENTS.md"),
  skills: (l: Library) => join(l.root, "skills.yaml"),
  skillNotes: (l: Library) => join(l.root, "skills"),
  fsrsParams: (l: Library) => join(l.root, "fsrs-params.json"),
  topics: (l: Library) => join(l.root, "topics"),
  topic: (l: Library, slug: string) => join(l.root, "topics", `${slug}.md`),
  items: (l: Library) => join(l.root, "items"),
  cards: (l: Library) => join(l.root, "cards"),
  card: (l: Library, id: string) => join(l.root, "cards", `${id}.md`),
  variants: (l: Library, id: string) => join(l.root, "cards", `${id}.variants.jsonl`),
  reviews: (l: Library) => join(l.root, "reviews"),
  reviewLog: (l: Library, d: Date) => join(l.root, "reviews", `${monthKey(d)}.jsonl`),
  sessions: (l: Library) => join(l.root, "sessions"),
  sessionLog: (l: Library, d: Date) => join(l.root, "sessions", `${monthKey(d)}.jsonl`),
  inbox: (l: Library) => join(l.root, "inbox"),
  index: (l: Library) => join(l.root, ".index", "library.sqlite"),
  lock: (l: Library) => join(l.root, ".ore", "lock"),
  openSession: (l: Library) => join(l.root, ".ore", "session"),
  logs: (l: Library) => join(l.root, ".ore", "logs"),
};

export function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}
