import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { opsApi as api } from "./ops-api";

/**
 * ChefSire staff portal panel (ops.chefsire.com). Sections come from the signed-in staff member's permissions; the
 * server enforces every permission again on each request, so hiding a section here is only presentation.
 */
export type OpsMe = {
  ok: boolean; signedIn: boolean; stage?: string; isOwner: boolean; permissions: string[];
  groups: { id: string; name: string }[]; staff: { id: string; login: string; displayName: string };
};
type Group = {
  id: string; name: string; description: string | null; builtIn: boolean;
  permissions: string[]; members: { staffId: string; login: string; displayName: string; status: string }[];
};
type Permission = { key: string; label: string; ownerOnly: boolean };
type AuditEntry = {
  id: number; actorType?: string; actorLabel: string | null; action: string; targetType: string | null; targetId: string | null;
  reason: string | null; details: Record<string, unknown>; createdAt: string;
};
type StaffAccount = {
  id: string; login: string; displayName: string; email: string | null; isOwner: boolean; status: string;
  mfaEnabled: boolean; lastLoginAt: string | null; groups: { id: string; name: string }[];
};
type Invite = { id: string; login: string; displayName: string; isOwner: boolean; reset: boolean; expiresAt: string };

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "staff.group.create": "Created group",
  "staff.group.update": "Changed group",
  "staff.group.delete": "Deleted group",
  "staff.member.add": "Added to group",
  "staff.member.remove": "Removed from group",
  "staff.invite.create": "Invited staff",
  "staff.invite.bootstrap": "Owner invite created on the server",
  "staff.invite.revoke": "Cancelled invite",
  "staff.user.created": "Joined the portal",
  "staff.user.disable": "Disabled staff account",
  "staff.user.enable": "Enabled staff account",
  "staff.owner.grant": "Made Owner",
  "staff.owner.revoke": "Removed Owner",
  "staff.access.reset": "Reset staff access",
  "staff.access.reset.completed": "Set up access again",
  "staff.mfa.enrolled": "Set up authenticator",
  "staff.signin": "Signed in",
  "member.status.active": "Reinstated account",
  "member.status.restricted": "Restricted account",
  "member.status.suspended": "Suspended account",
  "member.deactivated": "Member deactivated their account",
  "member.reactivated": "Member reactivated by signing in",
};

export default function OpsPanel({ me }: { me: OpsMe }) {
  const can = (p: string) => me.permissions.includes(p);
  const tabs = [
    can("members.view") && { key: "members", label: "Members" },
    can("staff.manage") && { key: "staff", label: "Staff" },
    can("staff.manage") && { key: "groups", label: "Groups" },
    can("audit.view") && { key: "audit", label: "Audit Log" },
  ].filter(Boolean) as { key: string; label: string }[];

  if (tabs.length === 0) return <p>Your groups don't include any portal sections yet. Ask an Owner to add you to a group.</p>;
  return (
    <Tabs defaultValue={tabs[0].key}>
      <TabsList>{tabs.map((t) => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}</TabsList>
      {can("members.view") && <TabsContent value="members"><Members /></TabsContent>}
      {can("staff.manage") && <TabsContent value="staff"><StaffAccounts selfId={me.staff.id} /></TabsContent>}
      {can("staff.manage") && <TabsContent value="groups"><StaffGroups /></TabsContent>}
      {can("audit.view") && <TabsContent value="audit"><AuditLog /></TabsContent>}
    </Tabs>
  );
}

type Change = { method: string; url: string; body?: unknown; done: string; onDone?: (data: any) => void };
function useChange() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (v: Change) => api<any>(v.method, v.url, v.body),
    onSuccess: (data, v) => { toast({ description: v.done }); v.onDone?.(data); qc.invalidateQueries({ queryKey: ["ops"] }); },
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });
}

function OneTimeLink({ link, onClose }: { link: string; onClose: () => void }) {
  return (
    <div className="space-y-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm" role="status">
      <p className="font-medium">Send this link to them privately. It works once and expires in 3 days. It won't be shown again.</p>
      <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="One-time link" />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(link)}>Copy</Button>
        <Button size="sm" variant="ghost" onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}

