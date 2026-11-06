import { invoke } from "@tauri-apps/api/core";

/** The iPhone build (`ORE_PHONE=1 vite build`, apps/phone). */
export const PHONE = import.meta.env.VITE_PHONE === "1";

// Every library read and write goes through the `ore` CLI (D30). Errors are the CLI's one-line message.

/** Runs `ore <args> --json` and returns the parsed output. */
export const ore = <T,>(...args: string[]): Promise<T> => oreWith<T>(null, ...args);

/** `ore` with `stdin` piped in (`ore diagram <item> <name> --set`). */
export const oreWith = <T,>(stdin: string | null, ...args: string[]): Promise<T> => oreJob<T>(null, stdin, ...args);

/** `ore` run under the name `job`, which `cancelOre(job)` stops (Cancel on an add). */
export async function oreJob<T>(job: string | null, stdin: string | null, ...args: string[]): Promise<T> {
  // On iPhone the same commands run inside the app (src/phone/core.ts).
  if (PHONE) return (await import("./phone/core")).run<T>(args, stdin);
  try {
    return await invoke<T>("ore", { args, stdin, job });
  } catch (e) {
    throw new Error(typeof e === "string" ? e : String(e));
  }
}

/** Stops the run named `job`: `ore` takes out what it wrote so far, and its call fails. */
export const cancelOre = (job: string): Promise<void> => invoke<void>("ore_cancel", { job }).catch(() => {});

/** `--name=value` in one argument: node's parseArgs rejects a separate value that starts with "-"
 *  (a Markdown list), so free text always goes in this form. */
export const opt = (name: string, value: string) => `--${name}=${value}`;

/** Starts `ore <args>` in the background (long AI jobs); output goes to the library's .ore/logs/. */
export async function oreDetached(...args: string[]): Promise<void> {
  // Background jobs are AI work (enrich, remix), which runs on the Mac (D7).
  if (PHONE) return;
  try {
    await invoke("ore_detached", { args });
  } catch (e) {
    throw new Error(typeof e === "string" ? e : String(e));
  }
}

export type Status = "inbox" | "reading" | "done";
/** The two source tabs (D28): To read holds inbox (not opened yet) and reading (started) sources. */
export type Tab = "toread" | "done" | "archived";
/** Archived sources come from `ore ls --archived`, never from the main list, so no status is in that tab. */
export const inTab = (s: Status, tab: Tab) => tab !== "archived" && (tab === "done") === (s === "done");
export type Intent = "keep" | "card" | "question";
export const INTENTS: Intent[] = ["keep", "card", "question"];

/** A passage of the body that supports a key point, anchored like a highlight (D56). */
export type Evidence = { exact: string; prefix: string; suffix: string; start: number; end: number };
export type KeyPoint = { text: string; evidence: Evidence[] };
/** `confidence` 1 guess, 2 think so, 3 sure; `check.covered` has one mark per key point (D53 to D56). */
/** `skipped`: not part of this finish (D100), its answer past where he stopped or left out by his note. */
export type Prequestion = { q: string; before?: string; after?: string; confidence?: number; points?: KeyPoint[]; check?: { covered: boolean[]; edited?: boolean }; skipped?: "past" | "left_out" };

export type Item = {
  id: string;
  type: string;
  title: string;
  author?: string;
  url?: string;
  /** A page that plays a video (D92): the video's link; the page's link is `url`. */
  video?: string;
  /** Absolute paths: the item's folder and the original kept at capture (source.pdf, …), if any. */
  dir: string;
  source_file?: string;
  /** Absolute path of thumbnail.* beside doc.md (D77), if the source has one. */
  thumbnail?: string;
  captured_at: string;
  status: Status;
  /** A Feed post being read, not saved: a highlight or a note line keeps it. */
  preview?: string;
  /** Archived: hidden from lists and search (only in the Archived tab). */
  archived_at?: string;
  /** Pinned: listed first, under Pinned. */
  pinned_at?: string;
  /** Last opened in the reader (D110). */
  opened_at?: string;
  /** A PDF's tables or formulas that read as plain text until the optional reader reads them (D125). */
  structure?: ("tables" | "formulas")[];
  /** `ore show`: being read now, or read; why the last reading failed; whether the reader is installed. */
  tables?: "reading" | "read";
  tables_error?: string;
  tables_reader?: boolean;
  skills: string[];
  suggested_skill?: { name: string; hook?: string };
  prequestions?: Prequestion[];
  enriched_at?: string;
  /** Why background enrich failed, while the source has never been enriched. */
  enrich_error?: string;
  recall?: { text: string; at: string; feedback?: string };
  chapter_recalls?: ChapterRecall[];
  /** From `ore ls`: the source note (notes.md) has text. */
  has_notes?: boolean;
  /** A lesson of a course (D79): the course's id, title and link, and the lesson's place in it (from 1). */
  course?: Course;
  /** From `ore ls`, on the lesson that holds it: the course's own picture (its page's og:image). */
  course_cover?: string;
};
export type Course = { id: string; title: string; part: number; url?: string };

