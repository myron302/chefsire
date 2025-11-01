import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Crown } from "lucide-react";
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
            <span className="hidden sm:inline">Back to Royal Table Talk</span>
            <span className="sm:hidden">Back to Table Talk</span>
          </a>
        </Link>
      </div>

      <Card className="border-2 border-amber-200 shadow-lg bg-gradient-to-br from-orange-50/30 to-red-50/30">
        <CardHeader className="border-b border-amber-200">
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-600" />
            <span className="bg-gradient-to-r from-orange-700 to-red-700 bg-clip-text text-transparent font-semibold">
              Royal Conversation
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3 pt-4">
          {/* Messages list */}
          <div
            ref={scrollerRef}
            className="h-[60vh] overflow-y-auto rounded-lg border-2 border-amber-100 p-4 bg-white/80 backdrop-blur-sm"
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
                  className={`mb-3 flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-md ${
                      mine
                        ? "bg-gradient-to-br from-orange-600 to-red-600 text-white rounded-br-sm border-2 border-amber-400"
                        : "bg-gradient-to-br from-purple-50 to-fuchsia-50 text-gray-800 rounded-bl-sm border-2 border-purple-200"
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</div>
                    <div className={`mt-1.5 text-[10px] text-right ${mine ? "text-amber-100" : "text-purple-400"}`}>
                      {new Date(m.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}

            {!loadingMessages && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Crown className="h-12 w-12 text-amber-300 mb-3" />
                <p className="text-sm text-gray-500 italic">No messages yet. Begin the royal discourse!</p>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="flex gap-2 pt-2">
            <Input
              placeholder="Compose your royal message…"
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
              className="border-amber-300 focus:border-amber-500 focus:ring-amber-500"
            />
            <Button
              disabled={!text.trim() || sendMutation.isPending}
              onClick={() => sendMutation.mutate(text.trim())}
              className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold shadow-md"
            >
              <Send className="h-4 w-4 mr-1" />
              Dispatch
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
