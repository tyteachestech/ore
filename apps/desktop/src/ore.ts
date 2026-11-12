import { invoke } from "@tauri-apps/api/core";

/** The iPhone build (`ORE_PHONE=1 vite build`, apps/phone). */
export const PHONE = import.meta.env.VITE_PHONE === "1";

/** On iPhone, reads in what the Mac changed (through iCloud) since; true if anything did. Never on the Mac. */
/** The share card's skill chips (phone/core.ts `shareSkills`); nothing on the Mac. */
export const shareSkills = async (skills: { id: string; name: string; icon?: string; color?: string }[]): Promise<void> => {
  if (PHONE) (await import("./phone/core")).shareSkills(skills);
};
/** The inbox item the share card's Open asked the phone to show (phone/core.ts `shareOpen`); nothing on the Mac. */
export const shareOpen = async (): Promise<string | null> => (PHONE ? (await import("./phone/core")).shareOpen() : null);
/** A file picked on the phone goes to the inbox to be imported (phone/core.ts `queuePicked`). */
export const queuePicked = async (name: string, bytes: Uint8Array, skill?: string): Promise<void> => {
  if (PHONE) await (await import("./phone/core")).queuePicked(name, bytes, skill);
};
export const pullFromMac = async (): Promise<boolean> => (PHONE ? (await import("./phone/core")).pull() : false);

// Every library read and write goes through the `ore` CLI (D30). Errors are the CLI's one-line message.

/** Runs `ore <args> --json` and returns the parsed output. */
export const ore = <T,>(...args: string[]): Promise<T> => oreWith<T>(null, ...args);

/** `ore` with `stdin` piped in (`ore diagram <item> <name> --set`). */
export const oreWith = <T,>(stdin: string | null, ...args: string[]): Promise<T> => oreJob<T>(null, stdin, ...args);

/** `ore` run under the name `job`, which `cancelOre(job)` stops (Cancel on an add). */
export async function oreJob<T>(job: string | null, stdin: string | null, ...args: string[]): Promise<T> {
  // On iPhone the same commands run inside the app (src/phone/core.ts).
  if (PHONE) return (await import("./phone/core")).run<T>(args, stdin);
  const call = async () => {
    try {
      return await invoke<T>("ore", { args, stdin, job });
    } catch (e) {
      throw new Error(typeof e === "string" ? e : String(e));
    }
  };
  return args[0] === "init" ? call() : firstRun(call, () => invoke("ore", { args: ["init"], stdin: null, job: null }));
}

let creating: Promise<unknown> | null = null;
/** First launch on a new Mac: there is no library yet, so make the default one (~/Ore) once and
 *  try again, instead of greeting a friend with "no library at …". */
export async function firstRun<T>(call: () => Promise<T>, init: () => Promise<unknown>): Promise<T> {
  try {
    return await call();
  } catch (e) {
    if (!(e instanceof Error && e.message.startsWith("no library at"))) throw e;
    await (creating ??= init().catch((err) => {
      creating = null;
      throw new Error(typeof err === "string" ? err : String(err));
    }));
    return call();
  }
}

/** Stops the run named `job`: `ore` takes out what it wrote so far, and its call fails. */
export const cancelOre = (job: string): Promise<void> => invoke<void>("ore_cancel", { job }).catch(() => {});

/** `--name=value` in one argument: node's parseArgs rejects a separate value that starts with "-"
 *  (a Markdown list), so free text always goes in this form. */
export const opt = (name: string, value: string) => `--${name}=${value}`;

export type Status = "inbox" | "reading" | "done";
/** The two source tabs (D28): To read holds inbox (not opened yet) and reading (started) sources. */
export type Tab = "toread" | "done" | "archived";
/** Archived sources come from `ore ls --archived`, never from the main list, so no status is in that tab. */
export const inTab = (s: Status, tab: Tab) => tab !== "archived" && (tab === "done") === (s === "done");
export type Intent = "keep" | "card" | "question" | "apply";
export const INTENTS: Intent[] = ["keep", "card", "question", "apply"];

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
  /** The date it was published, as its page, file or feed gave it ("2024-12-19", "2024"). */
  published?: string;
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
  /** When it was finished: kept on its way to Done. */
  finished_at?: string;
  /** A PDF's tables or formulas that read as plain text until the optional reader reads them (D125). */
  structure?: ("tables" | "formulas")[];
  /** What the device that added it couldn't bring in (a video's transcript on the iPhone, D235). */
  owed?: "transcript"[];
  owed_error?: string;
  /** `ore show`: being read now, or read; why the last reading failed; whether the reader is installed. */
  tables?: "reading" | "read";
  tables_error?: string;
  tables_reader?: boolean;
  /** An episode whose own page is kept and whose text isn't in it yet (D219): one click adds it. */
  page_text?: boolean;
  skills: string[];
  suggested_skill?: { name: string; hook?: string };
  prequestions?: Prequestion[];
  enriched_at?: string;
  /** Why background enrich failed, while the source has never been enriched. */
  enrich_error?: string;
  /** Added with no enrich on its way (`ore add --no-enrich`): nothing is writing its prequestions. */
  enrich_skipped?: boolean;
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
/** A pin time that lists a source between two pinned ones (they list by `pinned_at`): halfway
 *  between them, or a second past the end it goes to. */
