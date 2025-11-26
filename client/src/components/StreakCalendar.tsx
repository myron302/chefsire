import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Trophy, TrendingUp, Calendar as CalendarIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type DayActivity = {
  date: string;
  drinksMade: number;
  xpEarned: number;
  questsCompleted: number;
};

type StreakData = {
  currentStreak: number;
  longestStreak: number;
  lastStreakDate: string | null;
  activity: DayActivity[];
};

function getActivityLevel(drinksMade: number): string {
  if (drinksMade === 0) return "bg-gray-100 hover:bg-gray-200";
  if (drinksMade === 1) return "bg-orange-200 hover:bg-orange-300";
  if (drinksMade === 2) return "bg-orange-400 hover:bg-orange-500";
  if (drinksMade >= 3) return "bg-orange-600 hover:bg-orange-700";
  return "bg-gray-100";
}

function DayCell({ day }: { day: DayActivity | null }) {
  if (!day) {
    return <div className="w-3 h-3 rounded-sm bg-gray-50" />;
  }

  const activityLevel = getActivityLevel(day.drinksMade);
  const dateObj = day.date ? new Date(day.date) : new Date();
  const formattedDate = dateObj.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`w-3 h-3 rounded-sm transition-all cursor-pointer ${activityLevel} ${
              day.drinksMade > 0 ? "ring-1 ring-orange-900/20" : ""
            }`}
          />
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="text-sm">
            <p className="font-semibold">{formattedDate}</p>
            <p className="text-gray-600">
              {day.drinksMade} {day.drinksMade === 1 ? "drink" : "drinks"} made
            </p>
            {day.questsCompleted > 0 && (
              <p className="text-gray-600">{day.questsCompleted} quests completed</p>
            )}
            {day.xpEarned > 0 && <p className="text-orange-600">+{day.xpEarned} XP earned</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function generateCalendarWeeks(activity: DayActivity[]): (DayActivity | null)[][] {
  const weeks: (DayActivity | null)[][] = [];
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 90); // Last 90 days

  // Create a map for quick lookup
  const activityMap = new Map<string, DayActivity>();
  activity.forEach((day) => {
    if (!day.date) return;
    const date = new Date(day.date).toISOString().split("T")[0];
    activityMap.set(date, day);
  });

  // Generate weeks starting from Sunday
  let currentWeek: (DayActivity | null)[] = [];
  const currentDate = new Date(startDate);

  // Pad the beginning to start on Sunday
  const firstDayOfWeek = currentDate.getDay();
  for (let i = 0; i < firstDayOfWeek; i++) {
    currentWeek.push(null);
  }

  // Fill in the dates
  while (currentDate <= today) {
    const dateStr = currentDate.toISOString().split("T")[0];
    const dayData = activityMap.get(dateStr) || {
      date: dateStr,
      drinksMade: 0,
      xpEarned: 0,
      questsCompleted: 0,
    };

    currentWeek.push(dayData);

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Pad the end of the last week
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  return weeks;
}

export default function StreakCalendar({ userId }: { userId?: string }) {
  const { data, isLoading } = useQuery<StreakData>({
    queryKey: ["/api/streaks/calendar", userId],
    queryFn: async () => {
      // This endpoint would need to be created on the backend
      // For now, returning mock data structure
      return {
        currentStreak: 7,
        longestStreak: 14,
        lastStreakDate: new Date().toISOString(),
        activity: [],
      };
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-13 gap-1">
              {Array.from({ length: 91 }).map((_, i) => (
                <div key={i} className="w-3 h-3 bg-gray-200 rounded-sm" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const streakData = data || {
    currentStreak: 0,
    longestStreak: 0,
    lastStreakDate: null,
    activity: [],
  };

  const weeks = generateCalendarWeeks(streakData.activity);
  const totalDays = streakData.activity.reduce((sum, day) => sum + (day.drinksMade > 0 ? 1 : 0), 0);
  const totalDrinks = streakData.activity.reduce((sum, day) => sum + day.drinksMade, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-orange-500" />
              Activity Calendar
            </CardTitle>
            <CardDescription>Your last 90 days of activity</CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              {streakData.currentStreak} day streak
            </Badge>
            <Badge variant="outline" className="gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              Best: {streakData.longestStreak}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{totalDays}</div>
            <div className="text-sm text-gray-600">Active Days</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{totalDrinks}</div>
            <div className="text-sm text-gray-600">Total Drinks</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {totalDays > 0 ? (totalDrinks / totalDays).toFixed(1) : "0"}
            </div>
            <div className="text-sm text-gray-600">Avg per Day</div>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="space-y-2">
          {/* Month labels */}
          <div className="flex text-xs text-gray-600 mb-2">
            {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((month, i) => {
              const today = new Date();
              const currentMonth = today.getMonth();
              const monthIndex = (currentMonth - 2 + 12 + i) % 12;
              const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
              return (
                <div key={i} className="flex-1 text-center">
                  {i % 3 === 0 ? monthNames[monthIndex] : ""}
                </div>
              );
            })}
          </div>

          {/* Day labels */}
          <div className="flex items-center gap-1">
            <div className="w-8 flex flex-col gap-1 text-xs text-gray-600">
              <div>Sun</div>
              <div></div>
              <div>Tue</div>
              <div></div>
              <div>Thu</div>
              <div></div>
              <div>Sat</div>
            </div>

            {/* Calendar cells */}
            <div className="flex gap-1 overflow-x-auto">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-1">
                  {week.map((day, dayIndex) => (
                    <DayCell key={`${weekIndex}-${dayIndex}`} day={day} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end gap-2 text-xs text-gray-600 mt-4">
            <span>Less</span>
            <div className="w-3 h-3 rounded-sm bg-gray-100" />
            <div className="w-3 h-3 rounded-sm bg-orange-200" />
            <div className="w-3 h-3 rounded-sm bg-orange-400" />
            <div className="w-3 h-3 rounded-sm bg-orange-600" />
            <span>More</span>
          </div>
        </div>

        {/* Motivation message */}
        {streakData.currentStreak > 0 && (
          <div className="mt-6 p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🔥</div>
              <div>
                <p className="font-semibold text-orange-900">
                  {streakData.currentStreak >= 30
                    ? "Legendary streak! You're unstoppable!"
                    : streakData.currentStreak >= 14
                    ? "Amazing! Keep the fire burning!"
                    : streakData.currentStreak >= 7
                    ? "One week strong! You're on a roll!"
                    : "Great start! Keep building your streak!"}
                </p>
                <p className="text-sm text-gray-600">
                  You've been active for {streakData.currentStreak} consecutive days!
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
