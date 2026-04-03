import { Home, Users } from "lucide-react";
import { Link } from "wouter";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { HouseholdInvite } from "../types";

type NoHouseholdSectionProps = {
  createName: string;
  inviteCode: string;
  pendingInvites: HouseholdInvite[];
  createPending: boolean;
  joinPending: boolean;
  inviteDecisionPending: boolean;
  onCreateNameChange: (value: string) => void;
  onInviteCodeChange: (value: string) => void;
  onCreateHousehold: () => void;
  onJoinHousehold: () => void;
  onAcceptInvite: (inviteId: string) => void;
  onDeclineInvite: (inviteId: string) => void;
};

export function NoHouseholdSection({
  createName,
  inviteCode,
  pendingInvites,
  createPending,
  joinPending,
  inviteDecisionPending,
  onCreateNameChange,
  onInviteCodeChange,
  onCreateHousehold,
  onJoinHousehold,
  onAcceptInvite,
  onDeclineInvite,
}: NoHouseholdSectionProps) {
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
            onChange={(e) => onCreateNameChange(e.target.value)}
          />
          <Button onClick={onCreateHousehold} disabled={!createName.trim() || createPending} className="w-full">
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
            onChange={(e) => onInviteCodeChange(e.target.value.toUpperCase())}
          />
          <Button onClick={onJoinHousehold} disabled={!inviteCode.trim() || joinPending} className="w-full">
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
                    onClick={() => onAcceptInvite(invite.id)}
                    disabled={inviteDecisionPending}
                    size="sm"
                    className="flex-1"
                  >
                    Accept
                  </Button>
                  <Button
                    onClick={() => onDeclineInvite(invite.id)}
                    disabled={inviteDecisionPending}
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
