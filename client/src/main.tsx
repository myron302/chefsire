// client/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

/** A minimal, production-safe error boundary so the app never shows a dead white page */
class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message?: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(err: any) {
    return { hasError: true, message: err?.message || "App crashed" };
  }
  componentDidCatch(error: any, info: any) {
    // You can POST this to your server for logging if you want
    console.error("GlobalErrorBoundary caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 24,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
        }}>
          <h1 style={{ fontSize: 20, marginBottom: 12 }}>Something went wrong.</h1>
          <p style={{ marginBottom: 16 }}>
            The UI crashed while loading. Try{" "}
            <a href="/feed" style={{ color: "#ea580c", textDecoration: "underline" }}>
              going to the Feed
            </a>{" "}
            or reloading the page.
          </p>
          {this.state.message && (
            <pre style={{
              background: "#f3f4f6",
              padding: 12,
              borderRadius: 8,
              whiteSpace: "pre-wrap"
            }}>
              {this.state.message}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </React.StrictMode>
);
