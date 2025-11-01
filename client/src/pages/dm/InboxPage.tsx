import * as React from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Crown, Send, MessageSquare, Scroll } from "lucide-react";
import { useUser } from "@/contexts/UserContext";

type DMUser = {
  id: string;
  username: string;
  displayName?: string | null;
  avatar?: string | null;
};

type DMMessage = {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

type DMThread = {
  id: string;
  isGroup?: boolean;
  createdAt: string;
  updatedAt?: string | null;
  lastMessage?: DMMessage | null;
  participants?: DMUser[];
  unread?: number;
};

async function fetchThreads(): Promise<{ threads: DMThread[] }> {
  const r = await fetch("/api/dm/threads", { credentials: "include" });
  if (!r.ok) throw new Error(`Failed to load threads (${r.status})`);
  return r.json();
}

async function lookupUserByUsername(username: string): Promise<DMUser> {
  const r = await fetch(`/api/users/username/${encodeURIComponent(username)}`, {
    credentials: "include",
  });
  if (!r.ok) throw new Error(`User "${username}" not found`);
  return r.json();
}

async function startThread(toUsername: string): Promise<{ threadId: string }> {
  // First, lookup the user by username to get their ID
  const user = await lookupUserByUsername(toUsername);

  // Then create the thread with their ID
  const r = await fetch("/api/dm/threads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ participantIds: [user.id] }),
  });
  if (!r.ok) throw new Error(`Failed to create thread (${r.status})`);
  return r.json();
}

function ThreadRow({ thread, meId }: { thread: DMThread; meId?: string }) {
  const other = React.useMemo(() => {
    if (!thread.participants || thread.participants.length === 0) return null;
    const others = thread.participants.filter((p) => p.id !== meId);
    return others[0] ?? thread.participants[0] ?? null;
  }, [thread.participants, meId]);

  const name =
    (other?.displayName && other.displayName.trim()) ||
    other?.username ||
    (thread.isGroup ? "Group" : "Conversation");

  const preview = thread.lastMessage?.body ?? "No messages yet";
  const ts = thread.lastMessage?.createdAt ?? thread.createdAt;

  return (
    <Link href={`/messages/${thread.id}`}>
      <a className="block group">
        <div className="relative">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-400 to-red-400 rounded-lg blur opacity-0 group-hover:opacity-30 transition duration-300"></div>
          <Card className="relative hover:shadow-2xl hover:border-amber-400 hover:scale-[1.02] transition-all duration-300 border-2 border-amber-200 bg-gradient-to-r from-white via-orange-50/20 to-red-50/20">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3 bg-gradient-to-r from-transparent to-orange-50/40">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="relative">
                  <MessageSquare className="h-5 w-5 text-amber-600" />
                  {(thread.unread ?? 0) > 0 && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  )}
                </div>
                <span className="truncate font-bold text-gray-800">{name}</span>
                {(thread.unread ?? 0) > 0 && (
                  <Badge className="bg-gradient-to-r from-fuchsia-600 to-rose-600 text-white shadow-md animate-pulse">
                    {thread.unread}
                  </Badge>
                )}
              </CardTitle>
              <Badge variant="secondary" className="text-xs text-gray-600 bg-amber-100">
                {new Date(ts).toLocaleDateString()}
              </Badge>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-gray-700 line-clamp-2 italic leading-relaxed">{preview}</p>
            </CardContent>
          </Card>
        </div>
      </a>
    </Link>
  );
}

