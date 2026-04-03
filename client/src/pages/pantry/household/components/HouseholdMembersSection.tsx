import { Trash2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { HouseholdRoleBadge } from "./HouseholdRoleBadge";
import type { HouseholdMember } from "../types";

type HouseholdMembersSectionProps = {
  members: HouseholdMember[];
  canManage: boolean;
  inviteEmail: string;
  invitePending: boolean;
  removePending: boolean;
  onInviteEmailChange: (value: string) => void;
  onInviteUser: () => void;
  onRemoveMember: (member: HouseholdMember) => void;
};

export function HouseholdMembersSection({
  members,
  canManage,
  inviteEmail,
  invitePending,
  removePending,
  onInviteEmailChange,
  onInviteUser,
  onRemoveMember,
}: HouseholdMembersSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {members.length ? (
          <div className="space-y-2">
            {members.map((member) => (
              <div key={member.userId} className="flex items-center justify-between border rounded p-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{member.displayName || member.username || member.userId}</div>
                  {member.username && <div className="text-xs text-muted-foreground">@{member.username}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <HouseholdRoleBadge role={member.role} />
                  {canManage && member.role !== "owner" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveMember(member)}
                      disabled={removePending}
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
                onChange={(e) => onInviteEmailChange(e.target.value)}
              />
              <Button onClick={onInviteUser} disabled={!inviteEmail.trim() || invitePending}>
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
  );
}
