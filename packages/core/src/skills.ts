import { readFileSync } from "node:fs";
import type * as YAMLLib from "yaml";
import { z } from "zod";
import { listCards, writeCardMeta } from "./cards.ts";
import { parseYaml, stringifyFrontmatter, loadYaml } from "./frontmatter.ts";
import { isOther, tidyCollection } from "./collection-name.ts";
import { writeAtomic } from "./fsutil.ts";
import { allItems, findItem, ItemMetaSchema, SuggestedSkill, updateItemMeta, type ItemMeta } from "./items.ts";
import { nowIso, slugify } from "./ids.ts";
import { paths, type Library } from "./library.ts";
import { withLock } from "./lock.ts";
import { listTopics, readTopic, writeTopic } from "./topics.ts";

export const Priority = z.enum(["P1", "P2", "P3"]);
export type Priority = z.infer<typeof Priority>;

// Named colors, so the app can render each one for its own theme.
export const SkillColor = z.enum(["gray", "red", "orange", "yellow", "green", "teal", "blue", "purple", "pink"]);
export type SkillColor = z.infer<typeof SkillColor>;

export const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  priority: Priority,
  hook: z.string().optional(),
  goal: z.string().optional(), // D101: what he could show he can do, tried from memory on the skill page
  icon: z.string().optional(), // "mc:<name>", a pixel skill icon (D36, D157); emoji and "ph:" from before D157 draw nothing
  color: SkillColor.optional(),
  collection: z.string().optional(), // sidebar group, e.g. "Ty Teaches Tech"
  archived: z.boolean().optional(), // D173: out of sight: off the sidebar's list, out of review, Home and enrich
});
export type Skill = z.infer<typeof SkillSchema>;

// Daily review (D60): a goal in minutes of active review, weekends optional, and how many
// new drafts enter review a day. All optional; defaults below.
export const ReviewSettingsSchema = z.object({
  goal_minutes: z.number().int().min(1).max(240).optional(),
  weekdays_only: z.boolean().optional(),
  new_per_day: z.number().int().min(0).max(200).optional(),
  remix: z.boolean().optional(), // D66: cards he knows come back as variants
  plan: z.string().trim().max(80).optional(), // D67: the cue in "After <plan>, I review."; "" for none
  reminder: z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d)?$/, "reminder must be HH:MM, or empty for off").optional(), // D67: local time; "" off
});
export type ReviewSettings = Required<z.infer<typeof ReviewSettingsSchema>>;
export const REVIEW_DEFAULTS: ReviewSettings = { goal_minutes: 10, weekdays_only: false, new_per_day: 10, remix: true, plan: "", reminder: "" };

export const SkillsFileSchema = z.object({
  ai: z.enum(["claude", "codex"]).optional(),
  models: z.object({ claude: z.string().optional(), codex: z.string().optional() }).optional(), // the model per vendor; ORE_AI_MODEL overrides
  review: ReviewSettingsSchema.optional(),
  skills: z.array(SkillSchema),
});
export type SkillsFile = z.infer<typeof SkillsFileSchema>;

// D25. Tyler owns these; hooks are one-line reminders of why the skill matters.
export const DEFAULT_SKILLS: Skill[] = [
  { id: "ai", name: "AI", priority: "P1", hook: "Build and explain AI systems in my work" },
  { id: "learning", name: "Learning", priority: "P1", hook: "How people learn and remember" },
  { id: "teaching", name: "Teaching", priority: "P1", hook: "Explaining ideas so they land" },
  { id: "storytelling-writing", name: "Storytelling & Writing", priority: "P2", hook: "Clear, compelling writing and narrative" },
  { id: "creator-business", name: "Creator Business", priority: "P2", hook: "Running a creator business" },
  { id: "creativity", name: "Creativity", priority: "P2", hook: "Generating and shaping ideas" },
  { id: "habits", name: "Habits", priority: "P3", hook: "Building and breaking habits" },
  { id: "focus-attention", name: "Focus & Attention", priority: "P3", hook: "Directing attention, deep work" },
  { id: "self-regulation-motivation", name: "Self-Regulation & Motivation", priority: "P3", hook: "Managing energy, emotion and drive" },
];

