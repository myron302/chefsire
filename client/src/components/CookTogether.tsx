// client/src/components/CookTogether.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Video,
  Users,
  Clock,
  Star,
  Calendar,
  Play,
  UserPlus,
  LogOut,
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { Link } from "wouter";

type CookTogetherSession = {
  id: string;
  recipeId: string;
  hostUserId: string;
  title: string;
  description?: string;
  scheduledFor?: string;
  startedAt?: string;
  endedAt?: string;
  maxParticipants: number;
  status: "scheduled" | "active" | "completed" | "cancelled";
  roomCode: string;
  participantCount?: number;
  host: {
    id: string;
    displayName: string;
    avatar?: string;
  };
  recipe: {
    title: string;
    imageUrl?: string;
    prepTime?: number;
  };
};

type SessionParticipant = {
  id: string;
  sessionId: string;
  userId: string;
  joinedAt: string;
  leftAt?: string;
  completed: boolean;
  user: {
    id: string;
    displayName: string;
    avatar?: string;
  };
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

export function CookTogetherList() {
  const { user } = useUser();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: activeSessions, isLoading: loadingActive } = useQuery<{ sessions: CookTogetherSession[] }>({
    queryKey: ["/api/cook-together/active"],
    queryFn: () => fetchJSON<{ sessions: CookTogetherSession[] }>("/api/cook-together/active"),
  });

  const { data: scheduledSessions, isLoading: loadingScheduled } = useQuery<{ sessions: CookTogetherSession[] }>({
    queryKey: ["/api/cook-together/scheduled"],
    queryFn: () => fetchJSON<{ sessions: CookTogetherSession[] }>("/api/cook-together/scheduled"),
  });

  if (loadingActive || loadingScheduled) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-32 bg-muted rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const active = activeSessions?.sessions || [];
  const scheduled = scheduledSessions?.sessions || [];

  return (
    <div className="space-y-8">
      {/* Create Session Button */}
      {user && (
        <div className="flex justify-end">
          <Button
            onClick={() => setShowCreateForm(true)}
            className="bg-gradient-to-r from-purple-500 to-pink-500"
          >
            <Video className="h-4 w-4 mr-2" />
            Host a Session
          </Button>
        </div>
      )}

      {/* Live Sessions */}
      {active.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative">
              <Video className="h-6 w-6 text-red-500" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold">Live Now</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {active.map((session) => (
              <SessionCard key={session.id} session={session} isLive />
            ))}
          </div>
        </section>
      )}

      {/* Scheduled Sessions */}
      {scheduled.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-6 w-6 text-muted-foreground" />
            <h2 className="text-2xl font-bold">Upcoming Sessions</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {scheduled.map((session) => (
              <SessionCard key={session.id} session={session} isLive={false} />
            ))}
          </div>
        </section>
      )}

      {active.length === 0 && scheduled.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Video className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-20" />
            <h3 className="text-lg font-semibold mb-2">No Sessions Right Now</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Be the first to host a Cook Together session!
            </p>
            {user && (
              <Button onClick={() => setShowCreateForm(true)}>
                Host a Session
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Session Modal (simplified inline) */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <CardTitle>Create Cook Together Session</CardTitle>
            </CardHeader>
            <CardContent>
              <CreateSessionForm onClose={() => setShowCreateForm(false)} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function SessionCard({ session, isLive }: { session: CookTogetherSession; isLive: boolean }) {
  const { user } = useUser();
  const queryClient = useQueryClient();

  const joinMutation = useMutation({
    mutationFn: () => postJSON(`/api/cook-together/${session.id}/join`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cook-together/active"] });
      // Navigate to session room
      window.location.href = `/cook-together/${session.id}`;
    },
  });

  const spotsLeft = session.maxParticipants - (session.participantCount || 0);

  return (
    <Link href={`/cook-together/${session.id}`}>
      <Card className="cursor-pointer hover:border-primary/50 transition-all group">
        {/* Recipe Image */}
        <div className="relative h-48 overflow-hidden">
          {session.recipe.imageUrl ? (
            <img
              src={session.recipe.imageUrl}
              alt={session.recipe.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <Video className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

          {/* Live Badge */}
          {isLive && (
            <Badge className="absolute top-3 left-3 bg-red-500 animate-pulse">
              <span className="w-2 h-2 bg-white rounded-full mr-1 inline-block" />
              LIVE
            </Badge>
          )}

          {/* Room Code */}
          <Badge variant="secondary" className="absolute top-3 right-3">
            {session.roomCode}
          </Badge>

          {/* Title Overlay */}
          <div className="absolute bottom-3 left-3 right-3 text-white">
            <h3 className="font-bold text-lg line-clamp-2">{session.title}</h3>
          </div>
        </div>

        <CardContent className="p-4">
          {/* Host Info */}
          <div className="flex items-center gap-2 mb-3">
            <Avatar className="w-8 h-8">
              <AvatarImage src={session.host.avatar} />
              <AvatarFallback>{session.host.displayName[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {session.host.displayName}
              </p>
              <p className="text-xs text-muted-foreground">Host</p>
            </div>
          </div>

          {/* Session Stats */}
          <div className="flex items-center gap-4 mb-3 text-sm">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>
                {session.participantCount || 0}/{session.maxParticipants}
              </span>
            </div>
            {session.recipe.prepTime && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{session.recipe.prepTime}min</span>
              </div>
            )}
          </div>

          {/* Spots Remaining */}
          {spotsLeft > 0 && spotsLeft <= 3 && (
            <Badge variant="outline" className="mb-3 text-xs">
              Only {spotsLeft} spots left!
            </Badge>
          )}

          {/* Join Button */}
          {user && isLive && spotsLeft > 0 && (
            <Button
              onClick={(e) => {
                e.preventDefault();
                joinMutation.mutate();
              }}
              disabled={joinMutation.isPending}
              className="w-full"
              size="sm"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {joinMutation.isPending ? "Joining..." : "Join Session"}
            </Button>
          )}

          {!isLive && session.scheduledFor && (
            <div className="text-sm text-muted-foreground text-center">
              <Calendar className="h-4 w-4 inline mr-1" />
              {new Date(session.scheduledFor).toLocaleString()}
            </div>
          )}

          {spotsLeft === 0 && (
            <Badge variant="secondary" className="w-full justify-center">
              Session Full
            </Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function CreateSessionForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [recipeId, setRecipeId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(10);

  const createMutation = useMutation({
    mutationFn: (data: any) => postJSON("/api/cook-together/create", data),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cook-together/active"] });
      // Navigate to the new session
      window.location.href = `/cook-together/${data.session.id}`;
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      recipeId: recipeId || "demo-recipe-1", // Fallback for demo
      title,
      description,
      maxParticipants,
      isPublic: true,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Session Title</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Let's make smoothies together!"
          required
        />
      </div>

      <div>
        <label className="text-sm font-medium">Description (Optional)</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What will you be cooking?"
          rows={3}
        />
      </div>

      <div>
        <label className="text-sm font-medium">Max Participants</label>
        <Input
          type="number"
          value={maxParticipants}
          onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
          min={2}
          max={50}
        />
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={createMutation.isPending || !title}
          className="flex-1"
        >
          {createMutation.isPending ? "Creating..." : "Start Session"}
        </Button>
      </div>
    </form>
  );
}

// Session Room Component (for live cooking)
export function SessionRoom({ sessionId }: { sessionId: string }) {
  const { user } = useUser();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/cook-together", sessionId],
    queryFn: () => fetchJSON<{
      session: CookTogetherSession;
      participants: SessionParticipant[];
    }>(`/api/cook-together/${sessionId}`),
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const leaveMutation = useMutation({
    mutationFn: () => postJSON(`/api/cook-together/${sessionId}/leave`, {}),
    onSuccess: () => {
      window.location.href = "/cook-together";
    },
  });

  if (isLoading) {
    return <div>Loading session...</div>;
  }

  if (!data) {
    return <div>Session not found</div>;
  }

  const { session, participants } = data;
  const isHost = user?.id === session.hostUserId;

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* Session Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-2">{session.title}</h1>
              <div className="flex items-center gap-4 text-sm">
                <Badge variant="outline">Room: {session.roomCode}</Badge>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{participants.length}/{session.maxParticipants}</span>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => leaveMutation.mutate()}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Leave Session
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Video Area */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-0">
              <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
                <div className="text-center text-white">
                  <Video className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Video streaming will be available here</p>
                  <p className="text-sm opacity-75">WebRTC integration required</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recipe Steps */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Recipe: {session.recipe.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Follow along with the recipe steps here...
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Participants Sidebar */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Participants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {participants.map((participant) => (
                  <div key={participant.id} className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={participant.user.avatar} />
                      <AvatarFallback>
                        {participant.user.displayName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {participant.user.displayName}
                      </p>
                      {participant.userId === session.hostUserId && (
                        <Badge variant="secondary" className="text-xs">Host</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default CookTogetherList;
