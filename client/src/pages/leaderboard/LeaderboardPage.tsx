import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy, Zap, Flame, Users, Crown, Medal, Award } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";

type LeaderboardUser = {
  user: {
    id: string;
    username: string;
    displayName: string;
    avatar: string | null;
    royalTitle: string | null;
  };
  stats: any;
};

function getRankIcon(rank: number) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Award className="h-5 w-5 text-orange-600" />;
  return <span className="text-sm font-medium text-gray-500">#{rank}</span>;
}

function LeaderboardRow({ entry, rank }: { entry: LeaderboardUser; rank: number }) {
  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${
        rank <= 3 ? "bg-gradient-to-r from-orange-50 to-white" : "hover:bg-gray-50"
      }`}
    >
      <div className="w-8 flex justify-center">{getRankIcon(rank)}</div>

      <Avatar className={rank === 1 ? "h-12 w-12 ring-2 ring-yellow-500" : "h-10 w-10"}>
        <AvatarImage src={entry.user.avatar || ""} />
        <AvatarFallback>{entry.user.displayName?.slice(0, 1) || "?"}</AvatarFallback>
      </Avatar>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{entry.user.displayName || entry.user.username}</span>
          {entry.user.royalTitle && (
            <Badge variant="secondary" className="text-xs">
              <Crown className="h-3 w-3 mr-1" />
              {entry.user.royalTitle}
            </Badge>
          )}
        </div>
        <span className="text-sm text-gray-600">@{entry.user.username}</span>
      </div>

      <div className="text-right">
        <div className="font-bold text-lg">{entry.stats.totalPoints || entry.stats.engagementScore || entry.stats.completedQuests || entry.stats.currentStreak}</div>
        <div className="text-xs text-gray-600">
          {entry.stats.totalPoints !== undefined && "XP"}
          {entry.stats.engagementScore !== undefined && "Score"}
          {entry.stats.completedQuests !== undefined && "Quests"}
          {entry.stats.currentStreak !== undefined && "Days"}
        </div>
      </div>
    </div>
  );
}

function XPLeaderboard() {
  const { data, isLoading } = useQuery<{ leaderboard: LeaderboardUser[] }>({
    queryKey: ["/api/leaderboard/xp"],
  });

  if (isLoading) {
    return <div className="p-8 text-center text-gray-600">Loading...</div>;
  }

  const leaderboard = data?.leaderboard || [];

  return (
    <div className="space-y-2">
      {leaderboard.map((entry, index) => (
        <LeaderboardRow key={entry.user.id} entry={entry} rank={index + 1} />
      ))}
      {leaderboard.length === 0 && (
        <div className="p-8 text-center text-gray-600">No data yet</div>
      )}
    </div>
  );
}

function QuestLeaderboard() {
  const { data, isLoading } = useQuery<{ leaderboard: LeaderboardUser[] }>({
    queryKey: ["/api/leaderboard/quests"],
  });

  if (isLoading) {
    return <div className="p-8 text-center text-gray-600">Loading...</div>;
  }

  const leaderboard = data?.leaderboard || [];

  return (
    <div className="space-y-2">
      {leaderboard.map((entry, index) => (
        <LeaderboardRow key={entry.user.id} entry={entry} rank={index + 1} />
      ))}
      {leaderboard.length === 0 && (
        <div className="p-8 text-center text-gray-600">No data yet</div>
      )}
    </div>
  );
}

function StreakLeaderboard() {
  const { data, isLoading } = useQuery<{ leaderboard: LeaderboardUser[] }>({
    queryKey: ["/api/leaderboard/streaks"],
  });

  if (isLoading) {
    return <div className="p-8 text-center text-gray-600">Loading...</div>;
  }

  const leaderboard = data?.leaderboard || [];

  return (
    <div className="space-y-2">
      {leaderboard.map((entry, index) => (
        <LeaderboardRow key={entry.user.id} entry={entry} rank={index + 1} />
      ))}
      {leaderboard.length === 0 && (
        <div className="p-8 text-center text-gray-600">No data yet</div>
      )}
    </div>
  );
}

function SocialLeaderboard() {
  const { data, isLoading } = useQuery<{ leaderboard: LeaderboardUser[] }>({
    queryKey: ["/api/leaderboard/social"],
  });

  if (isLoading) {
    return <div className="p-8 text-center text-gray-600">Loading...</div>;
  }

  const leaderboard = data?.leaderboard || [];

  return (
    <div className="space-y-2">
      {leaderboard.map((entry, index) => (
        <LeaderboardRow key={entry.user.id} entry={entry} rank={index + 1} />
      ))}
      {leaderboard.length === 0 && (
        <div className="p-8 text-center text-gray-600">No data yet</div>
      )}
    </div>
  );
}

function MyRankCard() {
  const { user } = useUser();
  const { data } = useQuery<{ ranks: { xp: number | null; quests: number | null; streak: number | null } }>({
    queryKey: ["/api/leaderboard/my-rank"],
    enabled: !!user,
  });

  if (!user || !data) return null;

  return (
    <Card className="mb-6 bg-gradient-to-r from-orange-500 to-red-500 text-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5" />
          Your Rankings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{data.ranks.xp ? `#${data.ranks.xp}` : "-"}</div>
            <div className="text-sm opacity-90">XP Rank</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{data.ranks.quests ? `#${data.ranks.quests}` : "-"}</div>
            <div className="text-sm opacity-90">Quest Rank</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{data.ranks.streak ? `#${data.ranks.streak}` : "-"}</div>
            <div className="text-sm opacity-90">Streak Rank</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LeaderboardPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Trophy className="h-8 w-8 text-orange-500" />
          Leaderboards
        </h1>
        <p className="text-gray-600">
          See how you stack up against other food enthusiasts!
        </p>
      </div>

      <SectionErrorBoundary sectionName="Rankings">
        <MyRankCard />
      </SectionErrorBoundary>

      <Card>
        <Tabs defaultValue="xp" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="xp" className="gap-2">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">XP</span>
            </TabsTrigger>
            <TabsTrigger value="quests" className="gap-2">
              <Trophy className="h-4 w-4" />
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
          </TabsList>

          <TabsContent value="xp" className="mt-6">
            <SectionErrorBoundary sectionName="XP Leaderboard">
              <XPLeaderboard />
            </SectionErrorBoundary>
          </TabsContent>

          <TabsContent value="quests" className="mt-6">
            <SectionErrorBoundary sectionName="Quest Leaderboard">
              <QuestLeaderboard />
            </SectionErrorBoundary>
          </TabsContent>

          <TabsContent value="streaks" className="mt-6">
            <SectionErrorBoundary sectionName="Streak Leaderboard">
              <StreakLeaderboard />
            </SectionErrorBoundary>
          </TabsContent>

          <TabsContent value="social" className="mt-6">
            <SectionErrorBoundary sectionName="Social Leaderboard">
              <SocialLeaderboard />
            </SectionErrorBoundary>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