export const HOOK_MAX = 140; // one line under the skill's name

export const RETENTION: Record<Priority, number> = { P1: 0.92, P2: 0.88, P3: 0.8 };
export const PRIORITY_WEIGHT: Record<Priority, number> = { P1: 3, P2: 2, P3: 1 };
const DEFAULT_PRIORITY: Priority = "P2";
/** D173: a skill he makes starts Light; he raises it once it matters. */
export const NEW_SKILL_PRIORITY: Priority = "P3";

export function defaultSkillsYaml(): string {
  return (
    "# Skills (D25). Priority maps to desired retention (P1 0.92, P2 0.88, P3 0.80)\n" +
    "# and breaks ties in the review queue. It never changes FSRS math.\n" +
    "# ai: claude | codex   (AI vendor for enrichment and grading; ORE_AI overrides)\n" +
    loadYaml().stringify({ ai: "claude", skills: DEFAULT_SKILLS }, { lineWidth: 0 })
  );
}

export function loadSkills(lib: Library): SkillsFile {
  const text = readFileSync(paths.skills(lib), "utf8");
  let data: unknown;
  try {
    data = parseYaml(text);
  } catch {
    // Every screen reads skills.yaml, so a typo in it must say where (Bun's parser gives no line).
    const why = loadYaml().parseDocument(text).errors[0]?.message.split("\n")[0]?.replace(/:$/, "") ?? "it isn’t valid YAML";
    throw new Error(`skills.yaml in your library has a typo: ${why}. Fix it in a text editor.`);
  }
  const { file } = parseSkillsFile(data);
  // A collection named Other, saved before it was refused, reads as none: its skills join Other, and
  // the next arrange writes them so.
  for (const s of file.skills) if (s.collection !== undefined && isOther(s.collection)) delete s.collection;
  return file;
}

/** What `loadSkills` had to leave out of skills.yaml to read it, for `ore doctor`. */
export const skillsFileProblems = (lib: Library): string[] => parseSkillsFile(parseYaml(readFileSync(paths.skills(lib), "utf8"))).dropped;

// Fields a hand edit can get wrong without the skill itself being unreadable: each falls back to its
// default (no colour, no icon, P2), so one typo like `color: violet` doesn't blank every screen.
const LENIENT = new Set(["color", "icon", "priority", "hook", "goal", "collection", "archived"]);

/** Reads skills.yaml's data, dropping fields a hand edit got wrong (named in `dropped`); a file that still
 *  can't be read says which skill and field, with the fix, instead of zod's raw path. */
export function parseSkillsFile(data: unknown): { file: SkillsFile; dropped: string[] } {
  if (data == null) throw new Error("skills.yaml in your library is empty. Restore it from the library's history, or run `ore init` in a new folder for a fresh one.");
  const first = SkillsFileSchema.safeParse(data);
  if (first.success) return { file: first.data, dropped: [] };
  const copy = structuredClone(data) as Record<string, unknown>;
  const dropped: string[] = [];
  for (const issue of first.error.issues) {
    const [top, n, field] = issue.path;
    const skill = top === "skills" && typeof n === "number" ? ((copy.skills as Record<string, unknown>[])[n] as Record<string, unknown> | undefined) : undefined;
    if (skill && typeof field === "string" && LENIENT.has(field)) {
      if (field === "priority" ? skill.priority === DEFAULT_PRIORITY : !(field in skill)) continue; // one field, several issues
      dropped.push(`skill "${String(skill.name ?? skill.id ?? Number(n) + 1)}" has ${field} ${JSON.stringify(skill[field])}, which Ore can't use, so ${field === "priority" ? `${DEFAULT_PRIORITY} is used` : "it is left out"}`);
      if (field === "priority") skill.priority = DEFAULT_PRIORITY;
      else delete skill[field];
    } else if ((top === "review" || top === "models") && typeof n === "string" && copy[top] && typeof copy[top] === "object" && n in (copy[top] as object)) {
      dropped.push(`${top}.${n} is ${JSON.stringify((copy[top] as Record<string, unknown>)[n])}, which Ore can't use, so the default is used`);
      delete (copy[top] as Record<string, unknown>)[n];
    } else if (top === "ai" && issue.path.length === 1 && "ai" in copy) {
      dropped.push(`ai is ${JSON.stringify(copy.ai)} (claude or codex), so claude is used`);
      delete copy.ai;
    }
  }
  const second = SkillsFileSchema.safeParse(copy);
  if (second.success) return { file: second.data, dropped };
  const issue = second.error.issues[0]!;
  const [top, n, field] = issue.path;
  const skill = top === "skills" && typeof n === "number" ? ((copy.skills as Record<string, unknown>[] | undefined)?.[n] as Record<string, unknown> | undefined) : undefined;
  const where = skill && typeof skill === "object"
    ? `skill ${Number(n) + 1}${typeof skill.name === "string" ? ` ("${skill.name}")` : typeof skill.id === "string" ? ` (id ${skill.id})` : ""} ${field ? `has no usable ${String(field)}` : "isn't a skill"}`
    : top === "skills" ? "its skills: list is missing or not a list" : `${issue.path.join(".") || "the file"}: ${issue.message}`;
  throw new Error(`skills.yaml in your library: ${where}. Fix it in a text editor.`);
}

