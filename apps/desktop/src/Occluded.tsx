import { convertFileSrc } from "@tauri-apps/api/core";
import { useState } from "react";

/** A figure card in review (D166, image occlusion): the figure with its box covered while he recalls what
 *  is under it, then uncovered and outlined with the answer. A figure that no longer loads (its source
 *  reimported without it) leaves the card's text to stand alone. */
export function Occluded({ file, box, shown }: { file: string; box: [number, number, number, number]; shown: boolean }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  const [x, y, w, h] = box;
  return (
    <div className="review-figure">
      <div className="review-figure-frame">
        <img src={/^(https?:|data:)/i.test(file) ? file : convertFileSrc(file)} alt="" draggable={false} onError={() => setGone(true)} />
        <div className={`review-figure-box${shown ? " shown" : ""}`} style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }} role="img" aria-label={shown ? "The part that was hidden" : "Hidden part of the figure"} />
      </div>
    </div>
  );
}
