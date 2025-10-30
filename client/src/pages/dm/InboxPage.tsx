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
  text: string;
  createdAt: string;
};

type DMThread = {
  id: string;
  isGroup?: boolean;
  createdAt: string;
  updatedAt?: string | null;
  lastMessage?: DMMessage | null;
  participants: DMUser[];
};

async function fetchThreads(): Promise<DMThread[]> {
  const r = await fetch("/api/dm/threads", { credentials: "include" });
  if (!r.ok) throw new Error(`Failed to load threads (${r.status})`);
  return r.json();
}

async function startThread(payload: { toUsername: string; text?: string }) {
  // backend may implement one of:
  //  - POST /api/dm/threads { toUsername, text? }
  //  - POST /api/dm/new { toUsername, text? }
  // We’ll try /threads first, then fall back.
  const tryPost = async (url: string) => {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(`${url} ${r.status}`);
    return r.json() as Promise<{ threadId: string }>;
  };

  try {
    return await tryPost("/api/dm/threads");
  } catch {
    return await tryPost("/api/dm/new");
  }
}

function ThreadRow({ thread, meId }: { thread: DMThread; meId?: string }) {
  const other = React.useMemo(() => {
    const others = thread.participants.filter((p) => p.id !== meId);
    return others[0] ?? thread.participants[0] ?? null;
  }, [thread.participants, meId]);

  const name =
    (other?.displayName && other.displayName.trim()) ||
    other?.username ||
    (thread.isGroup ? "Group" : "Conversation");

  const preview = thread.lastMessage?.text ?? "No messages yet";
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
  const [firstMessage, setFirstMessage] = React.useState("");

  const createMutation = useMutation({
    mutationFn: (payload: { toUsername: string; text?: string }) =>
      startThread(payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["dm", "threads"] });
      window.location.href = `/messages/${res.threadId}`;
    },
  });

  const threads = data ?? [];
  const [filter, setFilter] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!filter.trim()) return threads;
    const q = filter.toLowerCase();
    return threads.filter((t) => {
      const names = t.participants.map((p) => (p.displayName || p.username || "").toLowerCase());
      const text = t.lastMessage?.text?.toLowerCase() ?? "";
      return names.some((n) => n.includes(q)) || text.includes(q);
    });
  }, [threads, filter]);

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5" />
        <h1 className="text-xl font-semibold">Messages</h1>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input
              placeholder="Recipient username (e.g., chefsire)"
              value={toUsername}
              onChange={(e) => setToUsername(e.target.value)}
            />
            <Input
              placeholder="First message (optional)"
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
            />
            <Button
              disabled={!toUsername || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  toUsername: toUsername.trim(),
                  text: firstMessage.trim() || undefined,
                })
              }
              className="w-full md:w-auto"
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