export default function DMInboxPage() {
  const { user } = useUser();
  const meId = user?.id;
  const qc = useQueryClient();
  const [location] = useLocation();

  // Extract ?new=username from URL
  const urlParams = new URLSearchParams(location.split('?')[1]);
  const newUsername = urlParams.get('new') || '';

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dm", "threads"],
    queryFn: fetchThreads,
  });

  const [toUsername, setToUsername] = React.useState(newUsername);

  const createMutation = useMutation({
    mutationFn: (username: string) => startThread(username),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["dm", "threads"] });
      setToUsername("");
      window.location.href = `/messages/${res.threadId}`;
    },
  });

  const threads = data?.threads ?? [];
  const [filter, setFilter] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!filter.trim()) return threads;
    const q = filter.toLowerCase();
    return threads.filter((t) => {
      const names = (t.participants ?? []).map((p) => (p.displayName || p.username || "").toLowerCase());
      const text = t.lastMessage?.body?.toLowerCase() ?? "";
      return names.some((n) => n.includes(q)) || text.includes(q);
    });
  }, [threads, filter]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-red-50">
      {/* Decorative background pattern */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23FF6B35' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }}></div>

      <div className="relative max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        {/* Royal Header */}
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 to-red-600 rounded-lg blur opacity-20"></div>
          <div className="relative bg-white rounded-lg p-6 shadow-xl border-2 border-amber-200">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Crown className="h-8 w-8 text-amber-500" />
                <div className="absolute -inset-2 bg-amber-400/20 rounded-full blur-md"></div>
              </div>
              <h1
                className="text-3xl font-bold bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 bg-clip-text text-transparent"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                <span className="hidden sm:inline">Royal Table Talk</span>
                <span className="sm:hidden">Table Talk</span>
              </h1>
            </div>
            <p className="text-sm text-gray-600 mt-2 italic">
              Where culinary royalty convenes
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-300 to-red-300 rounded-lg blur opacity-30"></div>
          <Input
            placeholder="Search conversations..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="relative bg-white border-2 border-amber-200 focus:border-amber-400 focus:ring-amber-400 shadow-md"
          />
        </div>

        {/* Compose */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 via-amber-500 to-red-600 rounded-lg blur-md opacity-40 group-hover:opacity-60 transition duration-300"></div>
          <Card className="relative border-2 border-amber-300 bg-white shadow-2xl">
            <CardHeader className="border-b-2 border-amber-200 bg-gradient-to-r from-orange-50 to-red-50">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="relative">
                  <Scroll className="h-5 w-5 text-amber-600" />
                  <div className="absolute inset-0 bg-amber-400 blur-sm opacity-30"></div>
                </div>
                <span className="bg-gradient-to-r from-orange-700 to-red-700 bg-clip-text text-transparent font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Dispatch a Royal Message
                </span>
              </CardTitle>
            </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Recipient username (e.g., chefsire)"
              value={toUsername}
              onChange={(e) => setToUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && toUsername.trim() && !createMutation.isPending) {
                  createMutation.mutate(toUsername.trim());
                }
              }}
              className="flex-1 border-amber-300 focus:border-amber-500 focus:ring-amber-500"
            />
            <Button
              disabled={!toUsername.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate(toUsername.trim())}
              className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold shadow-md"
            >
              <Send className="h-4 w-4 mr-2" />
              Dispatch
            </Button>
          </div>
          {createMutation.isError && (
            <p className="text-sm text-red-600">
              {(createMutation.error as Error)?.message || "Failed to create conversation"}
            </p>
          )}
            </CardContent>
          </Card>
        </div>

        {/* List */}
        {isLoading && (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
            <p className="text-sm text-muted-foreground mt-2">Loading your royal conversations...</p>
          </div>
        )}

        {isError && (
          <Card className="border-2 border-red-200 bg-red-50">
            <CardContent className="p-6">
              <p className="text-sm text-red-600">Error: {(error as Error).message}</p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {filtered.map((t) => (
            <ThreadRow key={t.id} thread={t} meId={meId} />
          ))}
          {!isLoading && filtered.length === 0 && (
            <Card className="border-2 border-amber-200 bg-gradient-to-br from-orange-50 to-red-50">
              <CardContent className="p-8 text-center">
                <Crown className="h-16 w-16 mx-auto mb-4 text-amber-300" />
                <p className="text-gray-600 italic">No conversations yet. Begin your royal discourse!</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
