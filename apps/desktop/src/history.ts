/** One step he can take back: what the toast said, its inverse, and (when it can be done again) the
 *  step itself. Both go through `ore`, never a snapshot of the library. */
export type Step = { message: string; undo: () => void; redo?: () => void };

const LIMIT = 50;

/** The app's undo and redo stacks (⌘Z, ⇧⌘Z). They live as long as the window, so moving between
 *  screens keeps them; a relaunch starts empty. */
export class History {
  private past: Step[] = [];
  private future: Step[] = [];

  /** A new step; anything undone before it can no longer be redone. */
  push(step: Step) {
    this.past = [...this.past.slice(1 - LIMIT), step];
    this.future = [];
  }

  /** Takes back the newest step and returns it. A step that can't be redone ends the redo run,
   *  so redo never replays an older step over one that is still undone. */
  undo(): Step | undefined {
    const step = this.past.pop();
    if (!step) return;
    step.undo();
    this.future = step.redo ? [...this.future, step] : [];
    return step;
  }

  /** Does again the step undone last and returns it. */
  redo(): Step | undefined {
    const step = this.future.pop();
    if (!step?.redo) return;
    step.redo();
    this.past.push(step);
    return step;
  }

  /** Takes back one step out of order, from its own toast's Undo (Linear: each toast undoes its own
   *  step). Returns false when it was already undone or forgotten. */
  take(step: Step): boolean {
    if (!this.past.includes(step)) return false;
    this.past = this.past.filter((s) => s !== step);
    step.undo();
    this.future = step.redo ? [...this.future.filter((s) => s !== step), step] : [];
    return true;
  }

  /** Does one undone step again, from its own toast's Redo. */
  again(step: Step): boolean {
    if (!step.redo || !this.future.includes(step)) return false;
    this.future = this.future.filter((s) => s !== step);
    step.redo();
    this.past.push(step);
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
