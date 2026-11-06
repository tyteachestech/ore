// The iPhone shell (phase 0 feel test): the Mac's screens in a phone layout. A tab bar for Today
// and Sources, as in Apple Books; a source and Review open full screen over it, with a way back.
// Everything inside the screens is the Mac app's own code.
import { BookOpen, CaretLeft, House } from "../icons";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Boundary } from "../Boundary";
import { Home } from "../Home";
import type { SideTab } from "../Notes";
import { lessonsOf, ore, type Item, type Skill, touched } from "../ore";
import { Reader } from "../Reader";
import { Review } from "../Review";
import { Thumb } from "../Thumb";
import { useToast } from "../Toast";
import { errorText } from "../util";

/** iOS's edge swipes. From the left edge the screen moves with the finger; let go past a third of
 *  the way (or with a flick) and it slides off and goes back, otherwise it springs back. A screen
 *  with a second page (a source and its note, `.reader`) pages instead: from the right edge to the
 *  note, and from the left edge back to the source, each keeping its scroll. */
function Screen({ onBack, onForward, className, children }: { onBack: () => void; onForward?: (open: boolean) => void; className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const back = useRef(onBack);
  back.current = onBack;
  const forward = useRef(onForward);
  forward.current = onForward;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let x0 = 0, y0 = 0, t0 = 0, dx = 0, state: "idle" | "maybe" | "drag" = "idle";
    let edge: "left" | "right" = "left";
    let strip: HTMLElement | null = null;
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t || e.touches.length !== 1) return;
      const pages = forward.current ? el.querySelector<HTMLElement>(".reader") : null;
      const noting = !!pages?.classList.contains("noting");
      if (t.clientX <= 24) edge = "left";
      else if (pages && !noting && t.clientX >= innerWidth - 24) edge = "right";
      else return;
      strip = noting || edge === "right" ? pages : null;
      [x0, y0, t0, dx, state] = [t.clientX, t.clientY, e.timeStamp, 0, "maybe"];
    };
    const move = (e: TouchEvent) => {
      const t = e.touches[0];
      if (state === "idle" || !t) return;
      dx = edge === "left" ? Math.max(0, t.clientX - x0) : Math.min(0, t.clientX - x0);
      if (state === "maybe") {
        if (Math.abs(t.clientY - y0) > 10 && Math.abs(t.clientY - y0) > Math.abs(dx)) return void (state = "idle");
        if (Math.abs(dx) < 10) return;
        state = "drag";
        if (strip) strip.classList.add("dragging");
        else el.style.transition = "none";
        window.getSelection()?.removeAllRanges();
        // The keyboard goes as the swipe starts, as in iOS.
        (document.activeElement as HTMLElement | null)?.blur();
      }
      e.preventDefault();
      if (strip) strip.style.setProperty("--drag", `${dx}px`);
      else el.style.transform = `translateX(${dx}px)`;
    };
    const end = (e: TouchEvent) => {
      if (state !== "drag") return void (state = "idle");
      state = "idle";
      const go = Math.abs(dx) > el.clientWidth / 3 || Math.abs(dx) / Math.max(1, e.timeStamp - t0) > 0.5;
      if (strip) {
        // Set the page at once so it slides on from where the finger let go; React agrees after.
        if (go) strip.classList.toggle("noting", edge === "right");
        strip.classList.remove("dragging");
        strip.style.removeProperty("--drag");
        if (go) forward.current?.(edge === "right");
        return;
      }
      el.style.transition = "transform 250ms cubic-bezier(.2, .9, .3, 1)";
      el.style.transform = go ? `translateX(${el.clientWidth}px)` : "";
      if (go) setTimeout(() => back.current(), 200);
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, []);
  return (
    <div className={className} ref={ref}>
      {children}
    </div>
  );
}

type TabId = "today" | "sources";

/** Where he was, so a relaunch comes back to it, as Apple's apps do. */
type Place = { tab: TabId; skill: string | null; openId: string | null; noting?: boolean; review: { pick: string[] | null } | null };
const PLACE = "ore-phone-place";
function loadPlace(): Place {
  try {
    return { tab: "today", skill: null, openId: null, review: null, ...JSON.parse(localStorage.getItem(PLACE) ?? "{}") };
  } catch {
    return { tab: "today", skill: null, openId: null, review: null };
  }
}

