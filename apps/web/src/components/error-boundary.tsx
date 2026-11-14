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
      <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-danger/10 text-danger">
          <AlertTriangle className="size-7" />
        </div>
        <h2 className="mt-4 font-display text-xl font-bold">Something went wrong on this page</h2>
        <p className="mt-1 text-sm text-muted">The rest of FlashSlot is fine. Reload to try again.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-flash px-4 text-sm font-semibold text-white cursor-pointer"
        >
          <RotateCcw className="size-4" /> Reload page
        </button>
      </div>
    );
  }
}