/** A course's lessons among `items`, in course order. */
export const lessonsOf = (items: Item[], course: string): Item[] =>
  items.filter((i) => i.course?.id === course).sort((a, b) => a.course!.part - b.course!.part);
/** The picture that stands for a course: its own cover, else its first lesson's thumbnail that has one. */
export function courseThumb(lessons: Item[]): Pick<Item, "type" | "thumbnail"> | undefined {
  const own = lessons.find((l) => l.course_cover)?.course_cover;
  return own ? { type: "article", thumbnail: own } : lessons.find((l) => l.thumbnail);
}
/** The lesson to open next: the first one not done (null when all are). */
export const nextLesson = (lessons: Item[]): Item | null => lessons.find((l) => l.status !== "done") ?? null;
/** How many rows a tab lists: a course counts once, in To read while any lesson is left, in Done once all are. */
export function tabCount(items: Item[], tab: Tab): number {
  const courses = new Map<string, boolean>();
  let n = 0;
  for (const i of items) {
    if (!i.course) n += Number(inTab(i.status, tab));
    else courses.set(i.course.id, (courses.get(i.course.id) ?? false) || i.status !== "done");
  }
  for (const left of courses.values()) n += Number(tab !== "archived" && left === (tab === "toread"));
  return n;
}

/** EPUB chapter recall (D18); `n` is the number in the body's `<!-- chapter N -->` marker. */
export type ChapterRecall = { n: number; text: string; at: string; feedback?: ChapterFeedback };
/** `section_lines`: one line on his section lines (D32), null when he wrote none in that range. */
export type ChapterFeedback = { feedback: string; missed: string[]; section_lines?: string | null };

export type Annotation = {
  id: string;
  /** Set on the highlight that kept a Feed post as a source. */
  kept_from_feed?: boolean;
  rev: number;
  intent: Intent;
  exact: string;
  prefix: string;
  suffix: string;
  start: number;
  end: number;
  note?: string;
  status: string;
  anchor?: { start: number; end: number; method: string } | null;
  /** Card here: a line he typed with nothing selected; `exact` is only the sentence where he was. */
  point?: boolean;
};

/** `ore questions`: a Question-intent highlight (D47); status "done" means answered. `answers` is his
 *  answer so far, piece by piece, each naming the source he wrote it from; `matches` the sources that
 *  may answer it (D75). With `--item`, `here` says why it is listed for that source. */
export type Question = Annotation & {
  item: string;
  ts: string;
  item_title: string;
  answers: { ts: string; text: string; item?: string; item_title?: string; quote?: string }[];
  matches: { item: string; title: string; quote?: string; start?: number }[];
  here?: "match" | "from" | "skill";
};

/** `ore stats --skill`: one row; retention is null below 10 reviews (D23). */
export type SkillStats = {
  skill: string;
  items_read: number;
  cards_live: number;
  reviews: number;
  retention: number | null;
  strength: Strength;
  /** Solid memories at each of the last 12 week ends, oldest first. */
  growth: { week_end: string; solid: number }[];
};

/** `ore research`: 3–5 sources for a highlight (D17); nothing is added until he picks one. */
export type Research = { sources: { title: string; url: string; site: string; type: string; why: string; minutes?: number | null }[] };

/** `ore show` on a YouTube source: the video and each transcript word's start time, `[seconds, word]`, in body order (D49). */
export type Transcript = { video: string; words: [number, string][] };

/** `reached` and `leave_out`: what his last partway finish covered (D100). */
export type Doc = Item & { body: string; annotations?: Annotation[]; transcript?: Transcript | null; reached?: number; leave_out?: { text: string } };

export const SKILL_COLORS = ["gray", "red", "orange", "yellow", "green", "teal", "blue", "purple", "pink"] as const;
export type SkillColor = (typeof SKILL_COLORS)[number];
/** `collection` groups skills in the sidebar. */
/** `hook` is his one line on why he is learning it (D63); `goal` what he could show he can do (D101). */
export type Skill = { id: string; name: string; hook?: string; goal?: string; icon?: string; color?: SkillColor; collection?: string };

export type SearchHit = { kind: string; ref: string; item?: string; title: string; snippet?: string };

