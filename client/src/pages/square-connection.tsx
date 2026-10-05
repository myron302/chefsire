import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import {
  isSquareAuthorizeUrl,
  SQUARE_CONNECTION_DISCONNECT_PATH,
  SQUARE_CONNECTION_RECHECK_PATH,
  SQUARE_CONNECTION_SCOPE_NOTE,
  SQUARE_CONNECTION_START_PATH,
  SQUARE_CONNECTION_STATUS_PATH,
  squareCallbackMessage,
  squareConnectionPresentation,
  squareDisconnectNotice,
  withoutSquareCallbackParams,
  type SquareConnectionStatus,
  type SquareDisconnectResponse,
} from "@/lib/square-connection";

type StatusResponse = { ok: true; connection: SquareConnectionStatus };

/** /settings/payouts: the provider's Square connection. Connect, reconnect, re-check and disconnect; nothing else. */
export default function SquareConnectionPage() {
  const queryClient = useQueryClient();
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // Shown after a disconnect and kept until the provider acts again: local disconnect is not always a Square revocation.
  const [disconnectNotice, setDisconnectNotice] = useState<{ tone: "good" | "attention"; text: string } | null>(null);
  // Read ONCE, on first render, then consumed: the notice describes the OAuth return that brought the provider here, not
  // whatever they do next. (Computing it from window.location on every render left "Square connected." beside a later disconnect.)
  const [callback, setCallback] = useState(() => squareCallbackMessage(typeof window === "undefined" ? "" : window.location.search));
  useEffect(() => {
    if (typeof window === "undefined") return;
    const { pathname, search, hash } = window.location;
    const cleaned = withoutSquareCallbackParams(search);
    if (cleaned !== search) window.history.replaceState(window.history.state, "", `${pathname}${cleaned}${hash}`);
  }, []);

  const status = useQuery<StatusResponse>({
    queryKey: [SQUARE_CONNECTION_STATUS_PATH],
    queryFn: async () => (await apiRequest("GET", SQUARE_CONNECTION_STATUS_PATH)).json(),
    retry: false,
    staleTime: 0,
  });

  const refreshWith = (data: StatusResponse | undefined) => {
    if (data) queryClient.setQueryData([SQUARE_CONNECTION_STATUS_PATH], { ok: true, connection: data.connection });
  };

  const start = useMutation({
    mutationFn: async () => (await apiRequest("GET", SQUARE_CONNECTION_START_PATH)).json() as Promise<{ authUrl?: unknown }>,
    onSuccess: (data) => {
      if (isSquareAuthorizeUrl(data.authUrl)) window.location.assign(data.authUrl);
      else setProblem("We couldn't start the Square connection. Please try again.");
    },
    onError: () => setProblem("We couldn't start the Square connection. Please try again."),
  });
  const recheck = useMutation({
    mutationFn: async () => (await apiRequest("POST", SQUARE_CONNECTION_RECHECK_PATH, {})).json() as Promise<StatusResponse>,
    onSuccess: (data) => { setProblem(null); setCallback(null); refreshWith(data); },
    onError: () => setProblem("We couldn't check Square right now. Please try again."),
  });
  const disconnect = useMutation({
    mutationFn: async () => (await apiRequest("POST", SQUARE_CONNECTION_DISCONNECT_PATH, {})).json() as Promise<SquareDisconnectResponse>,
    onSuccess: (data) => { setProblem(null); setConfirmingDisconnect(false); setCallback(null); setDisconnectNotice(squareDisconnectNotice(data)); refreshWith(data); },
    onError: () => setProblem("We couldn't disconnect Square. Please try again."),
  });

  const presentation = squareConnectionPresentation(status.data?.connection);
  const busy = start.isPending || recheck.isPending || disconnect.isPending;
  const badgeVariant = presentation.tone === "good" ? "default" : "secondary";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Square</CardTitle>
            <Badge variant={badgeVariant} data-testid="square-connection-state">{presentation.label}</Badge>
          </div>
          <CardDescription>{SQUARE_CONNECTION_SCOPE_NOTE}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {disconnectNotice && (
            <div role={disconnectNotice.tone === "attention" ? "alert" : "status"} className="flex items-start gap-2 text-sm" data-testid="square-disconnect-notice">
              {disconnectNotice.tone === "good" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
              <span>{disconnectNotice.text}</span>
            </div>
          )}
          {callback && (
            <div role="status" className="flex items-start gap-2 text-sm">
              {callback.tone === "good" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
              <span>{callback.text}</span>
            </div>
          )}
          {status.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking…</div>
          ) : status.isError ? (
            <p className="text-sm" role="alert">We couldn't load your Square connection. Please refresh and try again.</p>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="square-connection-detail">{presentation.detail}</p>
          )}
          {problem && <p className="text-sm" role="alert">{problem}</p>}

          {!status.isLoading && !status.isError && (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {presentation.actions.includes("connect") && (
                <Button className="min-h-11" disabled={busy} onClick={() => { setProblem(null); setDisconnectNotice(null); setCallback(null); start.mutate(); }}>Connect Square</Button>
              )}
              {presentation.actions.includes("reconnect") && (
                <Button className="min-h-11" disabled={busy} onClick={() => { setProblem(null); setDisconnectNotice(null); setCallback(null); start.mutate(); }}>Reconnect Square</Button>
              )}
              {presentation.actions.includes("recheck") && (
                <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => recheck.mutate()}>Check again</Button>
              )}
              {presentation.actions.includes("disconnect") && !confirmingDisconnect && (
                <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => setConfirmingDisconnect(true)}>Disconnect Square</Button>
              )}
              {presentation.actions.includes("disconnect") && confirmingDisconnect && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center" role="group" aria-label="Confirm disconnect">
                  <span className="text-sm">Disconnect Square? Your invoices and payment history stay as they are.</span>
                  <Button variant="destructive" className="min-h-11" disabled={busy} onClick={() => disconnect.mutate()}>Yes, disconnect</Button>
                  <Button variant="ghost" className="min-h-11" disabled={busy} onClick={() => setConfirmingDisconnect(false)}>Keep connected</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
