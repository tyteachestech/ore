import { fold, WORDS } from "./match";
import { GraduationCap, X } from "./icons";
import { Command } from "cmdk";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SkillIcon } from "./IconPicker";
import { isOther } from "../../../packages/core/src/collection-name";
import { LABEL } from "./Collected";
import { courseThumb, lessonsOf, nextLesson, ore, opt, PHONE, touched, type Intent, type Item, type SearchHit, type Skill } from "./ore";
import { Thumb } from "./Thumb";
import { useSwipeDown } from "./phone/sheet";
import { errorText, useFocusWhileMounted } from "./util";
import { Trap } from "./Trap";

/** `typed`: a row found only once he types (F132), so one of a set, like an ambience channel, never crowds the list ⌘K opens on. */
export type Action = { id: string; label: string; hint?: string; keywords?: string[]; typed?: boolean; run: () => void };

type Props = {
  actions: Action[];
  recent: Source[];
  /** Every source: titles are matched here (a course by its own title too), and a hit found in a source's text is titled from it. */
  items: Item[];
  skills: Skill[];
  skill: string | null;
  onSkill: (id: string | null) => void;
  /** Opens a skill's page with its note scrolled to these words. */
  onSkillNote: (id: string, words: string) => void;
  /** Opens a source; `at` is where to land in it (Reader's `jumpTo`). */
  onOpen: (item: string, at?: string) => void;
  /** Ask your library: the query as a question to his sources. Left out on the phone (AI runs on the Mac). */
  onAsk?: (question: string) => void;
  /** A skill made from the palette (New skill, New collection). */
  onCreated: (s: Skill) => void;
  onClose: () => void;
  /** Over Review (controls-08): leaves it as Esc does before an action runs, as if he had closed it first. */
  leave?: () => Promise<void> | undefined;
};

type Source = Pick<Item, "id" | "title" | "type" | "thumbnail">;
/** A source row: its picture (D77), as in every list of sources, then its title. */
const sourceLabel = (i: Source) => (
  <>
    <Thumb item={i} />
    <span className="palette-title">{i.title}</span>
  </>
);

/** `score` ranks a row against the query in place of cmdk's fuzzy match on `value`. */
type Row = { value: string; score?: number; label: ReactNode; extra?: ReactNode; keywords?: string[]; run: () => void };
type Group = { heading: string; score: number; rows: Row[] };
/** A match in the text: `what` names a match that isn't in the source's own text; `at` is where it lands (Reader's `jumpTo`). */
type Hit = { key: string; item?: string; skill?: string; title: string; what?: string; at?: string; snippet?: string };
/** A naming step, Raycast-style: the input names the thing, ↵ makes it, Esc goes back. */
type Page = { kind: "skill"; collection: string } | { kind: "collection" };

const TITLES = 8;

/** ⌘K: recent sources, actions, skills, sources and courses by title, then sources whose text matches
 *  (`ore search`, SQLite FTS5) in their own group below. */
