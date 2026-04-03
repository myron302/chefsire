import { Badge } from "@/components/ui/badge";
import type { HouseholdMember } from "../types";

type HouseholdRoleBadgeProps = {
  role: HouseholdMember["role"];
};

export function HouseholdRoleBadge({ role }: HouseholdRoleBadgeProps) {
  if (role === "owner") return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Owner</Badge>;
  if (role === "admin") return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Admin</Badge>;
  return <Badge variant="outline">Member</Badge>;
}
