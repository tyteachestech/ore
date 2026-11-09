import { CaretLeft, CaretRight, Check, DotsThree } from "./icons";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Hint } from "./Hint";
import { useLite } from "./Lite";
import { nativeMenu } from "./native-menu";
import { PHONE } from "./ore";
import { useSwipeDown } from "./phone/sheet";
import { Trap } from "./Trap";

/** A picked action runs once the menu has closed and handed focus back (its onCloseAutoFocus), so a
 *  field or dialog the action opens keeps the caret: run on a timer, it raced Radix's own focus return,
 *  which took the caret from a field picked with ↵ and its blur closed it again. */
function useLater() {
  const pending = useRef<(() => void) | null>(null);
  const later = (run: () => void) => () => void (pending.current = run);
  const pick = (b: MenuAction) => (b.keep ? (e: Event) => (e.preventDefault(), b.run()) : later(b.run));
  const closed = (e: Event, keepFocus?: boolean) => {
    if (keepFocus) e.preventDefault();
    const run = pending.current;
    pending.current = null;
    if (run) setTimeout(run, 0);
  };
  return { later, pick, closed };
}

/** One action on an object; `hint` is its shortcut, shown at the right like a macOS menu. */
export type MenuAction = {
  id: string;
  label: string;
  hint?: string;
  danger?: boolean;
  /** A line above it, starting a new group (Readwise Reader, Finder). */
  divider?: boolean;
  /** Drawn before the label (a skill's icon). */
  icon?: ReactNode;
  /** In a submenu: a checkbox item, ticked when true (Linear's labels). */
  checked?: boolean;
  /** In a submenu: picking it leaves the menu open, for settings he toggles while watching (Show). */
  keep?: boolean;
  run: () => void;
  /** A submenu ("Move to"). */
  sub?: MenuAction[];
  /** Listed in ⌘K but not in the ⋯ and right-click menus: the action has its own control on screen
   *  (the skill picker, + Note), or is a keyboard convention (⌘F). Its shortcut still works. */
  paletteOnly?: boolean;
};

/** A list of actions, or a function that makes it as the menu opens: a long list's rows then build
 *  no menus they may never show, and a memoized row's menu still reads the app as it is now. */
export type Actions = MenuAction[] | (() => MenuAction[]);
const listOf = (a: Actions) => (typeof a === "function" ? a() : a);
/** Renders its children only when it renders: inside a closed menu, never. */
const Later = ({ children }: { children: () => ReactNode }) => <>{children()}</>;

/** An object's actions, the same list on right-click and on its ⋯ button, as in Linear and Finder
 *  (AGENTS.md interaction checklist). Radix menus: arrows, type-ahead, Enter, Esc. */
