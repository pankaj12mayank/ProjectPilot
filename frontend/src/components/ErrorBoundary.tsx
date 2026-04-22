import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./ui/Button";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Route error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="pp-route-error" role="alert">
          <h2>Something went wrong</h2>
          <p>{this.state.error.message}</p>
          <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
