export type HouseholdMember = {
  userId: string;
  role: "owner" | "admin" | "member";
  joinedAt?: string;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
};

export type HouseholdInfo = {
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

export type DuplicatePair = {
  existing: { id: string; name: string; unit?: string | null; category?: string | null; quantity?: string | null };
  incoming: { id: string; name: string; unit?: string | null; category?: string | null; quantity?: string | null };
};

export type DuplicateDecision = "merge" | "keepBoth" | "discardIncoming";

export type HouseholdInvite = {
  id: string;
  householdId: string;
  householdName: string;
  invitedBy: {
    username: string | null;
    email: string | null;
  };
  createdAt: string;
};
