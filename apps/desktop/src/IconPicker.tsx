import * as RadioGroup from "@radix-ui/react-radio-group";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Hint } from "./Hint";
import { Shuffle } from "./icons";
import { SKILL_COLORS, type SkillColor } from "./ore";
import { SKILL_ICON_SET } from "./skill-icon-set";
import { load, save } from "./util";

// A skill icon is "mc:<name>", one of the set in skill-icon-set.ts (D157): a MingCute fill glyph redrawn on the
// UI icons' 16-pixel grid (vite.config.ts, pixelSkillIcons), tinted with the skill colour (D36). The SVGs ship
// with the app, so the picker works offline. Anything else stored (an emoji from before D157, a hand edit) draws nothing.
const iconUrl = (icon: string) => (icon.startsWith("mc:") ? `url(/mingcute-px/${icon.slice(3)}.svg)` : null);

/** Draws a skill's icon. Without one it draws nothing, or a colour dot with `dot`; a stored value it
 *  can't draw counts as no icon. */
export function SkillIcon({ icon, color, dot, className = "" }: { icon?: string; color?: SkillColor | ""; dot?: boolean; className?: string }) {
  const none = dot ? <span className={`skill-icon dot ${className}`} data-color={color || undefined} aria-hidden="true" /> : null;
  const mask = icon && iconUrl(icon);
  if (!mask) return none;
  const style: CSSProperties = { maskImage: mask, WebkitMaskImage: mask };
  return <span className={`skill-icon glyph ${className}`} data-color={color || undefined} style={style} aria-hidden="true" />;
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

/** Notion-style icon picker: search, recents, random, remove; icons take the skill colour. */
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
    <div className="picker">
      <div className="picker-head">
        <Swatches className="picker-colors" small value={color} onPick={onColor} />
        <button className="picker-remove" disabled={!value} onClick={onRemove}>
          Remove
        </button>
      </div>
      <div className="picker-body">
        <IconsTab recent={recent.filter((r) => iconUrl(r) !== null)} color={color} onPick={pick} />
      </div>
    </div>
  );
}

/** `words`: the name as words plus the words that find it ("book 2 read"), lowercased, for search. */
type McIcon = { name: string; words: string };
const ICONS: McIcon[] = SKILL_ICON_SET.map(([name, words = ""]) => ({ name, words: `${name.replaceAll("_", " ")} ${words}`.toLowerCase() }));

const COLS = 12;
const label = (icon: string) => icon.slice(3).replaceAll(/[-_]/g, " ");

function IconsTab({ recent, color, onPick }: { recent: string[]; color: SkillColor | ""; onPick: (icon: string) => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ICONS;
    // Exact name, then names starting with the query, then a word starting with it, then names containing it.
    const name = (i: McIcon) => i.name.replaceAll("_", " ");
    const rank = (i: McIcon) => (name(i) === q ? 0 : name(i).startsWith(q) ? 1 : i.words.includes(` ${q}`) ? 2 : i.words.includes(q) ? 3 : 4);
    return ICONS.map((i) => ({ i, r: rank(i) }))
      .filter((x) => x.r < 4)
      .sort((a, b) => a.r - b.r)
      .map((x) => x.i);
  }, [query]);
  useEffect(() => setActive(0), [query]);
  // The arrows move the active cell; keep it in view as they leave the visible rows (not on hover).
  const scroll = useRef<HTMLDivElement>(null);
  const keyed = useRef(false);
  useEffect(() => {
    const cell = keyed.current && scroll.current?.querySelector<HTMLElement>("[data-active]");
    if (!cell) return;
    cell.scrollIntoView({ block: "nearest" });
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

  /** `icon` is the stored value, "mc:<name>". */
  const cell = (icon: string, i?: number) => (
    <button
      key={icon}
      className="picker-cell"
      data-active={i === active || undefined}
      aria-label={label(icon)}
      title={label(icon)}
      onClick={() => onPick(icon)}
      onMouseEnter={() => i !== undefined && ((keyed.current = false), setActive(i))}
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
        {shown.length ? (
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
