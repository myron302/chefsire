import React, { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useUser } from "../contexts/UserContext";
import { authEntryDestination } from "../lib/auth-entry";
import type { SessionStatus } from "../lib/session-controller";

export function AuthEntryGate({ user, loading, sessionStatus, destination, navigate, children }: {
  user: unknown; loading: boolean; sessionStatus: SessionStatus; destination: string;
  navigate: (to: string, options: { replace: boolean }) => void; children: React.ReactNode;
}) {
  // Resolution belongs to this mounted route, not to the shared busy flag. Once
  // the server admits an anonymous form, submissions and read-only rechecks must
  // keep its component (including uncontrolled inputs and error state) alive.
  const admittedAnonymous = useRef(false);
  if (!user && sessionStatus === "anonymous") admittedAnonymous.current = true;
  const authenticated = !!user && sessionStatus === "authenticated";
  useEffect(() => {
    if (authenticated) navigate(destination, { replace: true });
  }, [authenticated, destination, navigate]);
  if (authenticated) return null;
  if (!admittedAnonymous.current && (loading || sessionStatus !== "anonymous")) {
    return <div role="status" className="p-4 text-sm text-muted-foreground">{sessionStatus === "unavailable" ? "Unable to confirm your session. Please use Try again below." : "Checking your session…"}</div>;
  }
  return <>{children}</>;
}

export default function AuthEntry({ children }: { children: React.ReactNode }) {
  const session = useUser();
  const [, navigate] = useLocation();
  return <AuthEntryGate {...session} destination={authEntryDestination(window.location.search)} navigate={navigate}>{children}</AuthEntryGate>;
}
