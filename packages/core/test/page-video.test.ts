import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addHighlight, anchorAnnotations } from "../src/annotations.ts";
import { addCourse, type CoursePlan } from "../src/ingest/course.ts";
import { addSource, embeddedVideo, reimportSource, transcriptOf } from "../src/ingest/index.ts";
import { createItem, findItem } from "../src/items.ts";
import { tempLibrary } from "./helpers.ts";

// A page with written text and a video (D92): one source holds the page's text, then the transcript.

const VTT = "WEBVTT\n\n00:00:00.000 --> 00:00:04.000\nWelcome to the platform tour.\n\n00:00:04.000 --> 00:00:08.000\nToday we call the API.\n";
const TEXT = `<p>${"The Claude Platform is the API, the SDKs and the console, the pieces you build with. ".repeat(10)}</p><h2>Three layers</h2><p>Primitives, infrastructure and controls.</p>`;
const embed = (id: string) => `<iframe src="https://www.youtube-nocookie.com/embed/${id}?rel=0"></iframe>`;
const article = (body: string) => `<html><head><title>Platform tour</title></head><body><article><h1>Platform tour</h1>${body}</article></body></html>`;

// A stand-in yt-dlp: prints the video's info with an English caption track the fetch below serves.
const realPath = process.env.PATH;
const realFetch = globalThis.fetch;
let log = "";
beforeAll(() => {
  const bin = mkdtempSync(join(tmpdir(), "ore-ytdlp-"));
  const info = JSON.stringify({ title: "Platform tour video", channel: "Anthropic", upload_date: "20261020", webpage_url: "https://www.youtube.com/watch?v=abcdefghijk", subtitles: { en: [{ ext: "vtt", url: "https://captions.test/en.vtt" }] } });
  writeFileSync(join(bin, "yt-dlp"), `#!/bin/sh\necho x >> "${bin}/calls"\ncat <<'JSON'\n${info}\nJSON\n`);
  chmodSync(join(bin, "yt-dlp"), 0o755);
  process.env.PATH = `${bin}:${realPath}`;
  log = join(bin, "calls");
});
afterAll(() => {
  process.env.PATH = realPath;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});
/** How many times yt-dlp ran. */
const calls = () => (existsSync(log) ? readFileSync(log, "utf8").split("\n").length - 1 : 0);
function serve(pages: Record<string, string>) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url === "https://captions.test/en.vtt") return new Response(VTT);
    const html = pages[url];
    return html ? new Response(html, { headers: { "content-type": "text/html" } }) : new Response("nope", { status: 404 });
  }) as typeof fetch;
}

describe("a page's video", () => {
  test("is the one YouTube video it embeds; none, or several, is no video", () => {
    expect(embeddedVideo(article(TEXT + embed("abcdefghijk")))).toBe("https://www.youtube.com/watch?v=abcdefghijk");
    expect(embeddedVideo(article(TEXT + embed("abcdefghijk") + embed("abcdefghijk")))).toBe("https://www.youtube.com/watch?v=abcdefghijk");
    expect(embeddedVideo(article(TEXT + embed("abcdefghijk") + embed("zyxwvutsrqp")))).toBeUndefined();
    expect(embeddedVideo(article(TEXT + `<iframe src="https://player.vimeo.com/video/1"></iframe>`))).toBeUndefined();
    expect(embeddedVideo(article(TEXT))).toBeUndefined();
  });
});

describe("adding a page with a video", () => {
  test("keeps the page's text, then the transcript, and plays the video", async () => {
    const lib = await tempLibrary();
    const url = "https://example.com/tour";
    serve({ [url]: article(TEXT + embed("abcdefghijk")) });
    const item = await addSource(lib, url);
    expect(item.meta.type).toBe("article");
    expect(item.meta.url).toBe(url);
    expect(item.meta.video).toBe("https://www.youtube.com/watch?v=abcdefghijk");
    // The transcript first, where the video sits, then the page's text after the marker the reader splits at.
    expect(item.body.indexOf("[00:00] Welcome")).toBeLessThan(item.body.indexOf("<!-- end of video transcript -->"));
    expect(item.body.indexOf("<!-- end of video transcript -->")).toBeLessThan(item.body.indexOf("Three layers"));
    expect(item.body).toContain("[00:00] Welcome to the platform tour.");
    const t = transcriptOf(findItem(lib, item.meta.id))!;
    expect(t.video).toBe("abcdefghijk");
    expect(t.words[0]).toEqual([0, "Welcome"]);
  });

  test("a page that only wraps its video is the video; a plain page stays an article", async () => {
    const lib = await tempLibrary();
    serve({ "https://example.com/watch": article(`<p>Watch the tour of the Claude Platform below, in a short video with every piece explained by the team that builds it.</p>${"<p>A few words.</p>".repeat(4)}` + embed("abcdefghijk")), "https://example.com/read": article(TEXT) });
    const wrap = await addSource(lib, "https://example.com/watch");
    expect(wrap.meta.type).toBe("youtube");
    expect(wrap.body.startsWith("[00:00] Welcome")).toBe(true);
    const plain = await addSource(lib, "https://example.com/read");
    expect(plain.meta.type).toBe("article");
    expect(plain.meta.video).toBeUndefined();
  });
});

