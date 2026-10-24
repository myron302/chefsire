import React, { useEffect } from "react";
import { useLocation } from "wouter";
import { useUser } from "../contexts/UserContext";
import { authEntryDestination } from "../lib/auth-entry";
import type { SessionStatus } from "../lib/session-controller";

export function AuthEntryGate({ user, loading, sessionStatus, destination, navigate, children }: {
  user: unknown; loading: boolean; sessionStatus: SessionStatus; destination: string;
  navigate: (to: string, options: { replace: boolean }) => void; children: React.ReactNode;
}) {
  const authenticated = !!user && sessionStatus === "authenticated";
  useEffect(() => {
    if (authenticated) navigate(destination, { replace: true });
  }, [authenticated, destination, navigate]);
  if (authenticated) return null;
  if (loading || sessionStatus !== "anonymous") {
    return <div role="status" className="p-4 text-sm text-muted-foreground">{sessionStatus === "unavailable" ? "Unable to confirm your session. Please use Try again below." : "Checking your session…"}</div>;
  }
  return <>{children}</>;
}

export default function AuthEntry({ children }: { children: React.ReactNode }) {
  const session = useUser();
  const [, navigate] = useLocation();
  return <AuthEntryGate {...session} destination={authEntryDestination(window.location.search)} navigate={navigate}>{children}</AuthEntryGate>;
}