export function Palette({ actions, recent, items, skills, skill, onSkill, onSkillNote, onOpen, onAsk, onCreated, onClose, leave }: Props) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState<Page | null>(null);
  const byRecent = useMemo(() => [...items].sort((a, b) => touched(b).localeCompare(touched(a))), [items]);
  const touchedAt = useMemo(() => new Map(items.map((i) => [i.id, touched(i)])), [items]);
  const [hits, setHits] = useState<Hit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** ⌘ held: the first nine rows show ⌘1–⌘9 and that key runs the row (Raycast). Set only by a ⌘ press
   *  after the palette opened, so the ⌘ still held from ⌘K does not flash the numbers. */
  const [numbers, setNumbers] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useFocusWhileMounted(inputRef);
  const sheet = useRef<HTMLDivElement>(null);
  useSwipeDown(sheet, onClose, PHONE);

  useEffect(() => {
    const query = q.trim();
    if (page || query.length < 2) return setHits([]);
    let live = true;
    const t = setTimeout(() => {
      ore<SearchHit[]>("search", query, "--limit", PHONE ? "500" : "20").then(
        (rows) => {
          if (!live) return;
          // One row per match, each landing on its own place: the words in the text, a highlight's popup,
          // the words in a source note or a skill note.
          const out: Hit[] = [];
          for (const r of rows) {
            if (r.kind === "skill-notes") {
              out.push({ key: `skill notes ${r.ref}`, skill: r.ref, title: skills.find((s) => s.id === r.ref)?.name ?? r.title, what: "skill note", snippet: r.snippet });
              continue;
            }
            const item = r.item ?? (r.kind === "item" ? r.ref : undefined);
            if (!item) continue;
            const intent = r.kind === "annotation" ? (r.title.split(":")[0] as Intent) : undefined;
            out.push({
              key: `text ${r.kind} ${r.ref}`,
              item,
              title: items.find((i) => i.id === item)?.title ?? r.title,
              what: intent ? (LABEL[intent] ?? "highlight").toLowerCase() : r.kind === "notes" ? "source note" : r.kind === "card" ? "exercise" : undefined,
              at: r.kind === "item" ? `find:${query}` : r.kind === "notes" ? `note:${query}` : r.kind === "annotation" ? `ann:${r.ref}` : r.annotation && `ann:${r.annotation}`,
              snippet: r.snippet,
            });
          }
          setHits(out);
          setError(null);
        },
        (e) => {
          if (!live) return;
          setHits([]);
          // Said in the foot, so a search that failed never reads as "No matches".
          setError(`Couldn’t search the text: ${errorText(e)}`);
        },
      );
    }, 150);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, page]);

  const open = (p: Page | null) => {
    setPage(p);
    setQ("");
    setError(null);
  };

  const create = async (name: string) => {
    if (!page || !name || busy) return;
    setBusy(true);
    try {
      const made = await ore<Skill>("skills", "add", name, opt("collection", page.kind === "skill" ? page.collection : ""));
      onClose();
      await leave?.();
      onCreated(made);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  // The palette ranks rows itself: search hits arrive after the query changes, and cmdk's own
  // sort (which reorders DOM nodes on each keystroke) misses groups that mount later.
  const query = q.trim();
  const group = (heading: string, rows: Row[], fixed?: number, max = Infinity): Group => {
    const scored = rows
      .map((row) => ({ row, s: fixed ?? row.score ?? (query ? Math.max(titleScore(row.value, query), ...(row.keywords ?? []).map((k) => titleScore(k, query) * 0.9)) : 1) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, max);
    return { heading, score: scored[0]?.s ?? 0, rows: scored.map((x) => x.row) };
  };

  const current = skills.find((s) => s.id === skill);
  const collections = [...new Set(skills.flatMap((s) => (s.collection ? [s.collection] : [])))];
  let groups: Group[];
  if (page) {
    // "Other" is the skills in no collection, so naming it adds a skill there, as naming a collection that exists adds one to it.
    const other = page.kind === "collection" && isOther(query);
    const exists = page.kind === "collection" && (other ? "Other" : collections.find((c) => c.toLowerCase() === query.toLowerCase()));
    groups = query
      ? [
          {
            heading: "",
            score: 1,
            rows: [
              page.kind === "collection"
                ? { value: "create", label: exists ? <>Add a skill to “{exists}”</> : <>Create collection “{query}”</>, run: () => open({ kind: "skill", collection: other ? "" : exists || query }) }
                : { value: "create", label: <>Create skill “{query}”{page.collection && <span className="sub">in {page.collection}</span>}</>, run: () => void create(query) },
            ],
          },
        ]
      : [];
  } else {
    const titled = new Set<string>();
    // A course (D79) is one row, matched by its own title, that opens the lesson to read next, as its
    // row in the source list does; its lessons match by their own titles like any source.
    const courses = query ? [...new Map(items.flatMap((i) => (i.course ? [[i.course.id, i.course] as const] : []))).values()] : [];
    const byTitle = group(
      "Sources",
      query
        ? [
            ...courses.map((c): Row => {
              const lessons = lessonsOf(items, c.id);
              const thumb = courseThumb(lessons);
              return {
                value: `course ${c.id}`,
                score: titleScore(c.title, query),
                label: (
                  <>
                    {thumb ? (
                      <Thumb item={thumb} />
                    ) : (
                      <span className="thumb none" aria-hidden="true">
                        <GraduationCap size={12} />
                      </span>
                    )}
                    <span className="palette-title">{c.title}</span>
                  </>
                ),
                extra: <span className="sub course-of">course</span>,
                run: () => onOpen((nextLesson(lessons) ?? lessons[0]!).id),
              };
            }),
            // A lesson names its course, as on Home: "Skills" alone doesn't say which course it is from.
            // Last touched first, so among equally good matches the one he had open lately leads (sort is stable).
            ...byRecent.map((i) => ({ value: `source ${i.id}`, score: titleScore(i.title, query), label: sourceLabel(i), extra: i.course && <span className="sub course-of">{i.course.title}</span>, run: () => onOpen(i.id) })),
          ]
        : [],
      undefined,
      TITLES,
    );
    for (const r of byTitle.rows) if (r.value.startsWith("source ")) titled.add(r.value.slice(7));
    groups = [
      group("Recent", query ? [] : recent.map((r) => ({ value: `source ${r.id}`, label: sourceLabel(r), run: () => onOpen(r.id) })), 2),
      byTitle,
      group(
        "Actions",
        [
          ...actions.filter((a) => query || !a.typed).map((a) => ({ value: a.label, label: a.label, keywords: a.keywords, extra: a.hint && <kbd>{a.hint}</kbd>, run: a.run })),
          { value: "New skill…", label: "New skill…", keywords: ["add skill", "create skill"], run: () => open({ kind: "skill", collection: current?.collection ?? "" }) },
          { value: "New collection…", label: "New collection…", keywords: ["section", "group", "folder", "create collection"], run: () => open({ kind: "collection" }) },
        ],
      ),
      // Skill pages (D46): stats, skill note, questions and sources.
      group("Skills", [
        ...(skill ? [{ value: "All sources", label: "All sources", run: () => onSkill(null) }] : []),
        ...skills.map((s) => ({
          value: `Go to skill: ${s.name}`,
          // Scored by its name too, so the skill named what he typed is the top row.
          keywords: [s.name],
          label: (
            <>
              <SkillIcon icon={s.icon} color={s.color} dot className="palette-icon" />
              {s.name}
            </>
          ),
          extra: skill === s.id && <span className="sub">current</span>,
          run: () => onSkill(s.id),
        })),
      ]),
      // Matches in the text (body, highlights, cards, notes) come last, under their own heading,
      // so a title match is never pushed down by a word deep in a long source.
      group(
        "In the text",
        // The phone's SQLite has no bm25 (phone/sqlite.ts), so its hits come last touched first.
        (PHONE ? [...hits].sort((a, b) => (touchedAt.get(b.item ?? "") ?? "").localeCompare(touchedAt.get(a.item ?? "") ?? "")) : hits)
          .filter((h) => !h.item || !titled.has(h.item))
          .map((h) => ({
            value: h.key,
            label: (
              <>
                {h.item && <Thumb item={items.find((i) => i.id === h.item) ?? { type: "article" }} />}
                <span className="palette-hit">
                  <span className="title">{h.what ? `${h.title} · ${h.what}` : h.title}</span>
                  {h.snippet && <span className="sub">{snippet(h.snippet, query)}</span>}
                </span>
              </>
            ),
            run: h.skill ? () => onSkillNote(h.skill!, query) : () => onOpen(h.item!, h.at),
          })),
        0.01,
      ),
      // Ask your library (Notion's "Ask AI" in search): first when the query reads as a question, else last.
      group("Ask", onAsk && query.length > 1 ? [{ value: "ask", label: <>Ask your library: “{query}”</>, run: () => onAsk(query) }] : [], asksQuestion(query) ? 2 : 0.005),
    ];
  }
  groups = groups.filter((g) => g.rows.length).sort((a, b) => b.score - a.score);

  // Keep the highlight on the top row when late search results change what that is.
  const first = groups[0]?.rows[0]?.value ?? "";
  const [selected, setSelected] = useState(first);
  useEffect(() => setSelected(first), [first]);

  const run = async (f: () => void) => {
    onClose();
    await leave?.();
    f();
  };
  // A naming step keeps the palette open; every other row closes it first.
  const pick = (r: Row) => (r.value === "create" || /^New (skill|collection)…$/.test(r.value) ? r.run() : run(r.run));
  const quick = groups.flatMap((g) => g.rows).slice(0, 9);

  useEffect(() => {
    const up = (e: KeyboardEvent) => e.key === "Meta" && setNumbers(false);
    const off = () => setNumbers(false);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", off);
    return () => {
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", off);
    };
  }, []);

  const placeholder = !page ? "Search sources or run a command…" : page.kind === "collection" ? "Name the collection…" : page.collection ? `Name the first skill in ${page.collection}…` : "Name the skill…";

  return (
    <Trap>
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Command
        ref={sheet}
        className="panel"
        label="Command palette"
        shouldFilter={false}
        value={selected}
        onValueChange={setSelected}
        onKeyDown={(e) => {
          if (e.key === "Meta") setNumbers(true);
          // ⌘1–⌘9 run a row here, before the app's ⌘1/⌘2 (To read, Done) see them.
          const n = e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && /^Digit[1-9]$/.test(e.code) ? quick[Number(e.code.slice(5)) - 1] : undefined;
          if (n) {
            e.preventDefault();
            e.stopPropagation();
            setNumbers(false);
            pick(n);
          } else if (e.key === "Tab") e.preventDefault(); // one input; arrows move through the list
          // Esc clears what he typed first, then goes back a page, then closes (Raycast).
          else if (e.key === "Escape" && q) {
            e.preventDefault();
            e.stopPropagation();
            setQ("");
            setError(null);
          } else if (e.key === "Escape" || (e.key === "Backspace" && page && !q)) {
            e.preventDefault();
            e.stopPropagation();
            if (page) open(null);
            else onClose();
          }
        }}
      >
        <div className="palette-field">
          <Command.Input
            ref={inputRef}
            className="panel-input"
            value={q}
            onValueChange={(v) => {
              setQ(v);
              setError(null);
            }}
            readOnly={busy}
            placeholder={placeholder}
            spellCheck={false}
            autoComplete="off"
          />
          {/* The phone has no Esc to leave with, and the sheet fills the screen. */}
          {PHONE && (
            <button className="palette-close" aria-label="Close" onClick={onClose}>
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        <Command.List>
          {!page && <Command.Empty>No matches</Command.Empty>}
          {groups.map((g) => (
            <Command.Group key={g.heading} heading={g.heading || undefined}>
              {g.rows.map((r) => {
                const i = numbers ? quick.indexOf(r) : -1;
                return (
                  <Command.Item key={r.value} value={r.value} onSelect={() => pick(r)}>
                    {r.label}
                    {i >= 0 ? <kbd>⌘{i + 1}</kbd> : r.extra}
                  </Command.Item>
                );
              })}
            </Command.Group>
          ))}
        </Command.List>
        <div className="panel-foot">
          {error && <span className="err">{error}</span>}
          <span className="right">
            {page ? (
              <>
                <span>
                  <kbd>↵</kbd> {page.kind === "collection" ? "Next" : "Create"}
                </span>
                <span>
                  <kbd>Esc</kbd> Back
                </span>
              </>
            ) : (
              <>
                {groups.some((g) => g.rows.length > 0) && (
                  <span>
                    <kbd>↵</kbd> {/^(source |course |text |skill notes |Go to skill|All sources)/.test(selected) ? "Open" : selected === "ask" ? "Ask" : "Run"}
                  </span>
                )}
                <span>
                  <kbd>Esc</kbd> Close
                </span>
              </>
            )}
          </span>
        </div>
      </Command>
    </div>
    </Trap>
  );
}

/** A query that reads as a question: it ends in "?", or starts with a question word and has three words or more. */
export const asksQuestion = (q: string) =>
  /\?\s*$/.test(q) || (/^(what|why|how|who|whom|when|where|which|does|do|did|is|are|was|were|can|could|should|would|will|explain)\b/i.test(q) && q.trim().split(/\s+/).length >= 3);

/** How well a title matches: every query word must appear in it, and a word that starts a title
 *  word counts more than one inside it (Linear, Raindrop). Letters scattered across a long title
 *  never match, which cmdk's fuzzy score allows. Accents fold ("cafe" finds Café, Raycast), a query
 *  of emoji (🔥) matches the titles that hold it, and the title that is the query ranks first. */
export function titleScore(title: string, query: string): number {
  const t = fold(title);
  const q = fold(query).trim();
  const exact = t.trim() === q ? 1 : 0;
  const terms = q.match(WORDS) ?? [];
  // No letters: emoji (🔥) match the titles that hold them; punctuation alone (: . -) matches nothing.
  if (!terms.length) return /\p{Extended_Pictographic}/u.test(q) && t.includes(q) ? 1 + (t.startsWith(q) ? 0.5 : 0) + exact : 0;
  let score = 0;
  for (const term of terms) {
    let i = t.indexOf(term);
    if (i < 0) return 0;
    let start = false;
    for (; i >= 0 && !start; i = t.indexOf(term, i + 1)) start = i === 0 || !/[\p{L}\p{N}]/u.test(t.charAt(i - 1));
    score += start ? 1 : 0.5;
  }
  return score / terms.length + (t.startsWith(terms[0]!) ? 0.5 : 0) + exact;
}

/** One line of a search snippet: FTS5 brackets the matched words; a bracket around anything
 *  else is the source's own Markdown and stays as written. */
export function snippet(text: string, query: string): ReactNode {
  const terms = query.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
  const line = text.replace(/\s+/g, " ").replace(/^[#>*\-\s]+/, "");
  const parts = line.split(/\[([^[\]]+)\]/);
  return parts.map((p, i) =>
    i % 2 === 0 ? p : terms.some((t) => p.toLowerCase().startsWith(t)) ? <mark key={i}>{p}</mark> : `[${p}]`,
  );
}
