import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Catches render errors so one broken component never blanks the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('UI error:', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }): void {
    // Navigating to another page clears the error.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
        <div className="grid size-14 place-items-center rounded-full bg-danger/10 text-danger">
          <AlertTriangle className="size-6" />
        </div>
        <h2 className="mt-6 font-display text-3xl font-medium tracking-[-0.04em]">
          This page <span className="font-serif italic">tripped</span>.
        </h2>
        <p className="mt-2 text-[15px] text-muted">The rest of FlashSlot is fine. Reload to try again.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-8 inline-flex h-10 items-center gap-2 rounded-full bg-fg px-5 text-sm font-medium text-bg transition-colors hover:bg-fg/85 cursor-pointer"
        >
          <RotateCcw className="size-4" /> Reload page
        </button>
      </div>
    );
  }
}
