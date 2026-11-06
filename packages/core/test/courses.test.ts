import { afterEach, describe, expect, test } from "bun:test";
import { courseLessons, renameCourse, setCourseArchived, setCourseSkills } from "../src/courses.ts";
import { academyLessons, addCourse, isCourseUrl, type CoursePlan } from "../src/ingest/course.ts";
import { addSource, courseCoverFile } from "../src/ingest/index.ts";
import { findItem, listItems, setItemArchived } from "../src/items.ts";
import { tempLibrary } from "./helpers.ts";

const COURSE = `<html><head><title>AI Fluency: Framework and foundations · Claude Academy</title></head><body>
<h1>AI Fluency: Framework and foundations</h1>
<a href="/courses/ai-fluency/intro">Start course <svg></svg></a>
<a href="/courses/ai-fluency/intro"><span>1</span> Introduction to AI Fluency</a>
<a href="/courses/ai-fluency/the-4d-framework">The 4D Framework</a>
<a href="/courses/ai-fluency/capabilities">Capabilities &amp; limitations</a>
<a href="/courses/ai-fluency/certificate-of-completion">Course quiz <span>Quiz</span></a>
<a href="/courses/ai-fluency/activities">Additional activities</a>
<a href="/courses/ai-fluency/badge">Completion badge</a>
<a href="/courses/other/intro">Another course</a>
</body></html>`;

const page = (title: string) => `<html><head><title>${title}</title></head><body><article><h1>${title}</h1>${`<p>${title} explains one idea of the course in a paragraph long enough to read as an article.</p>`.repeat(6)}</article></body></html>`;

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});
/** Serves each lesson page; `down` lessons fail as an unreachable page would. */
function serve(down: Set<string>) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    const slug = url.split("/").pop()!;
    if (down.has(slug)) return new Response("nope", { status: 503 });
    return new Response(page(slug), { headers: { "content-type": "text/html" } });
  }) as typeof fetch;
}

const plan: CoursePlan = {
  title: "AI Fluency",
  url: "https://academy.claude.com/courses/ai-fluency",
  lessons: ["intro", "delegation", "description"].map((s) => ({ title: s, url: `https://academy.claude.com/courses/ai-fluency/${s}` })),
};

describe("course links", () => {
  test("Claude Academy courses and lessons and YouTube playlists are courses; a video is not", () => {
    expect(isCourseUrl("https://academy.claude.com/courses/ai-fluency-framework-foundations")).toBe(true);
    expect(isCourseUrl("https://academy.claude.com/courses/ai-fluency-framework-foundations/the-4d-framework")).toBe(true);
    expect(isCourseUrl("https://www.youtube.com/playlist?list=PLabc_123")).toBe(true);
    expect(isCourseUrl("https://www.youtube.com/watch?v=W4Ua6XFfX9w")).toBe(false);
    expect(isCourseUrl("https://academy.claude.com/")).toBe(false);
  });

  test("lessons come in page order, once each, without the start button, quiz, badge or other courses", () => {
    const r = academyLessons(COURSE, "ai-fluency", "https://academy.claude.com");
    expect(r.title).toBe("AI Fluency: Framework and foundations");
    expect(r.lessons.map((l) => l.title)).toEqual(["1 Introduction to AI Fluency", "The 4D Framework", "Capabilities & limitations", "Additional activities"]);
    expect(r.lessons[1]!.url).toBe("https://academy.claude.com/courses/ai-fluency/the-4d-framework");
  });
});

