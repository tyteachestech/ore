import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { Hint } from "./Hint";
import { PHONE } from "./ore";
import { CaretLeft, CaretRight } from "./icons";
import { Working } from "./Working";

GlobalWorkerOptions.workerSrc = workerUrl;

/** The Original tab (D202): the PDF's own page beside its text, as Preview draws it. `page` is the page being
 *  read, and the tab follows it; ‹ › look at another, until the reading moves to a new page. Loaded only when
 *  the tab is opened (pdf.js is a chunk of its own). */
export default function OriginalPage({ file, page }: { file: string; page: number }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  /** A page he turned to himself; the reading's page takes over again when it changes. */
  const [own, setOwn] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  /** On the phone a pinch zooms the page (Books): once it settles, the page is drawn again that much sharper. */
  const [sharp, setSharp] = useState(1);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => setOwn(null), [page, file]);
  useEffect(() => setSharp(1), [own, page, file]);
  useEffect(() => {
    let gone = false;
    let task: ReturnType<typeof getDocument> | undefined;
    setPdf(null);
    setError(false);
    // The bytes are fetched here: pdf.js only fetches http(s) itself, and the app's files come over `asset:`.
    fetch(convertFileSrc(file))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => (task = getDocument({ data })).promise)
      .then((d) => !gone && setPdf(d))
      .catch(() => !gone && setError(true));
    return () => {
      gone = true;
      void task?.destroy();
    };
  }, [file]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const count = pdf?.numPages ?? 0;
  const shown = Math.min(Math.max(own ?? page, 1), count || 1);
  useEffect(() => {
    const c = canvas.current;
    if (!pdf || !c || !width) return;
    let gone = false;
    let task: RenderTask | undefined;
    void pdf.getPage(shown).then((pg) => {
      if (gone) return;
      const base = pg.getViewport({ scale: 1 });
      const view = pg.getViewport({ scale: (width / base.width) * (window.devicePixelRatio || 1) * sharp });
      // Drawn off the page and swapped in whole, so a turned page never shows half-drawn.
      const draft = document.createElement("canvas");
      draft.width = Math.round(view.width);
      draft.height = Math.round(view.height);
      task = pg.render({ canvas: draft, viewport: view });
      task.promise.then(
        () => {
          if (gone) return;
          c.width = draft.width;
          c.height = draft.height;
          c.getContext("2d")?.drawImage(draft, 0, 0);
          c.dataset.page = String(shown);
        },
        () => {},
      );
    }).catch(() => !gone && setError(true));
    return () => {
      gone = true;
      task?.cancel();
    };
  }, [pdf, shown, width, sharp]);

  return (
    <div className="original" ref={box}>
      {error ? (
        <p className="loading">This file’s pages can’t be shown here. Open the original from ⋯ to see them.</p>
      ) : !pdf ? (
        <p className="loading"><Working stage="read" label="Opening the original…" /></p>
      ) : (
        <>
          {count > 1 && (
            <div className="original-pager" role="group" aria-label="Pages of the original">
              <Hint text="Previous page" side="bottom">
                <button className="icon-btn" aria-label="Previous page" disabled={shown === 1} onClick={() => setOwn(shown - 1)}><CaretLeft size={11} aria-hidden="true" /></button>
              </Hint>
              <span aria-live="polite">{shown} / {count}</span>
              <Hint text="Next page" side="bottom">
                <button className="icon-btn" aria-label="Next page" disabled={shown === count} onClick={() => setOwn(shown + 1)}><CaretRight size={11} aria-hidden="true" /></button>
              </Hint>
            </div>
          )}
          {PHONE ? (
            <TransformWrapper
              key={shown}
              minScale={1}
              maxScale={4}
              doubleClick={{ mode: "toggle", step: 1.2 }}
              panning={{ disabled: !zoomed }}
              onTransformed={(_, t) => setZoomed(t.scale > 1.01)}
              onZoomStop={(r) => setSharp(Math.min(3, Math.max(1, Math.ceil(r.state.scale))))}
              onPinchingStop={(r) => setSharp(Math.min(3, Math.max(1, Math.ceil(r.state.scale))))}
            >
              <TransformComponent wrapperStyle={{ width: "100%" }} contentStyle={{ width: "100%" }}>
                <canvas ref={canvas} role="img" aria-label={`Page ${shown} of the original`} />
              </TransformComponent>
            </TransformWrapper>
          ) : (
            <canvas ref={canvas} role="img" aria-label={`Page ${shown} of the original`} />
          )}
        </>
      )}
    </div>
  );
}
