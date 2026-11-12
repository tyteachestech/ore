import * as Tabs from "@radix-ui/react-tabs";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { Hint } from "./Hint";
import type { KeyId } from "./keys";

type Icon = ComponentType<Omit<SVGProps<SVGSVGElement>, "ref"> & { size?: number }>;
export type HeadTab<T extends string> = { id: T; label: string; icon: Icon; tone: string; keys?: KeyId };

/** A section's name as a folder tab on the section's rule (D226, Tyler's own design): its icon, then its name. */
export function HeadTab({ icon: I, tone, children, after }: { icon: Icon; tone: string; children: ReactNode; after?: ReactNode }) {
  return (
    <span className="head-tab on" data-tone={tone}>
      <span className="head-tab-btn">
        <I className="card-icon" size={16} aria-hidden="true" />
        <span className="head-tab-name"><h2>{children}</h2></span>
      </span>
      {after}
    </span>
  );
}

/** A section's views as folder tabs (D226): the open one shows its name, the others are their icon with the
 *  name on hover, and a click grows the tab out. Arrows move between them, as in any tab list. `after` is
 *  drawn inside the open tab, after its name. */
export function HeadTabs<T extends string>({ label, tabs, value, onChange, after }: { label: string; tabs: HeadTab<T>[]; value: T; onChange: (v: T) => void; after?: ReactNode }) {
  const at = tabs.findIndex((t) => t.id === value);
  return (
    <Tabs.Root className={`head-tabs${after ? " with-after" : ""}`} value={value} onValueChange={(v) => onChange(v as T)}>
      <Tabs.List
        className="head-tabs-list"
        aria-label={label}
        // The grow is for a click. From the keyboard (arrows, ⌘1) the tab changes at once (DESIGN.md "Motion").
        onPointerDown={(e) => {
          const list = e.currentTarget;
          list.setAttribute("data-grow", "");
          setTimeout(() => list.removeAttribute("data-grow"), 400);
        }}
      >
        {tabs.map(({ id, label: name, icon: I, tone, keys }, i) => {
          const on = id === value;
          return (
            // ←→ move focus to a tab, which opens it; the Hint keeps focus events from Radix's own handler, so it is done here.
            <span key={id} className={`head-tab${on ? " on" : ""}`} style={{ order: i * 2 }} data-tone={tone} onFocusCapture={(e) => !on && e.target instanceof HTMLElement && e.target.matches("[role=tab]") && onChange(id)}>
              <Hint text={name} keys={keys} off={on}>
                <Tabs.Trigger value={id} className="head-tab-btn">
                  <I className="card-icon" size={16} aria-hidden="true" />
                  <span className="head-tab-name">{on ? <h2>{name}</h2> : <span>{name}</span>}</span>
                </Tabs.Trigger>
              </Hint>
            </span>
          );
        })}
      </Tabs.List>
      {/* Outside the tab list, which may hold only tabs; `order` draws it as the open tab's right end. */}
      {after && <span className="head-tab-after" style={{ order: at * 2 + 1 }}>{after}</span>}
    </Tabs.Root>
  );
}
