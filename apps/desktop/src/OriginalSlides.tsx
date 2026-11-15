import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Presentation, useCreatePresentationStore, usePresentation, useSlide } from "@diceui/pptx";
import { Hint } from "./Hint";
import { CaretLeft, CaretRight } from "./icons";
import { Working } from "./Working";

/** The Original tab for a PowerPoint deck (D307): the slide itself, as PowerPoint lays it out,
 *  beside the text Ore read from it. `slide` is the slide being read and the tab follows it; ‹ › look at another,
 *  until the reading moves to a new slide (as the PDF's pages do, D202). Drawn by Dice UI's `pptx` (Apache-2.0),
 *  read-only, and loaded only when the tab opens: it is a chunk of its own. */
export default function OriginalSlides({ file, slide }: { file: string; slide: number }) {
  const store = useCreatePresentationStore();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let gone = false;
    setFailed(false);
    fetch(convertFileSrc(file))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => (gone ? undefined : store.load(data)))
      .catch(() => !gone && setFailed(true));
    return () => {
      gone = true;
    };
  }, [file, store]);
  return (
    <div className="original">
      <Presentation.Provider store={store}>
        <Deck slide={slide} failed={failed} />
      </Presentation.Provider>
    </div>
  );
}

function Deck({ slide, failed }: { slide: number; failed: boolean }) {
  const { presentation, status } = usePresentation();
  const { index, total, goToIndex } = useSlide();
  /** A slide he turned to himself; the reading's slide takes over again when it changes. */
  const [own, setOwn] = useState<number | null>(null);
  useEffect(() => setOwn(null), [slide]);
  const shown = Math.min(Math.max(own ?? slide, 1), total || 1);
  useEffect(() => {
    if (total && index !== shown - 1) goToIndex(shown - 1);
  }, [shown, total, index, goToIndex]);

  if (failed || status === "error") return <p className="loading">This deck’s slides can’t be shown here. Open the original from ⋯ to see them.</p>;
  if (!presentation) return <p className="loading"><Working stage="read" label="Opening the original…" /></p>;
  return (
    <>
      {total > 1 && (
        <div className="original-pager" role="group" aria-label="Slides of the original">
          <Hint text="Previous slide" side="bottom">
            <button className="icon-btn" aria-label="Previous slide" disabled={shown === 1} onClick={() => setOwn(shown - 1)}><CaretLeft size={11} aria-hidden="true" /></button>
          </Hint>
          <span aria-live="polite">{shown} / {total}</span>
          <Hint text="Next slide" side="bottom">
            <button className="icon-btn" aria-label="Next slide" disabled={shown === total} onClick={() => setOwn(shown + 1)}><CaretRight size={11} aria-hidden="true" /></button>
          </Hint>
        </div>
      )}
      <Presentation.Viewport autoFit className="original-slide" role="img" aria-label={`Slide ${shown} of the original`} style={{ aspectRatio: `${presentation.width} / ${presentation.height}` }} data-slide={shown}>
        <Presentation.Slide />
      </Presentation.Viewport>
    </>
  );
}