/** `ore notes`: a source note or a skill note (notes.md) as it now is; `dir` is its folder, absolute. */
export type Notes = { item?: string; skill?: string; text: string; path: string; dir: string };

/** `ore backlinks`: a line in another note that links here (D39). */
export type Backlink = { from: { kind: "item" | "skill"; id: string; title: string }; heading: string | null; line: string };

/** `ore diagram`: a scene in Excalidraw's file format beside a note (D40, D103); `scene` is null until first saved. */
export type Diagram = { item?: string; skill?: string; name: string; path: string; scene: { type: "excalidraw"; elements: unknown[]; files?: Record<string, unknown>; [k: string]: unknown } | null };

export type Feedback = { item: string; feedback: string; questions?: { n: number; feedback: string }[]; missed?: string[]; section_lines?: string | null };

export const loadSkills = () => ore<Skill[]>("skills");

export const visible = (a: Annotation) => a.status !== "deleted";

/** `ore today` (D58, D60): the daily goal, what is due, this week, and each skill's due cards and strength. */
export type Today = {
  goal_minutes: number;
  weekdays_only: boolean;
  new_per_day: number;
  counts: boolean;
  active_ms: number;
  goal_ms: number;
  met: boolean;
  caught_up: boolean;
  due: number;
  new_today: number;
  new_waiting: number;
  estimate_ms: number;
  /** Today's slice: the most urgent cards that fit what is left of the goal (D65). */
  slice_ms: number;
  /** "After <plan>, I review." ("" for none) and the reminder time, "HH:MM" or "" (D67). */
  plan: string;
  reminder: string;
  week: { date: string; status: "met" | "open" | "off"; active_ms: number }[];
  days_met: number;
  skills: ({ skill: string; due: number } & Omit<Strength, "explain">)[];
};

/** A skill's strength (D62, D63): solid = live cards with stability of 21 days or more. `level`
 *  comes from the most solid memories it ever had, so it never drops; `win_back` were solid once. */
export type Strength = {
  solid: number;
  growing: number;
  /** Growing cards that become solid if he recalls them at their next review (D90). */
  ready: number;
  ready_today: number;
  new: number;
  win_back: number;
  peak: number;
  level: number;
  next_level_at: number;
  explain: { id: string; question: string }[];
};

/** Where the next level stands, framed from the last level until halfway and from the goal after
 *  (D63: motivation sags in the middle when it is counted from one end only). */
export function levelProgress(k: Pick<Strength, "solid" | "level" | "next_level_at">): { share: number; line: string } {
  const from = 5 * k.level ** 2;
  const left = k.next_level_at - k.solid;
  const since = k.solid - from;
  const share = Math.max(0, Math.min(1, since / Math.max(1, k.next_level_at - from)));
  return { share, line: k.level > 0 && since > 0 && since < left ? `${since} since level ${k.level}` : `${left} to level ${k.level + 1}` };
}

/** `ore due`: one card in queue order. `card` is a Fact, `prompt` an Explain (D43). */
export type DueEntry = { id: string; kind: "card" | "prompt"; state: "draft" | "live"; item: string; skills: string[]; question: string; relearn: boolean };

/** `ore card show`. */
export type CardFull = {
  id: string; kind: "card" | "prompt"; state: "draft" | "live" | "retired"; item: string; annotation?: string; question: string; answer: string; rubric: string[];
  /** A remixed version shown in review (D66), with the card it stands in for. */
  variant?: string; original?: { question: string; answer: string; rubric: string[] };
  /** Review may offer "In my head" (D68): an Explain card he has passed twice. */
  in_head_ok?: boolean;
  /** A card from a line he typed (Card here, D99): the passages that answer it, found in the source. */
  evidence?: { exact: string; start: number; end: number }[];
};

/** `ore grade`: a proposed rating (never logged by itself, D21) and one mark per rubric point. */
export type Grade = { rating: 1 | 2 | 3 | 4; gaps: string[]; feedback: string; covered: boolean[] };

/** `ore session end` (D62). */
export type SessionEnd = {
  id: string; reviews: number; kept: number; rescued: number; caught_up?: boolean;
  /** Cards that became solid this session, as each one's first skill (D90): one cut gem each. */
  cut?: string[];
  /** On the week's first end screen (D69): of Explain answers marked Sure, the share the key-point check passed. */
  calibration?: { sure_n: number; sure_right: number } | null;
};

/** When he last added or opened a source: To read lists the last touched first (D110). */
export const touched = (i: Pick<Item, "captured_at" | "opened_at">) => (i.opened_at && i.opened_at > i.captured_at ? i.opened_at : i.captured_at);
