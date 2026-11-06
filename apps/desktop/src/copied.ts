// A link or file he copied in another app and came back with, offered as the add box's first row
// (Chrome's "Link you copied"). Nothing polls the clipboard: its change count is read when the window
// loses and gains focus, and the clipboard itself only when the add box opens, so macOS's paste prompt
// (if it asks) comes when he is adding something.

import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { copiedEntry, type Entry } from "./paste";

/** How long after he comes back a copy still counts as just copied. */
const FRESH_MS = 5 * 60_000;

const count = () => invoke<number | null>("clipboard_count").catch(() => null);

let left: number | null = null;
let fresh: { count: number; at: number } | null = null;

/** Once, at launch: note what the clipboard was when he left and whether it changed while away. */
export function watchCopies(): () => void {
  const off = getCurrentWindow().onFocusChanged(async ({ payload: focused }) => {
    const now = await count();
    if (now === null) return;
    if (!focused) left = now;
    else if (left !== null && now !== left) fresh = { count: now, at: Date.now() };
  });
  return () => void off.then((f) => f());
}

/** What he copied while away, if it is new, recent and something Ore reads. Offered once: asking
 *  again returns null until he copies something else away from the app. */
export async function takeCopied(have: Iterable<string>): Promise<Entry | null> {
  const f = fresh;
  fresh = null;
  if (!f || Date.now() - f.at > FRESH_MS || (await count()) !== f.count) return null;
  return copiedEntry(await invoke<string | null>("clipboard_text").catch(() => null), have);
}

/** Whether a paste carries files copied in Finder: the webview sees only their names. */
export const pastesFiles = (d: DataTransfer | null) => !!d && (d.files.length > 0 || d.types.includes("Files"));

/** The files copied in Finder, read from the Mac's pasteboard; none when it can't be read. */
export const copiedFiles = (): Promise<Entry[]> =>
  invoke<string[]>("clipboard_files").then((paths) => paths.map((path): Entry => ({ kind: "file", path })), () => []);
