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
      <a className="block">
        <Card className="hover:shadow-lg hover:border-amber-300 transition-all duration-200 border border-amber-100 bg-gradient-to-r from-white to-orange-50/30">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-amber-600" />
              <span className="truncate font-semibold text-gray-800">{name}</span>
              {(thread.unread ?? 0) > 0 && (
                <Badge className="bg-gradient-to-r from-fuchsia-600 to-rose-600 text-white">
                  {thread.unread}
                </Badge>
              )}
            </CardTitle>
            <Badge variant="secondary" className="text-xs text-gray-600">
              {new Date(ts).toLocaleDateString()}
            </Badge>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-gray-600 line-clamp-2 italic">{preview}</p>
          </CardContent>
        </Card>
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
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Crown className="h-6 w-6 text-amber-500" />
        <h1
          className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          <span className="hidden sm:inline">Royal Table Talk</span>
          <span className="sm:hidden">Table Talk</span>
        </h1>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <Input
          placeholder="Search conversations"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {/* Compose */}
      <Card className="border-2 border-amber-200 bg-gradient-to-br from-orange-50/50 to-red-50/50 shadow-lg">
        <CardHeader className="border-b border-amber-200">
          <CardTitle className="text-base flex items-center gap-2">
            <Scroll className="h-5 w-5 text-amber-600" />
            <span className="bg-gradient-to-r from-orange-700 to-red-700 bg-clip-text text-transparent font-semibold">
              Dispatch a New Message
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

      {/* List */}
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && (
        <p className="text-sm text-red-600">Error: {(error as Error).message}</p>
      )}

      <div className="space-y-3">
        {filtered.map((t) => (
          <ThreadRow key={t.id} thread={t} meId={meId} />
        ))}
        {!isLoading && filtered.length === 0 && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No conversations yet.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
