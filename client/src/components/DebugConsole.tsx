import { useEffect, useRef, useState } from "react";

/**
 * In-app console overlay for mobile debugging
 * Shows console.log/warn/error + window.onerror + unhandledrejection
 * Appears when ?debug=1 in the URL or in dev mode.
 */
export default function DebugConsole() {
  const [visible, setVisible] = useState(true);
  const [lines, setLines] = useState<string[]>([]);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const add = (msg: string) =>
      setLines((prev) => [...prev.slice(-199), `[${new Date().toLocaleTimeString()}] ${msg}`]);

    // Proxy console
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;

    console.log = (...args) => { add(`LOG: ${args.map(String).join(" ")}`); origLog(...args); };
    console.warn = (...args) => { add(`WARN: ${args.map(String).join(" ")}`); origWarn(...args); };
    console.error = (...args) => { add(`ERROR: ${args.map(String).join(" ")}`); origError(...args); };

    const onError = (event: ErrorEvent) => add(`ONERROR: ${event.message} @ ${event.filename}:${event.lineno}`);
    const onRejection = (event: PromiseRejectionEvent) =>
      add(`UNHANDLED REJECTION: ${String(event.reason)}`);

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      console.log = origLog; console.warn = origWarn; console.error = origError;
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  // simple touch drag for mobile
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startPos.current = { x: t.clientX - el.offsetLeft, y: t.clientY - el.offsetTop };
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!startPos.current) return;
      const t = e.touches[0];
      el.style.left = `${t.clientX - startPos.current.x}px`;
      el.style.top = `${t.clientY - startPos.current.y}px`;
    };
    const onTouchEnd = () => { startPos.current = null; };

    el.addEventListener("touchstart", onTouchStart);
    el.addEventListener("touchmove", onTouchMove);
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  if (!visible) return null;

  // Only show if ?debug=1 or in dev (vite)
  if (!shouldShowDebugConsole()) return null;

  return (
    <div
      ref={boxRef}
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        width: "90vw",
        maxWidth: 420,
        maxHeight: "40vh",
        zIndex: 99999,
        background: "rgba(0,0,0,0.85)",
        color: "#fff",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
      }}
      role="region"
      aria-label="Debug Console"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 12px",
          background: "rgba(255,255,255,0.08)",
          borderBottom: "1px solid rgba(255,255,255,0.15)",
          touchAction: "none",
          cursor: "grab",
        }}
      >
        <strong style={{ fontSize: 12, letterSpacing: 0.5 }}>Debug Console</strong>
        <button
          onClick={() => setVisible(false)}
          aria-label="Close debug console"
          style={{
            marginLeft: "auto",
            background: "transparent",
            color: "#fff",
            border: 0,
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
      <div
        style={{
          padding: 10,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 11,
          overflow: "auto",
          maxHeight: "32vh",
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
        }}
      >
        {lines.length === 0 ? (
          <div style={{ opacity: 0.6 }}>No logs yet. Interact with the app or refresh this page.</div>
        ) : (
          lines.map((l, i) => <div key={i}>{l}</div>)
        )}
      </div>
    </div>
  );
}

export function shouldShowDebugConsole() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("debug") === "1" || import.meta.env.DEV;
  } catch {
    return import.meta?.env?.DEV ?? false;
  }
}
