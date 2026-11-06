import { openPath, openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import type { Item } from "./ore";

/** Where a source came from: its web address, else the file kept at capture (source.epub, …). */
export function originalLabel(item: Item): string | null {
  if (item.url) {
    try {
      return new URL(item.url).hostname.replace(/^www\./, "");
    } catch {
      return item.url;
    }
  }
  // The file's own name ("chapter-3.pdf"), as Finder shows it, not "Original PDF".
  return item.source_file?.split("/").pop() ?? null;
}

/** Opens the web page in the browser, or the original file in its default app. */
export async function openOriginal(item: Item): Promise<void> {
  if (item.url) await openUrl(item.url);
  else if (item.source_file) await openPath(item.source_file);
  else throw new Error("This source has no original to open");
}

/** The file a source lives in, for pasting into a terminal or an AI chat: the original kept at
 *  capture (source.pdf, …), else the saved text (doc.md). Finder's Copy as Pathname. */
export const pathOf = (item: Pick<Item, "dir" | "source_file">) => item.source_file ?? `${item.dir.replace(/\/$/, "")}/doc.md`;

/** Shows the source's folder in Finder with its original file selected. */
export const revealInFinder = (item: Item) => revealItemInDir(item.source_file ?? item.dir);
