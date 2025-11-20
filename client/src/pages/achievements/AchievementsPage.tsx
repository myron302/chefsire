import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Zap, Flame, Users, Utensils, Target, Lock, Award } from "lucide-react";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";

type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  xpReward: number;
  unlocked: boolean;
  progress: number;
};

type AchievementsData = {
  achievements: Achievement[];
  stats: {
    totalUnlocked: number;
    totalXpEarned: number;
  };
};

function getCategoryIcon(category: string) {
  switch (category) {
    case "xp":
      return <Zap className="h-5 w-5" />;
    case "quests":
      return <Target className="h-5 w-5" />;
    case "streaks":
      return <Flame className="h-5 w-5" />;
    case "social":
      return <Users className="h-5 w-5" />;
    case "recipes":
      return <Utensils className="h-5 w-5" />;
    default:
      return <Award className="h-5 w-5" />;
  }
}

function getCategoryColor(category: string) {
  switch (category) {
    case "xp":
      return "from-yellow-500 to-orange-500";
    case "quests":
      return "from-blue-500 to-indigo-500";
    case "streaks":
      return "from-red-500 to-pink-500";
    case "social":
      return "from-purple-500 to-pink-500";
    case "recipes":
      return "from-green-500 to-teal-500";
    default:
      return "from-gray-500 to-gray-600";
  }
}

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const isUnlocked = achievement.unlocked;
  const progress = achievement.progress || 0;

  return (
    <Card
      className={`relative overflow-hidden transition-all duration-300 ${
        isUnlocked
          ? "hover:shadow-lg hover:scale-105 border-2 border-transparent hover:border-orange-500"
          : "opacity-60 hover:opacity-80"
      }`}
    >
      {/* Background gradient for unlocked achievements */}
      {isUnlocked && (
        <div
          className={`absolute inset-0 bg-gradient-to-br ${getCategoryColor(
            achievement.category
          )} opacity-5`}
        />
      )}

      <CardHeader className="relative">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div
              className={`text-4xl ${
                isUnlocked ? "animate-bounce" : "grayscale"
              }`}
            >
              {achievement.icon}
            </div>

            <div>
              <CardTitle className="flex items-center gap-2">
                {achievement.name}
                {!isUnlocked && <Lock className="h-4 w-4 text-gray-400" />}
              </CardTitle>
              <CardDescription className="mt-1">
                {achievement.description}
              </CardDescription>
            </div>
          </div>

          {/* XP Reward */}
          <Badge
            variant={isUnlocked ? "default" : "secondary"}
            className="shrink-0"
          >
            <Zap className="h-3 w-3 mr-1" />
            {achievement.xpReward} XP
          </Badge>
        </div>
      </CardHeader>

      {/* Progress bar for locked achievements */}
      {!isUnlocked && progress > 0 && (
        <CardContent className="relative">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Progress</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardContent>
      )}

      {/* Unlocked badge */}
      {isUnlocked && (
        <div className="absolute top-2 right-2">
          <div className="bg-green-500 text-white rounded-full p-1">
            <Trophy className="h-4 w-4" />
          </div>
        </div>
      )}
    </Card>
  );
}

function AchievementsList({
  achievements,
  category,
}: {
  achievements: Achievement[];
  category?: string;
}) {
  const filtered = category
    ? achievements.filter((a) => a.category === category)
    : achievements;

  const unlocked = filtered.filter((a) => a.unlocked);
  const locked = filtered.filter((a) => !a.unlocked);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
        <div className="flex items-center gap-3">
          {category && getCategoryIcon(category)}
          <div>
            <p className="text-sm text-gray-600">
              {category
                ? `${category.charAt(0).toUpperCase() + category.slice(1)} Achievements`
                : "All Achievements"}
            </p>
            <p className="text-2xl font-bold text-orange-600">
              {unlocked.length} / {filtered.length}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Completion</p>
          <p className="text-2xl font-bold">
            {filtered.length > 0
              ? Math.round((unlocked.length / filtered.length) * 100)
              : 0}
            %
          </p>
        </div>
      </div>

      {/* Unlocked achievements */}
      {unlocked.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Unlocked ({unlocked.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {unlocked.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))}
          </div>
        </div>
      )}

      {/* Locked achievements */}
      {locked.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Lock className="h-5 w-5 text-gray-400" />
            Locked ({locked.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {locked.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AchievementsPage() {
  const { data, isLoading, error } = useQuery<AchievementsData>({
    queryKey: ["/api/achievements"],
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading achievements...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">Failed to load achievements. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const achievements = data?.achievements || [];
  const stats = data?.stats || { totalUnlocked: 0, totalXpEarned: 0 };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Trophy className="h-8 w-8 text-orange-500" />
          Achievements
        </h1>
        <p className="text-gray-600">
          Track your progress and unlock rewards as you explore ChefSire!
        </p>
      </div>

      {/* Overall stats */}
      <Card className="mb-6 bg-gradient-to-r from-orange-500 to-red-500 text-white">
        <CardHeader>
          <CardTitle className="text-xl">Your Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm opacity-90">Total Unlocked</p>
              <p className="text-3xl font-bold">{stats.totalUnlocked}</p>
            </div>
            <div>
              <p className="text-sm opacity-90">Total Achievements</p>
              <p className="text-3xl font-bold">{achievements.length}</p>
            </div>
            <div>
              <p className="text-sm opacity-90">XP from Achievements</p>
              <p className="text-3xl font-bold">{stats.totalXpEarned}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-6">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="xp" className="gap-2">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">XP</span>
            </TabsTrigger>
            <TabsTrigger value="quests" className="gap-2">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Quests</span>
            </TabsTrigger>
            <TabsTrigger value="streaks" className="gap-2">
              <Flame className="h-4 w-4" />
              <span className="hidden sm:inline">Streaks</span>
            </TabsTrigger>
            <TabsTrigger value="social" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Social</span>
            </TabsTrigger>
            <TabsTrigger value="recipes" className="gap-2">
              <Utensils className="h-4 w-4" />
              <span className="hidden sm:inline">Recipes</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <SectionErrorBoundary sectionName="All Achievements">
              <AchievementsList achievements={achievements} />
            </SectionErrorBoundary>
          </TabsContent>

          <TabsContent value="xp" className="mt-6">
            <SectionErrorBoundary sectionName="XP Achievements">
              <AchievementsList achievements={achievements} category="xp" />
            </SectionErrorBoundary>
          </TabsContent>

          <TabsContent value="quests" className="mt-6">
            <SectionErrorBoundary sectionName="Quest Achievements">
              <AchievementsList achievements={achievements} category="quests" />
            </SectionErrorBoundary>
          </TabsContent>

          <TabsContent value="streaks" className="mt-6">
            <SectionErrorBoundary sectionName="Streak Achievements">
              <AchievementsList achievements={achievements} category="streaks" />
            </SectionErrorBoundary>
          </TabsContent>

          <TabsContent value="social" className="mt-6">
            <SectionErrorBoundary sectionName="Social Achievements">
              <AchievementsList achievements={achievements} category="social" />
            </SectionErrorBoundary>
          </TabsContent>

          <TabsContent value="recipes" className="mt-6">
            <SectionErrorBoundary sectionName="Recipe Achievements">
              <AchievementsList achievements={achievements} category="recipes" />
            </SectionErrorBoundary>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
