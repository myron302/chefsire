import * as React from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mail, Send, MessageSquare } from "lucide-react";
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
        <Card className="hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="truncate">{name}</span>
            </CardTitle>
            <Badge variant="secondary">
              {new Date(ts).toLocaleString()}
            </Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground line-clamp-2">{preview}</p>
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

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dm", "threads"],
    queryFn: fetchThreads,
  });

  const [toUsername, setToUsername] = React.useState("");

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
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5" />
        <h1 className="text-xl font-semibold">
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Start a new conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
              className="flex-1"
            />
            <Button
              disabled={!toUsername.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate(toUsername.trim())}
            >
              <Send className="h-4 w-4 mr-2" />
              Message
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
