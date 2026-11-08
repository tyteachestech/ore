import * as RadioGroup from "@radix-ui/react-radio-group";
import * as Tabs from "@radix-ui/react-tabs";
import { defaultEmojiDataResolver, EmojiPicker } from "frimousse";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Hint } from "./Hint";
import { Shuffle } from "./icons";
import { SKILL_COLORS, type SkillColor } from "./ore";
import { load, save } from "./util";

// A skill icon is one emoji or "mc:<name>", a MingCute fill icon tinted with the skill color (D36), drawn on the
// UI icons' 16-pixel grid (vite.config.ts, pixelSkillIcons).
// "ph:<name>" (Phosphor) icons picked before MingCute still draw. Emoji data and the icon SVGs ship
// with the app (vite.config.ts), so the picker works offline.
const EMOJIBASE = "/emojibase";
const iconUrl = (icon: string) =>
  icon.startsWith("mc:") ? `url(/mingcute-px/${icon.slice(3)}.svg)` : icon.startsWith("ph:") ? `url(/icons/${icon.slice(3)}-fill.svg)` : null;
const isIcon = (icon: string) => iconUrl(icon) !== null;

/** Draws a skill's icon. Without one it draws nothing, or a color dot with `dot`; a stored value it
 *  can't draw (a hand-edited skills.yaml) counts as no icon. */
export function SkillIcon({ icon, color, dot, className = "" }: { icon?: string; color?: SkillColor | ""; dot?: boolean; className?: string }) {
  const none = dot ? <span className={`skill-icon dot ${className}`} data-color={color || undefined} aria-hidden="true" /> : null;
  if (!icon) return none;
  const mask = iconUrl(icon);
  if (mask) {
    const style: CSSProperties = { maskImage: mask, WebkitMaskImage: mask };
    return <span className={`skill-icon glyph ${className}`} data-color={color || undefined} style={style} aria-hidden="true" />;
  }
  if ([...new Intl.Segmenter().segment(icon)].length !== 1) return none;
  return (
    <span className={`skill-icon emoji ${className}`} aria-hidden="true">
      {icon}
    </span>
  );
}