// A card's priority is the highest priority among its skills; an archived skill counts only when all of
// them are archived (D173).
export function cardPriority(skillIds: string[], skills: Skill[]): Priority {
  const own = skills.filter((s) => skillIds.includes(s.id));
  const live = own.filter((s) => !s.archived);
  const ps = (live.length ? live : own).map((s) => s.priority);
  return ps.length ? ps.sort()[0]! : DEFAULT_PRIORITY;
}

/** Filed under no skill there is (none, or only ids no longer in skills.yaml): What to review's No skill row (D203). */
export const unfiled = (skillIds: string[], skills: Skill[]): boolean => !skillIds.some((id) => skills.some((s) => s.id === id));

/** Filed only under archived skills (D173): its cards wait out of review, its sources off Home. */
export const archivedOnly = (skillIds: string[], skills: Skill[]): boolean => {
  const own = skills.filter((s) => skillIds.includes(s.id));
  return own.length > 0 && own.every((s) => s.archived);
};

// Archived or not, as a card's skills were: archiving changes only what is listed and due, never a
// card's retention, so its review history replays to the same schedule (D22, D173).
export const desiredRetention = (skillIds: string[], skills: Skill[]): number =>
  RETENTION[cardPriority(skillIds, skills.map((s) => (s.archived ? { ...s, archived: undefined } : s)))];

/** A new skill's id: its name's slug, numbered when another skill holds it ("C#" after "C++"). A name with
 *  no Latin letters or digits keeps its own letters ("日本語", "русский") instead of "untitled": the id names
 *  the skills/<id>/ folder and `ore:skill/<id>` links, and both take any letter. */
const newSkillId = (skills: Skill[], name: string): string => {
  const ascii = slugify(name);
  const own = name.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, "-").replace(/^-+|-+$/g, "");
  const base = ascii === "untitled" && own ? [...own].slice(0, 60).join("").replace(/-+$/, "") : ascii;
  let id = base;
  for (let n = 2; skills.some((s) => s.id === id); n++) id = `${base}-${n}`;
  return id;
};

/** Names that read the same: case aside, and "é" typed (one letter) or from a Mac file name (e + accent). */
const sameName = (a: string, b: string) => a.normalize("NFC").toLowerCase() === b.normalize("NFC").toLowerCase();

export const matchSkill = (skills: Skill[], name: string): Skill | undefined =>
  skills.find((s) => s.id === name.trim() || sameName(s.name, name.trim().replace(/\s+/g, " ")));

// "mc:<file_name>", a pixel skill icon (D157). Checked on write only, so a hand-edited skills.yaml never stops
// loading; the app just doesn't draw an icon it can't read.
export const isSkillIcon = (icon: string): boolean => /^mc:[A-Za-z0-9]+(_[A-Za-z0-9]+)*$/.test(icon);

export const reviewSettings = (lib: Library): ReviewSettings => ({ ...REVIEW_DEFAULTS, ...loadSkills(lib).review });

