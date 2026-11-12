// A video added on a device with no yt-dlp (the iPhone) is in the library at once, its transcript owed;
// a device that has yt-dlp fills it as a reimport (D227).
import { afterEach, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addSource, fillOwed, findItem, reimportSource, transcriptOf } from "../src/index.ts";
import { paths } from "../src/library.ts";
import { tempLibrary } from "./helpers.ts";

const realFetch = globalThis.fetch;
const env = { ...process.env };
afterEach(() => {
  globalThis.fetch = realFetch;
  process.env.PATH = env.PATH;
  delete process.env.ORE_NO_TOOLS;
});

const VTT = "WEBVTT\n\n00:00:00.000 --> 00:00:04.000\nSpacing reviews out beats cramming them together.\n";
/** A yt-dlp that describes one video with one caption track, or fails as it does for a video that is gone. */
function ytDlp(ok: boolean): string {
  const dir = mkdtempSync(join(tmpdir(), "ore-ytdlp-"));
  const info = { title: "Spacing", channel: "Learning Lab", upload_date: "20260102", webpage_url: "https://www.youtube.com/watch?v=abcdefghijk", subtitles: { en: [{ ext: "vtt", url: "https://captions.test/en.vtt" }] } };
  writeFileSync(join(dir, "yt-dlp"), ok ? `#!/bin/sh\ncat <<'JSON'\n${JSON.stringify(info)}\nJSON\n` : "#!/bin/sh\necho 'ERROR: Video unavailable' >&2\nexit 1\n");
  chmodSync(join(dir, "yt-dlp"), 0o755);
  return dir;
}
const web = (oembed: number) =>
  (globalThis.fetch = (async (u: string | URL) => {
    const url = String(u);
    if (url.includes("/oembed")) return oembed === 200 ? Response.json({ title: "Spacing", author_name: "Learning Lab" }) : new Response("", { status: oembed });
    if (url.startsWith("https://captions.test/")) return new Response(VTT);
    return new Response("", { status: 404 }); // the thumbnail
  }) as typeof fetch);

test("with no yt-dlp the video comes in at once with its transcript owed, and a device with yt-dlp fills it", async () => {
  const lib = await tempLibrary();
  process.env.ORE_NO_TOOLS = "1";
  process.env.PATH = "/nonexistent";
  web(200);
  const added = await addSource(lib, "https://youtu.be/abcdefghijk?si=x");
  expect(added.meta).toMatchObject({ type: "youtube", title: "Spacing", author: "Learning Lab", url: "https://www.youtube.com/watch?v=abcdefghijk", owed: ["transcript"] });
  expect(added.body).toBe("");
  // It plays: the reader finds the video, with no words yet.
  expect(transcriptOf(added)).toEqual({ video: "abcdefghijk", words: [] });
  // What is owed is noted in the inbox, so a pass with nothing owed never reads the sources.
  expect(readdirSync(paths.inbox(lib))).toEqual([`${added.meta.id}.owed.json`]);
  // The phone itself fills nothing, and says where the transcript comes from when asked to read it again.
  expect(await fillOwed(lib)).toEqual([]);
  expect(reimportSource(lib, added.meta.id)).rejects.toThrow(/through your Mac/);

  // The Mac: yt-dlp is there.
  delete process.env.ORE_NO_TOOLS;
  process.env.PATH = `${ytDlp(true)}:${env.PATH}`;
  const filled = await fillOwed(lib);
  expect(filled.map((i) => i.meta.id)).toEqual([added.meta.id]);
  const now = findItem(lib, added.meta.id);
  expect(now.body).toContain("Spacing reviews out beats cramming");
  expect(now.meta.owed).toBeUndefined();
  expect(now.meta.published).toBe("2026-01-02");
  expect(readFileSync(now.docPath, "utf8")).not.toContain("owed");
  expect(transcriptOf(now)!.words.length).toBeGreaterThan(3);
  expect(readdirSync(paths.inbox(lib))).toEqual([]);
  expect(await fillOwed(lib)).toEqual([]);
});

test("a video that can't be filled keeps the reason and isn't asked for again until he reimports it", async () => {
  const lib = await tempLibrary();
  process.env.ORE_NO_TOOLS = "1";
  process.env.PATH = "/nonexistent";
  web(200);
  const added = await addSource(lib, "https://www.youtube.com/watch?v=abcdefghijk");
  delete process.env.ORE_NO_TOOLS;
  process.env.PATH = `${ytDlp(false)}:${env.PATH}`;
  expect(await fillOwed(lib)).toEqual([]);
  expect(findItem(lib, added.meta.id).meta.owed_error).toMatch(/Video unavailable/);
  // The next pass leaves it alone (a working yt-dlp would have filled it).
  process.env.PATH = `${ytDlp(true)}:${env.PATH}`;
  expect(await fillOwed(lib)).toEqual([]);
  await reimportSource(lib, added.meta.id);
  const { owed, owed_error } = findItem(lib, added.meta.id).meta;
  expect([owed, owed_error]).toEqual([undefined, undefined]);
});

test("a video YouTube won't describe waits for the Mac whole, and a Mac with no yt-dlp is still told to install it", async () => {
  const lib = await tempLibrary();
  process.env.PATH = "/nonexistent";
  web(401);
  expect(addSource(lib, "https://www.youtube.com/watch?v=abcdefghijk")).rejects.toThrow(/brew install yt-dlp/);
  process.env.ORE_NO_TOOLS = "1";
  expect(addSource(lib, "https://www.youtube.com/watch?v=abcdefghijk")).rejects.toThrow(/yt-dlp, which only runs on the Mac/);
});
