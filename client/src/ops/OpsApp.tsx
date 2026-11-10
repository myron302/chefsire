import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/toaster";
import OpsPanel, { type OpsMe } from "./OpsPanel";
import { opsRequest, setOpsSignedOutHandler } from "./ops-api";

/**
 * The ChefSire staff portal app (ops.chefsire.com): staff sign-in (password, then authenticator code; first time:
 * invite link, password, authenticator setup, recovery codes) and the back office panel.
 */
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: true } } });

type AuthMe = Partial<OpsMe> & { ok: boolean; signedIn: boolean; stage?: "mfa" | "enroll" | "full"; staff?: { login: string; displayName: string } };
const auth = <T,>(method: string, path: string, body?: unknown) => opsRequest<T>(method, `/api/ops/auth${path}`, body);

export default function OpsApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <Portal />
      <Toaster />
    </QueryClientProvider>
  );
}

function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-muted/40">
      <main className={`mx-auto space-y-4 p-4 sm:p-6 ${wide ? "max-w-5xl" : "max-w-md pt-16"}`}>
        {!wide && <p className="text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">ChefSire Staff Portal</p>}
        {children}
      </main>
    </div>
  );
}

function ErrorText({ error }: { error: string | null }) {
  return error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null;
}

function Portal() {
  const qc = useQueryClient();
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const me = useQuery<AuthMe>({ queryKey: ["ops-auth"], queryFn: () => auth("GET", "/me"), staleTime: 0 });
  const refresh = () => qc.invalidateQueries({ queryKey: ["ops-auth"] });

  useEffect(() => {
    setOpsSignedOutHandler(refresh);
    return () => setOpsSignedOutHandler(null);
  }, [qc]);
  // Once signed out (here or elsewhere), drop everything the portal had loaded.
  const signedIn = me.data?.signedIn === true;
  useEffect(() => {
    if (me.data && !signedIn) qc.removeQueries({ queryKey: ["ops"] });
  }, [me.data, signedIn, qc]);

  if (me.isPending) return <Shell><p role="status">Loading…</p></Shell>;
  if (me.isError) return <Shell><Card><CardContent className="pt-6"><p role="alert">{(me.error as Error).message}</p></CardContent></Card></Shell>;

  if (recoveryCodes) return <Shell><RecoveryCodes codes={recoveryCodes} onDone={async () => { await qc.refetchQueries({ queryKey: ["ops-auth"] }); setRecoveryCodes(null); }} /></Shell>;

  const invite = window.location.pathname === "/invite" ? window.location.hash.slice(1) : "";
  if (!me.data.signedIn && me.data.stage === "enroll") return <Shell><EnrollAuthenticator login={me.data.staff?.login ?? ""} onDone={setRecoveryCodes} onRestart={refresh} /></Shell>;
  if (!me.data.signedIn && me.data.stage === "mfa") return <Shell><VerifyCode onDone={refresh} onRestart={refresh} /></Shell>;
  if (!me.data.signedIn) {
    return <Shell>{invite ? <AcceptInvite token={invite} onDone={() => { window.history.replaceState(null, "", "/"); refresh(); }} /> : <SignIn onDone={refresh} />}</Shell>;
  }

  const signOut = async () => {
    await auth("POST", "/logout").catch(() => undefined);
    refresh();
  };
  return (
    <Shell wide>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">ChefSire Staff Portal</h1>
          <p className="text-sm text-muted-foreground">
            {me.data.staff?.displayName} ({me.data.staff?.login})
            {me.data.isOwner ? " · Owner" : me.data.groups?.length ? ` · ${me.data.groups.map((g) => g.name).join(", ")}` : ""}
          </p>
        </div>
        <Button variant="outline" onClick={signOut}>Sign out</Button>
      </header>
      <OpsPanel me={me.data as OpsMe} />
    </Shell>
  );
}

function useSubmit(run: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await run();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, submit };
}

