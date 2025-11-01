import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send } from "lucide-react";
import { useUser } from "@/contexts/UserContext";

type Params = { params?: Record<string, string> };

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
  sender?: DMUser;
};

async function fetchMessages(threadId: string): Promise<{ messages: DMMessage[] }> {
  const r = await fetch(`/api/dm/threads/${threadId}/messages`, {
    credentials: "include",
  });
  if (!r.ok) throw new Error(`Failed to load messages (${r.status})`);
  return r.json();
}

async function sendMessage(threadId: string, text: string) {
  const r = await fetch(`/api/dm/threads/${threadId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ text }),
  });
  if (!r.ok) throw new Error(`Failed to send message (${r.status})`);
  return r.json();
}

function useAutoScroll(dep: unknown) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [dep]);
  return ref;
}

export default function DMThreadPage({ params }: Params) {
  const threadId = params?.threadId ?? "";
  const { user } = useUser();
  const meId = user?.id;
  const qc = useQueryClient();

  const {
    data: messagesData,
    isLoading: loadingMessages,
    isError: messagesError,
    error: messagesErr,
  } = useQuery({
    queryKey: ["dm", "messages", threadId],
    queryFn: () => fetchMessages(threadId),
    enabled: !!threadId,
    refetchInterval: 2500, // lightweight live updates
  });

  const messages = messagesData?.messages ?? [];

  const [text, setText] = React.useState("");
  const sendMutation = useMutation({
    mutationFn: (text: string) => sendMessage(threadId, text),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["dm", "messages", threadId] });
    },
  });

  const scrollerRef = useAutoScroll(messages.length);

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/messages">
          <a className="inline-flex items-center gap-2 text-sm hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Back to Messages
          </a>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversation</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Messages list */}
          <div
            ref={scrollerRef}
            className="h-[60vh] overflow-y-auto rounded border p-3 bg-background"
          >
            {loadingMessages ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : null}

            {messagesError && (
              <p className="text-sm text-red-600">
                {(messagesErr as Error)?.message || "Failed to load messages"}
              </p>
            )}

            {messages.map((m) => {
              const mine = m.senderId === meId;
              return (
                <div
                  key={m.id}
                  className={`mb-2 flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      mine
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted rounded-bl-sm"
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words">{m.body}</div>
                    <div className="mt-1 text-[10px] opacity-70 text-right">
                      {new Date(m.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}

            {!loadingMessages && messages.length === 0 && (
              <p className="text-sm text-muted-foreground">No messages yet. Say hello!</p>
            )}
          </div>

          {/* Composer */}
          <div className="flex gap-2">
            <Input
              placeholder="Write a message…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (text.trim() && !sendMutation.isPending) {
                    sendMutation.mutate(text.trim());
                  }
                }
              }}
            />
            <Button
              disabled={!text.trim() || sendMutation.isPending}
              onClick={() => sendMutation.mutate(text.trim())}
            >
              <Send className="h-4 w-4 mr-1" />
              Send
            </Button>
          </div>
          {sendMutation.isError && (
            <p className="text-sm text-red-600">
              {(sendMutation.error as Error)?.message || "Failed to send"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
