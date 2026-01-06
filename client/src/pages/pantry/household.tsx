// client/src/pages/pantry/household.tsx
import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Users, Copy, Home, LogOut, RefreshCcw, Merge, Trash2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type HouseholdMember = {
  userId: string;
  role: "owner" | "admin" | "member";
  joinedAt?: string;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
};

type HouseholdInfo = {
  household: {
    id: string;
    name: string;
    inviteCode: string;
    ownerId: string;
    createdAt?: string;
  } | null;
  userRole: "owner" | "admin" | "member" | null;
  members: HouseholdMember[];
};

type DuplicatePair = {
  existing: { id: string; name: string; unit?: string | null; category?: string | null; quantity?: string | null };
  incoming: { id: string; name: string; unit?: string | null; category?: string | null; quantity?: string | null };
};

export default function HouseholdPantryPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [createName, setCreateName] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  // Duplicate resolution UI
  const [dupeOpen, setDupeOpen] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  const [decisions, setDecisions] = useState<Record<string, "merge" | "keepBoth" | "discardIncoming">>({});

  const { data, isLoading } = useQuery<HouseholdInfo>({
    queryKey: ["/api/pantry/household"],
    queryFn: async () => {
      const res = await fetch("/api/pantry/household", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load household");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const household = data?.household ?? null;

  const roleBadge = (role: HouseholdMember["role"]) => {
    if (role === "owner") return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Owner</Badge>;
    if (role === "admin") return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Admin</Badge>;
    return <Badge variant="outline">Member</Badge>;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/pantry/household", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: createName }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || "Failed to create household");
      return j as HouseholdInfo;
    },
    onSuccess: () => {
      setCreateName("");
      qc.invalidateQueries({ queryKey: ["/api/pantry/household"] });
      toast({ title: "Household created" });
    },
    onError: (e: any) => toast({ title: "Create failed", description: e.message, variant: "destructive" }),
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/pantry/household/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ inviteCode }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || "Failed to join household");
      return j as HouseholdInfo;
    },
    onSuccess: () => {
      setInviteCode("");
      qc.invalidateQueries({ queryKey: ["/api/pantry/household"] });
      toast({ title: "Joined household" });
    },
    onError: (e: any) => toast({ title: "Join failed", description: e.message, variant: "destructive" }),
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/pantry/household/leave", {
        method: "POST",
        credentials: "include",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || "Failed to leave household");
      return j;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/pantry/household"] });
      qc.invalidateQueries({ queryKey: ["/api/pantry/items"] });
      toast({ title: "Left household" });
    },
    onError: (e: any) => toast({ title: "Leave failed", description: e.message, variant: "destructive" }),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/pantry/household/sync", {
        method: "POST",
        credentials: "include",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || "Failed to sync pantry");
      return j as { ok: boolean; moved: number; duplicates: DuplicatePair[] };
    },
    onSuccess: (j) => {
      qc.invalidateQueries({ queryKey: ["/api/pantry/items"] });
      toast({ title: "Synced pantry", description: `${j.moved} item(s) moved into the household pantry.` });

      if (j.duplicates?.length) {
        setDuplicates(j.duplicates);
        const initial: Record<string, "merge" | "keepBoth" | "discardIncoming"> = {};
        for (const d of j.duplicates) initial[d.incoming.id] = "merge";
        setDecisions(initial);
        setDupeOpen(true);
      }
    },
    onError: (e: any) => toast({ title: "Sync failed", description: e.message, variant: "destructive" }),
  });

  const resolveDupesMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        decisions: duplicates.map((d) => ({
          incomingId: d.incoming.id,
          existingId: d.existing.id,
          action: decisions[d.incoming.id] || "merge",
        })),
      };
      const res = await fetch("/api/pantry/household/resolve-duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || "Failed to resolve duplicates");
      return j as { ok: boolean; merged: number; discarded: number; kept: number };
    },
    onSuccess: (j) => {
      setDupeOpen(false);
      setDuplicates([]);
      setDecisions({});
      qc.invalidateQueries({ queryKey: ["/api/pantry/items"] });
      toast({
        title: "Duplicates resolved",
        description: `Merged: ${j.merged} • Discarded: ${j.discarded} • Kept both: ${j.kept}`,
      });
    },
    onError: (e: any) => toast({ title: "Resolve failed", description: e.message, variant: "destructive" }),
  });

  const canManage = data?.userRole === "owner" || data?.userRole === "admin";

  const copyCode = async () => {
    if (!household?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(household.inviteCode);
      toast({ title: "Copied invite code" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p>Loading household…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not in a household
  if (!household) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Home className="w-5 h-5" />
            <h1 className="text-2xl font-bold">Household Pantry</h1>
          </div>
          <Link href="/pantry">
            <Button variant="outline">Back to Pantry</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Create a Household
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Household name (ex: My Family)"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
            />
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!createName.trim() || createMutation.isPending}
              className="w-full"
            >
              Create Household
            </Button>
            <p className="text-sm text-muted-foreground">
              After you create one, you’ll get an invite code to share with the people you want to join the same pantry.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Join a Household</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Invite code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            />
            <Button onClick={() => joinMutation.mutate()} disabled={!inviteCode.trim() || joinMutation.isPending} className="w-full">
              Join Household
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // In a household
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Home className="w-5 h-5" />
          <h1 className="text-2xl font-bold">{household.name}</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/pantry">
            <Button variant="outline">Back to Pantry</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span>Invite Code</span>
            <Button variant="outline" size="sm" onClick={copyCode}>
              <Copy className="w-4 h-4 mr-2" />
              Copy
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="p-3 rounded border bg-muted/30 font-mono text-lg tracking-wider">
            {household.inviteCode}
          </div>
          <p className="text-sm text-muted-foreground">
            Send this code to someone you want to share a pantry with. They can paste it on this page to join.
          </p>

          <div className="pt-2 flex gap-2">
            <Button
              variant="secondary"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              title="Move your personal pantry items into the household pantry"
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Sync my pantry into household
            </Button>

            <Button
              variant="outline"
              onClick={() => qc.invalidateQueries({ queryKey: ["/api/pantry/household"] })}
              title="Refresh"
            >
              Refresh
            </Button>

            {data?.userRole !== "owner" && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm("Leave this household? You will no longer see shared items.")) leaveMutation.mutate();
                }}
                disabled={leaveMutation.isPending}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Leave
              </Button>
            )}
          </div>

          {data?.userRole === "owner" && (
            <p className="text-sm text-muted-foreground pt-1">
              Owners can’t leave yet (this avoids orphaning the household). If you want that later, we can add ownership transfer.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data?.members?.length ? (
            <div className="space-y-2">
              {data.members.map((m) => (
                <div key={m.userId} className="flex items-center justify-between border rounded p-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {m.displayName || m.username || m.userId}
                    </div>
                    {m.username && <div className="text-xs text-muted-foreground">@{m.username}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    {roleBadge(m.role)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          )}

          <p className="text-sm text-muted-foreground">
            Shared pantry items are the ones marked as “Household Item” on the Pantry page.
          </p>
        </CardContent>
      </Card>

      {/* Duplicate Resolution Dialog */}
      <Dialog open={dupeOpen} onOpenChange={setDupeOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Duplicate items found</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 max-h-[60vh] overflow-auto">
            <p className="text-sm text-muted-foreground">
              Some items already existed in the household pantry. Choose what to do for each duplicate.
            </p>

            {duplicates.map((d) => {
              const action = decisions[d.incoming.id] || "merge";
              return (
                <div key={d.incoming.id} className="border rounded p-3 space-y-2">
                  <div className="text-sm">
                    <div className="font-medium">{d.existing.name}</div>
                    <div className="text-muted-foreground">
                      Household: {d.existing.quantity ?? "—"} {d.existing.unit ?? ""} {d.existing.category ? `• ${d.existing.category}` : ""}
                    </div>
                    <div className="text-muted-foreground">
                      Yours: {d.incoming.quantity ?? "—"} {d.incoming.unit ?? ""} {d.incoming.category ? `• ${d.incoming.category}` : ""}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={action === "merge" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDecisions((s) => ({ ...s, [d.incoming.id]: "merge" }))}
                    >
                      <Merge className="w-4 h-4 mr-2" />
                      Merge quantities
                    </Button>
                    <Button
                      variant={action === "keepBoth" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDecisions((s) => ({ ...s, [d.incoming.id]: "keepBoth" }))}
                    >
                      Keep both
                    </Button>
                    <Button
                      variant={action === "discardIncoming" ? "destructive" : "outline"}
                      size="sm"
                      onClick={() => setDecisions((s) => ({ ...s, [d.incoming.id]: "discardIncoming" }))}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Discard mine
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDupeOpen(false)}>
              Close
            </Button>
            <Button onClick={() => resolveDupesMutation.mutate()} disabled={resolveDupesMutation.isPending}>
              Apply choices
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