describe("adding a course", () => {
  test("each lesson becomes a source in course order; a retry adds only the lessons that failed", async () => {
    const lib = await tempLibrary();
    serve(new Set(["delegation"]));
    const first = await addCourse(lib, plan, { skills: ["ai"] });
    expect(first.added.map((i) => i.meta.course!.part)).toEqual([1, 3]);
    expect(first.failed.map((f) => f.part)).toEqual([2]);
    const id = first.course.id;
    const lesson = findItem(lib, first.added[0]!.meta.id);
    expect(lesson.meta.course).toEqual({ id, title: "AI Fluency", part: 1, url: plan.url });
    expect(lesson.meta.skills).toEqual(["ai"]);
    expect(lesson.meta.title).toBe("intro");

    serve(new Set());
    // Progress counts only the lessons this add fetches: the retry is 0 of 1, not 2 of 3.
    const steps: string[] = [];
    const again = await addCourse(lib, plan, { onLesson: (done, of, title) => steps.push(`${done}/${of} ${title}`) });
    expect(steps).toEqual(["0/1 delegation"]);
    expect(again.course.id).toBe(id);
    expect(again.kept).toBe(2);
    expect(again.added.map((i) => i.meta.course!.part)).toEqual([2]);
    expect(courseLessons(lib, id).map((l) => l.meta.title)).toEqual(["intro", "delegation", "description"]);
    expect((await addCourse(lib, plan)).added).toEqual([]);
  });

  test("skills belong to the whole course: a retried lesson joins them, skills picked on a re-add file every lesson", async () => {
    const lib = await tempLibrary();
    serve(new Set(["delegation"]));
    const { course } = await addCourse(lib, plan, { skills: ["ai"] });
    serve(new Set());
    await addCourse(lib, plan);
    expect(courseLessons(lib, course.id).map((l) => l.meta.skills.join())).toEqual(["ai", "ai", "ai"]);
    expect(await addCourse(lib, plan, { skills: ["teaching"] })).toMatchObject({ added: [], filed: ["teaching"], restored: 0 });
    expect(courseLessons(lib, course.id).map((l) => l.meta.skills.join())).toEqual(["ai,teaching", "ai,teaching", "ai,teaching"]);
    // An archived course added again comes back.
    await setCourseArchived(lib, course.id, true);
    expect(await addCourse(lib, plan, { skills: ["ai"] })).toMatchObject({ added: [], filed: [], restored: 3 });
    expect(courseLessons(lib, course.id)).toHaveLength(3);
  });

  test("the course page's own picture becomes the course's cover, saved once beside its first lesson", async () => {
    const lib = await tempLibrary();
    const PNG = new Uint8Array(200).fill(7);
    let pages = 0;
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url === plan.url) return pages++, new Response(`<html><head><meta property="og:image" content="/og/ai-fluency.png"></head><body></body></html>`, { headers: { "content-type": "text/html" } });
      if (url.endsWith("/og/ai-fluency.png")) return new Response(PNG, { headers: { "content-type": "image/png" } });
      return new Response(page(url.split("/").pop()!), { headers: { "content-type": "text/html" } });
    }) as typeof fetch;
    const { course } = await addCourse(lib, plan);
    const [first, ...rest] = courseLessons(lib, course.id);
    expect(courseCoverFile(first!)).toEndWith("course-cover.png");
    expect(rest.some((l) => courseCoverFile(l))).toBe(false);
    await addCourse(lib, plan);
    expect(pages).toBe(1);
  });

  test("rename, file and archive act on every lesson", async () => {
    const lib = await tempLibrary();
    serve(new Set());
    const { course } = await addCourse(lib, plan);
    await renameCourse(lib, course.id, "  AI Fluency basics ");
    await setCourseSkills(lib, course.id, ["ai", "teaching"]);
    expect(courseLessons(lib, course.id).every((l) => l.meta.course!.title === "AI Fluency basics" && l.meta.skills.join() === "ai,teaching")).toBe(true);
    expect(await setCourseArchived(lib, course.id, true)).toBe(3);
    expect(listItems(lib)).toEqual([]);
    expect(() => courseLessons(lib, course.id)).toThrow();
    expect(await setCourseArchived(lib, course.id, false)).toBe(3);
    expect(courseLessons(lib, course.id)).toHaveLength(3);
    await expect(renameCourse(lib, course.id, " ")).rejects.toThrow("a course needs a title");
  });
});

describe("adding a link again", () => {
  test("gives back the source already here, filed under the new skills too, instead of a second copy", async () => {
    const lib = await tempLibrary();
    serve(new Set());
    const url = "https://example.com/posts/retrieval";
    const first = await addSource(lib, url, { skills: ["ai"] });
    expect("kept" in first).toBe(false);
    const again = await addSource(lib, url, { skills: ["teaching"] });
    expect(again.kept).toBe(true);
    expect(again.meta.id).toBe(first.meta.id);
    expect(again.meta.skills).toEqual(["ai", "teaching"]);
    expect(again.filed).toEqual(["teaching"]);
    expect(listItems(lib)).toHaveLength(1);
  });

  test("brings an archived source back, and says so", async () => {
    const lib = await tempLibrary();
    serve(new Set());
    const url = "https://example.com/posts/retrieval";
    const first = await addSource(lib, url);
    await setItemArchived(lib, first.meta.id, true);
    const again = await addSource(lib, url, { skills: ["ai"] });
    expect(again.meta.id).toBe(first.meta.id);
    expect(again).toMatchObject({ kept: true, filed: ["ai"], restored: true });
    expect(listItems(lib).map((i) => i.meta.id)).toEqual([first.meta.id]);
  });
});
