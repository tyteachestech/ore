import { describe, expect, test } from "bun:test";
import { emojiTrigger, findEmoji, type EmojiEntry } from "../src/editor/emoji";

const ALL: EmojiEntry[] = [
  { emoji: "😀", label: "grinning face", tags: ["face", "grin"] },
  { emoji: "😄", label: "grinning face with smiling eyes", tags: ["eye", "face", "mouth", "open", "smile"] },
  { emoji: "🙂", label: "slightly smiling face", tags: ["face", "smile"] },
  { emoji: "👍", label: "thumbs up", tags: ["+1", "hand", "thumb", "up"] },
  { emoji: "🔥", label: "fire", tags: ["flame", "tool"] },
];

describe("`:` emoji menu", () => {
  test("opens after a colon at a word start, never in times, URLs or prose", () => {
    expect(emojiTrigger(":d")?.[2]).toBe("d");
    expect(emojiTrigger(":fi")?.[2]).toBe("fi");
    expect(emojiTrigger("so hot :fire")?.[2]).toBe("fire");
    expect(emojiTrigger("(:thumbs_up")?.[2]).toBe("thumbs_up");
    for (const s of ["at 10:30", "https://ex", "Note:this", "Note: x", ":", ": f", ":1st", "a:D"]) expect(emojiTrigger(s)).toBeNull();
  });

  test("names that start with the query come first, then search words, then the rest", () => {
    expect(findEmoji(ALL, "smil").map((e) => e.emoji)).toEqual(["🙂", "😄"]);
    expect(findEmoji(ALL, "smile").map((e) => e.emoji)).toEqual(["🙂", "😄"]);
    expect(findEmoji(ALL, "grin")[0]!.emoji).toBe("😀");
    expect(findEmoji(ALL, "thumbs_up").map((e) => e.emoji)).toEqual(["👍"]);
    expect(findEmoji(ALL, "flame").map((e) => e.emoji)).toEqual(["🔥"]);
    expect(findEmoji(ALL, "zzz")).toEqual([]);
  });
});
