import { renameSync } from "node:fs";
import { join } from "node:path";
import { reanchorItem } from "../annotations.ts";
import { stringifyFrontmatter } from "../frontmatter.ts";
import { writeAtomic } from "../fsutil.ts";
import { ulid } from "../ids.ts";
import { createItem, findItem, listItems, readItemDir, setItemArchived, sourceFile, type CourseRef, type Item, type NewItem } from "../items.ts";
import { paths, type Library } from "../library.ts";
import { withLock } from "../lock.ts";
import { setItemSkills } from "../skills.ts";
import { withImages } from "./assets.ts";
import { dropTitle, hasText, pageDraft, withTranscript } from "./page.ts";
import { courseCoverFile, makeCourseCover, makeThumbnail } from "./thumbnail.ts";
import { ytDlp } from "./youtube.ts";

// A course is a list of lessons, each added as its own source (option B, docs/design/courses-and-live-links.md).
// Two kinds are read: a Claude Academy course (its page lists the lessons in order; a lesson's video ID
// lives in the script the page loads, not in its HTML) and a YouTube playlist (through yt-dlp).

export interface CourseLesson {
  title: string;
  /** The lesson's page. */
  url: string;
  /** The lesson's YouTube video, when it has one; it is then added as a video source with its transcript. */
  video?: string;
}

export interface CoursePlan {
  title: string;
  url: string;
  lessons: CourseLesson[];
}

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

const ACADEMY = /^https?:\/\/(?:www\.)?academy\.claude\.com\/courses\/([\w-]+)(?:\/[\w-]*)?\/?(?:[?#].*)?$/;
const PLAYLIST = /^https?:\/\/(?:www\.|m\.)?youtube\.com\/playlist\?(?:.*&)?list=([\w-]+)/;

/** Whether a link is a course Ore can add lesson by lesson (a Claude Academy course or lesson, a YouTube playlist). */
export const isCourseUrl = (url: string): boolean => ACADEMY.test(url) || PLAYLIST.test(url);

const decode = (s: string) =>
  s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

async function get(url: string): Promise<string> {
  const host = new URL(url).host;
  const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow" }).catch(() => {
    throw new Error(`Couldn’t reach ${host}. Check your connection and try again.`);
  });
  if (!res.ok) throw new Error(`Couldn’t open ${url} (HTTP ${res.status} from ${host}). Check the link and try again.`);
  return res.text();
}

/** The lessons of a Claude Academy course, in order, from the course page's HTML (a lesson page's
 *  link leads to its course). The course quiz and badge pages are left out: they are not lessons. */
export function academyLessons(html: string, course: string, origin: string): { title: string; lessons: CourseLesson[] } {
  const title = decode(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "") || decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "").replace(/ · Claude Academy$/, "");
  const seen = new Set<string>();
  const lessons: CourseLesson[] = [];
  const link = new RegExp(`<a[^>]*href="(/courses/${course}/([\\w-]+))"[^>]*>([\\s\\S]*?)</a>`, "g");
  for (const m of html.matchAll(link)) {
    const [, path, slug, inner] = m;
    const text = decode(inner!);
    // "Start course" and "Continue" buttons link to a lesson too; its title comes from the lesson list.
    if (!text || seen.has(slug!) || slug === "badge" || /\bquiz$/i.test(text) || /^(start|continue|resume)\b/i.test(text)) continue;
    seen.add(slug!);
    lessons.push({ title: text, url: origin + path });
  }
  return { title, lessons };
}

/** Each lesson's YouTube ID, by lesson slug, from the scripts the course page loads: the router chunk
 *  names each lesson's script, and a lesson with a video passes `youtubeId:"…"` to its player. */
async function academyVideos(html: string, course: string, origin: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const router = html.match(/\/assets\/[\w/-]*courses-[\w-]+\.js/)?.[0];
  if (!router) return out;
  const js = await get(origin + router).catch(() => "");
  const chunk = new RegExp(`assets/[\\w/-]*content/courses/${course}/lessons/\\d+-([\\w-]+)/index-[\\w-]+\\.js`, "g");
  const chunks = new Map<string, string>();
  for (const m of js.matchAll(chunk)) chunks.set(m[1]!, m[0]);
  await Promise.all(
    [...chunks].map(async ([slug, path]) => {
      const id = (await get(`${origin}/${path}`).catch(() => "")).match(/youtubeId:"([\w-]{11})"/)?.[1];
      if (id) out.set(slug, id);
    }),
  );
  return out;
}