// Change the daily review settings in skills.yaml (D60), keeping comments.
export async function setReviewSettings(lib: Library, patch: Partial<ReviewSettings>): Promise<ReviewSettings> {
  const valid = ReviewSettingsSchema.parse(patch);
  return withLock(paths.lock(lib), () => {
    const doc = loadYaml().parseDocument(readFileSync(paths.skills(lib), "utf8"));
    for (const [k, v] of Object.entries(valid)) if (v !== undefined) doc.setIn(["review", k], v);
    writeAtomic(paths.skills(lib), doc.toString({ lineWidth: 0 }));
    return { ...REVIEW_DEFAULTS, ...parseSkillsFile(doc.toJSON()).file.review };
  });
}

// The AI vendor for enrichment and grading (`ai:` in skills.yaml), keeping comments.
export async function setAiVendor(lib: Library, vendor: "claude" | "codex"): Promise<"claude" | "codex"> {
  const ai = SkillsFileSchema.shape.ai.unwrap().parse(vendor);
  return withLock(paths.lock(lib), () => {
    const doc = loadYaml().parseDocument(readFileSync(paths.skills(lib), "utf8"));
    doc.set("ai", ai);
    writeAtomic(paths.skills(lib), doc.toString({ lineWidth: 0 }));
    return ai;
  });
}

// Rename a skill, or set its icon, color, collection, hook (his "why I'm learning this", D63) or goal (D101) in
// skills.yaml; an empty string clears the field (never the name). The ID stays, so links survive (D39).
// Edits the YAML document in place so Tyler's comments and ordering survive.
export async function setSkillLook(lib: Library, id: string, look: Partial<Record<"name" | "icon" | "color" | "collection" | "hook" | "goal" | "priority", string>>): Promise<Skill> {
  return withLock(paths.lock(lib), () => {
    const doc = loadYaml().parseDocument(readFileSync(paths.skills(lib), "utf8"));
    const list = doc.get("skills") as YAMLLib.YAMLSeq<YAMLLib.YAMLMap>;
    const node = list.items.find((m) => m.get("id") === id);
    if (!node) throw new Error(`unknown skill "${id}"`);
    const name = look.name?.trim().replace(/\s+/g, " ");
    if (name !== undefined) {
      if (!name) throw new Error("a skill needs a name");
      const other = loadSkills(lib).skills.find((s) => s.id !== id && sameName(s.name, name));
      if (other) throw new Error(`skill "${other.name}" already exists`);
      node.set("name", name);
    }
    if (look.priority !== undefined) {
      const p = Priority.safeParse(look.priority.trim().toUpperCase());
      if (!p.success) throw new Error("priority must be P1 (Focus), P2 (Normal) or P3 (Light)");
      node.set("priority", p.data);
    }
    for (const key of ["icon", "color", "collection", "hook", "goal"] as const) {
      const raw = look[key];
      const v = raw === undefined ? undefined : key === "collection" ? collectionName(raw) : key === "hook" || key === "goal" ? raw.trim().replace(/\s+/g, " ") : raw.trim();
      if (v === undefined) continue;
      if (key === "color" && v && !SkillColor.options.includes(v as SkillColor))
        throw new Error(`color must be one of ${SkillColor.options.join("|")}`);
      if (key === "icon" && v && !isSkillIcon(v)) throw new Error('icon must be "mc:<name>"');
      if ((key === "hook" || key === "goal") && v.length > HOOK_MAX) throw new Error(`${key} must be at most ${HOOK_MAX} characters`);
      if (v) node.set(key, v);
      else node.delete(key);
    }
    // Read as loadSkills reads it: a bad value he typed elsewhere in the file doesn't stop this change.
    const skill = parseSkillsFile(doc.toJSON()).file.skills.find((s) => s.id === id)!;
    writeAtomic(paths.skills(lib), doc.toString({ lineWidth: 0 }));
    return skill;
  });
}

/** Archives a skill, or brings it back (D173): only the flag changes; its sources, cards and FSRS
 *  state stay as they are, so bringing it back is the same call with `false`. */
export async function archiveSkill(lib: Library, id: string, archived: boolean): Promise<Skill> {
  return withLock(paths.lock(lib), () => {
    const doc = loadYaml().parseDocument(readFileSync(paths.skills(lib), "utf8"));
    if (!setArchived(doc, id, archived)) throw new Error(`unknown skill "${id}"`);
    const skill = parseSkillsFile(doc.toJSON()).file.skills.find((s) => s.id === id)!;
    writeAtomic(paths.skills(lib), doc.toString({ lineWidth: 0 }));
    return skill;
  });
}

