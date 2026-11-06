import { Component, type ReactNode } from "react";

/** Keeps one broken view from blanking the window: shows what failed and a way back. Remount it
 *  (a new `key`) to try again, e.g. on navigation. */
export class Boundary extends Component<{ children: ReactNode; onBack: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="empty-state boundary" role="alert">
        <p>This view hit a snag.</p>
        <p className="quiz-faint">{this.state.error.message}</p>
        <button className="pill-btn" onClick={() => this.props.onBack()}>
          Go home
        </button>
      </div>
    );
  }
}
