// client/src/pages/pantry/household.tsx
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Home } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { HouseholdMembersSection } from "./household/components/HouseholdMembersSection";
import { HouseholdOverviewSection } from "./household/components/HouseholdOverviewSection";
import { NoHouseholdSection } from "./household/components/NoHouseholdSection";
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
      <NoHouseholdSection
        createName={createName}
        inviteCode={inviteCode}
        pendingInvites={pendingInvites}
        createPending={createMutation.isPending}
        joinPending={joinMutation.isPending}
        inviteDecisionPending={acceptInviteMutation.isPending || declineInviteMutation.isPending}
        onCreateNameChange={setCreateName}
        onInviteCodeChange={setInviteCode}
        onCreateHousehold={() => createMutation.mutate()}
        onJoinHousehold={() => joinMutation.mutate()}
        onAcceptInvite={(inviteId) => acceptInviteMutation.mutate(inviteId)}
        onDeclineInvite={(inviteId) => declineInviteMutation.mutate(inviteId)}
      />
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

      <HouseholdOverviewSection
        inviteCode={household.inviteCode}
        userRole={data?.userRole}
        syncPending={syncMutation.isPending}
        leavePending={leaveMutation.isPending}
        onCopyInviteCode={copyCode}
        onSyncPantry={() => syncMutation.mutate()}
        onRefreshHousehold={() => qc.invalidateQueries({ queryKey: HOUSEHOLD_QUERY_KEY })}
        onLeaveHousehold={() => {
          if (confirm("Leave this household? You will no longer see shared items.")) leaveMutation.mutate();
        }}
      />

      <HouseholdMembersSection
        members={data?.members ?? []}
        canManage={canManage}
        inviteEmail={inviteEmail}
        invitePending={inviteUserMutation.isPending}
        removePending={removeMemberMutation.isPending}
        onInviteEmailChange={setInviteEmail}
        onInviteUser={() => inviteUserMutation.mutate(inviteEmail)}
        onRemoveMember={(member) => {
          if (confirm(`Remove ${member.username || member.displayName} from the household?`)) {
            removeMemberMutation.mutate(member.userId);
          }
        }}
      />

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
