import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Target, Trophy, Clock, CheckCircle2, XCircle, Sparkles,
  Calendar, TrendingUp, Award, Flame
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { formatDistanceToNow } from "date-fns";

type Quest = {
  id: string;
  title: string;
  description: string;
  icon: string;
  actionType: string;
  category: string | null;
  targetValue: number;
  xpReward: number;
  coinReward: number;
  difficulty: string;
};

type QuestProgress = {
  id: string;
  userId: string;
  questId: string;
  date: string;
  currentProgress: number;
  targetProgress: number;
  status: "active" | "completed" | "expired";
  completedAt: string | null;
  xpEarned: number;
  createdAt: string;
  quest: Quest;
};

export default function QuestsPage() {
  const { user } = useUser();
  const [tab, setTab] = useState<"active" | "completed" | "history">("active");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/quests/daily", user?.id],
    queryFn: async () => {
      const response = await fetch("/api/quests/daily", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch quests");
      return response.json() as Promise<QuestProgress[]>;
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const activeQuests = data?.filter((q) => q.status === "active") || [];
  const completedQuests = data?.filter((q) => q.status === "completed") || [];
  const expiredQuests = data?.filter((q) => q.status === "expired") || [];

  const totalXpToday = completedQuests.reduce((sum, q) => sum + q.xpEarned, 0);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "bg-green-500";
      case "medium":
        return "bg-yellow-500";
      case "hard":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Target className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Please Log In</h2>
            <p className="text-muted-foreground mb-4">
              Log in to view your daily quests and start earning XP!
            </p>
            <Button asChild>
              <a href="/auth">Log In</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-lg text-muted-foreground">Loading quests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 text-white rounded-xl p-8 mb-6 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                <Target className="h-10 w-10" />
                Daily Quests
              </h1>
              <p className="text-white/90 text-lg">
                Complete quests to earn XP and unlock rewards!
              </p>
            </div>
            <div className="text-center bg-white/20 backdrop-blur rounded-lg p-4">
              <Trophy className="h-8 w-8 mx-auto mb-1" />
              <div className="text-3xl font-bold">{totalXpToday}</div>
              <div className="text-sm text-white/80">XP Today</div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4 text-center">
                <Flame className="h-6 w-6 mx-auto mb-2 text-yellow-300" />
                <div className="text-2xl font-bold">{activeQuests.length}</div>
                <div className="text-sm text-white/80">Active</div>
              </CardContent>
            </Card>
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4 text-center">
                <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-green-300" />
                <div className="text-2xl font-bold">{completedQuests.length}</div>
                <div className="text-sm text-white/80">Completed</div>
              </CardContent>
            </Card>
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4 text-center">
                <Award className="h-6 w-6 mx-auto mb-2 text-purple-300" />
                <div className="text-2xl font-bold">
                  {((completedQuests.length / (activeQuests.length + completedQuests.length || 1)) * 100).toFixed(0)}%
                </div>
                <div className="text-sm text-white/80">Success Rate</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={tab === "active" ? "default" : "outline"}
            onClick={() => setTab("active")}
            className="flex-1"
          >
            <Flame className="h-4 w-4 mr-2" />
            Active ({activeQuests.length})
          </Button>
          <Button
            variant={tab === "completed" ? "default" : "outline"}
            onClick={() => setTab("completed")}
            className="flex-1"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Completed ({completedQuests.length})
          </Button>
          <Button
            variant={tab === "history" ? "default" : "outline"}
            onClick={() => setTab("history")}
            className="flex-1"
          >
            <Calendar className="h-4 w-4 mr-2" />
            History ({expiredQuests.length})
          </Button>
        </div>

        {/* Quest Lists */}
        <div className="space-y-4">
          {tab === "active" && activeQuests.length === 0 && (
            <Card className="p-8 text-center">
              <Target className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-bold mb-2">No Active Quests</h3>
              <p className="text-muted-foreground">Check back tomorrow for new quests!</p>
            </Card>
          )}

          {tab === "active" &&
            activeQuests.map((questProgress) => (
              <Card key={questProgress.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="text-4xl">{questProgress.quest.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xl font-bold">{questProgress.quest.title}</h3>
                          <Badge className={getDifficultyColor(questProgress.quest.difficulty)}>
                            {questProgress.quest.difficulty}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mb-4">
                          {questProgress.quest.description}
                        </p>

                        {/* Progress Bar */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">
                              Progress: {questProgress.currentProgress} / {questProgress.targetProgress}
                            </span>
                            <span className="text-muted-foreground">
                              {Math.round((questProgress.currentProgress / questProgress.targetProgress) * 100)}%
                            </span>
                          </div>
                          <Progress
                            value={(questProgress.currentProgress / questProgress.targetProgress) * 100}
                            className="h-3"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="text-right ml-4">
                      <div className="flex items-center gap-1 text-yellow-600 font-bold text-lg mb-1">
                        <Sparkles className="h-5 w-5" />
                        +{questProgress.xpEarned} XP
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(questProgress.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

          {tab === "completed" && completedQuests.length === 0 && (
            <Card className="p-8 text-center">
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-bold mb-2">No Completed Quests Yet</h3>
              <p className="text-muted-foreground">Start completing quests to see them here!</p>
            </Card>
          )}

          {tab === "completed" &&
            completedQuests.map((questProgress) => (
              <Card key={questProgress.id} className="bg-green-50 border-green-200">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="text-4xl">{questProgress.quest.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xl font-bold">{questProgress.quest.title}</h3>
                          <Badge className="bg-green-500">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Completed
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">
                          {questProgress.quest.description}
                        </p>
                        {questProgress.completedAt && (
                          <p className="text-sm text-green-600 mt-2">
                            Completed {formatDistanceToNow(new Date(questProgress.completedAt), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right ml-4">
                      <div className="flex items-center gap-1 text-green-600 font-bold text-lg">
                        <Trophy className="h-5 w-5" />
                        +{questProgress.xpEarned} XP
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

          {tab === "history" && expiredQuests.length === 0 && (
            <Card className="p-8 text-center">
              <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-bold mb-2">No Quest History</h3>
              <p className="text-muted-foreground">Your quest history will appear here.</p>
            </Card>
          )}

          {tab === "history" &&
            expiredQuests.map((questProgress) => (
              <Card key={questProgress.id} className="opacity-60">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="text-4xl grayscale">{questProgress.quest.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xl font-bold line-through">{questProgress.quest.title}</h3>
                          <Badge variant="outline">Expired</Badge>
                        </div>
                        <p className="text-muted-foreground">
                          {questProgress.quest.description}
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Progress: {questProgress.currentProgress} / {questProgress.targetProgress}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>
    </div>
  );
}