export function pinBetween(before?: string, after?: string): string {
  const a = before ? Date.parse(before) : NaN;
  const b = after ? Date.parse(after) : NaN;
  const t = !Number.isNaN(a) && !Number.isNaN(b) ? Math.round((a + b) / 2) : !Number.isNaN(b) ? b - 1000 : !Number.isNaN(a) ? a + 1000 : Date.now();
  return new Date(t).toISOString();
}

/** What a list's search knows a source by (`ranked`): its title first, then its course, author, site, skills and type. */
export const searchFields = (i: Item, site?: string, skills: string[] = []): (string | undefined)[] => [i.title, i.course?.title, i.author, siteName(site), ...skills, i.type];
/** A site as searched: its name without the ending ("nytimes" for nytimes.com, "bbc.co" for bbc.co.uk), or
 *  "com" would find nearly every web page as one types "Complete" (bench "filter sources"). */
const siteName = (site?: string) => site?.replace(/\.[^.]+$/, "");
/** The lesson to open next: the first one not done (null when all are). */
export const nextLesson = (lessons: Item[]): Item | null => lessons.find((l) => l.status !== "done") ?? null;
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
  /** Apply (D127): how it went, written when he checked the try off. */
  reflection?: string;
  /** Apply (D148): the rounds before this one, oldest first, each with his plan and how it went. */
  uses?: { ts: string; plan?: string; reflection?: string }[];
};

/** `ore tries`: an Apply highlight (D127), a technique he plans to try on his own work; `note` is his
 *  plan, status "done" means tried. */
export type Try = Annotation & { item: string; ts: string; item_title: string };

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
export type Doc = Item & { body: string; annotations?: Annotation[]; transcript?: Transcript | null; audio?: { file: string; words: [number, string][] }; reached?: number; leave_out?: { text: string } };

export const SKILL_COLORS = ["gray", "red", "orange", "yellow", "green", "teal", "blue", "purple", "pink"] as const;
export type SkillColor = (typeof SKILL_COLORS)[number];
/** `collection` groups skills in the sidebar. */
/** `hook` is his one line on why he is learning it (D63); `goal` what he could show he can do (D101). */
export type Priority = "P1" | "P2" | "P3";
export type Skill = { id: string; name: string; priority?: Priority; archived?: boolean; hook?: string; goal?: string; icon?: string; color?: SkillColor; collection?: string };

export type SearchHit = { kind: string; ref: string; item?: string; title: string; snippet?: string; annotation?: string };

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
  /** Of `due`, the exercises filed under no skill: What to review's "No skill" row (D204). */
  no_skill_due: number;
  estimate_ms: number;
  /** Today's slice: the most urgent cards that fit what is left of the goal (D65). */
  slice_ms: number;
  /** "After <plan>, I review." ("" for none) and the reminder time, "HH:MM" or "" (D67). */
  plan: string;
  reminder: string;
  week: { date: string; status: "met" | "open" | "off"; active_ms: number }[];
  days_met: number;
  skills: ({ skill: string; due: number } & Omit<Strength, "explain">)[];
  /** Sources whose doc.md can't be read, and why (files-10): they drop out of every list. */
  unreadable: { dir: string; error: string }[];
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
  /** Gem grades (D197), each solid gem once: polished on a new case, or missed once and won back. */
  mended: number;
  polished: number;
  /** How long his live memories now last, in days, added up. */
  depth: number;
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
export type DueEntry = { id: string; kind: "card" | "prompt"; state: "draft" | "live"; item: string; skills: string[]; question: string; relearn: boolean; /** null: never reviewed. */ due?: string | null; /** His chance of recalling it now, 0 to 1. */ retrievability?: number };

