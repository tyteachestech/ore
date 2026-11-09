import { expect, test } from "bun:test";
import { chatGroups } from "../src/chat-groups";

// D171: the tutor's list of chats groups them by the day each was last changed, as Notion AI's does.
test("chats fall under Today, Yesterday, Past 7 days and Older by local calendar day, newest first", () => {
  const now = new Date(2026, 10, 9, 9, 0); // 9 Nov, 9 am local
  const at = (d: number, h: number) => new Date(2026, 10, d, h).toISOString();
  const rows = [
    { id: "older", updated: at(1, 12) },
    { id: "late-yesterday", updated: at(8, 23) },
    { id: "early-today", updated: at(9, 0) },
    { id: "week", updated: at(3, 8) },
    { id: "now", updated: at(9, 8) },
    { id: "broken", updated: "" },
  ];
  expect(chatGroups(rows, now).map((g) => [g.heading, g.rows.map((r) => r.id)])).toEqual([
    ["Today", ["now", "early-today"]],
    ["Yesterday", ["late-yesterday"]],
    ["Past 7 days", ["week"]],
    ["Older", ["older", "broken"]],
  ]);
  expect(chatGroups([], now)).toEqual([]);
});
