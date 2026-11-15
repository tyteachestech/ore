// The reader's Aa on the iPhone (D-new-phone-reading-looks): the five things every good reader lets you change
// (Books, Kindle, Readwise Reader, Instapaper), in one bottom sheet as Books lays out its Themes & Settings. Each
// tap applies at once and keeps the passage in view (reading.ts), the text left showing above the sheet.
import { useRef, useState, type ReactNode } from "react";
import { FONTS, PAGES, setFont, setPage, setSpacing, setWidth, SIZES, SPACINGS, WIDTHS, bigger, smaller, useReading } from "../reading";
import { Trap } from "../Trap";
import { sheetLayer, useSwipeDown } from "./sheet";

/** Three short lines: how far apart (spacing) or how wide (margins) each step sets the text. */
const Lines = ({ gap, width }: { gap: number; width: number }) => (
  <span className="looks-lines" style={{ gap }} aria-hidden="true">
    <i style={{ width }} />
    <i style={{ width }} />
    <i style={{ width }} />
  </span>
);

/** A row of choices, one checked: radio buttons, as iOS reads a segmented control. */
function Choice<T extends string>({ label, value, options, onPick, className, render }: { label: string; value: T; options: readonly { id: T; label: string }[]; onPick: (v: T) => void; className: string; render: (id: T, i: number) => ReactNode }) {
  return (
    <div className={className} role="radiogroup" aria-label={label}>
      {options.map((o, i) => (
        <button key={o.id} role="radio" aria-checked={o.id === value} aria-label={o.label} data-page={o.id} onClick={() => onPick(o.id)}>
          {render(o.id, i)}
        </button>
      ))}
    </div>
  );
}

export function ReadingLooks() {
  const { size, spacing, width, font, page } = useReading();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  useSwipeDown(box, close, open);
  return (
    <>
      <button className="looks-btn" aria-label="Text and page" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        Aa
      </button>
      {open && sheetLayer(
        <div className="overlay looks-overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <Trap>
            <div ref={box} className="panel sheet looks-sheet" role="dialog" aria-modal="true" aria-label="Text and page" tabIndex={-1} onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}>
              <div className="looks-size" role="group" aria-label={`Text size, ${size}`}>
                <button aria-label="Smaller text" disabled={size === SIZES[0]} onClick={smaller}>A</button>
                <button aria-label="Larger text" disabled={size === SIZES[SIZES.length - 1]} onClick={bigger}>A</button>
              </div>
              <div className="looks-pair">
                <Choice className="looks-seg" label="Line spacing" value={spacing} options={SPACINGS} onPick={setSpacing} render={(_, i) => <Lines gap={[3, 5, 8][i]!} width={22} />} />
                {/* Margins: Narrow width is wide margins. */}
                <Choice className="looks-seg" label="Margins" value={width} options={[...WIDTHS].reverse().map((w, i) => ({ id: w.id, label: ["Narrow margins", "Medium margins", "Wide margins"][i]! }))} onPick={setWidth} render={(_, i) => <Lines gap={4} width={[22, 17, 12][i]!} />} />
              </div>
              <Choice className="looks-pair" label="Font" value={font} options={FONTS} onPick={setFont} render={(id) => <span className="looks-tile" data-font={id}><b style={{ fontFamily: id === "charter" ? 'Charter, "Bitstream Charter", "New York", serif' : "var(--font)" }}>Aa</b>{FONTS.find((f) => f.id === id)!.label}</span>} />
              <Choice className="looks-pair" label="Page" value={page} options={PAGES} onPick={setPage} render={(id) => <span className="looks-tile" data-page={id}><b>{PAGES.find((p) => p.id === id)!.label}</b></span>} />
            </div>
          </Trap>
        </div>,
      )}
    </>
  );
}