const RECENTS = "ore.recent-icons";
function recents(): string[] {
  try {
    const v: unknown = JSON.parse(load(RECENTS) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const random = <T,>(xs: T[]): T | undefined => xs[Math.floor(Math.random() * xs.length)];

/** The popover's onOpenAutoFocus: the caret goes in Filter, so typing searches at once (Notion,
 *  Linear). Left to Radix, focus lands on the first tab and the fields' autoFocus is lost. */
export const focusFilter = (e: Event) => {
  e.preventDefault();
  (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".picker-search")?.focus();
};

/** The skill colours as one radio group, as a macOS colour row: one Tab stop, ← → move and pick. */
export function Swatches({ className, small, value, onPick }: { className: string; small?: boolean; value: SkillColor | ""; onPick: (color: SkillColor | "") => void }) {
  return (
    <RadioGroup.Root className={className} orientation="horizontal" loop aria-label="Color" value={value || "none"} onValueChange={(v) => onPick(v === "none" ? "" : (v as SkillColor))}>
      {(["", ...SKILL_COLORS] as const).map((c) => (
        // The hint sits on a wrapper: on the radio itself, its focus handler (which keeps a hint from
        // showing on focus moved by code) would stop the pick that Radix makes as an arrow moves focus.
        <Hint key={c || "none"} text={c ? c[0]!.toUpperCase() + c.slice(1) : "No color"}>
          <span className="swatch-hint">
            <RadioGroup.Item className={`swatch${small ? " small" : ""}`} value={c || "none"} data-color={c || undefined} aria-label={c || "No color"} />
          </span>
        </Hint>
      ))}
    </RadioGroup.Root>
  );
}

/** Notion-style picker: Emoji and Icons tabs, search, recents, random, remove; icons take the skill color. */
export function IconPicker({ value, color, onPick, onColor, onRemove }: {
  value?: string;
  color: SkillColor | "";
  onPick: (icon: string) => void;
  onColor: (color: SkillColor | "") => void;
  onRemove: () => void;
}) {
  const [recent, setRecent] = useState(recents);
  const pick = (icon: string) => {
    const next = [icon, ...recent.filter((r) => r !== icon)].slice(0, 24);
    setRecent(next);
    save(RECENTS, JSON.stringify(next));
    onPick(icon);
  };

  return (
    <Tabs.Root className="picker" defaultValue={value && isIcon(value) ? "icons" : "emoji"}>
      <div className="picker-head">
        <Tabs.List className="picker-tabs" aria-label="Icon type">
          <Tabs.Trigger value="emoji">Emoji</Tabs.Trigger>
          <Tabs.Trigger value="icons">Icons</Tabs.Trigger>
        </Tabs.List>
        <button className="picker-remove" disabled={!value} onClick={onRemove}>
          Remove
        </button>
      </div>
      <Swatches className="picker-colors" small value={color} onPick={onColor} />
      <Tabs.Content value="emoji" className="picker-body">
        <EmojiTab recent={recent.filter((r) => !isIcon(r))} onPick={pick} />
      </Tabs.Content>
      <Tabs.Content value="icons" className="picker-body">
        <IconsTab recent={recent.filter(isIcon)} color={color} onPick={pick} />
      </Tabs.Content>
    </Tabs.Root>
  );
}

function EmojiTab({ recent, onPick }: { recent: string[]; onPick: (icon: string) => void }) {
  const [query, setQuery] = useState("");
  const shuffle = async () => {
    const data = await defaultEmojiDataResolver("en", { emojibaseUrl: EMOJIBASE });
    const e = random(data.emojis);
    if (e) onPick(e.emoji);
  };
  return (
    <EmojiPicker.Root className="emoji-root" columns={12} emojibaseUrl={EMOJIBASE} onEmojiSelect={(e) => onPick(e.emoji)}>
      <div className="picker-tools">
        <EmojiPicker.Search className="field picker-search" placeholder="Filter…" autoFocus onChange={(e) => setQuery(e.target.value)} />
        <Hint text="Random emoji">
          <button className="picker-tool" aria-label="Random emoji" onClick={() => void shuffle()}>
            <Shuffle size={16} aria-hidden="true" />
          </button>
        </Hint>
        <EmojiPicker.SkinToneSelector className="picker-tool tone" aria-label="Skin tone" title="Skin tone" />
      </div>
      {!query && recent.length > 0 && (
        <div className="picker-section recent">
          <div className="picker-label">Recent</div>
          <div className="picker-grid">
            {recent.slice(0, 12).map((e) => (
              <button key={e} className="picker-cell emoji" aria-label={e} onClick={() => onPick(e)}>
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
      <EmojiPicker.Viewport className="picker-scroll">
        <EmojiPicker.Loading className="picker-note">Loading…</EmojiPicker.Loading>
        <EmojiPicker.Empty className="picker-note">No emoji found.</EmojiPicker.Empty>
        <EmojiPicker.List
          className="emoji-list"
          components={{
            CategoryHeader: ({ category, ...props }) => (
              <div className="picker-label" {...props}>
                {category.label}
              </div>
            ),
            Row: ({ children, ...props }) => (
              <div className="picker-grid" {...props}>
                {children}
              </div>
            ),
            Emoji: ({ emoji, ...props }) => (
              <button className="picker-cell emoji" data-active={emoji.isActive || undefined} {...props}>
                {emoji.emoji}
              </button>
            ),
          }}
        />
      </EmojiPicker.Viewport>
    </EmojiPicker.Root>
  );
}

/** `words`: the name as words ("book 2 ai"); `terms`: its category, both lowercased, for search. */
type McIcon = { name: string; words: string; terms: string };
let mcIcons: Promise<McIcon[]> | null = null;
// Unfiltered, the grid starts with the subjects a skill is likely about and ends with UI glyphs and brand logos.
const ORDER = "education nature food sport design development media device building transport weather emoji user contact business crypto file editor map zodiac shape other part system arrow logo".split(" ");
const categoryRank = (category: string) => (ORDER.includes(category) ? ORDER.indexOf(category) : ORDER.length);
const loadIcons = () =>
  (mcIcons ??= import("virtual:mingcute").then((m) =>
    m.default
      .map(([name, category]): McIcon => ({ name, words: name.replaceAll("_", " ").toLowerCase(), terms: category }))
      .sort((a, b) => categoryRank(a.terms) - categoryRank(b.terms)),
  ));

const COLS = 12;
const label = (icon: string) => icon.slice(3).replaceAll(/[-_]/g, " ");

function IconsTab({ recent, color, onPick }: { recent: string[]; color: SkillColor | ""; onPick: (icon: string) => void }) {
  const [all, setAll] = useState<McIcon[] | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  useEffect(() => void loadIcons().then(setAll), []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!all || !q) return all ?? [];
    // Exact name, then names starting with the query, then a word starting with it, then names containing it, then categories.
    const rank = (i: McIcon) =>
      i.words === q ? 0 : i.words.startsWith(q) ? 1 : i.words.includes(` ${q}`) ? 2 : i.words.includes(q) ? 3 : i.terms.includes(q) ? 4 : 5;
    return all
      .map((i) => ({ i, r: rank(i) }))
      .filter((x) => x.r < 5)
      .sort((a, b) => a.r - b.r)
      .map((x) => x.i);
  }, [all, query]);
  useEffect(() => setActive(0), [query]);
  // The arrows move the active cell; keep it in view as they leave the visible rows (not on hover).
  const scroll = useRef<HTMLDivElement>(null);
  const keyed = useRef(false);
  useEffect(() => {
    if (keyed.current) scroll.current?.querySelector<HTMLElement>("[data-active]")?.scrollIntoView({ block: "nearest" });
    keyed.current = false;
  }, [active]);

  const onKey = (e: ReactKeyboardEvent) => {
    const move = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLS, ArrowUp: -COLS }[e.key];
    if (move !== undefined) {
      e.preventDefault();
      keyed.current = true;
      setActive((a) => Math.min(Math.max(a + move, 0), shown.length - 1));
    } else if (e.key === "Enter" && shown[active]) {
      e.preventDefault();
      onPick(`mc:${shown[active].name}`);
    }
  };

  /** `icon` is the stored value, "mc:<name>" (or "ph:<name>" in recents). */
  const cell = (icon: string, i?: number) => (
    <button
      key={icon}
      className="picker-cell"
      data-active={i === active || undefined}
      aria-label={label(icon)}
      title={label(icon)}
      onClick={() => onPick(icon)}
      onMouseEnter={() => i !== undefined && setActive(i)}
    >
      <SkillIcon icon={icon} color={color} />
    </button>
  );

  return (
    <>
      <div className="picker-tools">
        <input className="field picker-search" placeholder="Filter…" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey} />
        <Hint text="Random icon">
          <button className="picker-tool" aria-label="Random icon" onClick={() => shown.length && onPick(`mc:${random(shown)!.name}`)}>
            <Shuffle size={16} aria-hidden="true" />
          </button>
        </Hint>
      </div>
      <div className="picker-scroll" ref={scroll}>
        {!query && recent.length > 0 && (
          <div className="picker-section">
            <div className="picker-label">Recent</div>
            <div className="picker-grid">{recent.slice(0, 12).map((r) => cell(r))}</div>
          </div>
        )}
        {!all ? (
          <div className="picker-note">Loading…</div>
        ) : shown.length ? (
          <div className="picker-section">
            {!query && <div className="picker-label">Icons</div>}
            <div className="picker-grid">{shown.map((i, n) => cell(`mc:${i.name}`, n))}</div>
          </div>
        ) : (
          <div className="picker-note">No icons found.</div>
        )}
      </div>
    </>
  );
}
