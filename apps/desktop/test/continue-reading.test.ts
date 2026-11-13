import { expect, test } from "bun:test";
import { continueReading } from "../src/Home";
import type { Item } from "../src/ore";

const item = (id: string, title: string, opened_at?: string): Item =>
  ({ id, title, type: "article", dir: `/lib/${id}`, captured_at: "2026-10-01T00:00:00.000Z", status: "reading", skills: [], opened_at }) as Item;

test("Continue reading lists what he opened last first, from the files, with nothing remembered on this Mac", () => {
  // `ore ls` lists by title; the files say when each was last opened.
  const items = [item("a", "A beginner's guide", "2026-11-01T09:00:00.000Z"), item("b", "Budgeting by values", "2026-11-07T09:00:00.000Z"), item("c", "Crafting interpreters"), item("d", "Distributed systems", "2026-11-05T09:00:00.000Z")];
  expect(continueReading(items, []).map((i) => i.id)).toEqual(["b", "d", "a", "c"]);
});

test("what this Mac remembers opening comes first, in its order", () => {
  const items = [item("a", "A", "2026-11-01T09:00:00.000Z"), item("b", "B", "2026-11-07T09:00:00.000Z"), item("c", "C", "2026-11-05T09:00:00.000Z")];
  expect(continueReading(items, ["a"]).map((i) => i.id)).toEqual(["a", "b", "c"]);
});

test("a source just added and not opened yet joins the list by when it was added, newest on top; an old unread one stays out", () => {
  // Tyler, 2026-11-13: an episode he had just shared was nowhere on Home, which listed only what he had opened.
  const now = Date.parse("2026-11-13T02:00:00.000Z");
  const added = (id: string, captured_at: string): Item => ({ ...item(id, id), status: "inbox", captured_at }) as Item;
  const items = [item("read", "Reading", "2026-11-12T09:00:00.000Z"), added("new", "2026-11-13T01:00:00.000Z"), added("older", "2026-11-10T01:00:00.000Z"), added("stale", "2026-10-20T01:00:00.000Z"), item("long", "Long ago", "2026-11-01T09:00:00.000Z")];
  expect(continueReading(items, [], now).map((i) => i.id)).toEqual(["new", "read", "older", "long"]);
  // What this device remembers opening still leads among what he is reading; a new one goes above the first older than it.
  expect(continueReading(items, ["long"], now).map((i) => i.id)).toEqual(["new", "older", "long", "read"]);
});
