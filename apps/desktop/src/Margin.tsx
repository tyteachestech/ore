import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Hint } from "./Hint";
import { Signpost } from "./icons";
import { renderedNodeAt, type Skeleton, type TextIndex } from "./text";

// Chapter-end recall signs (D18, D115), drawn under each chapter's last block as an overlay
// positioned from the rendered blocks. They never enter <article className="doc">: highlights are
// painted over that DOM and its text index must stay exactly the rendered Markdown.

export type ChapterEnd = { n: number; title: string | null; end: Element };

/** A chapter worth recalling: front matter, a contents page or a short "how to read this" intro has fewer words. */
const MIN_WORDS = 500;

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const clean = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim();

/** The last rendered block of every chapter but the final one (the source finish covers it).
 *  react-markdown drops the `<!-- chapter N -->` markers, so each is located through the text
 *  that follows it in the source. Chapters under ~500 words (title pages, contents, intros) get none. */
export function findChapterEnds(body: string, src: Skeleton, idx: TextIndex, article: HTMLElement): ChapterEnd[] {
  const marks = [...body.matchAll(/<!-- chapter (\d+) -->/g)].map((m) => ({ n: Number(m[1]), at: m.index, end: m.index + m[0].length }));
  const out: ChapterEnd[] = [];
  for (let i = 0; i + 1 < marks.length; i++) {
    const cur = marks[i]!;
    const next = marks[i + 1]!;
    const text = body.slice(cur.end, next.at);
    if (words(text) < MIN_WORDS) continue;
    let el = renderedNodeAt(src, idx, next.end)?.parentElement ?? null;
    while (el && el.parentElement !== article) el = el.parentElement;
    const end = el?.previousElementSibling;
    if (end) out.push({ n: cur.n, title: clean(text.match(/^#{1,6}[ \t]+(.+)$/m)?.[1] ?? null) || null, end });
  }
  return out;
}

type Geo = { left: number; width: number; tops: Map<Element, number> };

export type MarginHandle = { focusNearest: () => void };

type Props = {
  chapters: ChapterEnd[];
  recalled: Set<number>;
  handle: RefObject<MarginHandle | null>;
  onChapter: (c: ChapterEnd) => void;
};

export function Margin({ chapters, recalled, handle, onChapter }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const scroller = () => ref.current?.closest<HTMLElement>(".reader-scroll") ?? null;

  // Positions follow layout: window and panel width, prequestions opening, images loading.
  useLayoutEffect(() => {
    const box = ref.current;
    const scroll = scroller();
    const article = box?.parentElement?.querySelector<HTMLElement>("article.doc");
    if (!box || !scroll || !article) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const b = box.getBoundingClientRect();
      const a = article.getBoundingClientRect();
      const tops = new Map<Element, number>();
      // Centred in the gap between the chapter's last block and the next one (the sign is ~28px).
      for (const x of chapters) {
        const end = x.end.getBoundingClientRect().bottom;
        const next = x.end.nextElementSibling?.getBoundingClientRect().top;
        tops.set(x.end, (next !== undefined && next > end + 28 ? (end + next) / 2 - 14 : end + 6) - b.top);
      }
      setGeo({ left: a.left - b.left, width: a.width, tops });
    };
    measure();
    const ro = new ResizeObserver(() => (frame ||= requestAnimationFrame(measure)));
    ro.observe(box);
    ro.observe(scroll);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [chapters]);

  useEffect(() => {
    handle.current = {
      focusNearest: () => {
        const box = ref.current;
        const scroll = scroller();
        if (!box || !scroll) return;
        const view = scroll.getBoundingClientRect();
        const mid = (view.top + view.bottom) / 2;
        const spots = Array.from(box.querySelectorAll<HTMLButtonElement>("button[data-spot]")).map((el) => ({ el, r: el.getBoundingClientRect() }));
        const inView = spots.filter((s) => s.r.bottom > view.top && s.r.top < view.bottom);
        const pick = inView.length
          ? inView.reduce((a, b) => (Math.abs(b.r.top - mid) < Math.abs(a.r.top - mid) ? b : a))
          : spots.find((s) => s.r.top >= view.bottom);
        if (!pick) return;
        pick.el.scrollIntoView({ block: "nearest" });
        pick.el.click();
      },
    };
    return () => {
      handle.current = null;
    };
  });

  if (!geo) return <div className="margin" ref={ref} />;
  const at = (end: Element) => geo.tops.get(end) ?? 0;

  return (
    <div className="margin" ref={ref} onMouseUp={(e) => e.stopPropagation()}>
      {/* A recalled chapter's sign is gone: what he wrote stands in the source note under its title. */}
      {chapters
        .filter((c) => !recalled.has(c.n))
        .map((c) => (
          <Hint key={c.n} text="Close the book and write what you remember" keys="section" side="right">
            <button data-spot={`chapter:${c.n}`} className="chap-sign" style={{ top: at(c.end), left: geo.left, maxWidth: geo.width }} onClick={() => onChapter(c)}>
              <Signpost size={16} aria-hidden="true" />
              Recall this chapter
            </button>
          </Hint>
        ))}
    </div>
  );
}