function setArchived(doc: YAMLLib.Document, id: string, archived: boolean): boolean {
  const node = (doc.get("skills") as YAMLLib.YAMLSeq<YAMLLib.YAMLMap>).items.find((m) => m.get("id") === id);
  if (!node) return false;
  if (archived) node.set("archived", true);
  else node.delete("archived");
  return true;
}

/** Filing a source under an archived skill brings the skill back (D173): he is learning it again.
 *  Call inside the library lock. Returns the ids it brought back. */
export function unarchiveFiled(lib: Library, ids: string[]): string[] {
  const back = loadSkills(lib).skills.filter((s) => s.archived && ids.includes(s.id)).map((s) => s.id);
  if (!back.length) return back;
  const doc = loadYaml().parseDocument(readFileSync(paths.skills(lib), "utf8"));
  for (const id of back) setArchived(doc, id, false);
  writeAtomic(paths.skills(lib), doc.toString({ lineWidth: 0 }));
  return back;
}

// A collection's name as saved; a collection named Other would show as a second Other (collection-name.ts).
function collectionName(name: string): string {
  const c = tidyCollection(name);
  if (isOther(c)) throw new Error(`"${c}" is the name of the skills in no collection`);
  return c;
}

// The sidebar's layout: collections in order, each with its skills in order ("" holds the skills in
// no collection). Every skill appears exactly once.
export const SkillLayoutSchema = z.array(z.object({ collection: z.string(), skills: z.array(z.string()) }));
export type SkillLayout = z.infer<typeof SkillLayoutSchema>;

// Lay out the sidebar in one write: sorts skills.yaml into the given order (each collection's skills
// contiguous, since a collection's place is where its first skill appears) and sets or clears each
// skill's collection. Moving a skill, reordering, renaming or removing a collection, and undoing any
// of them are all this call. Comments on each skill's entry move with it.
export async function arrangeSkills(lib: Library, layout: SkillLayout): Promise<Skill[]> {
  return withLock(paths.lock(lib), () => {
    const doc = loadYaml().parseDocument(readFileSync(paths.skills(lib), "utf8"));
    const list = doc.get("skills") as YAMLLib.YAMLSeq<YAMLLib.YAMLMap>;
    const byId = new Map(list.items.map((m) => [String(m.get("id")), m]));
    const seen = new Set<string>();
    const names = new Set<string>();
    const order: YAMLLib.YAMLMap[] = [];
    for (const g of layout) {
      const c = collectionName(g.collection);
      if (c && names.has(c.toLowerCase())) throw new Error(`collection "${c}" is listed twice`);
      names.add(c.toLowerCase());
      for (const id of g.skills) {
        const node = byId.get(id);
        if (!node) throw new Error(`unknown skill "${id}"`);
        if (seen.has(id)) throw new Error(`skill "${id}" is listed twice`);
        seen.add(id);
        if (c) node.set("collection", c);
        else node.delete("collection");
        order.push(node);
      }
    }
    const missing = [...byId.keys()].filter((id) => !seen.has(id));
    if (missing.length) throw new Error(`layout leaves out ${missing.map((id) => `"${id}"`).join(", ")}`);
    list.items = order;
    const skills = parseSkillsFile(doc.toJSON()).file.skills;
    writeAtomic(paths.skills(lib), doc.toString({ lineWidth: 0 }));
    return skills;
  });
}

// Create a skill Tyler named (D25), Light (D173), optionally in a sidebar collection.
export async function addSkill(lib: Library, name: string, collection = ""): Promise<Skill> {
  return withLock(paths.lock(lib), () => {
    const n = name.normalize("NFC").trim().replace(/\s+/g, " ");
    if (!n) throw new Error("a skill needs a name");
    const doc = loadYaml().parseDocument(readFileSync(paths.skills(lib), "utf8"));
    const skills = parseSkillsFile(doc.toJSON()).file.skills;
    const existing = skills.find((s) => sameName(s.name, n));
    if (existing) throw new Error(`skill "${existing.name}" already exists`);
    const id = newSkillId(skills, n);
    const c = collectionName(collection);
    const skill: Skill = { id, name: n, priority: NEW_SKILL_PRIORITY, ...(c ? { collection: c } : {}) };
    (doc.get("skills") as YAMLLib.YAMLSeq).add(doc.createNode(skill));
    writeAtomic(paths.skills(lib), doc.toString({ lineWidth: 0 }));
    return skill;
  });
}

