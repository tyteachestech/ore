import { convertFileSrc } from "@tauri-apps/api/core";
import { Article, BookOpenText, FilePdf, Quotes, TextAlignLeft, YoutubeLogo, type Icon } from "./icons";
import { useState } from "react";
import type React from "react";
import type { Item } from "./ore";

const KIND_ICON: Record<string, Icon> = { article: Article, youtube: YoutubeLogo, pdf: FilePdf, epub: BookOpenText, markdown: TextAlignLeft, snippet: Quotes };

/** The picture's own shape, width over height, as `--ar`: Home's Continue reading sizes its box from it (D340). */
const shape = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
  if (w && h) e.currentTarget.style.setProperty("--ar", String(w / h));
};

/** The picture that stands for a source (D77), Readwise/Raindrop-style: its thumbnail.*, else the
 *  icon of its kind, so every row lines up and is told apart at a glance. */
export function Thumb({ item, className = "thumb", iconSize = 12 }: { item: Pick<Item, "type" | "thumbnail">; className?: string; iconSize?: 12 | 16 }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (item.thumbnail && failed !== item.thumbnail)
    return <img className={className} data-kind={item.type} src={item.thumbnail.startsWith("data:") ? item.thumbnail : convertFileSrc(item.thumbnail)} alt="" draggable={false} loading="lazy" onLoad={shape} onError={() => setFailed(item.thumbnail!)} />;
  const K = KIND_ICON[item.type] ?? Article;
  return (
    <span className={`${className} none`} data-kind={item.type} aria-hidden="true">
      <K size={iconSize} />
    </span>
  );
}
