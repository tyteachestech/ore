import { convertFileSrc } from "@tauri-apps/api/core";
import { Article, BookOpenText, FilePdf, Quotes, TextAlignLeft, YoutubeLogo, type Icon } from "./icons";
import { useState } from "react";
import type { Item } from "./ore";

const KIND_ICON: Record<string, Icon> = { article: Article, youtube: YoutubeLogo, pdf: FilePdf, epub: BookOpenText, markdown: TextAlignLeft, snippet: Quotes };

/** The picture that stands for a source (D77), Readwise/Raindrop-style: its thumbnail.*, else the
 *  icon of its kind, so every row lines up and is told apart at a glance. */
export function Thumb({ item, className = "thumb", iconSize = 12 }: { item: Pick<Item, "type" | "thumbnail">; className?: string; iconSize?: 12 | 16 }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (item.thumbnail && failed !== item.thumbnail)
    return <img className={className} data-kind={item.type} src={item.thumbnail.startsWith("data:") ? item.thumbnail : convertFileSrc(item.thumbnail)} alt="" draggable={false} loading="lazy" onError={() => setFailed(item.thumbnail!)} />;
  const K = KIND_ICON[item.type] ?? Article;
  return (
    <span className={`${className} none`} aria-hidden="true">
      <K size={iconSize} />
    </span>
  );
}
