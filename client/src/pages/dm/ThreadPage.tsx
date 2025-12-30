import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Send, Crown, User } from "lucide-react";
import { useUser } from "@/contexts/UserContext";

type Params = { params?: Record<string, string> };

type DMUser = {
  id: string;
  username: string;
  displayName?: string | null;
  avatar?: string | null;
};

type DMThread = {
  id: string;
  isGroup?: boolean;
  participants?: DMUser[];
};

type DMMessage = {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  createdAt: string;
  sender?: DMUser;
};

async function fetchThread(threadId: string): Promise<DMThread> {
  const r = await fetch(`/api/dm/threads/${threadId}`, {
    credentials: "include",
  });
  if (!r.ok) throw new Error(`Failed to load thread (${r.status})`);
  return r.json();
}

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

  // Fetch thread info to get participants
  const { data: threadData } = useQuery({
    queryKey: ["dm", "thread", threadId],
    queryFn: () => fetchThread(threadId),
    enabled: !!threadId,
  });

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

  // Get the other participant
  const otherParticipant = React.useMemo(() => {
    if (!threadData?.participants) return null;
    const others = threadData.participants.filter((p) => p.id !== meId);
    return others[0] ?? null;
  }, [threadData?.participants, meId]);

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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-red-50">
      {/* Decorative background pattern */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23FF6B35' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }}></div>

      <div className="relative max-w-3xl mx-auto p-4 md:p-6 space-y-4">
        {/* Back button */}
        <div className="flex items-center gap-2">
          <Link href="/messages">
            <a className="group inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-white border-2 border-amber-200 hover:border-amber-400 hover:shadow-md transition-all duration-200">
              <ArrowLeft className="h-4 w-4 text-amber-600 group-hover:translate-x-[-2px] transition-transform" />
              <span className="hidden sm:inline font-medium text-gray-700">Back to Royal Table Talk</span>
              <span className="sm:hidden font-medium text-gray-700">Back to Table Talk</span>
            </a>
          </Link>
        </div>

        {/* Conversation Card */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 via-amber-500 to-red-600 rounded-lg blur-md opacity-40 group-hover:opacity-60 transition duration-300"></div>
          <Card className="relative border-2 border-amber-300 shadow-2xl bg-white">
            <CardHeader className="border-b-2 border-amber-200 bg-gradient-to-r from-orange-50 to-red-50">
              <CardTitle className="text-lg flex items-center gap-3">
                {otherParticipant ? (
                  <>
                    <Link href={`/profile/${otherParticipant.id}`}>
                      <a className="flex-shrink-0">
                        <Avatar className="w-10 h-10 cursor-pointer hover:opacity-80 transition-opacity border-2 border-amber-400">
                          <AvatarImage src={otherParticipant.avatar || ""} alt={otherParticipant.displayName || otherParticipant.username} />
                          <AvatarFallback className="bg-gradient-to-br from-purple-400 to-fuchsia-400 text-white">
                            {(otherParticipant.displayName || otherParticipant.username || "U")[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </a>
                    </Link>
                    <Link href={`/profile/${otherParticipant.id}`}>
                      <a className="hover:underline">
                        <span className="bg-gradient-to-r from-orange-700 to-red-700 bg-clip-text text-transparent font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
                          {otherParticipant.displayName || otherParticipant.username}
                        </span>
                      </a>
                    </Link>
                  </>
                ) : (
                  <>
                    <div className="relative">
                      <Crown className="h-6 w-6 text-amber-600" />
                      <div className="absolute inset-0 bg-amber-400 blur-sm opacity-30"></div>
                    </div>
                    <span className="bg-gradient-to-r from-orange-700 to-red-700 bg-clip-text text-transparent font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
                      Royal Conversation
                    </span>
                  </>
                )}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 pt-4 bg-gradient-to-br from-orange-50/20 to-red-50/20">
              {/* Messages list */}
              <div
                ref={scrollerRef}
                className="h-[60vh] overflow-y-auto rounded-lg border-2 border-amber-200 p-4 bg-white/90 backdrop-blur-sm shadow-inner"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23FFA500' fill-opacity='0.02' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='1'/%3E%3Ccircle cx='13' cy='13' r='1'/%3E%3C/g%3E%3C/svg%3E")`,
                }}
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
                      className={`mb-3 flex ${mine ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                    >
                      <div className="relative group/message">
                        <div className={`absolute -inset-0.5 rounded-2xl blur opacity-0 group-hover/message:opacity-40 transition ${
                          mine ? "bg-gradient-to-r from-orange-400 to-red-400" : "bg-gradient-to-r from-purple-400 to-fuchsia-400"
                        }`}></div>
                        <div
                          className={`relative max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-lg ${
                            mine
                              ? "bg-gradient-to-br from-orange-600 via-red-600 to-orange-700 text-white rounded-br-sm border-2 border-amber-400"
                              : "bg-gradient-to-br from-purple-50 via-fuchsia-50 to-pink-50 text-gray-800 rounded-bl-sm border-2 border-purple-300"
                          }`}
                        >
                          {!mine && m.sender && (
                            <Link href={`/profile/${m.senderId}`}>
                              <a className="text-xs font-bold text-purple-700 hover:underline block mb-1">
                                {m.sender.displayName || m.sender.username}
                              </a>
                            </Link>
                          )}
                          <div className="whitespace-pre-wrap break-words leading-relaxed font-medium">{m.body}</div>
                          <div className={`mt-2 text-[10px] text-right font-medium ${mine ? "text-amber-100" : "text-purple-500"}`}>
                            {new Date(m.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {!loadingMessages && messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="relative">
                      <Crown className="h-16 w-16 text-amber-400 mb-4" />
                      <div className="absolute inset-0 bg-amber-400 blur-xl opacity-30"></div>
                    </div>
                    <p className="text-base text-gray-600 italic font-medium">No messages yet. Begin the royal discourse!</p>
                  </div>
                )}
              </div>

              {/* Composer */}
              <div className="relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-400 to-red-400 rounded-lg blur opacity-20"></div>
                <div className="relative flex gap-2 pt-2 p-3 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border-2 border-amber-200">
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
                    className="border-2 border-amber-300 focus:border-amber-500 focus:ring-amber-500 bg-white shadow-sm"
                  />
                  <Button
                    disabled={!text.trim() || sendMutation.isPending}
                    onClick={() => sendMutation.mutate(text.trim())}
                    className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Dispatch
                  </Button>
                </div>
              </div>
              {sendMutation.isError && (
                <div className="mt-2 p-3 bg-red-50 border-2 border-red-200 rounded-lg">
                  <p className="text-sm text-red-600 font-medium">
                    {(sendMutation.error as Error)?.message || "Failed to send"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