// Accept an item's suggested skill: create it in skills.yaml, Light (D173), unless it already exists
// (an archived one comes back), then file the item, its cards and its topics under it. Tyler creates skills; AI only suggests (D25).
export async function acceptSuggestedSkill(lib: Library, ref: string): Promise<{ skill: Skill; created: boolean; item: ItemMeta; undo: SuggestionUndo }> {
  return withLock(paths.lock(lib), () => {
    const item = findItem(lib, ref);
    const s = item.meta.suggested_skill;
    if (!s) throw new Error(`${item.meta.id} has no suggested skill`);
    const skills = loadSkills(lib).skills;
    let skill = matchSkill(skills, s.name);
    const created = !skill;
    if (!skill) {
      skill = { id: newSkillId(skills, s.name), name: s.name, priority: NEW_SKILL_PRIORITY, ...(s.hook ? { hook: s.hook } : {}) };
      const doc = loadYaml().parseDocument(readFileSync(paths.skills(lib), "utf8"));
      (doc.get("skills") as YAMLLib.YAMLSeq).add(doc.createNode(skill));
      writeAtomic(paths.skills(lib), doc.toString({ lineWidth: 0 }));
    }
    const id = skill.id;
    if (skill.archived) skill = { ...skill, archived: undefined };
    unarchiveFiled(lib, [id]);
    const cards: string[] = [], topics: string[] = [];
    const undo = { suggestion: s, skill: id, created, filed: !item.meta.skills.includes(id), cards, topics };
    const meta = ItemMetaSchema.parse({ ...item.meta, skills: [...new Set([...item.meta.skills, id])], suggested_skill: undefined });
    writeAtomic(item.docPath, stringifyFrontmatter(meta, item.body));
    for (const c of listCards(lib).filter((c) => c.meta.item === meta.id && !c.meta.skills.includes(id))) {
      writeCardMeta(c, { ...c.meta, skills: [...c.meta.skills, id] });
      cards.push(c.meta.id);
    }
    for (const t of meta.topics.map((slug) => readTopic(lib, slug)))
      if (t && !t.meta.skills.includes(id)) {
        writeTopic({ ...t, meta: { ...t.meta, skills: [...t.meta.skills, id] } });
        topics.push(t.slug);
      }
    return { skill, created, item: meta, undo };
  });
}

/** What an accept changed, so Undo takes back exactly that (or, with only `suggestion`, a dismiss). */
export const SuggestionUndoSchema = z.object({
  suggestion: SuggestedSkill,
  skill: z.string().optional(),
  created: z.boolean().default(false),
  filed: z.boolean().default(false),
  cards: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
});
export type SuggestionUndo = z.input<typeof SuggestionUndoSchema>;

/** Undoes an accept or a dismiss in one locked step: the skill comes off what the accept filed under it
 *  (a skill it made goes too, unless something has been filed under it since), and the suggestion
 *  returns, so the chip shows again and Accept works. */
