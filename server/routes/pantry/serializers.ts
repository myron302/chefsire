type HouseholdMember = {
  userId: string;
  role: string;
  username: string | null;
  email: string | null;
};

type HouseholdInfo = {
  id: string;
  name: string;
  ownerUserId: string;
  inviteCode: string;
  createdAt: unknown;
  myRole: string;
  members: HouseholdMember[];
};

export function serializeHouseholdPayload(householdInfo: HouseholdInfo) {
  return {
    household: {
      id: householdInfo.id,
      name: householdInfo.name,
      inviteCode: householdInfo.inviteCode,
      ownerId: householdInfo.ownerUserId,
      createdAt: householdInfo.createdAt,
    },
    userRole: householdInfo.myRole,
    members: householdInfo.members,
  };
}

export function serializeHouseholdInviteRow(row: any) {
  return {
    id: String(row.id),
    householdId: String(row.household_id),
    householdName: String(row.household_name),
    invitedBy: {
      username: row.invited_by_username,
      email: row.invited_by_email,
    },
    createdAt: row.created_at,
  };
}
