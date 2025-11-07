import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, Star, Zap, CheckCircle2, Clock } from "lucide-react";
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
  const { user } = useUser();
  const queryClient = useQueryClient();

  const {
    data: questsResponse,
    isLoading,
    error,
  } = useQuery<{ quests: Array<{ progress: Omit<QuestProgress, 'quest'>, quest: Quest }> }>({
    queryKey: ["/api/quests/daily", user?.id],
    queryFn: () => fetchJSON<{ quests: Array<{ progress: Omit<QuestProgress, 'quest'>, quest: Quest }> }>(`/api/quests/daily/${user?.id}`),
    enabled: !!user?.id,
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

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Daily Quests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Unable to load quests. Try again later.</p>
        </CardContent>
      </Card>
    );
  }

  // Ensure quests is always an array
  const questsArray = Array.isArray(quests) ? quests : [];
  const activeQuests = questsArray.filter((q) => q.status === "active");
  const completedToday = questsArray.filter((q) => q.status === "completed");

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Daily Quests
          </div>
          <Badge variant="secondary" className="text-xs">
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
                  className={`p-4 rounded-lg border ${
                    isCompleted
                      ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                      : "bg-card border-border"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isCompleted
                            ? "bg-green-500 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          getQuestIcon(questProgress.quest.questType)
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-medium leading-tight">
                          {questProgress.quest.title}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {questProgress.quest.description}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={getDifficultyColor(questProgress.quest.difficulty)}
                    >
                      {questProgress.quest.difficulty}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <Progress value={progressPercent} className="h-2" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {questProgress.currentProgress} / {questProgress.targetProgress}
                      </span>
                      <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400 font-medium">
                        <Zap className="h-3 w-3" />
                        +{questProgress.quest.xpReward} XP
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {completedToday.length === 3 && (
          <div className="text-center p-4 bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg">
            <Trophy className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
            <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-100">
              All quests completed!
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              Amazing work! Come back tomorrow for new challenges.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
