import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";

/**
 * ChefSire control panel (back office). Access and sections come from GET /api/admin/me; the server enforces every
 * permission again on each request, so hiding a section here is only presentation.
 */
type StaffMe = { ok: boolean; isStaff: boolean; isOwner: boolean; permissions: string[]; groups: { id: string; name: string }[] };
type Group = {
  id: string; name: string; description: string | null; builtIn: boolean;
  permissions: string[]; members: { userId: string; username: string; displayName: string | null }[];
};
type Permission = { key: string; label: string; ownerOnly: boolean };
type AuditEntry = {
  id: number; actorLabel: string | null; action: string; targetType: string | null; targetId: string | null;
  reason: string | null; details: Record<string, unknown>; createdAt: string;
};

async function api<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || (data as any)?.message || `Request failed (${res.status})`);
  return data as T;
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "staff.group.create": "Created group",
  "staff.group.update": "Changed group",
  "staff.group.delete": "Deleted group",
  "staff.member.add": "Added to group",
  "staff.member.remove": "Removed from group",
};

export default function AdminPanel() {
  const { user, loading } = useUser();
  const me = useQuery<StaffMe>({
    queryKey: ["admin", "me", user?.id],
    queryFn: () => api<StaffMe>("GET", "/api/admin/me"),
    enabled: Boolean(user),
    staleTime: 0,
  });

  if (loading || (user && me.isPending)) return <main className="mx-auto max-w-5xl p-6"><p role="status">Loading…</p></main>;
  if (!user) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <Link href={`/login?next=${encodeURIComponent("/admin")}`} className="underline">Sign in</Link> to open the control panel.
      </main>
    );
  }
  if (me.isError || !me.data?.isStaff) {
    return <main className="mx-auto max-w-5xl p-6"><h1 className="text-2xl font-bold mb-2">Control panel</h1><p>Your account doesn't have staff access.</p></main>;
  }

  const can = (p: string) => me.data!.permissions.includes(p);
  const tabs = [
    can("staff.manage") && { key: "staff", label: "Staff & Groups" },
    can("audit.view") && { key: "audit", label: "Audit Log" },
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold">Control panel</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {user.username}
          {me.data.isOwner ? " · Owner" : me.data.groups.length ? ` · ${me.data.groups.map((g) => g.name).join(", ")}` : ""}
        </p>
      </div>
      {tabs.length === 0 ? (
        <p>Your groups don't include any control panel sections yet.</p>
      ) : (
        <Tabs defaultValue={tabs[0].key}>
          <TabsList>{tabs.map((t) => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}</TabsList>
          {can("staff.manage") && <TabsContent value="staff"><StaffGroups /></TabsContent>}
          {can("audit.view") && <TabsContent value="audit"><AuditLog /></TabsContent>}
        </Tabs>
      )}
    </main>
  );
}