async function playlist(url: string): Promise<CoursePlan> {
  const bin = ytDlp();
  if (!bin) throw new Error("Playlists need yt-dlp, which isn’t installed. Run `brew install yt-dlp` in Terminal, then try again.");
  const proc = Bun.spawn([bin, "-J", "--flat-playlist", "--no-warnings", url], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  if (code !== 0) throw new Error(`Couldn’t read that playlist: ${stderr.trim().split("\n").pop()?.replace(/^ERROR:\s*/, "")}. Check the link; if it opens in the browser, run \`brew upgrade yt-dlp\` and try again.`);
  const info = JSON.parse(stdout) as { title?: string; webpage_url?: string; entries?: { id: string; title?: string }[] };
  const lessons = (info.entries ?? [])
    .filter((e) => e.id && e.title && !/^\[(private|deleted) video\]$/i.test(e.title))
    .map((e) => {
      const video = `https://www.youtube.com/watch?v=${e.id}`;
      return { title: e.title!, url: video, video };
    });
  return { title: info.title || "Playlist", url: info.webpage_url ?? url, lessons };
}

/** Reads a course's title and lessons without adding anything. */
export async function planCourse(url: string): Promise<CoursePlan> {
  if (PLAYLIST.test(url)) return playlist(url);
  const m = url.match(ACADEMY);
  if (!m) throw new Error("That link isn’t a course Ore can read (a Claude Academy course or a YouTube playlist).");
  const course = m[1]!;
  const origin = new URL(url).origin;
  const page = `${origin}/courses/${course}`;
  const html = await get(page);
  const { title, lessons } = academyLessons(html, course, origin);
  if (!lessons.length) throw new Error(`Found no lessons on ${page}. Open it in the browser to check it’s a course.`);
  const videos = await academyVideos(html, course, origin);
  return {
    title,
    url: page,
    lessons: lessons.map((l) => {
      const id = videos.get(l.url.split("/").pop()!);
      return id ? { ...l, video: `https://www.youtube.com/watch?v=${id}` } : l;
    }),
  };
}

/** A lesson as a source: its page's text and its video's transcript in one source (D92), the video
 *  alone when the page has nothing to read, the page alone when there is no video. A playlist's
 *  lesson is only its video. */
export async function lessonDraft(l: CourseLesson): Promise<Omit<NewItem, "course" | "skills">> {
  const html = l.url === l.video ? "" : await get(l.url).catch((e) => (l.video ? "" : Promise.reject(e)));
  // The course's name for the lesson, not the video's ("Lesson 2B: … | AI Fluency course").
  const d = await pageDraft(html, l.url, { title: l.title, video: l.video });
  // The author a course page yields is page furniture, not a person.
  return d.type === "article" ? { ...d, author: undefined } : d;
}

/** Whether a lesson added before D92 lacks its page's text: a video lesson with a page of its own. */
const lacksPage = (i: Item, l: CourseLesson | undefined) => !!l?.video && l.url !== l.video && i.meta.type === "youtube";

/** Gives a lesson added as a bare video its page's text (D92), when the page has some: the text goes
 *  above the transcript it had (the video isn't fetched again), its highlights re-anchor, and the
 *  lesson keeps its id, cards, notes and progress. Returns whether it changed. */
async function fillPage(lib: Library, item: Item, l: CourseLesson): Promise<boolean> {
  const html = await get(l.url);
  const w = await (await import("./web.ts")).htmlToDoc(html, l.url).catch(() => null);
  const vtt = sourceFile(item);
  if (!w || !hasText(w.markdown) || !vtt?.endsWith(".vtt")) return false;
  await withLock(paths.lock(lib), () => {
    writeAtomic(join(item.dir, "source.html"), html);
    renameSync(vtt, join(item.dir, "transcript.vtt"));
    const meta = { ...item.meta, type: "article" as const, url: l.url, video: item.meta.url };
    writeAtomic(item.docPath, stringifyFrontmatter(meta, withTranscript(dropTitle(w.markdown, item.meta.title), item.body)));
  });
  await reanchorItem(lib, readItemDir(item.dir));
  return true;
}

export interface CourseAdded {
  course: Omit<CourseRef, "part">;
  added: Item[];
  /** Lessons already in the library from an earlier add, skipped. */
  kept: number;
  /** Lessons already here that got their page's text this time (D92). */
  filled: Item[];
  failed: { part: number; title: string; error: string }[];
  /** Skills the course was filed under by this add that it didn't have. */
  filed: string[];
  /** Archived lessons this add brought back. */
  restored: number;
}

/** Adds every lesson of a course as its own source, in order. Adding a course already in the library
 *  (same course link) adds only the lessons it lacks, so a retry never repeats what already worked. */
/** `onLesson` runs as each lesson starts, with how many of the lessons this add fetches are done, so a
 *  retry that fetches 2 missing lessons counts 0 of 2, not 12 of 14. */
export async function addCourse(lib: Library, plan: CoursePlan, opts: { skills?: string[]; onLesson?: (done: number, of: number, title: string) => void } = {}): Promise<CourseAdded> {
  if (plan.lessons.some((l) => l.video) && !ytDlp()) throw new Error("This course’s videos need yt-dlp, which isn’t installed. Run `brew install yt-dlp` in Terminal, then try again.");
  const existing = listItems(lib).concat(listItems(lib, { archived: true })).filter((i) => i.meta.course?.url === plan.url);
  const first = existing[0]?.meta.course;
  const id = first?.id ?? ulid();
  const title = first?.title ?? plan.title;
  const have = new Set(existing.map((i) => i.meta.course!.part));
  // Skills belong to the course as a whole: new lessons join the ones it has, and skills picked when the
  // link is added again file every lesson already here too.
  const had = [...new Set(existing.flatMap((i) => i.meta.skills))];
  const filed = (opts.skills ?? []).filter((k) => !had.includes(k));
  const skills = [...had, ...filed];
  for (const i of existing) if (skills.some((k) => !i.meta.skills.includes(k))) await setItemSkills(lib, i.meta.id, skills);
  // Adding an archived course again brings it back: he wants it.
  const archived = existing.filter((i) => i.meta.archived_at);
  for (const i of archived) await setItemArchived(lib, i.meta.id, false);
  const added: Item[] = [];
  const filled: Item[] = [];
  const failed: CourseAdded["failed"] = [];
  // Lessons it lacks, and lessons added before D92 that lack their page's text.
  const fill = existing.filter((i) => lacksPage(i, plan.lessons[i.meta.course!.part - 1]));
  const todo = plan.lessons.map((l, i) => ({ l, part: i + 1, had: fill.find((f) => f.meta.course!.part === i + 1) })).filter((x) => !have.has(x.part) || x.had);
  for (const [done, { l, part, had }] of todo.entries()) {
    opts.onLesson?.(done, todo.length, l.title);
    try {
      if (had) {
        if (await fillPage(lib, had, l)) filled.push(findItem(lib, had.meta.id));
        continue;
      }
      const draft = await withImages(await lessonDraft(l));
      if (!draft.body.trim()) throw new Error("Found no text to read in it.");
      const item = await createItem(lib, { ...draft, skills, course: { id, title, part, url: plan.url } });
      await makeThumbnail(item);
      added.push(item);
    } catch (e) {
      failed.push({ part, title: l.title, error: (e as Error).message });
    }
  }
  // The course's own picture for its row, made once (a re-add makes it for a course added before it).
  const lessons = [...existing, ...added];
  if (lessons.length && !lessons.some(courseCoverFile)) await makeCourseCover(lessons[0]!, plan.url);
  return { course: { id, title, url: plan.url }, added, kept: have.size, filled, failed, filed, restored: archived.length };
}