export async function undoSuggestedSkill(lib: Library, ref: string, input: SuggestionUndo): Promise<ItemMeta> {
  const r = SuggestionUndoSchema.parse(input);
  if (!r.suggestion.name.trim()) throw new Error("a suggested skill needs a name");
  return withLock(paths.lock(lib), () => {
    const item = findItem(lib, ref);
    const id = r.skill;
    const off = (skills: string[]) => skills.filter((x) => x !== id);
    const meta = ItemMetaSchema.parse({ ...item.meta, skills: id && r.filed ? off(item.meta.skills) : item.meta.skills, suggested_skill: r.suggestion });
    writeAtomic(item.docPath, stringifyFrontmatter(meta, item.body));
    if (!id) return meta;
    const cards = new Set(r.cards);
    for (const c of listCards(lib).filter((c) => cards.has(c.meta.id) && c.meta.skills.includes(id))) writeCardMeta(c, { ...c.meta, skills: off(c.meta.skills) });
    for (const t of r.topics.map((slug) => readTopic(lib, slug)))
      if (t?.meta.skills.includes(id)) writeTopic({ ...t, meta: { ...t.meta, skills: off(t.meta.skills) } });
    const used = allItems(lib).some((i) => i.meta.skills.includes(id)) || listCards(lib).some((c) => c.meta.skills.includes(id)) || listTopics(lib).some((t) => t.meta.skills.includes(id));
    if (r.created && !used) {
      const doc = loadYaml().parseDocument(readFileSync(paths.skills(lib), "utf8"));
      const list = doc.get("skills") as YAMLLib.YAMLSeq<YAMLLib.YAMLMap>;
      const i = list.items.findIndex((m) => m.get("id") === id);
      if (i >= 0) {
        list.items.splice(i, 1);
        writeAtomic(paths.skills(lib), doc.toString({ lineWidth: 0 }));
      }
    }
    return meta;
  });
}

// File a source under exactly `ids`. Its cards follow (a skill taken off the source comes off its
// cards, a new one goes on) and its topics gain the new ones; topics are shared, so none are dropped.
export async function setItemSkills(lib: Library, ref: string, ids: string[]): Promise<ItemMeta> {
  return withLock(paths.lock(lib), () => {
    const known = new Set(loadSkills(lib).skills.map((s) => s.id));
    const unknown = ids.find((id) => !known.has(id));
    if (unknown) throw new Error(`unknown skill "${unknown}"`);
    const item = findItem(lib, ref);
    const next = [...new Set(ids)];
    const added = next.filter((id) => !item.meta.skills.includes(id));
    const removed = item.meta.skills.filter((id) => !next.includes(id));
    const meta = ItemMetaSchema.parse({ ...item.meta, skills: next });
    writeAtomic(item.docPath, stringifyFrontmatter(meta, item.body));
    unarchiveFiled(lib, added);
    for (const c of listCards(lib).filter((c) => c.meta.item === meta.id)) {
      const skills = [...new Set([...c.meta.skills.filter((s) => !removed.includes(s)), ...added])];
      if (skills.join() !== c.meta.skills.join()) writeCardMeta(c, { ...c.meta, skills });
    }
    for (const t of meta.topics.map((slug) => readTopic(lib, slug)))
      if (t && added.some((id) => !t.meta.skills.includes(id))) writeTopic({ ...t, meta: { ...t.meta, skills: [...new Set([...t.meta.skills, ...added])] } });
    return meta;
  });
}

// Delete a skill: drop it from skills.yaml and untag its sources, cards and topics. Nothing else
// goes: cards keep reviewing and the skill note stays on disk. `archive` also archives the sources
// filed only under this skill.
/** What deleting a skill changed, so `restoreSkill` can put it all back (Undo): the skill and its place
 *  in skills.yaml, the sources, cards and topics it was taken off and its place in each one's skills
 *  (the first is the primary one), and which sources it archived. A bare id (printed before places
 *  were kept) goes back at the end. */
const Place = z.number().int().min(0).optional();
const Untagged = z.union([z.string().transform((id) => ({ id, at: undefined })), z.object({ id: z.string(), at: Place })]);
export const RemovedSkillSchema = z.object({
  skill: SkillSchema,
  at: z.number().int().min(0),
  items: z.array(z.object({ id: z.string(), archived: z.boolean(), at: Place })),
  cards: z.array(Untagged),
  topics: z.array(Untagged),
});
export type RemovedSkill = z.input<typeof RemovedSkillSchema>;
/** `skills` with `id` put back at `at` (the end when it isn't known). */
const putBack = (skills: string[], id: string, at?: number) => [...skills.slice(0, at ?? skills.length), id, ...skills.slice(at ?? skills.length)];

