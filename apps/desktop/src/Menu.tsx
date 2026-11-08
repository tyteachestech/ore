import { CaretRight, Check, DotsThree } from "./icons";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Fragment, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Hint } from "./Hint";
import { useLite } from "./Lite";
import { nativeMenu } from "./native-menu";

// After the menu closes and hands focus back to its trigger, so a dialog the action opens keeps focus.
const later = (run: () => void) => () => setTimeout(run, 0);
const pick = (b: MenuAction) => (b.keep ? (e: Event) => (e.preventDefault(), b.run()) : later(b.run));

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
  // A row not on screen yet can't be right-clicked; its menu comes with it when it scrolls in.
  if (useLite() || (Array.isArray(actions) && !actions.length)) return children; // or no menu to open (the phone's title)
  return (
    <ContextMenu.Root onOpenChange={(open) => open && (opened.current = performance.now())}>
      <ContextMenu.Trigger asChild disabled={native} onPointerDownCapture={(e) => setNative(nativeMenu(e.target, getSelection()))}>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="popover menu-list" collisionPadding={8} onCloseAutoFocus={(e) => keepFocus && e.preventDefault()}>
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

/** The ⋯ button that opens the same actions as right-click; shown on row hover. */
export function MoreButton({ label, actions, className = "more", icon, hint = "More actions", open, onOpenChange, onPointerDown, align = "end", keepFocus }: {
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
}) {
  const button = (
    <button type="button" aria-haspopup="menu" aria-expanded="false" className={className} aria-label={label} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => (onPointerDown?.(e), e.stopPropagation())}>
      {icon ?? <DotsThree size={16} aria-hidden="true" />}
    </button>
  );
  // Off screen in a long list (Lite.tsx): the same button, its menu and hint once it scrolls in.
  if (useLite() && !open) return button;
  return (
    <DropdownMenu.Root modal={false} open={open} onOpenChange={onOpenChange}>
      <Hint text={hint}>
        <DropdownMenu.Trigger asChild>{button}</DropdownMenu.Trigger>
      </Hint>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="popover menu-list" align={align} sideOffset={4} collisionPadding={8} onCloseAutoFocus={(e) => keepFocus && e.preventDefault()} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
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
