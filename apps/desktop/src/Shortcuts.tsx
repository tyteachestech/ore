import { ArrowCounterClockwise, Keyboard, X } from "./icons";
import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Hint } from "./Hint";
import { Trap } from "./Trap";
import { WithMenu } from "./Menu";
import { BINDINGS, clash, comboOf, defaultOf, FIXED, invalid, isCustom, label, rebind, resetKeys, restore, saved, useKeymap, type Combo, type KeyId } from "./keys";
import { useFocusWhileMounted, type Notify } from "./util";

const GROUPS = ["General", "Sources", "Feed", "Review", "Reader", "Quiz", "Video and listening", "Highlight", "Notes", "Diagram"];

/** ⌘/: every shortcut, in a sheet over the app. Settings › Keyboard shortcuts is the same editor. */
export function Shortcuts({ onClose, notify }: { onClose: () => void; notify: Notify }) {
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Trap>
      <div className="panel keys" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onKeyDown={onKeyDown}>
        <ShortcutEditor notify={notify} />
      </div>
      </Trap>
    </div>
  );
}

/** Takes back a change to the keymap from the toast, ⌘Z or ⇧⌘Z. */
function step(notify: Notify, message: string, run: () => void) {
  const before = saved();
  run();
  const after = saved();
  notify(message, "info", () => restore(before), () => restore(after));
}

const NONE = { current: null };

const keysText = (c: Combo) => label(c) || "Not assigned";

/** ChatGPT's Settings › Keyboard shortcuts: search by name, or switch the field to keys and press a
 *  combo to see what uses it. Click a shortcut (or ↵ on it) and press new keys; a combo another
 *  command has asks before taking it. ↺ puts back the default, × leaves it not assigned, and every
 *  change but a plain rebind has Undo. */