function StaffGroups() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const groups = useQuery<{ groups: Group[] }>({ queryKey: ["admin", "groups"], queryFn: () => api("GET", "/api/admin/groups") });
  const catalog = useQuery<{ permissions: Permission[] }>({ queryKey: ["admin", "permissions"], queryFn: () => api("GET", "/api/admin/permissions") });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });
  const mutate = useMutation({
    mutationFn: (v: { method: string; url: string; body?: unknown; done: string }) => api(v.method, v.url, v.body),
    onSuccess: (_d, v) => { toast({ description: v.done }); refresh(); },
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });
  const [newName, setNewName] = useState("");

  if (groups.isPending || catalog.isPending) return <p role="status">Loading groups…</p>;
  if (groups.isError || catalog.isError) return <p role="alert">Couldn't load groups.</p>;
  const grantable = catalog.data.permissions.filter((p) => !p.ownerOnly);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Permissions are given to groups, and staff accounts are added to groups. Owners (the accounts in the server's
        admin list) always have full control, including this page.
      </p>
      {groups.data.groups.map((g) => (
        <GroupCard key={g.id} group={g} grantable={grantable} busy={mutate.isPending} onChange={(v) => mutate.mutate(v)} />
      ))}
      <Card>
        <CardHeader><CardTitle className="text-base">New group</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input aria-label="New group name" placeholder="e.g. Moderators" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} />
          <Button
            disabled={newName.trim().length < 2 || mutate.isPending}
            onClick={() => { mutate.mutate({ method: "POST", url: "/api/admin/groups", body: { name: newName.trim(), permissions: [] }, done: "Group created" }); setNewName(""); }}
          >Create</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function GroupCard({ group, grantable, busy, onChange }: {
  group: Group; grantable: Permission[]; busy: boolean;
  onChange: (v: { method: string; url: string; body?: unknown; done: string }) => void;
}) {
  const [account, setAccount] = useState("");
  const toggle = (key: string, on: boolean) => {
    const next = on ? [...group.permissions, key] : group.permissions.filter((p) => p !== key);
    onChange({ method: "PATCH", url: `/api/admin/groups/${group.id}`, body: { permissions: next }, done: `${group.name}: permissions updated` });
  };
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{group.name} {group.builtIn && <Badge variant="secondary" className="ml-1">Built-in</Badge>}</CardTitle>
            {group.description && <CardDescription>{group.description}</CardDescription>}
          </div>
          {!group.builtIn && (
            <Button variant="outline" size="sm" disabled={busy}
              onClick={() => onChange({ method: "DELETE", url: `/api/admin/groups/${group.id}`, done: `${group.name} deleted` })}>
              Delete group
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-medium">Permissions</legend>
          {grantable.map((p) => (
            <label key={p.key} className="flex items-start gap-2 text-sm">
              <Checkbox checked={group.permissions.includes(p.key)} disabled={busy} onCheckedChange={(v) => toggle(p.key, v === true)} />
              <span>{p.label}</span>
            </label>
          ))}
        </fieldset>
        <div>
          <p className="mb-1 text-sm font-medium">Members ({group.members.length})</p>
          {group.members.length === 0 ? <p className="text-sm text-muted-foreground">No members yet.</p> : (
            <ul className="space-y-1">
              {group.members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between rounded border px-2 py-1 text-sm">
                  <span>{m.displayName || m.username} <span className="text-muted-foreground">@{m.username}</span></span>
                  <Button variant="ghost" size="sm" disabled={busy}
                    onClick={() => onChange({ method: "DELETE", url: `/api/admin/groups/${group.id}/members/${m.userId}`, done: `Removed ${m.username} from ${group.name}` })}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex gap-2">
            <Label htmlFor={`add-${group.id}`} className="sr-only">Add a member by username or email</Label>
            <Input id={`add-${group.id}`} placeholder="Username or email" value={account} onChange={(e) => setAccount(e.target.value)} />
            <Button variant="outline" disabled={!account.trim() || busy}
              onClick={() => { onChange({ method: "POST", url: `/api/admin/groups/${group.id}/members`, body: { account: account.trim() }, done: `Added to ${group.name}` }); setAccount(""); }}>
              Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AuditLog() {
  const [before, setBefore] = useState<number[]>([]);
  const cursor = before[before.length - 1];
  const audit = useQuery<{ entries: AuditEntry[]; hasMore: boolean }>({
    queryKey: ["admin", "audit", cursor],
    queryFn: () => api("GET", `/api/admin/audit?limit=50${cursor ? `&before=${cursor}` : ""}`),
  });
  if (audit.isPending) return <p role="status">Loading audit log…</p>;
  if (audit.isError) return <p role="alert">Couldn't load the audit log.</p>;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Audit log</CardTitle>
        <CardDescription>Every staff action, newest first. Entries are permanent.</CardDescription>
      </CardHeader>
      <CardContent>
        {audit.data.entries.length === 0 ? <p className="text-sm text-muted-foreground">Nothing yet.</p> : (
          <ul className="divide-y text-sm">
            {audit.data.entries.map((e) => (
              <li key={e.id} className="py-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <span><strong>{e.actorLabel ?? "Unknown"}</strong> · {AUDIT_ACTION_LABELS[e.action] ?? e.action}</span>
                  <time className="text-muted-foreground" dateTime={e.createdAt}>{new Date(e.createdAt).toLocaleString()}</time>
                </div>
                {typeof e.details?.groupName === "string" || typeof e.details?.name === "string" ? (
                  <p className="text-muted-foreground">
                    {String(e.details.groupName ?? e.details.name)}
                    {typeof e.details?.username === "string" ? ` · @${e.details.username}` : ""}
                  </p>
                ) : null}
                {e.reason && <p>Reason: {e.reason}</p>}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex justify-between">
          <Button variant="outline" size="sm" disabled={before.length === 0} onClick={() => setBefore(before.slice(0, -1))}>Newer</Button>
          <Button variant="outline" size="sm" disabled={!audit.data.hasMore}
            onClick={() => setBefore([...before, audit.data.entries[audit.data.entries.length - 1].id])}>Older</Button>
        </div>
      </CardContent>
    </Card>
  );
}