/** Sources by To read and Done, as one list. */
function SourceList({ title, items, onOpen }: { title: string; items: Item[] | null; onOpen: (id: string) => void }) {
  const toRead = (items ?? []).filter((i) => i.status !== "done").sort((a, b) => touched(b).localeCompare(touched(a)));
  const done = (items ?? []).filter((i) => i.status === "done");
  return (
    <div className="phone-sources">
      <h1>{title}</h1>
      {items === null ? null : !items.length ? (
        <p className="phone-empty">Nothing here yet. Sources you add on the Mac come to the phone with its next install.</p>
      ) : (
        ([
          ["To read", toRead],
          ["Done", done],
        ] as const).map(([label, list]) =>
          list.length ? (
            <section key={label}>
              <h2>{label}</h2>
              <ul>
                {list.map((i) => (
                  <li key={i.id}>
                    <button onClick={() => onOpen(i.id)}>
                      <Thumb item={i} className="thumb phone-thumb" />
                      <span className="phone-title">{i.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null,
        )
      )}
    </div>
  );
}

const Back = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <header className="phone-bar">
    <button className="phone-back" onClick={onClick}>
      <CaretLeft size={16} aria-hidden="true" /> {label}
    </button>
  </header>
);

export function PhoneApp() {
  const [start] = useState(loadPlace);
  const [tab, setTab] = useState<TabId>(start.tab);
  const [items, setItems] = useState<Item[] | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skill, setSkill] = useState<string | null>(start.skill);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(start.openId);
  const [noting, setNoting] = useState(!!start.noting);
  /** What the page beside the source shows: the note, or what he collected (a tap on the collected count). */
  const [side, setSide] = useState<SideTab>("note");
  // Once that page has slid away it is the note again, so the edge swipe always brings the note.
  useEffect(() => {
    if (noting) return;
    const t = setTimeout(() => setSide("note"), 300);
    return () => clearTimeout(t);
  }, [noting]);
  const [jumpTo, setJumpTo] = useState<string | undefined>();
  const [finishing, setFinishing] = useState(false);
  const [reviewing, setReviewing] = useState<{ pick: string[] | null; run: number } | null>(start.review && { pick: start.review.pick, run: 0 });
  const [tick, setTick] = useState(0);
  const { notify, view: toast } = useToast();
  const actions = useRef([]);

  useEffect(() => {
    try {
      localStorage.setItem(PLACE, JSON.stringify({ tab, skill, openId, noting, review: reviewing && { pick: reviewing.pick } } satisfies Place));
    } catch {}
  }, [tab, skill, openId, noting, reviewing]);
  const refresh = useCallback(async () => {
    try {
      const [all, sk] = await Promise.all([ore<Item[]>("ls"), ore<Skill[]>("skills")]);
      setItems(all);
      setSkills(sk);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => void refresh(), [refresh]);

  // The on-screen keyboard covers fixed screens (Review) instead of shrinking them: lift them by its
  // height, and keep the answer's buttons in sight when it opens.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let full = innerHeight;
    const fit = () => {
      // Against the full screen: with some fields iOS also shrinks innerHeight, while fixed screens still
      // lay out on the whole screen (portrait only, so its height doesn't change).
      full = Math.max(full, innerHeight);
      const kb = Math.max(0, Math.round(full - vv.height));
      document.documentElement.style.setProperty("--keyboard", `${kb}px`);
      if (!kb) return;
      document.querySelector(".phone-full .review-foot")?.scrollIntoView({ block: "end" });
      // A field in the reader (a prequestion, a highlight's note) stays in sight above the keyboard.
      const field = document.activeElement;
      if (!(field instanceof HTMLElement) || !field.closest(".phone-reader")) return;
      if (!field.isContentEditable) return field.scrollIntoView({ block: "nearest" });
      // The source note is one tall editor: bring the caret, not the editor, into view, once the screen has shrunk.
      requestAnimationFrame(() => {
        const sel = getSelection();
        const caret = sel?.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
        let box: HTMLElement | null = field;
        while (box && !(box.scrollHeight > box.clientHeight && getComputedStyle(box).overflowY !== "visible")) box = box.parentElement;
        if (!caret || !box) return;
        const below = caret.bottom + 24 - box.getBoundingClientRect().bottom;
        if (below > 0) box.scrollTop += below;
      });
    };
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    return () => {
      vv.removeEventListener("resize", fit);
      vv.removeEventListener("scroll", fit);
    };
  }, []);

  const open = (id: string, at?: string) => {
    setJumpTo(at);
    setFinishing(false);
    setNoting(false);
    setOpenId(id);
  };
  /** Archive from the source's menu: back to the list at once, with Undo, as on the Mac. */
  const archive = async (item: Item) => {
    setOpenId(null);
    setItems((all) => all?.filter((i) => i.id !== item.id) ?? all);
    const apply = (on: boolean) => {
      if (on) setItems((all) => all?.filter((i) => i.id !== item.id) ?? all);
      ore("archive", item.id, ...(on ? [] : ["--undo"])).then(refresh, (e) => (notify(errorText(e), "error"), refresh()));
    };
    notify(`Archived “${item.title}”`, "info", () => apply(false), () => apply(true));
    try {
      await ore("archive", item.id);
    } catch (e) {
      notify(errorText(e), "error");
    }
    void refresh();
  };
  const endReview = () => {
    setReviewing(null);
    setTick((t) => t + 1);
  };

  // A full screen opens over the tabs, which stay underneath for the swipe back to reveal.
  const over = reviewing ? (
      <Screen className="phone-full" onBack={endReview}>
        <Boundary onBack={endReview}>
          <Review
            key={reviewing.run}
            pick={reviewing.pick}
            skills={skills}
            onOpenSource={(item, at) => {
              endReview();
              open(item, at);
            }}
            onClose={(again) => (again ? setReviewing({ pick: reviewing.pick, run: reviewing.run + 1 }) : endReview())}
            notify={notify}
          />
        </Boundary>
      </Screen>
    ) : openId ? (
      <Screen className="phone-full phone-reader" onBack={() => setOpenId(null)} onForward={setNoting}>
        {/* From the note, Back returns to the source, as the left-edge swipe does. */}
        <Back label={noting ? "Source" : "Back"} onClick={() => (noting ? setNoting(false) : setOpenId(null))} />
        <Boundary onBack={() => setOpenId(null)}>
          <Reader
            key={openId}
            id={openId}
            skills={skills}
            finishing={finishing}
            setFinishing={setFinishing}
            notesOpen={noting}
            sideTab={side}
            onShowSide={(t) => (setSide(t), setNoting(true))}
            onCloseSide={() => setNoting(false)}
            onToggleSide={() => setNoting((v) => !v)}
            showCollected={0}
            renameSource={0}
            actionsRef={actions}
            onArchive={(item) => void archive(item)}
            lessons={(() => {
              const c = (items ?? []).find((i) => i.id === openId)?.course;
              return c ? lessonsOf(items ?? [], c.id) : undefined;
            })()}
            onOpenLesson={(id) => open(id)}
            onPin={() => {}}
            onMove={() => void refresh()}
            jumpTo={jumpTo}
            blocked={false}
            targets={[]}
            onOpenLink={() => {}}
            onBack={() => setOpenId(null)}
            onChanged={() => void refresh()}
            onSkillsChanged={() => void refresh()}
            onDone={() => {
              setOpenId(null);
              setFinishing(false);
              void refresh();
            }}
            notify={notify}
          />
        </Boundary>
      </Screen>
    ) : null;

  const skillName = skills.find((s) => s.id === skill)?.name;

  return (
    <div className="phone-app">
      <main className="phone-page">
        {error && <p className="phone-error">{error}</p>}
        {tab === "today" ? (
          <Home
            items={items ?? []}
            skills={skills}
            recent={[]}
            reload={tick}
            onReview={(pick) => setReviewing({ pick, run: 0 })}
            onOpenSource={(id) => open(id)}
            onOpenSkill={setSkill}
            notify={notify}
          />
        ) : (
          <SourceList title="Sources" items={items} onOpen={open} />
        )}
      </main>
      <nav className="phone-tabs">
        <button className={tab === "today" ? "on" : ""} onClick={() => setTab("today")}>
          <House size={24} weight={tab === "today" ? "fill" : "regular"} aria-hidden="true" />
          Today
        </button>
        <button className={tab === "sources" ? "on" : ""} onClick={() => setTab("sources")}>
          <BookOpen size={24} weight={tab === "sources" ? "fill" : "regular"} aria-hidden="true" />
          Sources
        </button>
      </nav>
      {/* A skill's sources, pushed from Today; a source opens over it. */}
      {skill && (
        <Screen className="phone-full" onBack={() => setSkill(null)}>
          <Back label={tab === "today" ? "Today" : "Sources"} onClick={() => setSkill(null)} />
          <div className="phone-page">
            <SourceList title={skillName ?? "Sources"} items={items && items.filter((i) => i.skills.includes(skill))} onOpen={open} />
          </div>
        </Screen>
      )}
      {over}
      {toast}
    </div>
  );
}
