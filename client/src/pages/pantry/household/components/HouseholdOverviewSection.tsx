import { Copy, LogOut, RefreshCcw } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type HouseholdOverviewSectionProps = {
  inviteCode: string;
  userRole: "owner" | "admin" | "member" | null | undefined;
  syncPending: boolean;
  leavePending: boolean;
  onCopyInviteCode: () => void;
  onSyncPantry: () => void;
  onRefreshHousehold: () => void;
  onLeaveHousehold: () => void;
};

export function HouseholdOverviewSection({
  inviteCode,
  userRole,
  syncPending,
  leavePending,
  onCopyInviteCode,
  onSyncPantry,
  onRefreshHousehold,
  onLeaveHousehold,
}: HouseholdOverviewSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Invite Code</span>
          <Button variant="outline" size="sm" onClick={onCopyInviteCode}>
            <Copy className="w-4 h-4 mr-2" />
            Copy
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="p-3 rounded border bg-muted/30 font-mono text-lg tracking-wider">{inviteCode}</div>
        <p className="text-sm text-muted-foreground">
          Send this code to someone you want to share a pantry with. They can paste it on this page to join.
        </p>

        <div className="pt-2 flex gap-2">
          <Button
            variant="secondary"
            onClick={onSyncPantry}
            disabled={syncPending}
            title="Move your personal pantry items into the household pantry"
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            Sync my pantry into household
          </Button>

          <Button variant="outline" onClick={onRefreshHousehold} title="Refresh">
            Refresh
          </Button>

          {userRole !== "owner" && (
            <Button variant="destructive" onClick={onLeaveHousehold} disabled={leavePending}>
              <LogOut className="w-4 h-4 mr-2" />
              Leave
            </Button>
          )}
        </div>

        {userRole === "owner" && (
          <p className="text-sm text-muted-foreground pt-1">
            Owners can’t leave yet (this avoids orphaning the household). If you want that later, we can add ownership
            transfer.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
