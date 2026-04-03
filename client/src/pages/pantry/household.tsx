// client/src/pages/pantry/household.tsx
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Users, Copy, Home, LogOut, RefreshCcw, Trash2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  acceptHouseholdInvite,
  createHousehold,
  declineHouseholdInvite,
  fetchHouseholdInfo,
  fetchHouseholdInvites,
  inviteHouseholdUser,
  joinHousehold,
  leaveHousehold,
  removeHouseholdMember,
  resolveHouseholdDuplicates,
  syncHouseholdPantry,
} from "./household/api";
import {
  buildInitialDuplicateDecisions,
  buildResolveDuplicatesDecisions,
  canManageHousehold,
  HOUSEHOLD_INVITES_QUERY_KEY,
  HOUSEHOLD_QUERY_KEY,
  HOUSEHOLD_REFETCH_INTERVAL_MS,
  PANTRY_ITEMS_QUERY_KEY,
} from "./household/helpers";
import { DuplicateResolutionDialog } from "./household/components/DuplicateResolutionDialog";
import { HouseholdRoleBadge } from "./household/components/HouseholdRoleBadge";
import type { DuplicateDecision, DuplicatePair, HouseholdInfo, HouseholdInvite } from "./household/types";

export default function HouseholdPantryPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [createName, setCreateName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  // Duplicate resolution UI
  const [dupeOpen, setDupeOpen] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  const [decisions, setDecisions] = useState<Record<string, DuplicateDecision>>({});

  const { data, isLoading } = useQuery<HouseholdInfo>({
    queryKey: HOUSEHOLD_QUERY_KEY,
    queryFn: fetchHouseholdInfo,
    refetchInterval: HOUSEHOLD_REFETCH_INTERVAL_MS,
  });

  const household = data?.household ?? null;

  // Query for pending invites
  const { data: invitesData } = useQuery<{ invites: HouseholdInvite[] }>({
    queryKey: HOUSEHOLD_INVITES_QUERY_KEY,
    queryFn: fetchHouseholdInvites,
    refetchInterval: HOUSEHOLD_REFETCH_INTERVAL_MS,
  });

  const pendingInvites = invitesData?.invites ?? [];

  const createMutation = useMutation({
    mutationFn: async () => createHousehold(createName),
    onSuccess: () => {
      setCreateName("");
      qc.invalidateQueries({ queryKey: HOUSEHOLD_QUERY_KEY });
      toast({ title: "Household created" });
    },
    onError: (e: any) => {
      console.error("Create household error:", e);
      toast({
        title: "Create failed",
        description: e.message || String(e),
        variant: "destructive",
        duration: 10000
      });
    },
  });

  const joinMutation = useMutation({
    mutationFn: async () => joinHousehold(inviteCode),
    onSuccess: () => {
      setInviteCode("");
      qc.invalidateQueries({ queryKey: HOUSEHOLD_QUERY_KEY });
      toast({ title: "Joined household" });
    },
    onError: (e: any) => toast({ title: "Join failed", description: e.message, variant: "destructive" }),
  });

  const leaveMutation = useMutation({
    mutationFn: leaveHousehold,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: HOUSEHOLD_QUERY_KEY });
      qc.invalidateQueries({ queryKey: PANTRY_ITEMS_QUERY_KEY });
      toast({ title: "Left household" });
    },
    onError: (e: any) => toast({ title: "Leave failed", description: e.message, variant: "destructive" }),
  });

  const syncMutation = useMutation({
    mutationFn: syncHouseholdPantry,
    onSuccess: (j) => {
      qc.invalidateQueries({ queryKey: PANTRY_ITEMS_QUERY_KEY });
      toast({ title: "Synced pantry", description: `${j.moved} item(s) moved into the household pantry.` });

      if (j.duplicates?.length) {
        setDuplicates(j.duplicates);
        setDecisions(buildInitialDuplicateDecisions(j.duplicates));
        setDupeOpen(true);
      }
    },
    onError: (e: any) => toast({ title: "Sync failed", description: e.message, variant: "destructive" }),
  });

  const resolveDupesMutation = useMutation({
    mutationFn: async () => resolveHouseholdDuplicates(buildResolveDuplicatesDecisions(duplicates, decisions)),
    onSuccess: (j) => {
      setDupeOpen(false);
      setDuplicates([]);
      setDecisions({});
      qc.invalidateQueries({ queryKey: PANTRY_ITEMS_QUERY_KEY });
      toast({
        title: "Duplicates resolved",
        description: `Merged: ${j.merged} • Discarded: ${j.discarded} • Kept both: ${j.kept}`,
      });
    },
    onError: (e: any) => toast({ title: "Resolve failed", description: e.message, variant: "destructive" }),
  });

  const inviteUserMutation = useMutation({
    mutationFn: inviteHouseholdUser,
    onSuccess: (data) => {
      setInviteEmail("");
      qc.invalidateQueries({ queryKey: HOUSEHOLD_QUERY_KEY });
      toast({ title: "User invited", description: data.message });
    },
    onError: (e: any) => {
      toast({
        title: "Invite failed",
        description: e.debugInfo || e.message,
        variant: "destructive",
      });
    },
  });

  const acceptInviteMutation = useMutation({
    mutationFn: acceptHouseholdInvite,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: HOUSEHOLD_QUERY_KEY });
      qc.invalidateQueries({ queryKey: HOUSEHOLD_INVITES_QUERY_KEY });
      toast({ title: "Invite accepted", description: "Welcome to the household!" });
    },
    onError: (e: any) => toast({ title: "Accept failed", description: e.message, variant: "destructive" }),
  });

  const declineInviteMutation = useMutation({
    mutationFn: declineHouseholdInvite,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: HOUSEHOLD_INVITES_QUERY_KEY });
      toast({ title: "Invite declined" });
    },
    onError: (e: any) => toast({ title: "Decline failed", description: e.message, variant: "destructive" }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: removeHouseholdMember,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: HOUSEHOLD_QUERY_KEY });
      toast({ title: "Member removed" });
    },
    onError: (e: any) => toast({ title: "Remove failed", description: e.message, variant: "destructive" }),
  });

  const canManage = canManageHousehold(data);

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

        {pendingInvites.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pending Invites</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="p-4 border rounded-lg space-y-3">
                  <div>
                    <p className="font-medium">{invite.householdName}</p>
                    <p className="text-sm text-muted-foreground">
                      Invited by {invite.invitedBy.username || invite.invitedBy.email}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => acceptInviteMutation.mutate(invite.id)}
                      disabled={acceptInviteMutation.isPending || declineInviteMutation.isPending}
                      size="sm"
                      className="flex-1"
                    >
                      Accept
                    </Button>
                    <Button
                      onClick={() => declineInviteMutation.mutate(invite.id)}
                      disabled={acceptInviteMutation.isPending || declineInviteMutation.isPending}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
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
              onClick={() => qc.invalidateQueries({ queryKey: HOUSEHOLD_QUERY_KEY })}
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
                    <HouseholdRoleBadge role={m.role} />
                    {canManage && m.role !== "owner" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Remove ${m.username || m.displayName} from the household?`)) {
                            removeMemberMutation.mutate(m.userId);
                          }
                        }}
                        disabled={removeMemberMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          )}

          {canManage && (
            <div className="pt-4 border-t space-y-2">
              <p className="text-sm font-medium">Invite by email, username, or user ID</p>
              <div className="flex gap-2">
                <Input
                  placeholder="email, username, or user ID"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <Button
                  onClick={() => inviteUserMutation.mutate(inviteEmail)}
                  disabled={!inviteEmail.trim() || inviteUserMutation.isPending}
                >
                  Invite
                </Button>
              </div>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Shared pantry items are the ones marked as "Household Item" on the Pantry page.
          </p>
        </CardContent>
      </Card>

      <DuplicateResolutionDialog
        open={dupeOpen}
        onOpenChange={setDupeOpen}
        duplicates={duplicates}
        decisions={decisions}
        onDecisionChange={(incomingId, action) => setDecisions((s) => ({ ...s, [incomingId]: action }))}
        onApplyChoices={() => resolveDupesMutation.mutate()}
        applyPending={resolveDupesMutation.isPending}
      />
    </div>
  );
}
