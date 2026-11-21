import { Component, type ReactNode } from "react";

/** Keeps one broken view from blanking the window: shows what failed and a way back. Remount it
 *  (a new `key`) to try again, e.g. on navigation. `what` and `action` name the last resort around the whole
 *  app (main.tsx), which catches what no view's own boundary does: a sheet, the sidebar, the phone's screens. */
export class Boundary extends Component<{ children: ReactNode; onBack: () => void; what?: string; action?: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="empty-state boundary" role="alert">
        <p>{this.props.what ?? "This view"} hit a snag.</p>
        <p className="quiz-faint">{this.state.error.message}</p>
        <button className="pill-btn" onClick={() => this.props.onBack()}>
          {this.props.action ?? "Go home"}
        </button>
      </div>
    );
  }
}
