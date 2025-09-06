import React from "react";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; message?: string; stack?: string };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, message: error?.message || String(error), stack: error?.stack };
  }

  componentDidCatch(error: any, info: any) {
    // still log to console for devs
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 m-4 border rounded bg-red-50 text-red-700">
          <div className="font-semibold mb-1">This page crashed while rendering.</div>
          <div className="text-sm break-words">{this.state.message}</div>
          {this.state.stack && (
            <details className="mt-2 whitespace-pre-wrap text-xs opacity-80">
              <summary>Stack</summary>
              {this.state.stack}
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