const lessonUrl = "https://academy.claude.com/courses/platform/what-is-it";
const plan: CoursePlan = { title: "Platform 101", url: "https://academy.claude.com/courses/platform", lessons: [{ title: "What is it?", url: lessonUrl, video: "https://www.youtube.com/watch?v=abcdefghijk" }] };

describe("a course lesson with a video", () => {
  test("holds the lesson page's text and the video's transcript", async () => {
    const lib = await tempLibrary();
    serve({ [lessonUrl]: article(TEXT) });
    const r = await addCourse(lib, plan);
    const lesson = r.added[0]!;
    expect(lesson.meta).toMatchObject({ type: "article", title: "What is it?", url: lessonUrl, video: "https://www.youtube.com/watch?v=abcdefghijk", author: undefined });
    expect(lesson.body).toContain("Three layers");
    expect(lesson.body.startsWith("Platform tour")).toBe(false); // the page's heading, not its text
    expect(lesson.body).toContain("## Video transcript\n\n[00:00] Welcome");
  });

  test("added before as a bare video, it gets the page's text on a re-add, keeping its highlights and id", async () => {
    const lib = await tempLibrary();
    const old = await createItem(lib, {
      type: "youtube", title: "What is it?", url: "https://www.youtube.com/watch?v=abcdefghijk", body: "[00:00] Welcome to the platform tour. Today we call the API.\n",
      source: { ext: "vtt", data: VTT }, course: { id: "c1", title: "Platform 101", part: 1, url: plan.url },
    });
    const hl = addHighlight(old, { exact: "Today we call the API.", intent: "keep" });
    serve({ [lessonUrl]: article(TEXT) });
    const before = calls();
    const r = await addCourse(lib, plan);
    expect(r.added).toEqual([]);
    expect(r.filled.map((i) => i.meta.id)).toEqual([old.meta.id]);
    expect(calls()).toBe(before); // the transcript it had is reused, not fetched again
    const now = findItem(lib, old.meta.id);
    expect(now.meta).toMatchObject({ type: "article", url: lessonUrl, video: "https://www.youtube.com/watch?v=abcdefghijk" });
    expect(now.body.indexOf("[00:00] Welcome")).toBeLessThan(now.body.indexOf("Three layers"));
    const a = anchorAnnotations(now).find((x) => x.id === hl.id)!;
    expect(now.body.slice(a.anchor!.start, a.anchor!.end)).toBe("Today we call the API.");
    expect(transcriptOf(now)!.video).toBe("abcdefghijk");
    // Once filled, a re-add leaves it be.
    expect((await addCourse(lib, plan)).filled).toEqual([]);
  });
});

describe("reimporting a lesson added as a bare video", () => {
  test("reads its page again from the course, by its place in it, and keeps the highlights", async () => {
    const lib = await tempLibrary();
    const old = await createItem(lib, {
      type: "youtube", title: "What is it?", url: "https://www.youtube.com/watch?v=abcdefghijk", body: "[00:00] Welcome to the platform tour. Today we call the API.\n",
      source: { ext: "vtt", data: VTT }, course: { id: "c1", title: "Platform 101", part: 1, url: plan.url },
    });
    const hl = addHighlight(old, { exact: "Today we call the API.", intent: "keep" });
    serve({
      [plan.url]: `<html><head><title>Platform 101 · Claude Academy</title><script src="/assets/v1/courses-abc.js"></script></head><body><h1>Platform 101</h1><a href="/courses/platform/what-is-it">What is it?</a></body></html>`,
      "https://academy.claude.com/assets/v1/courses-abc.js": `import("assets/v1/content/courses/platform/lessons/01-what-is-it/index-x1.js")`,
      "https://academy.claude.com/assets/v1/content/courses/platform/lessons/01-what-is-it/index-x1.js": `player({youtubeId:"abcdefghijk"})`,
      [lessonUrl]: article(TEXT),
    });
    const r = await reimportSource(lib, old.meta.id);
    expect(r.changed).toBe(true);
    expect(r.item.meta).toMatchObject({ type: "article", url: lessonUrl, video: "https://www.youtube.com/watch?v=abcdefghijk" });
    expect(r.item.body).toContain("Three layers");
    expect(r.item.body).toContain("## Video transcript\n\n[00:00] Welcome");
    const a = anchorAnnotations(r.item).find((x) => x.id === hl.id)!;
    expect(r.item.body.slice(a.anchor!.start, a.anchor!.end)).toBe("Today we call the API.");
  });
});
