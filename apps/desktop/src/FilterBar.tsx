import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { useRef, useState, type ReactElement } from "react";
import { CaretRight, Check, X } from "./icons";
import { Hint } from "./Hint";
import { more } from "./more";
import type { Item, Skill } from "./ore";
import { SkillIcon } from "./IconPicker";
import { FIELDS, kindLabel, options, settled, summary, toggle, type Field, type Filter } from "./filters";

type Props = { items: Item[]; skills: Skill[]; filters: Filter[]; onChange: (f: Filter[]) => void };

const has = (label: string, q: string) => label.toLowerCase().includes(q.trim().toLowerCase());

/** Linear's filter menu: pick a field, then any of its values; picking keeps it open, so several can be
 *  picked, and ⌫ in the empty search goes back to the fields. */
function FilterPicker({ items, skills, filters, onChange, start, children }: Props & { start?: Field; children: ReactElement }) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<Field | undefined>(start);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const skill = (id: string) => skills.find((k) => k.id === id);
  const picked = filters.find((f) => f.field === field)?.values ?? [];
  const opts = open && field ? options(items, field, (id) => skill(id)?.name ?? id).filter((o) => has(o.label, query)) : [];
  const meta = FIELDS.find((f) => f.id === field);
  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setField(start);
          setQuery("");
        } else if (settled(filters) !== filters) onChange(settled(filters));
      }}
    >
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="popover menu filter-menu" side="bottom" align="start" sideOffset={4} collisionPadding={8}>
          <Command label="Filter" loop shouldFilter={false}>
            <Command.Input
              ref={input}
              className="menu-input"
              placeholder={meta ? `Find ${meta.plural}…` : "Filter by…"}
              value={query}
              onValueChange={setQuery}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !query && field) {
                  e.preventDefault();
                  setField(undefined);
                }
              }}
              autoFocus
            />
            <Command.List ref={more}>
              {!field &&
                FIELDS.filter((f) => has(f.label, query)).map((f) => (
                  <Command.Item key={f.id} value={f.id} onSelect={() => (setField(f.id), setQuery(""), input.current?.focus())}>
                    <span className="menu-label">{f.label}</span>
                    <CaretRight size={11} className="sub-caret" aria-hidden="true" />
                  </Command.Item>
                ))}
              {opts.map((o) => {
                const k = field === "skill" ? skill(o.value) : undefined;
                return (
                  <Command.Item key={o.value} value={`v:${o.value}`} onSelect={() => (onChange(toggle(filters, field!, o.value, true)), input.current?.focus())}>
                    {k && <SkillIcon icon={k.icon} color={k.color} dot className="palette-icon" />}
                    <span className="menu-label">{o.label}</span>
                    <span className="filter-n">{o.n}</span>
                    <span className="check">{picked.includes(o.value) && <Check size={12} aria-hidden="true" />}</span>
                  </Command.Item>
                );
              })}
              {field && !opts.length && <Command.Empty>No {meta!.plural} match</Command.Empty>}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** The Filter button beside the list's search. */
export function FilterButton(p: Props) {
  return (
    <FilterPicker {...p}>
      <button className="filter-add" aria-label="Filter by kind, skill or author">
        Filter
      </button>
    </FilterPicker>
  );
}

/** One chip per field filtered: its name and values open its list again, × lets it go (Linear). */
export function FilterChips(p: Props) {
  if (!p.filters.length) return null;
  const label = (field: Field) => (v: string) => (field === "skill" ? (v ? p.skills.find((k) => k.id === v)?.name ?? v : "No skill") : field === "kind" ? kindLabel(v) : v);
  return (
    <div className="filter-chips" role="group" aria-label="Filters">
      {p.filters.map((f) => {
        const name = FIELDS.find((x) => x.id === f.field)!.label;
        return (
          <span key={f.field} className="filter-chip">
            <FilterPicker {...p} start={f.field}>
              <button className="filter-chip-open">
                <span className="filter-chip-field">{name}</span>
                {summary(f, label(f.field))}
              </button>
            </FilterPicker>
            <Hint text={`Remove the ${name.toLowerCase()} filter`}>
              <button className="filter-chip-x" aria-label={`Remove the ${name.toLowerCase()} filter`} onClick={() => p.onChange(p.filters.filter((x) => x !== f))}>
                <X size={10} aria-hidden="true" />
              </button>
            </Hint>
          </span>
        );
      })}
      {p.filters.length > 1 && (
        <button className="filter-clear" onClick={() => p.onChange([])}>
          Clear
        </button>
      )}
    </div>
  );
}
