import { expect, test } from "bun:test";
import { enclosure, keyText, loadCases, pageTracks, pickTracks, wer, words } from "../eval/transcripts.ts";

test("the transcript cases load, each with what its kind needs", () => {
  const cases = loadCases();
  expect(cases.filter((c) => c.kind === "youtube").length).toBeGreaterThanOrEqual(5);
  expect(cases.filter((c) => c.kind === "podcast").length).toBeGreaterThanOrEqual(5);
});

test("words: speech only, in lower case, without names, stamps or sound notes", () => {
  expect(words("**Jerod Santo:** Today, we're joined by [Charlie](https://x.y) — it's 3.5x faster! [laughs]")).toEqual(["today", "we're", "joined", "by", "charlie", "it's", "3", "5x", "faster"]);
  expect(words("Lex Fridman\n(00:01:15) The following is a conversation. (LAUGHTER) Right (I think).")).toEqual(["the", "following", "is", "a", "conversation", "right", "i", "think"]);
  expect(words("Ira Glass: Don’t stop.")).toEqual(["don't", "stop"]);
});

test("wer counts swapped, lost and extra words against the key", () => {
  const k = "the quick brown fox jumps over the lazy dog".split(" ");
  expect(wer(k, k)).toEqual({ n: 9, sub: 0, del: 0, ins: 0, wer: 0 });
  expect(wer(k, "the quick brown box jumps over lazy dog today".split(" "))).toEqual({ n: 9, sub: 1, del: 1, ins: 1, wer: 3 / 9 });
  expect(wer(k, [])).toMatchObject({ del: 9, wer: 1 });
  expect(wer([], ["a"])).toMatchObject({ ins: 1, wer: 1 });
});

test("pickTracks takes the human captions in the language, a regional one too, and the automatic ones apart", () => {
  const vtt = (url: string) => [{ ext: "json3", url: "x" }, { ext: "vtt", url }];
  expect(pickTracks({ subtitles: { "en-GB": vtt("human"), fr: vtt("fr") }, automatic_captions: { en: vtt("auto"), "en-orig": vtt("orig") } }, "en")).toEqual({ human: { ext: "vtt", url: "human" }, auto: { ext: "vtt", url: "orig" } });
  expect(pickTracks({ automatic_captions: { en: vtt("auto") } }, "en")).toEqual({ human: undefined, auto: { ext: "vtt", url: "auto" } });
});

test("pageTracks reads the caption list out of a video page", () => {
  const html = `<script>var x = {"captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=1\\u0026lang=en","name":{"simpleText":"English [CC]"},"languageCode":"en"},{"baseUrl":"https://www.youtube.com/api/timedtext?v=1\\u0026kind=asr","languageCode":"en","kind":"asr"}],"audioTracks":[]}}};</script>`;
  expect(pageTracks(html)).toEqual([
    { url: "https://www.youtube.com/api/timedtext?v=1&lang=en", lang: "en", auto: false },
    { url: "https://www.youtube.com/api/timedtext?v=1&kind=asr", lang: "en", auto: true },
  ]);
  expect(pageTracks("<html>no captions here</html>")).toEqual([]);
});

test("enclosure finds an episode's audio by guid", () => {
  const feed = `<rss><channel><item><guid isPermaLink="false"><![CDATA[a-1]]></guid><enclosure url="https://x.test/a.mp3?x=1&amp;y=2" type="audio/mpeg"/></item><item><guid>b-2</guid><enclosure length="1" url="https://x.test/b.mp3"/></item></channel></rss>`;
  expect(enclosure(feed, "a-1")).toBe("https://x.test/a.mp3?x=1&y=2");
  expect(enclosure(feed, "b-2")).toBe("https://x.test/b.mp3");
  expect(enclosure(feed, "c-3")).toBeUndefined();
});

test("keyText reads captions as their words and cuts a text to its opening and closing phrases", async () => {
  expect(await keyText("WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello there\n\n00:00:03.000 --> 00:00:05.000\ngeneral reader\n", "https://x.test/t.vtt")).toBe("Hello there general reader");
  expect(await keyText("Menu Subscribe\nHello there.\nGoodbye now.\nFooter links", "https://x.test/t.txt", "Hello", "Goodbye now.")).toBe("Hello there.\nGoodbye now.");
  expect(await keyText("Ada Lovelace Hello there.\nGrace Hopper Goodbye now.", "https://x.test/t.txt", undefined, undefined, ["Ada Lovelace", "Grace Hopper"])).toBe("Hello there.\nGoodbye now.");
  expect(keyText("nothing", "https://x.test/t.txt", "Hello")).rejects.toThrow("opening phrase");
});
