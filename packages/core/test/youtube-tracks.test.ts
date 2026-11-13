import { expect, test } from "bun:test";
import { pickTrack } from "../src/ingest/youtube.ts";

// Found by the transcript eval (2026-11-12): two videos whose human captions the import passed over.
const vtt = (url: string) => [{ ext: "json3", url: "x" }, { ext: "vtt", url }];

test("human captions named with more than their language are still the human captions", () => {
  // MIT OpenCourseWare's 18.06 lecture: its own captions are "en-qlPKC2UN_YU".
  expect(pickTrack({ language: "en", subtitles: { "en-qlPKC2UN_YU": vtt("human") }, automatic_captions: { "en-orig": vtt("auto"), en: vtt("auto2") } })?.url).toBe("human");
  expect(pickTrack({ language: "en", subtitles: { "en-GB": vtt("gb"), en: vtt("plain") } })?.url).toBe("plain");
});

test("a video with no language named reads the captions in its own language", () => {
  // A Spanish TEDx talk: yt-dlp gives language null, human "es" captions, automatic ones made in Spanish.
  expect(pickTrack({ language: null, subtitles: { es: vtt("human-es") }, automatic_captions: { "es-orig": vtt("auto-es"), en: vtt("translated"), fr: vtt("fr") } })?.url).toBe("human-es");
  expect(pickTrack({ language: null, automatic_captions: { "es-orig": vtt("auto-es"), es: vtt("es2"), fr: vtt("fr") } })?.url).toBe("auto-es");
  expect(pickTrack({ subtitles: { de: vtt("only"), live_chat: [{ ext: "json", url: "chat" }] } })?.url).toBe("only");
});

test("English comes first, human before automatic, and nothing is still nothing", () => {
  expect(pickTrack({ language: "es", subtitles: { es: vtt("es"), en: vtt("en") } })?.url).toBe("en");
  expect(pickTrack({ language: "es", subtitles: { es: vtt("es") }, automatic_captions: { en: vtt("translated") } })?.url).toBe("es");
  expect(pickTrack({ language: "ja", automatic_captions: { en: vtt("translated") } })?.url).toBe("translated");
  expect(pickTrack({ language: "en" })).toBeUndefined();
  expect(pickTrack({ language: null, subtitles: { de: vtt("de"), fr: vtt("fr") } })).toBeUndefined();
});
