import { convertFileSrc } from "@tauri-apps/api/core";
import type { Components } from "react-markdown";

/** Images saved with the source (`assets/…`, D96) load from its folder; web images as they are. */
export const withImages = (base: Components, dir: string): Components => ({
  ...base,
  img: ({ src, alt }) => {
    const s = typeof src === "string" ? src : "";
    return <img src={/^(https?:|data:)/i.test(s) ? s : convertFileSrc(`${dir}/${decodeURI(s)}`)} data-src={s} alt={alt ?? ""} loading="lazy" draggable={false} />;
  },
});
