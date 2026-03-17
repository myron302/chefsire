import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getRemixStreakDays } from "@/lib/drinks-activity";

export default function RemixStreakBadge() {
  const [streakDays, setStreakDays] = useState(0);

  useEffect(() => {
    setStreakDays(getRemixStreakDays());
  }, []);

  return (
    <Badge variant="secondary" className="text-sm px-3 py-1">
      <Flame className="h-4 w-4 mr-1 text-orange-500" />
      Remix Streak: {Math.max(0, streakDays)} day{streakDays === 1 ? "" : "s"}
    </Badge>
  );
}
