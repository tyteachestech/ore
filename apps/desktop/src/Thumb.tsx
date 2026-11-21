import { convertFileSrc } from "@tauri-apps/api/core";
import { Article, BookOpenText, FilePdf, Quotes, TextAlignLeft, YoutubeLogo, type Icon } from "./icons";
import { useState } from "react";
import type React from "react";
import type { Item } from "./ore";

const KIND_ICON: Record<string, Icon> = { article: Article, youtube: YoutubeLogo, pdf: FilePdf, epub: BookOpenText, markdown: TextAlignLeft, snippet: Quotes };

/** Where a source's picture is read from: its file through the webview, or its bytes as they are. */
export const thumbSrc = (thumbnail: string) => (thumbnail.startsWith("data:") ? thumbnail : convertFileSrc(thumbnail));

/** How a picture sits in a wide 16:9 box (Home's Continue reading, D-new-home-row), from its own shape: a wide one
 *  fills it; a page or a tall capture fills it from its top, where the title is; a cover or a show's square art
 *  is shown whole, since a strip of a cover is no cover. */
export const fitOf = (type: string, w: number, h: number): "fill" | "top" | "whole" => {
  const ar = w / h;
  if (ar >= 1.3) return "fill";
  return type === "pdf" || ar < 0.5 ? "top" : "whole";
};
const fit = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const { naturalWidth: w, naturalHeight: h, dataset } = e.currentTarget;
  if (w && h) dataset.fit = fitOf(dataset.kind ?? "", w, h);
};

/** The picture that stands for a source (D77), Readwise/Raindrop-style: its thumbnail.*, else the
 *  icon of its kind, so every row lines up and is told apart at a glance. */
export function Thumb({ item, className = "thumb", iconSize = 12 }: { item: Pick<Item, "type" | "thumbnail">; className?: string; iconSize?: 12 | 16 }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (item.thumbnail && failed !== item.thumbnail)
    return <img className={className} data-kind={item.type} src={thumbSrc(item.thumbnail)} alt="" draggable={false} loading="lazy" onLoad={fit} onError={() => setFailed(item.thumbnail!)} />;
  const K = KIND_ICON[item.type] ?? Article;
  return (
    <span className={`${className} none`} data-kind={item.type} aria-hidden="true">
      <K size={iconSize} />
    </span>
  );
}