function SignIn({ onDone }: { onDone: () => void }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, submit } = useSubmit(async () => {
    await auth("POST", "/login", { login: login.trim().toLowerCase(), password });
    setPassword("");
    onDone();
  });
  return (
    <Card>
      <CardHeader><CardTitle>Sign in</CardTitle><CardDescription>For ChefSire employees. Member accounts don't work here.</CardDescription></CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1"><Label htmlFor="login">Login</Label><Input id="login" autoComplete="username" autoCapitalize="none" value={login} onChange={(e) => setLogin(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <ErrorText error={error} />
          <Button type="submit" className="w-full" disabled={busy || !login.trim() || !password}>Continue</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function VerifyCode({ onDone, onRestart }: { onDone: () => void; onRestart: () => void }) {
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const { busy, error, submit } = useSubmit(async () => {
    await auth("POST", "/mfa/verify", useRecovery ? { recoveryCode: code.trim() } : { code: code.replace(/\s/g, "") });
    onDone();
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Authenticator code</CardTitle>
        <CardDescription>{useRecovery ? "Enter one of your recovery codes. Each works once." : "Open your authenticator app and enter the 6-digit code for ChefSire Staff."}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={submit}>
          <Label htmlFor="code" className="sr-only">{useRecovery ? "Recovery code" : "Code"}</Label>
          <Input id="code" autoFocus autoComplete="one-time-code" inputMode={useRecovery ? "text" : "numeric"} value={code} onChange={(e) => setCode(e.target.value)} />
          <ErrorText error={error} />
          <Button type="submit" className="w-full" disabled={busy || !code.trim()}>Sign in</Button>
          <div className="flex justify-between text-sm">
            <button type="button" className="underline" onClick={() => { setUseRecovery(!useRecovery); setCode(""); }}>
              {useRecovery ? "Use authenticator code" : "Use a recovery code"}
            </button>
            <button type="button" className="underline" onClick={async () => { await auth("POST", "/logout").catch(() => undefined); onRestart(); }}>Start over</button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function AcceptInvite({ token, onDone }: { token: string; onDone: () => void }) {
  const check = useQuery<{ login: string; displayName: string; reset: boolean }>({
    queryKey: ["ops-invite", token],
    queryFn: () => auth("POST", "/invite/check", { token }),
  });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const { busy, error, submit } = useSubmit(async () => {
    if (password !== confirm) throw new Error("The passwords don't match.");
    await auth("POST", "/invite/accept", { token, password });
    onDone();
  });
  if (check.isPending) return <p role="status">Checking your link…</p>;
  if (check.isError) return <Card><CardContent className="pt-6"><p role="alert">{(check.error as Error).message}</p></CardContent></Card>;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{check.data.reset ? "Set a new password" : `Welcome, ${check.data.displayName}`}</CardTitle>
        <CardDescription>Your login is <strong>{check.data.login}</strong>. Choose a password (at least 12 characters), then you'll set up an authenticator app.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={submit}>
          <input type="text" name="username" autoComplete="username" value={check.data.login} readOnly hidden />
          <div className="space-y-1"><Label htmlFor="new-password">Password</Label><Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="confirm-password">Confirm password</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
          <ErrorText error={error} />
          <Button type="submit" className="w-full" disabled={busy || password.length < 12}>Continue</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function EnrollAuthenticator({ login, onDone, onRestart }: { login: string; onDone: (codes: string[]) => void; onRestart: () => void }) {
  const [setup, setSetup] = useState<{ secret: string; uri: string; qr: string } | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  useEffect(() => {
    let cancelled = false;
    auth<{ secret: string; uri: string }>("POST", "/mfa/setup")
      .then(async (s) => { const qr = await QRCode.toDataURL(s.uri, { margin: 1, width: 220 }); if (!cancelled) setSetup({ ...s, qr }); })
      .catch((e) => { if (!cancelled) setSetupError((e as Error).message); });
    return () => { cancelled = true; };
  }, []);
  const { busy, error, submit } = useSubmit(async () => {
    const result = await auth<{ recoveryCodes: string[] }>("POST", "/mfa/enroll", { code: code.replace(/\s/g, "") });
    onDone(result.recoveryCodes);
  });
  if (setupError) return <Card><CardContent className="space-y-2 pt-6"><p role="alert">{setupError}</p><Button variant="outline" onClick={onRestart}>Start over</Button></CardContent></Card>;
  if (!setup) return <p role="status">Preparing…</p>;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Set up your authenticator</CardTitle>
        <CardDescription>
          Every sign-in needs a code from an authenticator app (Microsoft Authenticator, Google Authenticator, Authy or 1Password).
          Scan this code with the app, then enter the 6-digit code it shows.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <img src={setup.qr} alt={`Authenticator QR code for ${login}`} className="mx-auto h-[220px] w-[220px]" />
        <details className="text-sm">
          <summary className="cursor-pointer">Can't scan? Enter this key instead</summary>
          <p className="mt-1 break-all font-mono">{setup.secret.match(/.{1,4}/g)?.join(" ")}</p>
        </details>
        <form className="space-y-3" onSubmit={submit}>
          <Label htmlFor="enroll-code">6-digit code</Label>
          <Input id="enroll-code" autoComplete="one-time-code" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} />
          <ErrorText error={error} />
          <Button type="submit" className="w-full" disabled={busy || code.replace(/\s/g, "").length !== 6}>Confirm</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void | Promise<void> }) {
  const [saved, setSaved] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Save your recovery codes</CardTitle>
        <CardDescription>If you lose your phone, each of these codes lets you sign in once. Store them somewhere safe. They won't be shown again.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="grid grid-cols-2 gap-1 rounded border p-3 font-mono text-sm">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
        <Button variant="outline" className="w-full" onClick={() => navigator.clipboard?.writeText(codes.join("\n"))}>Copy codes</Button>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I've saved these codes</label>
        <Button className="w-full" disabled={!saved} onClick={onDone}>Continue to the portal</Button>
      </CardContent>
    </Card>
  );
}