function StaffAccounts({ selfId }: { selfId: string }) {
  const list = useQuery<{ staff: StaffAccount[]; invites: Invite[] }>({ queryKey: ["ops", "staff"], queryFn: () => api("GET", "/staff") });
  const groups = useQuery<{ groups: Group[] }>({ queryKey: ["ops", "groups"], queryFn: () => api("GET", "/groups") });
  const change = useChange();
  const [link, setLink] = useState<string | null>(null);
  const [form, setForm] = useState({ login: "", displayName: "", email: "", groupIds: [] as string[], isOwner: false });
  const [reason, setReason] = useState("");

  if (list.isPending || groups.isPending) return <p role="status">Loading staff…</p>;
  if (list.isError || groups.isError) return <p role="alert">Couldn't load staff.</p>;
  const act = (s: StaffAccount, url: string, body: Record<string, unknown>, done: string) =>
    change.mutate({ method: "POST", url: `/staff/${s.id}/${url}`, body: { ...body, reason: reason.trim() }, done, onDone: (d) => { if (d?.link) setLink(d.link); setReason(""); } });

  return (
    <div className="space-y-4">
      {link && <OneTimeLink link={link} onClose={() => setLink(null)} />}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff accounts</CardTitle>
          <CardDescription>Staff sign in here with their own login, password and authenticator app. They are not ChefSire member accounts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="staff-reason">Reason for changes below (required, saved in the audit log)</Label>
            <Input id="staff-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="e.g. Left the company" />
          </div>
          <ul className="divide-y">
            {list.data.staff.map((s) => (
              <li key={s.id} className="space-y-1 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{s.displayName}</strong> <span className="text-muted-foreground">{s.login}</span>
                  {s.isOwner && <Badge variant="secondary">Owner</Badge>}
                  {s.status === "disabled" && <Badge variant="destructive">Disabled</Badge>}
                  {!s.mfaEnabled && <Badge variant="outline">Setup pending</Badge>}
                </div>
                <p className="text-muted-foreground">
                  {s.groups.length ? s.groups.map((g) => g.name).join(", ") : "No groups"}
                  {s.lastLoginAt ? ` · Last sign-in ${new Date(s.lastLoginAt).toLocaleString()}` : ""}
                </p>
                {s.id === selfId ? <p className="text-xs text-muted-foreground">This is you. Another Owner can change your account.</p> : (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={reason.trim().length < 3 || change.isPending}
                    onClick={() => act(s, "status", { status: s.status === "active" ? "disabled" : "active" }, s.status === "active" ? `${s.login} disabled` : `${s.login} enabled`)}>
                    {s.status === "active" ? "Disable" : "Enable"}
                  </Button>
                  {s.status === "active" && (
                    <Button size="sm" variant="outline" disabled={reason.trim().length < 3 || change.isPending}
                      onClick={() => act(s, "reset-access", {}, `${s.login}: access reset`)}>Reset password &amp; authenticator</Button>
                  )}
                  <Button size="sm" variant="ghost" disabled={reason.trim().length < 3 || change.isPending}
                    onClick={() => act(s, "owner", { isOwner: !s.isOwner }, s.isOwner ? `${s.login} is no longer an Owner` : `${s.login} is now an Owner`)}>
                    {s.isOwner ? "Remove Owner" : "Make Owner"}
                  </Button>
                </div>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {list.data.invites.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Open invites and reset links</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {list.data.invites.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                  <span>{i.displayName} <span className="text-muted-foreground">{i.login}{i.reset ? " · reset" : ""} · expires {new Date(i.expiresAt).toLocaleString()}</span></span>
                  <Button size="sm" variant="ghost" disabled={change.isPending}
                    onClick={() => change.mutate({ method: "DELETE", url: `/staff/invites/${i.id}`, done: "Link cancelled" })}>Cancel</Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite staff</CardTitle>
          <CardDescription>Creates a one-time link. They choose a password and set up an authenticator app when they open it.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
            e.preventDefault();
            change.mutate({
              method: "POST", url: "/staff/invites", done: "Invite created",
              body: { login: form.login.trim(), displayName: form.displayName.trim(), email: form.email.trim() || null, groupIds: form.groupIds, isOwner: form.isOwner },
              onDone: (d) => { setLink(d.link); setForm({ login: "", displayName: "", email: "", groupIds: [], isOwner: false }); },
            });
          }}>
            <div className="space-y-1"><Label htmlFor="inv-name">Name</Label><Input id="inv-name" value={form.displayName} maxLength={80} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="inv-login">Login</Label><Input id="inv-login" value={form.login} maxLength={40} placeholder="e.g. jsmith" autoCapitalize="none" onChange={(e) => setForm({ ...form, login: e.target.value.toLowerCase() })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="inv-email">Work email (optional)</Label><Input id="inv-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <fieldset className="space-y-1 sm:col-span-2">
              <legend className="text-sm font-medium">Groups</legend>
              <div className="flex flex-wrap gap-4">
                {groups.data.groups.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.groupIds.includes(g.id)} onCheckedChange={(v) => setForm({ ...form, groupIds: v === true ? [...form.groupIds, g.id] : form.groupIds.filter((x) => x !== g.id) })} />
                    {g.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox checked={form.isOwner} onCheckedChange={(v) => setForm({ ...form, isOwner: v === true })} />
              Owner (full control, including staff accounts)
            </label>
            <div className="sm:col-span-2"><Button type="submit" disabled={!form.login.trim() || !form.displayName.trim() || change.isPending}>Create invite link</Button></div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function StaffGroups() {
  const groups = useQuery<{ groups: Group[] }>({ queryKey: ["ops", "groups"], queryFn: () => api("GET", "/groups") });
  const catalog = useQuery<{ permissions: Permission[] }>({ queryKey: ["ops", "permissions"], queryFn: () => api("GET", "/permissions") });
  const staff = useQuery<{ staff: StaffAccount[] }>({ queryKey: ["ops", "staff"], queryFn: () => api("GET", "/staff") });
  const mutate = useChange();
  const [newName, setNewName] = useState("");

  if (groups.isPending || catalog.isPending || staff.isPending) return <p role="status">Loading groups…</p>;
  if (groups.isError || catalog.isError || staff.isError) return <p role="alert">Couldn't load groups.</p>;
  const grantable = catalog.data.permissions.filter((p) => !p.ownerOnly);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Permissions are given to groups, and staff are added to groups. Owners always have full control, including
        staff accounts and this page.
      </p>
      {groups.data.groups.map((g) => (
        <GroupCard key={g.id} group={g} grantable={grantable} staff={staff.data.staff} busy={mutate.isPending} onChange={(v) => mutate.mutate(v)} />
      ))}
      <Card>
        <CardHeader><CardTitle className="text-base">New group</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input aria-label="New group name" placeholder="e.g. Moderators" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} />
          <Button
            disabled={newName.trim().length < 2 || mutate.isPending}
            onClick={() => { mutate.mutate({ method: "POST", url: "/groups", body: { name: newName.trim(), permissions: [] }, done: "Group created" }); setNewName(""); }}
          >Create</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function GroupCard({ group, grantable, staff, busy, onChange }: {
  group: Group; grantable: Permission[]; staff: StaffAccount[]; busy: boolean;
  onChange: (v: Change) => void;
}) {
  const [staffId, setStaffId] = useState("");
  const addable = staff.filter((s) => !group.members.some((m) => m.staffId === s.id));
  const toggle = (key: string, on: boolean) => {
    const next = on ? [...group.permissions, key] : group.permissions.filter((p) => p !== key);
    onChange({ method: "PATCH", url: `/groups/${group.id}`, body: { permissions: next }, done: `${group.name}: permissions updated` });
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
              onClick={() => onChange({ method: "DELETE", url: `/groups/${group.id}`, done: `${group.name} deleted` })}>
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
          <p className="mb-1 text-sm font-medium">Staff in this group ({group.members.length})</p>
          {group.members.length === 0 ? <p className="text-sm text-muted-foreground">Nobody yet.</p> : (
            <ul className="space-y-1">
              {group.members.map((m) => (
                <li key={m.staffId} className="flex items-center justify-between rounded border px-2 py-1 text-sm">
                  <span>{m.displayName} <span className="text-muted-foreground">{m.login}{m.status === "disabled" ? " · disabled" : ""}</span></span>
                  <Button variant="ghost" size="sm" disabled={busy}
                    onClick={() => onChange({ method: "DELETE", url: `/groups/${group.id}/members/${m.staffId}`, done: `Removed ${m.login} from ${group.name}` })}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {addable.length > 0 && (
            <div className="mt-2 flex gap-2">
              <Label htmlFor={`add-${group.id}`} className="sr-only">Add staff to {group.name}</Label>
              <select id={`add-${group.id}`} className="h-10 flex-1 rounded-md border bg-background px-2 text-sm" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                <option value="">Choose staff…</option>
                {addable.map((s) => <option key={s.id} value={s.id}>{s.displayName} ({s.login})</option>)}
              </select>
              <Button variant="outline" disabled={!staffId || busy}
                onClick={() => { onChange({ method: "POST", url: `/groups/${group.id}/members`, body: { staffId }, done: `Added to ${group.name}` }); setStaffId(""); }}>
                Add
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AuditLog() {
  const [before, setBefore] = useState<number[]>([]);
  const cursor = before[before.length - 1];
  const audit = useQuery<{ entries: AuditEntry[]; hasMore: boolean }>({
    queryKey: ["ops", "audit", cursor],
    queryFn: () => api("GET", `/audit?limit=50${cursor ? `&before=${cursor}` : ""}`),
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
                  <span><strong>{e.actorLabel ?? "Unknown"}</strong>{e.actorType === "member" ? " (member account)" : ""} · {AUDIT_ACTION_LABELS[e.action] ?? e.action}</span>
                  <time className="text-muted-foreground" dateTime={e.createdAt}>{new Date(e.createdAt).toLocaleString()}</time>
                </div>
                {typeof e.details?.groupName === "string" || typeof e.details?.name === "string" ? (
                  <p className="text-muted-foreground">
                    {String(e.details.groupName ?? e.details.name)}
                    {typeof e.details?.username === "string" ? ` · @${e.details.username}` : typeof e.details?.login === "string" ? ` · ${e.details.login}` : ""}
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

type MemberRow = { id: string; username: string; displayName: string | null; email: string; status: string; createdAt: string | null };
type MemberRecord = {
  member: { id: string; username: string; displayName: string | null; email: string; phone: string | null; createdAt: string | null; isOwner: boolean };
  status: { status: string; reason: string | null; changedAt: string | null };
  records: { name: string; rows: Record<string, unknown>[]; total: number; truncated: boolean; error: string | null }[];
  history: AuditEntry[];
  canChangeStatus: { restrict: boolean; suspend: boolean };
};

const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  restricted: "bg-amber-100 text-amber-900",
  suspended: "bg-red-100 text-red-800",
  deactivated: "bg-gray-200 text-gray-800",
};
const StatusBadge = ({ status }: { status: string }) => (
  <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? ""}`}>{status[0].toUpperCase() + status.slice(1)}</span>
);

function Members() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const list = useQuery<{ members: MemberRow[]; hasMore: boolean }>({
    queryKey: ["ops", "members", query],
    queryFn: () => api("GET", `/members?limit=50${query ? `&q=${encodeURIComponent(query)}` : ""}`),
  });
  if (selected) return <MemberDetail id={selected} onBack={() => setSelected(null)} />;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Members</CardTitle>
        <CardDescription>Search by username, name, email or phone.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); }}>
          <Input aria-label="Search members" placeholder="Search members" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button type="submit">Search</Button>
        </form>
        {list.isPending ? <p role="status">Searching…</p> : list.isError ? <p role="alert">Couldn't load members.</p> : list.data.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members found.</p>
        ) : (
          <ul className="divide-y">
            {list.data.members.map((m) => (
              <li key={m.id}>
                <button className="flex w-full items-center justify-between gap-2 py-2 text-left hover:bg-muted/50" onClick={() => setSelected(m.id)}>
                  <span><strong>{m.displayName || m.username}</strong> <span className="text-muted-foreground">@{m.username} · {m.email}</span></span>
                  <StatusBadge status={m.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const cell = (v: unknown) => v == null ? "—" : typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v).toLocaleString() : String(v);

function MemberDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const record = useQuery<MemberRecord>({ queryKey: ["ops", "member", id], queryFn: () => api("GET", `/members/${id}`) });
  const change = useMutation({
    mutationFn: (status: string) => api("POST", `/members/${id}/status`, { status, reason: reason.trim() }),
    onSuccess: (_d, status) => {
      toast({ description: status === "active" ? "Account reinstated" : `Account ${status}` });
      setReason("");
      qc.invalidateQueries({ queryKey: ["ops"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });
  if (record.isPending) return <p role="status">Loading member…</p>;
  if (record.isError) return <p role="alert">Couldn't load this member. <Button variant="link" onClick={onBack}>Back</Button></p>;
  const { member, status, records, history, canChangeStatus } = record.data;
  const options = [
    { to: "active", label: "Reinstate", show: status.status !== "active" && (status.status === "suspended" ? canChangeStatus.suspend : canChangeStatus.restrict) },
    { to: "restricted", label: "Restrict", show: status.status !== "restricted" && (status.status === "suspended" ? canChangeStatus.suspend : canChangeStatus.restrict) },
    { to: "suspended", label: "Suspend", show: status.status !== "suspended" && canChangeStatus.suspend },
  ].filter((o) => o.show);
  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" onClick={onBack}>← All members</Button>
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {member.displayName || member.username} <span className="font-normal text-muted-foreground">@{member.username}</span> <StatusBadge status={status.status} />
            {member.isOwner && <Badge variant="secondary">Owner</Badge>}
          </CardTitle>
          <CardDescription>
            {member.email}{member.phone ? ` · ${member.phone}` : ""}{member.createdAt ? ` · Joined ${new Date(member.createdAt).toLocaleDateString()}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {status.status !== "active" && <p className="text-sm">Reason: {status.reason ?? "—"}{status.changedAt ? ` (since ${new Date(status.changedAt).toLocaleString()})` : ""}</p>}
          {member.isOwner ? <p className="text-sm text-muted-foreground">This account is on the server's admin list and can't be restricted or suspended here.</p> : options.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="status-reason">Reason (required, saved in the audit log)</Label>
              <Input id="status-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="e.g. Repeated spam reports" />
              <div className="flex flex-wrap gap-2">
                {options.map((o) => (
                  <Button key={o.to} variant={o.to === "suspended" ? "destructive" : "outline"} disabled={reason.trim().length < 3 || change.isPending} onClick={() => change.mutate(o.to)}>
                    {o.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Restricted: can sign in and browse, but can't post, comment, message, sell or buy. Suspended: signed out
                everywhere, can't sign in, and their posts, products and profile are hidden. Nothing is deleted; reinstating restores everything.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      {records.map((section) => (
        <Card key={section.name}>
          <CardHeader>
            <CardTitle className="text-base">{section.name} ({section.total})</CardTitle>
            {section.truncated && <CardDescription>Showing the newest {section.rows.length} of {section.total}. Every record is kept.</CardDescription>}
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {section.error ? <p className="text-sm text-muted-foreground">Unavailable.</p> : section.rows.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
              <table className="w-full text-left text-sm">
                <thead><tr>{Object.keys(section.rows[0]).map((k) => <th key={k} className="pr-3 font-medium">{k}</th>)}</tr></thead>
                <tbody>{section.rows.map((row, i) => <tr key={i} className="border-t">{Object.values(row).map((v, j) => <td key={j} className="py-1 pr-3">{cell(v)}</td>)}</tr>)}</tbody>
              </table>
            )}
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardHeader><CardTitle className="text-base">Staff actions on this account</CardTitle></CardHeader>
        <CardContent>
          {history.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
            <ul className="divide-y text-sm">
              {history.map((e) => (
                <li key={e.id} className="py-2">
                  <strong>{e.actorLabel ?? "Unknown"}</strong> · {AUDIT_ACTION_LABELS[e.action] ?? e.action} · {new Date(e.createdAt).toLocaleString()}
                  {e.reason && <p>Reason: {e.reason}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