export async function removeSkill(lib: Library, id: string, opts: { archive?: boolean } = {}): Promise<{ skill: Skill; untagged: number; archived: number; removed: RemovedSkill }> {
  return withLock(paths.lock(lib), () => {
    const doc = loadYaml().parseDocument(readFileSync(paths.skills(lib), "utf8"));
    const list = doc.get("skills") as YAMLLib.YAMLSeq<YAMLLib.YAMLMap>;
    const i = list.items.findIndex((m) => m.get("id") === id);
    if (i < 0) throw new Error(`unknown skill "${id}"`);
    const skill = parseSkillsFile(doc.toJSON()).file.skills[i]!;
    const removed: RemovedSkill = { skill, at: i, items: [], cards: [], topics: [] };
    for (const item of allItems(lib)) {
      if (!item.meta.skills.includes(id)) continue;
      const skills = item.meta.skills.filter((s) => s !== id);
      const archive = !!opts.archive && !skills.length && !item.meta.archived_at;
      const meta = ItemMetaSchema.parse({ ...item.meta, skills, ...(archive ? { archived_at: nowIso() } : {}) });
      writeAtomic(item.docPath, stringifyFrontmatter(meta, item.body));
      removed.items.push({ id: item.meta.id, archived: archive, at: item.meta.skills.indexOf(id) });
    }
    for (const c of listCards(lib).filter((c) => c.meta.skills.includes(id))) {
      writeCardMeta(c, { ...c.meta, skills: c.meta.skills.filter((s) => s !== id) });
      removed.cards.push({ id: c.meta.id, at: c.meta.skills.indexOf(id) });
    }
    for (const t of listTopics(lib).filter((t) => t.meta.skills.includes(id))) {
      writeTopic({ ...t, meta: { ...t.meta, skills: t.meta.skills.filter((s) => s !== id) } });
      removed.topics.push({ id: t.slug, at: t.meta.skills.indexOf(id) });
    }
    // Last, so a run cut off midway leaves the skill still there: running it again finishes the job.
    list.items.splice(i, 1);
    writeAtomic(paths.skills(lib), doc.toString({ lineWidth: 0 }));
    return { skill, untagged: removed.items.length, archived: removed.items.filter((x) => x.archived).length, removed };
  });
}

/** Undoes `removeSkill`: the skill goes back where it was, filed again under everything it was taken
 *  off, and the sources it archived come back. Anything deleted since is skipped. */
export async function restoreSkill(lib: Library, input: RemovedSkill): Promise<Skill> {
  const r = RemovedSkillSchema.parse(input);
  const id = r.skill.id;
  return withLock(paths.lock(lib), () => {
    const doc = loadYaml().parseDocument(readFileSync(paths.skills(lib), "utf8"));
    const list = doc.get("skills") as YAMLLib.YAMLSeq<YAMLLib.YAMLMap>;
    if (list.items.some((m) => m.get("id") === id)) throw new Error(`a skill "${id}" already exists`);
    list.items.splice(Math.min(r.at, list.items.length), 0, doc.createNode(r.skill) as YAMLLib.YAMLMap);
    writeAtomic(paths.skills(lib), doc.toString({ lineWidth: 0 }));
    const back = new Map(r.items.map((x) => [x.id, x]));
    for (const item of allItems(lib)) {
      const was = back.get(item.meta.id);
      if (!was || item.meta.skills.includes(id)) continue;
      const { archived_at, ...rest } = item.meta;
      const meta = ItemMetaSchema.parse({ ...rest, skills: putBack(item.meta.skills, id, was.at), ...(was.archived ? {} : archived_at ? { archived_at } : {}) });
      writeAtomic(item.docPath, stringifyFrontmatter(meta, item.body));
    }
    const cards = new Map(r.cards.map((c) => [c.id, c.at]));
    for (const c of listCards(lib).filter((c) => cards.has(c.meta.id) && !c.meta.skills.includes(id))) writeCardMeta(c, { ...c.meta, skills: putBack(c.meta.skills, id, cards.get(c.meta.id)) });
    for (const { id: slug, at } of r.topics) {
      const t = readTopic(lib, slug);
      if (t && !t.meta.skills.includes(id)) writeTopic({ ...t, meta: { ...t.meta, skills: putBack(t.meta.skills, id, at) } });
    }
    return r.skill;
  });
}

export async function dismissSuggestedSkill(lib: Library, ref: string): Promise<ItemMeta> {
  return updateItemMeta(lib, ref, (m) => ({ ...m, suggested_skill: undefined }));
}
