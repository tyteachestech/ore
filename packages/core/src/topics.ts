import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { parseFrontmatter, stringifyFrontmatter } from "./frontmatter.ts";
import { visible, writeAtomic } from "./fsutil.ts";
import { slugify, ulid } from "./ids.ts";
import { AiStamp } from "./items.ts";
import { paths, type Library } from "./library.ts";

export const TopicMetaSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["active", "wanted"]),
  skills: z.array(z.string()).default([]),
  aliases: z.array(z.string()).default([]),
  ai: AiStamp.optional(),
});
export type TopicMeta = z.infer<typeof TopicMetaSchema>;

export interface Topic {
  slug: string;
  meta: TopicMeta;
  body: string;
  path: string;
}

export function readTopic(lib: Library, slug: string): Topic | null {
  const path = paths.topic(lib, slug);
  if (!existsSync(path)) return null;
  const { data, body } = parseFrontmatter(readFileSync(path, "utf8"));
  return { slug, meta: TopicMetaSchema.parse(data), body, path };
}

export function listTopics(lib: Library): Topic[] {
  const dir = paths.topics(lib);
  if (!existsSync(dir)) return [];
  return visible(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .flatMap((f) => {
      const t = readTopic(lib, f.slice(0, -3));
      return t ? [t] : [];
    });
}

// Creates the topic file unless it exists. Caller holds the library lock.
export function ensureTopic(lib: Library, t: { slug: string; name: string; status: "active" | "wanted"; skills?: string[]; summary?: string; ai?: AiStamp }): { topic: Topic; created: boolean } {
  const slug = slugify(t.slug || t.name);
  const existing = readTopic(lib, slug);
  if (existing) return { topic: existing, created: false };
  const meta: TopicMeta = { id: ulid(), name: t.name, status: t.status, skills: t.skills ?? [], aliases: [], ai: t.ai };
  const body = t.summary ? `${t.summary.trim()}\n` : "";
  writeAtomic(paths.topic(lib, slug), stringifyFrontmatter(meta, body));
  return { topic: { slug, meta, body, path: paths.topic(lib, slug) }, created: true };
}

export function writeTopic(t: Topic): void {
  writeAtomic(t.path, stringifyFrontmatter(TopicMetaSchema.parse(t.meta), t.body));
}
