// client/src/components/SeasonalEvents.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Calendar,
  Trophy,
  Users,
  Clock,
  TrendingUp,
  Star,
  Award,
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { Link } from "wouter";

type SeasonalEvent = {
  id: string;
  slug: string;
  title: string;
  description: string;
  eventType: string;
  category?: string;
  startDate: string;
  endDate: string;
  rules: any;
  rewards: any;
  imageUrl?: string;
  bannerUrl?: string;
  isFeatured: boolean;
  participantCount: number;
};

type EventParticipation = {
  id: string;
  eventId: string;
  userId: string;
  score: number;
  rank?: number;
  progress: any;
  joinedAt: string;
};

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function postJSON<T>(url: string, data?: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export function SeasonalEventsList() {
  const { user } = useUser();

  const { data: activeEvents, isLoading: loadingActive } = useQuery<{ events: SeasonalEvent[] }>({
    queryKey: ["/api/events/active"],
    queryFn: () => fetchJSON<{ events: SeasonalEvent[] }>("/api/events/active"),
  });

  const { data: upcomingEvents, isLoading: loadingUpcoming } = useQuery<{ events: SeasonalEvent[] }>({
    queryKey: ["/api/events/upcoming"],
    queryFn: () => fetchJSON<{ events: SeasonalEvent[] }>("/api/events/upcoming"),
  });

  if (loadingActive || loadingUpcoming) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-48 bg-muted rounded-lg mb-4" />
              <div className="h-6 bg-muted rounded w-3/4 mb-2" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const active = activeEvents?.events || [];
  const upcoming = upcomingEvents?.events || [];

  return (
    <div className="space-y-8">
      {/* Active Events */}
      {active.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">Active Events</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {active.map((event) => (
              <EventCard key={event.id} event={event} isActive />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Events */}
      {upcoming.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-6 w-6 text-muted-foreground" />
            <h2 className="text-2xl font-bold">Coming Soon</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} isActive={false} />
            ))}
          </div>
        </section>
      )}

      {active.length === 0 && upcoming.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-20" />
            <h3 className="text-lg font-semibold mb-2">No Events Right Now</h3>
            <p className="text-sm text-muted-foreground">
              Check back soon for exciting new challenges and competitions!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EventCard({ event, isActive }: { event: SeasonalEvent; isActive: boolean }) {
  const { user } = useUser();
  const queryClient = useQueryClient();

  const joinMutation = useMutation({
    mutationFn: () => postJSON(`/api/events/${event.id}/join`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", event.id] });
    },
  });

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case "competition":
        return <Trophy className="h-5 w-5" />;
      case "challenge":
        return <Star className="h-5 w-5" />;
      case "milestone":
        return <Award className="h-5 w-5" />;
      default:
        return <Calendar className="h-5 w-5" />;
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case "competition":
        return "from-yellow-500 to-orange-500";
      case "challenge":
        return "from-blue-500 to-cyan-500";
      case "milestone":
        return "from-purple-500 to-pink-500";
      default:
        return "from-gray-500 to-gray-600";
    }
  };

  const daysUntilEnd = Math.ceil(
    (new Date(event.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Link href={`/events/${event.slug}`}>
      <Card className={`cursor-pointer hover:border-primary/50 transition-all ${event.isFeatured ? "border-2 border-primary" : ""}`}>
        {/* Event Banner/Image */}
        {(event.bannerUrl || event.imageUrl) && (
          <div className="relative h-48 overflow-hidden">
            <img
              src={event.bannerUrl || event.imageUrl}
              alt={event.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            {event.isFeatured && (
              <Badge className="absolute top-3 right-3 bg-gradient-to-r from-yellow-500 to-orange-500">
                Featured
              </Badge>
            )}
            {isActive && (
              <Badge className="absolute top-3 left-3 bg-green-500">
                Live Now
              </Badge>
            )}
          </div>
        )}

        <CardContent className="p-6">
          {/* Event Type Badge */}
          <div className="flex items-center gap-2 mb-3">
            <div className={`p-2 rounded-full bg-gradient-to-r ${getEventTypeColor(event.eventType)}`}>
              {getEventTypeIcon(event.eventType)}
            </div>
            <Badge variant="outline" className="capitalize">
              {event.eventType}
            </Badge>
            {event.category && (
              <Badge variant="secondary" className="capitalize">
                {event.category}
              </Badge>
            )}
          </div>

          {/* Event Title & Description */}
          <h3 className="text-xl font-bold mb-2">{event.title}</h3>
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {event.description}
          </p>

          {/* Event Stats */}
          <div className="flex items-center gap-4 mb-4 text-sm">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{event.participantCount || 0} joined</span>
            </div>
            {isActive && (
              <div className="flex items-center gap-1 text-orange-600">
                <Clock className="h-4 w-4" />
                <span>{daysUntilEnd} days left</span>
              </div>
            )}
          </div>

          {/* Join Button */}
          {user && isActive && (
            <Button
              onClick={(e) => {
                e.preventDefault();
                joinMutation.mutate();
              }}
              disabled={joinMutation.isPending}
              className="w-full"
            >
              {joinMutation.isPending ? "Joining..." : "Join Event"}
            </Button>
          )}

          {!isActive && (
            <div className="text-sm text-muted-foreground">
              Starts {new Date(event.startDate).toLocaleDateString()}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

// Event Details Page Component
export function EventDetails({ eventId }: { eventId: string }) {
  const { user } = useUser();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/events", eventId],
    queryFn: () => fetchJSON<{
      event: SeasonalEvent;
      stats: any;
      userParticipation: EventParticipation | null;
    }>(`/api/events/${eventId}`),
  });

  const { data: leaderboardData } = useQuery({
    queryKey: ["/api/events", eventId, "leaderboard"],
    queryFn: () => fetchJSON<{ leaderboard: any[] }>(`/api/events/${eventId}/leaderboard?limit=10`),
  });

  const joinMutation = useMutation({
    mutationFn: () => postJSON(`/api/events/${eventId}/join`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
    },
  });

  if (isLoading) {
    return <div className="animate-pulse">Loading event...</div>;
  }

  if (!data) {
    return <div>Event not found</div>;
  }

  const { event, stats, userParticipation } = data;
  const leaderboard = leaderboardData?.leaderboard || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Event Header */}
      <Card>
        <CardContent className="p-0">
          {event.bannerUrl && (
            <div className="relative h-64">
              <img
                src={event.bannerUrl}
                alt={event.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 text-white">
                <h1 className="text-4xl font-bold mb-2">{event.title}</h1>
                <p className="text-lg opacity-90">{event.description}</p>
              </div>
            </div>
          )}
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-lg capitalize">
                  {event.eventType}
                </Badge>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <span>{stats.total_participants || 0} participants</span>
                </div>
              </div>
              {user && !userParticipation && (
                <Button
                  onClick={() => joinMutation.mutate()}
                  disabled={joinMutation.isPending}
                  size="lg"
                >
                  {joinMutation.isPending ? "Joining..." : "Join Event"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* User Progress (if participating) */}
          {userParticipation && (
            <Card>
              <CardHeader>
                <CardTitle>Your Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Score</span>
                      <span className="text-sm text-muted-foreground">
                        {userParticipation.score} points
                      </span>
                    </div>
                    {userParticipation.rank && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Rank</span>
                        <Badge variant="secondary">#{userParticipation.rank}</Badge>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Event Rules */}
          {event.rules && Object.keys(event.rules).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>How to Participate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  {/* Render rules dynamically */}
                  <p className="text-sm text-muted-foreground">
                    Check the event details for rules and requirements.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rewards */}
          {event.rewards && Object.keys(event.rewards).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Rewards
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {/* Render rewards dynamically */}
                  <p className="text-sm text-muted-foreground">
                    Compete for exclusive rewards and badges!
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - Leaderboard */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No rankings yet
                </p>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 p-2 rounded hover:bg-muted"
                    >
                      <div className="text-lg font-bold w-8 text-center">
                        {index < 3 ? (
                          <span className={index === 0 ? "text-yellow-500" : index === 1 ? "text-gray-400" : "text-orange-600"}>
                            #{index + 1}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">#{index + 1}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{entry.user?.displayName || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{entry.points} points</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default SeasonalEventsList;