export function WithMenu({ actions, children, keepFocus }: { actions: Actions; children: ReactNode; /** Focus stays where the action put it (the note's text), not back on the trigger. */ keepFocus?: boolean }) {
  // macOS opens the menu on mouse down, under the pointer, so the same click's mouse up lands on the
  // first item and Radix would pick it. A release right after opening is that click, not a choice;
  // pressing, moving to an item and releasing still picks it, as in a native menu.
  const opened = useRef(0);
  const early = (e: PointerEvent) => performance.now() - opened.current < 300 && e.preventDefault();
  // Right-click in a field or on selected text inside the object gets the Mac's own text menu
  // (Copy, Paste, Look Up), not the object's: decided on the press, before the menu event.
  const [native, setNative] = useState(false);
  const { later, pick, closed } = useLater();
  // A row not on screen yet can't be right-clicked; its menu comes with it when it scrolls in.
  if (useLite() || (Array.isArray(actions) && !actions.length)) return children; // or no menu to open (the phone's title)
  return (
    <ContextMenu.Root onOpenChange={(open) => open && (opened.current = performance.now())}>
      <ContextMenu.Trigger asChild disabled={native} onPointerDownCapture={(e) => setNative(nativeMenu(e.target, getSelection()))}>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="popover menu-list" collisionPadding={8} onCloseAutoFocus={(e) => closed(e, keepFocus)} onKeyDown={(e) => e.stopPropagation()}>
          <Later>{() => listOf(actions).map((a) => (
            <Fragment key={a.id}>
            {a.divider && <ContextMenu.Separator className="menu-sep" />}
            {a.sub ? (
              <ContextMenu.Sub>
                <ContextMenu.SubTrigger className="menu-item">
                  {a.label}
                  <CaretRight className="menu-caret" size={11} weight="bold" aria-hidden="true" />
                </ContextMenu.SubTrigger>
                <ContextMenu.Portal>
                  <ContextMenu.SubContent className="popover menu-list menu-sub" sideOffset={4} collisionPadding={8}>
                    {a.sub.map((b) =>
                      b.checked === undefined ? (
                        <ContextMenu.Item key={b.id} className="menu-item" onSelect={later(b.run)}>
                          {b.label}
                        </ContextMenu.Item>
                      ) : (
                        <ContextMenu.CheckboxItem key={b.id} className="menu-item check" checked={b.checked} onSelect={pick(b)}>
                          <span className="menu-tick">
                            <ContextMenu.ItemIndicator>
                              <Check size={12} weight="bold" />
                            </ContextMenu.ItemIndicator>
                          </span>
                          {b.icon}
                          <span className="menu-label">{b.label}</span>
                        </ContextMenu.CheckboxItem>
                      ),
                    )}
                  </ContextMenu.SubContent>
                </ContextMenu.Portal>
              </ContextMenu.Sub>
            ) : (
              <ContextMenu.Item className={`menu-item${a.danger ? " danger" : ""}`} onPointerUp={early} onSelect={later(a.run)}>
                {a.label}
                {a.hint && <kbd>{a.hint}</kbd>}
              </ContextMenu.Item>
            )}
            </Fragment>
          ))}</Later>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex="0"]';
/** A ⋯ shown only on hover can't take focus back once its menu closes: it hides as the pointer leaves, and focus
 *  falls to <body>. Its row takes it instead (Tyler, 2026-11-08): the row itself or the list holding it when they
 *  take focus, else the row's main control. Only when focus would go back to the ⋯: a click that put it
 *  somewhere else keeps it there. */
function focusRow(e: Event, button: HTMLButtonElement | null) {
  const active = document.activeElement;
  if (!button || (active && active !== document.body && active !== button && !active.closest("[role=menu]"))) return;
  let row: HTMLElement | null | undefined = button.parentElement?.closest<HTMLElement>(FOCUSABLE);
  for (let up = button.parentElement; !row && up && up !== document.body; up = up.parentElement)
    row = [...up.querySelectorAll<HTMLElement>(FOCUSABLE)].find((el) => el !== button && el.getClientRects().length > 0);
  if (row) (e.preventDefault(), row.focus({ preventScroll: true }));
}

/** The ⋯ button that opens the same actions as right-click; shown on row hover. */
export function MoreButton({ label, actions, className = "more", icon, hint = "More actions", open, onOpenChange, onPointerDown, align = "end", keepFocus, hoverOnly }: {
  label: string;
  actions: Actions;
  className?: string;
  /** Another button face (the note's ⋮⋮ block handle) with its hover text. */
  icon?: ReactNode;
  hint?: ReactNode;
  /** Opened by its owner: a handle that drags on press opens on a click that didn't (Notion). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Runs first; preventDefault() there keeps the press from opening the menu. */
  onPointerDown?: (e: PointerEvent<HTMLButtonElement>) => void;
  align?: "start" | "end";
  /** Focus stays where the action put it (the note's text), not back on the button. */
  keepFocus?: boolean;
  /** Shown only while its row is hovered: focus goes back to the row, not to it (`focusRow`). */
  hoverOnly?: boolean;
}) {
  const { later, pick, closed } = useLater();
  const self = useRef<HTMLButtonElement>(null);
  // Off screen in a long list (Lite.tsx): the same button as the trigger renders, its menu and hint once it scrolls in.
  const lite = useLite() && !open;
  const button = (
    <button ref={self} {...(lite && { type: "button", "aria-haspopup": "menu", "aria-expanded": false })} className={className} aria-label={label} data-no-drag onClick={(e) => e.stopPropagation()} onPointerDown={onPointerDown}>
      {icon ?? <DotsThree size={16} aria-hidden="true" />}
    </button>
  );
  if (lite) return button;
  if (PHONE) return <ActionSheet label={label} actions={actions} className={className} icon={icon} open={open} onOpenChange={onOpenChange} onPointerDown={onPointerDown} keepFocus={keepFocus} />;
  return (
    <DropdownMenu.Root modal={false} open={open} onOpenChange={onOpenChange}>
      <Hint text={hint}>
        <DropdownMenu.Trigger asChild>{button}</DropdownMenu.Trigger>
      </Hint>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="popover menu-list" align={align} sideOffset={4} collisionPadding={8} onCloseAutoFocus={(e) => (hoverOnly && !keepFocus && focusRow(e, self.current), closed(e, keepFocus))} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <Later>{() => listOf(actions).map((a) => (
            <Fragment key={a.id}>
            {a.divider && <DropdownMenu.Separator className="menu-sep" />}
            {a.sub ? (
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger className="menu-item">
                  {a.label}
                  <CaretRight className="menu-caret" size={11} weight="bold" aria-hidden="true" />
                </DropdownMenu.SubTrigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.SubContent className="popover menu-list menu-sub" sideOffset={4} collisionPadding={8} onClick={(e) => e.stopPropagation()}>
                    {a.sub.map((b) =>
                      b.checked === undefined ? (
                        <DropdownMenu.Item key={b.id} className="menu-item" onSelect={later(b.run)}>
                          {b.label}
                        </DropdownMenu.Item>
                      ) : (
                        <DropdownMenu.CheckboxItem key={b.id} className="menu-item check" checked={b.checked} onSelect={pick(b)}>
                          <span className="menu-tick">
                            <DropdownMenu.ItemIndicator>
                              <Check size={12} weight="bold" />
                            </DropdownMenu.ItemIndicator>
                          </span>
                          {b.icon}
                          <span className="menu-label">{b.label}</span>
                        </DropdownMenu.CheckboxItem>
                      ),
                    )}
                  </DropdownMenu.SubContent>
                </DropdownMenu.Portal>
              </DropdownMenu.Sub>
            ) : (
              <DropdownMenu.Item className={`menu-item${a.danger ? " danger" : ""}`} onSelect={later(a.run)}>
                {a.label}
                {a.hint && <kbd>{a.hint}</kbd>}
              </DropdownMenu.Item>
            )}
            </Fragment>
          ))}</Later>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** On the phone the ⋯ menu is one bottom sheet that steps through (D155; Cult UI's family drawer, Apple's
 *  action sheets): the actions as 44pt rows, and a submenu ("Skills") swaps into the same sheet behind a
 *  back row, the sheet's height easing between the two, instead of a menu over a menu. Shortcuts stay off
 *  it. A pick closes the sheet and runs; a `keep` tick stays. Swipe down, a tap outside or Esc closes it. */
function ActionSheet({ label, actions, className, icon, open: controlled, onOpenChange, onPointerDown, keepFocus }: { label: string; actions: Actions; className: string; icon?: ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void; onPointerDown?: (e: PointerEvent<HTMLButtonElement>) => void; keepFocus?: boolean }) {
  const [own, setOwn] = useState(false);
  const open = controlled ?? own;
  // The press that opens it keeps focus where it is (a note's text under the keyboard bar), as Radix's
  // trigger does; an owner that preventDefault()s the press keeps it from opening (the drag handle).
  const held = useRef(false);
  const [stepId, setStepId] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  const back = useRef<HTMLElement | null>(null);
  const show = (on: boolean) => {
    if (on) back.current = document.activeElement as HTMLElement | null;
    setOwn(on);
    if (!on) {
      setStepId(null);
      if (!keepFocus) back.current?.focus?.();
    }
    onOpenChange?.(on);
  };
  const close = () => show(false);
  useSwipeDown(box, close, open);
  useEffect(() => {
    if (open) box.current?.focus();
  }, [open]);
  // The sheet's height follows the step it shows: measured after each swap, so the change eases.
  useLayoutEffect(() => {
    if (open) setHeight(inner.current?.offsetHeight);
  }, [open, stepId]);
  const list = open ? listOf(actions) : [];
  const step = stepId ? list.find((a) => a.id === stepId) : undefined;
  const rows = step?.sub ?? list;
  const pick = (a: MenuAction) => {
    if (a.sub) return setStepId(a.id);
    if (a.keep) return a.run();
    close();
    setTimeout(a.run, 0);
  };
  return (
    <>
      <button className={className} aria-label={label} aria-haspopup="dialog" aria-expanded={open} data-no-drag onClick={(e) => (e.stopPropagation(), held.current || show(true))} onPointerDown={(e) => { onPointerDown?.(e); held.current = e.defaultPrevented; e.preventDefault(); }}>
        {icon ?? <DotsThree size={16} aria-hidden="true" />}
      </button>
      {open && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <Trap>
            <div ref={box} className="panel sheet action-sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); step ? setStepId(null) : close(); } }}>
              <div className="sheet-steps" style={{ height }}>
                <div ref={inner} key={step?.id ?? "top"} className="pick-list">
                  {step && (
                    <button className="pick-row sheet-back" onClick={() => setStepId(null)}>
                      <CaretLeft size={12} weight="bold" aria-hidden="true" />
                      <span className="name">{step.label}</span>
                    </button>
                  )}
                  {rows.map((a) => (
                    <Fragment key={a.id}>
                      {a.divider && !step && <div className="sheet-sep" role="separator" />}
                      <button className={`pick-row${a.danger ? " danger" : ""}`} role={a.checked === undefined ? undefined : "checkbox"} aria-checked={a.checked} onClick={() => pick(a)}>
                        {step && <span className="menu-tick">{a.checked && <Check size={12} weight="bold" />}</span>}
                        {a.icon}
                        <span className="name">{a.label}</span>
                        {a.sub && <CaretRight className="menu-caret" size={11} weight="bold" aria-hidden="true" />}
                      </button>
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          </Trap>
        </div>
      )}
    </>
  );
}
