import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, Star, Zap, CheckCircle2, Clock, Sparkles } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type Quest = {
  id: string;
  slug: string;
  title: string;
  description: string;
  questType: string;
  targetValue: number;
  xpReward: number;
  difficulty: string;
};

type QuestProgress = {
  id: string;
  questId: string;
  userId: string;
  currentProgress: number;
  targetProgress: number;
  status: "active" | "completed" | "expired";
  xpEarned: number;
  quest: Quest;
};

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export default function DailyQuests() {
  const { user, loading } = useUser();
  const queryClient = useQueryClient();
  const [celebrateQuestId, setCelebrateQuestId] = useState<string | null>(null);

  const {
    data: questsResponse,
    isLoading,
    error,
  } = useQuery<{ quests: Array<{ progress: Omit<QuestProgress, 'quest'>, quest: Quest }> }>({
    queryKey: ["/api/quests/daily", user?.id],
    queryFn: () => fetchJSON<{ quests: Array<{ progress: Omit<QuestProgress, 'quest'>, quest: Quest }> }>(`/api/quests/daily/${user?.id}`),
    enabled: !loading && !!user?.id, // Only fetch when loading is done AND user exists
    retry: false, // Don't retry on error
    refetchInterval: 30000, // Refetch every 30 seconds to check for updates
  });

  // Extract and restructure quests array from response
  const quests = questsResponse?.quests.map(({ progress, quest }) => ({
    ...progress,
    quest,
  }));

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      easy: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      hard: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    return colors[difficulty] || colors.easy;
  };

  const getQuestIcon = (questType: string) => {
    const icons: Record<string, typeof Trophy> = {
      make_drink: Zap,
      try_category: Star,
      use_ingredient: Star,
      social_action: Trophy,
      streak_milestone: Trophy,
    };
    const Icon = icons[questType] || Star;
    return <Icon className="h-4 w-4" />;
  };

  // Don't show while user context is loading
  if (loading) return null;

  // Don't show if user is logged out
  if (!user) return null;

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Daily Quests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-2 bg-muted rounded w-full mb-2" />
                <div className="h-2 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Hide component if there's an error (e.g., tables don't exist yet)
  if (error) {
    console.warn("Daily Quests error:", error);
    return null;
  }

  // Ensure quests is always an array
  const questsArray = Array.isArray(quests) ? quests : [];
  const activeQuests = questsArray.filter((q) => q.status === "active");
  const completedToday = questsArray.filter((q) => q.status === "completed");

  // Trigger celebration animation when a quest is completed
  useEffect(() => {
    const justCompleted = questsArray.find(
      (q) => q.status === "completed" && !celebrateQuestId
    );
    if (justCompleted) {
      setCelebrateQuestId(justCompleted.id);
      setTimeout(() => setCelebrateQuestId(null), 2000);
    }
  }, [questsArray]);

  return (
    <Card className="w-full relative overflow-hidden">
      {/* Animated background gradient for all completed */}
      {completedToday.length === 3 && (
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-100 via-orange-100 to-red-100 dark:from-yellow-900/20 dark:via-orange-900/20 dark:to-red-900/20 opacity-30 animate-pulse" />
      )}

      <CardHeader className="relative">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {completedToday.length === 3 ? (
              <Trophy className="h-5 w-5 text-yellow-500 animate-bounce" />
            ) : (
              <Trophy className="h-5 w-5 text-yellow-500" />
            )}
            Daily Quests
          </div>
          <Badge
            variant={completedToday.length === 3 ? "default" : "secondary"}
            className={`text-xs ${
              completedToday.length === 3
                ? "bg-gradient-to-r from-yellow-500 to-orange-500 animate-pulse"
                : ""
            }`}
          >
            {completedToday.length}/3 Complete
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeQuests.length === 0 && completedToday.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-20" />
            <p className="text-sm text-muted-foreground">
              New quests appear daily.
              <br />
              Come back tomorrow!
            </p>
          </div>
        ) : (
          <>
            {questsArray.map((questProgress) => {
              const progressPercent =
                (questProgress.currentProgress / questProgress.targetProgress) * 100;
              const isCompleted = questProgress.status === "completed";

              return (
                <div
                  key={questProgress.id}
                  className={`p-3 rounded-lg border transition-all duration-300 ${
                    isCompleted
                      ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                      : "bg-card border-border hover:border-orange-300"
                  } ${
                    celebrateQuestId === questProgress.id
                      ? "animate-pulse ring-2 ring-green-500"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 ${
                          isCompleted
                            ? "bg-green-500 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <div className="scale-75">{getQuestIcon(questProgress.quest.questType)}</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-medium leading-tight truncate">
                          {questProgress.quest.title}
                        </h4>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 h-4 flex-shrink-0 ml-2 ${getDifficultyColor(questProgress.quest.difficulty)}`}
                    >
                      +{questProgress.quest.xpReward} XP
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <div className="relative">
                      <Progress value={progressPercent} className="h-1.5 transition-all duration-500 ease-out" />
                      {isCompleted && (
                        <div className="absolute -top-0.5 -right-0.5">
                          <Sparkles className="h-3 w-3 text-yellow-500 animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={`transition-colors ${
                        isCompleted ? "text-green-600 dark:text-green-400 font-semibold" : "text-muted-foreground"
                      }`}>
                        {questProgress.currentProgress} / {questProgress.targetProgress}
                        {isCompleted && " ✓"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {completedToday.length === 3 && (
          <div className="text-center p-4 bg-gradient-to-r from-yellow-100 via-orange-100 to-red-100 dark:from-yellow-900/20 dark:via-orange-900/20 dark:to-red-900/20 rounded-lg border-2 border-yellow-400 dark:border-yellow-600 shadow-lg animate-pulse">
            <div className="relative">
              <Trophy className="h-8 w-8 mx-auto mb-2 text-yellow-600 animate-bounce" />
              <Sparkles className="h-4 w-4 absolute top-0 left-1/2 -translate-x-6 text-yellow-500 animate-ping" />
              <Sparkles className="h-4 w-4 absolute top-0 right-1/2 translate-x-6 text-orange-500 animate-ping" />
            </div>
            <p className="text-sm font-bold text-yellow-900 dark:text-yellow-100 mb-1">
              🎉 Perfect Day! All Quests Completed! 🎉
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              Amazing work! You've earned all the XP. Come back tomorrow for new challenges!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