/** `ore card show`. */
export type CardFull = {
  id: string; kind: "card" | "prompt"; state: "draft" | "live" | "retired"; item: string; annotation?: string; question: string; answer: string; rubric: string[];
  /** A remixed version shown in review (D66), with the card it stands in for. */
  variant?: string; original?: { question: string; answer: string; rubric: string[] };
  /** Review may offer "In my head" (D68): an Explain card he has passed twice. */
  in_head_ok?: boolean;
  /** A card from a line he typed (Card here, D99): the passages that answer it, found in the source. */
  evidence?: { exact: string; start: number; end: number }[];
  /** A card from part of a figure (D166): the image as the source names it and the box hidden in review, as
   *  fractions of its size; `figure_file` is where the image is (show only). */
  figure?: { src: string; box: [number, number, number, number] };
  figure_file?: string;
  /** Its reviews and where each rating puts the next one (D149); with --review only. */
  history?: CardHistory;
};
export type CardHistory = { reviews: { ts: string; rating: 1 | 2 | 3 | 4 }[]; next: Record<1 | 2 | 3 | 4, string> };

/** `ore grade`: a proposed rating (never logged by itself, D21) and one mark per rubric point, with the words
 *  of his answer that earned each covered one ("" for none; absent from a grade made before D141). */
export type Grade = { rating: 1 | 2 | 3 | 4; gaps: string[]; feedback: string; covered: boolean[]; evidence?: string[]; ai?: { vendor: string; model: string; prompt_version: string } };

/** `ore session end` (D62). */
/** The end screen says how many were rescued only when they are a minority of the session: over a backlog
 *  (the normal state, docs/design/daily-session.md) nearly every card is, so the line would say nothing. */
export const rescuedWorthSaying = (s: { reviews: number; rescued: number }) => s.rescued > 0 && s.rescued * 2 < s.reviews;

/** How far ahead the closing card may come from, and how likely its recall must be. */
const LAST_WIN_WINDOW = 10;
const LAST_WIN_AT = 0.6;
/** D177: when the goal closes on a miss, the session's last moment is a failure, and hard tasks that come
 *  last raise quitting (Kang 2022). One more card first: the likeliest recall of the next ten, moved to the
 *  front. Null when none is likely enough, and the session ends as it did. Never the card just missed or a
 *  new one. Order only: every card keeps its own schedule (D22). */
export function lastWin(queue: DueEntry[]): DueEntry[] | null {
  let best = -1;
  queue.slice(0, LAST_WIN_WINDOW).forEach((e, i) => {
    if (!e.relearn && e.due && (e.retrievability ?? 0) >= LAST_WIN_AT && (best < 0 || e.retrievability! > queue[best]!.retrievability!)) best = i;
  });
  return best < 0 ? null : [queue[best]!, ...queue.slice(0, best), ...queue.slice(best + 1)];
}

/** Later (D192, Anki's Bury for one session): the exercise on screen goes to the end of the session, nothing
 *  recorded. `off` is what he has put off this session before. Null when every exercise left, this one too,
 *  has been put off: the session ends and they stay due, so Laters in a row can never go round forever. */
export function putOff(queue: DueEntry[], off: ReadonlySet<string>): DueEntry[] | null {
  const [head, ...rest] = queue;
  if (!head || rest.every((e) => off.has(e.id))) return null;
  return [...rest, head];
}

/** The gap worth naming on the end screen (D177): a week or more. */
const LONG_GAP_DAYS = 7;
export const longGapText = (s: { longest_days?: number }) => ((s.longest_days ?? 0) >= LONG_GAP_DAYS ? `You recalled one you last saw ${s.longest_days} days ago` : null);

/** A span of memory in the unit a person would say it in (D197): days to two months, months to two years, then years. */
export function depthText(days: number): string {
  const n = Math.round(days);
  if (n < 60) return `${n} ${n === 1 ? "day" : "days"}`;
  if (n < 730) return `${Math.round(n / 30.44)} months`;
  return `${(n / 365.25).toFixed(1).replace(/\.0$/, "")} years`;
}

export type SessionEnd = {
  id: string; reviews: number; kept: number; rescued: number; caught_up?: boolean;
  /** The longest gap, in days, he recalled a card across this session (D177). */
  longest_days?: number;
  /** Cards that became solid this session, as each one's first skill (D90): one cut gem each. */
  cut?: string[];
  /** Per cut gem, its grade (D197): mended (won back after a miss) or polished (passed as a remix); absent when all are plain. */
  grades?: ("cut" | "mended" | "polished")[];
  /** Gems cut before this session and polished in it, as each one's first skill (D197). */
  polished?: string[];
  /** How much longer the exercises he passed now last, in days added up (D197). */
  depth_days?: number;
  /** On the week's first end screen (D69): of Explain answers marked Sure, the share the key-point check passed. */
  calibration?: { sure_n: number; sure_right: number; levels: { confidence: 1 | 2 | 3; n: number; right: number | null }[] } | null;
};

/** When he last added or opened a source: To read lists the last touched first (D110). */
export const touched = (i: Pick<Item, "captured_at" | "opened_at">) => (i.opened_at && i.opened_at > i.captured_at ? i.opened_at : i.captured_at);