export function ShortcutEditor({ notify, inPage, query = "" }: { notify: Notify; inPage?: boolean; query?: string }) {
  const keys = useKeymap();
  const fieldRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useFocusWhileMounted(inPage ? NONE : fieldRef); // the sheet opens on its field; Settings keeps focus on its tabs
  const [q, setQ] = useState(query);
  const [byKeys, setByKeys] = useState(false);
  const [pressed, setPressed] = useState<Combo>("");
  const [recording, setRecording] = useState<KeyId | null>(null);
  const [error, setError] = useState<{ id: KeyId; text: string } | null>(null);
  const [conflict, setConflict] = useState<{ id: KeyId; combo: Combo; with: KeyId } | null>(null);
  const custom = BINDINGS.some((b) => isCustom(b.id));

  const name = (id: KeyId) => BINDINGS.find((b) => b.id === id)!.label;
  const words = byKeys ? [] : q.toLowerCase().split(/\s+/).filter(Boolean);
  const hit = (...texts: string[]) => words.every((w) => texts.some((t) => t.toLowerCase().includes(w)));
  const boundHit = (b: (typeof BINDINGS)[number]) => (byKeys ? !pressed || keys[b.id] === pressed : hit(b.label, b.group, label(keys[b.id])));
  const fixedHit = (f: (typeof FIXED)[number]) => (byKeys ? !pressed || f.keys.split(/\s+/).includes(label(pressed)) : hit(f.label, f.group, f.keys));
  const searching = byKeys ? !!pressed : words.length > 0;

  const focusKey = (id: KeyId) => requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-key="${id}"]`)?.focus());
  const record = (id: KeyId) => {
    setError(null);
    setConflict(null);
    setRecording(id);
    focusKey(id);
  };
  // A default another command took since asks first, as recording does: Replace, or keep both as they are.
  const reset = (id: KeyId) => {
    const combo = defaultOf(id);
    const other = combo ? clash(id, combo) : null;
    if (other) {
      setConflict({ id, combo, with: other.id });
      return requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(".key-replace")?.focus());
    }
    step(notify, `Reset “${name(id)}” to ${keysText(combo)}`, () => rebind(id, combo, true));
  };
  const remove = (id: KeyId) => step(notify, `Removed the shortcut for “${name(id)}”`, () => rebind(id, ""));
  const replace = (c: NonNullable<typeof conflict>) => {
    setConflict(null);
    step(notify, `${label(c.combo)} is now “${name(c.id)}”; “${name(c.with)}” has no shortcut`, () => rebind(c.id, c.combo, true));
    focusKey(c.id);
  };

  /** While recording, every key goes to the recorder, Esc included, so no other shortcut fires. */
  const onRecord = (e: ReactKeyboardEvent, id: KeyId) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") return setRecording(null);
    const combo = comboOf(e.nativeEvent);
    if (!combo) return;
    setRecording(null);
    if (combo === keys[id]) return;
    const why = invalid(id, combo);
    if (why) return setError({ id, text: why });
    const other = clash(id, combo);
    if (other) {
      setConflict({ id, combo, with: other.id });
      requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(".key-replace")?.focus());
      return;
    }
    rebind(id, combo);
  };

  /** ↑ ↓ move between shortcuts, from the field too (the palette, Raycast). */
  const onList = (e: ReactKeyboardEvent) => {
    if (recording || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
    const all = [...(listRef.current?.querySelectorAll<HTMLElement>(".key-edit") ?? [])];
    if (!all.length) return;
    e.preventDefault();
    const at = all.indexOf(document.activeElement as HTMLElement);
    const next = at < 0 ? (e.key === "ArrowDown" ? 0 : -1) : at + (e.key === "ArrowDown" ? 1 : -1);
    if (next < 0) return fieldRef.current?.focus();
    all[Math.min(next, all.length - 1)]!.focus();
  };

  const onField = (e: ReactKeyboardEvent) => {
    if (!byKeys || e.key === "Tab" || e.key === "ArrowDown" || e.key === "ArrowUp") return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") return pressed ? setPressed("") : setByKeys(false);
    const c = comboOf(e.nativeEvent);
    if (c) setPressed(c);
  };

  const toggleKeys = () => {
    setByKeys(!byKeys);
    setPressed("");
    fieldRef.current?.focus();
  };

  return (
    <div className={`keys-editor${inPage ? " in-page" : ""}`} onKeyDown={onList}>
      <div className="keys-head">
        <input
          ref={fieldRef}
          className={`keys-search${byKeys ? " by-keys" : ""}`}
          placeholder={byKeys ? "Press keys…" : "Search shortcuts"}
          aria-label={byKeys ? "Press keys to find the shortcut that uses them" : "Search shortcuts"}
          value={byKeys ? label(pressed) : q}
          readOnly={byKeys}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onField}
          spellCheck={false}
          autoComplete="off"
        />
        <Hint text={byKeys ? "Search by name" : "Search by keys"}>
          <button className={`keys-mode${byKeys ? " on" : ""}`} aria-pressed={byKeys} aria-label="Search by keys" onClick={toggleKeys}>
            <Keyboard size={15} weight={byKeys ? "fill" : "regular"} aria-hidden="true" />
          </button>
        </Hint>
        {custom && (
          <button className="link" onClick={() => step(notify, "Reset all shortcuts to their defaults", resetKeys)}>
            Reset all
          </button>
        )}
      </div>
      <div className="keys-body" ref={listRef}>
        {GROUPS.map((g) => {
          const bound = BINDINGS.filter((b) => b.group === g && boundHit(b));
          const fixed = FIXED.filter((f) => f.group === g && fixedHit(f));
          if (!bound.length && !fixed.length) return null;
          return (
            <section key={g}>
              <h3>{g}</h3>
              {bound.map(({ id, label: what }) => {
                const combo = keys[id];
                const changed = isCustom(id);
                const actions = [
                  { id: "change", label: "Change shortcut…", run: () => record(id) },
                  ...(changed ? [{ id: "reset", label: `Reset to ${keysText(defaultOf(id))}`, run: () => reset(id) }] : []),
                  ...(combo ? [{ id: "remove", label: "Remove shortcut", danger: true, divider: true, run: () => remove(id) }] : []),
                ];
                return (
                  <WithMenu key={id} actions={actions}>
                    <div className={`key-row${recording === id ? " rec" : ""}`}>
                      <span className="key-name">{what}</span>
                      {error?.id === id && <span className="err">{error.text}</span>}
                      {conflict?.id === id && (
                        <span className="key-clash" role="alert">
                          {label(conflict.combo)} is “{name(conflict.with)}”
                          <button
                            className="key-replace"
                            onClick={() => replace(conflict)}
                            onKeyDown={(e) => {
                              if (e.key !== "Escape") return;
                              e.preventDefault();
                              e.stopPropagation();
                              setConflict(null);
                              focusKey(id);
                            }}
                          >
                            Replace
                          </button>
                        </span>
                      )}
                      <span className="key-tools">
                        {changed && recording !== id && (
                          <Hint text={`Reset to ${keysText(defaultOf(id))}`}>
                            <button className="key-tool" aria-label={`Reset ${what} to ${keysText(defaultOf(id))}`} onClick={() => reset(id)}>
                              <ArrowCounterClockwise size={12} weight="bold" aria-hidden="true" />
                            </button>
                          </Hint>
                        )}
                        {combo && recording !== id && conflict?.id !== id && (
                          <Hint text="Remove shortcut">
                            <button className="key-tool key-x" aria-label={`Remove the shortcut for ${what}`} onClick={() => remove(id)}>
                              <X size={11} weight="bold" aria-hidden="true" />
                            </button>
                          </Hint>
                        )}
                      </span>
                      <button
                        data-key={id}
                        className={`key-edit${recording === id ? " rec" : ""}`}
                        aria-label={`${what}: ${keysText(combo)}. Press to change`}
                        onClick={() => (recording === id ? setRecording(null) : record(id))}
                        onBlur={() => recording === id && setRecording(null)}
                        onKeyDown={(e) => recording === id && onRecord(e, id)}
                      >
                        {recording === id ? "Press keys…" : combo ? <kbd>{label(combo)}</kbd> : <span className="key-none">Not assigned</span>}
                      </button>
                    </div>
                  </WithMenu>
                );
              })}
              {fixed.map((f) => (
                <div key={f.label} className="key-row">
                  <span className="key-name">{f.label}</span>
                  <span className="key-fixed">
                    <kbd>{f.keys}</kbd>
                  </span>
                </div>
              ))}
            </section>
          );
        })}
        {searching && !BINDINGS.some(boundHit) && !FIXED.some(fixedHit) && (
          <p className="keys-none">{byKeys ? `${label(pressed)} isn’t used. Click a shortcut to give it these keys.` : `No shortcut matches “${q}”`}</p>
        )}
      </div>
    </div>
  );
}
