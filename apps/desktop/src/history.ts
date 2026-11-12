/** One step he can take back: what the toast said, its inverse, and (when it can be done again) the
 *  step itself. Both go through `ore`, never a snapshot of the library, and return the write's promise
 *  (a type error otherwise, so a write can't fail unseen): if it fails, the step goes back where it was
 *  and `onFail` says why; once it lands, `onLanded` lets screens opened since read their data again. */
export type Step = { message: string; undo: () => Promise<unknown>; redo?: () => Promise<unknown> };

const LIMIT = 50;

/** One undo run for the window, as macOS's: a text field takes ⌘Z for typing he did there after the
 *  app's newest step, and passes it to that step otherwise (a field he only clicked into, or a filter
 *  he typed before ticking a skill). A field marked data-app-undo (Review's empty answer) never keeps it. */
let tick = 0;
let stepAt = 0;
const typedAt = new WeakMap<EventTarget, number>();
const watched = new WeakSet<Document>();
const watchTyping = (doc: Document) => {
  if (watched.has(doc)) return;
  watched.add(doc);
  doc.addEventListener("input", (e) => e.target && typedAt.set(e.target, ++tick), true);
};
if (typeof document !== "undefined") watchTyping(document);

/** Whether ⌘Z in `el` is its own typing undo rather than the app's. */
export function ownsUndo(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (t?.ownerDocument) watchTyping(t.ownerDocument);
  if (!t || (t.tagName !== "INPUT" && t.tagName !== "TEXTAREA") || t.hasAttribute("data-app-undo")) return false;
  return (typedAt.get(t) ?? 0) > stepAt;
}


/** The app's undo and redo stacks (⌘Z, ⇧⌘Z). They live as long as the window, so moving between
 *  screens keeps them; a relaunch starts empty. */
export class History {
  private past: Step[] = [];
  private future: Step[] = [];

  constructor(
    private onFail?: (step: Step, error: unknown, what: "undo" | "redo") => void,
    private onLanded?: (step: Step) => void,
  ) {}

  /** A write that failed leaves the library as it was, so its step goes back: ⌘Z (or ⇧⌘Z) tries it again. */
  private watch(step: Step, run: Promise<unknown>, what: "undo" | "redo") {
    run.then(() => this.onLanded?.(step), (e) => {
      const [from, to] = what === "undo" ? [this.future, this.past] : [this.past, this.future];
      const i = from.indexOf(step);
      if (i >= 0) from.splice(i, 1);
      if (!to.includes(step)) to.push(step);
      this.onFail?.(step, e, what);
    });
  }

  /** A new step; anything undone before it can no longer be redone. */
  push(step: Step) {
    stepAt = ++tick;
    this.past = [...this.past.slice(1 - LIMIT), step];
    this.future = [];
  }

  /** Takes back the newest step and returns it. A step that can't be redone ends the redo run,
   *  so redo never replays an older step over one that is still undone. */
  undo(): Step | undefined {
    const step = this.past.pop();
    if (!step) return;
    this.watch(step, step.undo(), "undo");
    this.future = step.redo ? [...this.future, step] : [];
    return step;
  }

  /** Does again the step undone last and returns it. */
  redo(): Step | undefined {
    const step = this.future.pop();
    if (!step?.redo) return;
    this.past.push(step);
    this.watch(step, step.redo(), "redo");
    return step;
  }

  /** Takes back one step out of order, from its own toast's Undo (Linear: each toast undoes its own
   *  step). Returns false when it was already undone or forgotten. */
  take(step: Step): boolean {
    if (!this.past.includes(step)) return false;
    this.past = this.past.filter((s) => s !== step);
    const run = step.undo();
    this.future = step.redo ? [...this.future.filter((s) => s !== step), step] : [];
    this.watch(step, run, "undo");
    return true;
  }

  /** Does one undone step again, from its own toast's Redo. */
  again(step: Step): boolean {
    if (!step.redo || !this.future.includes(step)) return false;
    this.future = this.future.filter((s) => s !== step);
    this.past.push(step);
    this.watch(step, step.redo(), "redo");
    return true;
  }

  /** Takes a step off the history without running it: what it did is already gone. */
  forget(step: Step) {
    this.past = this.past.filter((s) => s !== step);
    this.future = this.future.filter((s) => s !== step);
  }

  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
}
