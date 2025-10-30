import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listThreads, getMessages, createThread, sendMessage, markRead } from "@/api/dm";
import { getDmSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/contexts/UserContext"; // assume existing
import { ArrowLeft, Send, MessageSquare, Circle, CircleCheck, Loader2 } from "lucide-react";

type Message = {
  id: string; threadId: string; senderId: string;
  body: string; attachments?: any[]; createdAt: string; editedAt?: string | null;
};

export default function DmPage() {
  const { user } = useUser(); // must provide user.id
  const [match, params] = useRoute<{ id?: string }>("/dm/:id?");
  const threadId = params?.id ?? null;
  const qc = useQueryClient();

  const { data: threads = [], refetch: refetchThreads } = useQuery({
    queryKey: ["dm", "threads"],
    queryFn: listThreads,
  });

  const selected = useMemo(
    () => threads.find((t: any) => t.id === threadId) || null,
    [threads, threadId]
  );

  // Messages
  const { data: messages = [], refetch: refetchMessages } = useQuery({
    enabled: !!threadId,
    queryKey: ["dm", "messages", threadId],
    queryFn: () => getMessages(threadId!),
  });

  // Socket wiring
  useEffect(() => {
    if (!user?.id) return;
    const s = getDmSocket(user.id);
    if (threadId) s.emit("join", { threadId });

    const onMsg = ({ message }: { message: Message }) => {
      if (message.threadId !== threadId) {
        // bump threads to update lastMessage/unread
        refetchThreads();
        return;
      }
      qc.setQueryData<Message[]>(["dm", "messages", threadId], (old = []) => [...old, message]);
      // update list
      refetchThreads();
    };

    const onTyping = ({ threadId: tid }: any) => {
      if (tid === threadId) {
        // could surface UI typing indicator
      }
    };

    s.on("message", onMsg);
    s.on("typing", onTyping);
    return () => {
      s.off("message", onMsg);
      s.off("typing", onTyping);
      if (threadId) s.emit("leave", { threadId });
    };
  }, [user?.id, threadId, qc, refetchThreads]);

  return (
    <div className="mx-auto max-w-6xl grid grid-cols-12 gap-4 p-4">
      {/* Sidebar */}
      <div className="col-span-12 md:col-span-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Messages</CardTitle>
            <Link href="/dm"><Button variant="secondary" size="sm">New</Button></Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {threads.length === 0 && <div className="text-sm text-muted-foreground">No conversations yet.</div>}
            {threads.map((t: any) => (
              <Link key={t.id} href={`/dm/${t.id}`}>
                <a className={`block rounded p-2 border hover:bg-accent ${t.id === threadId ? "bg-accent" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-medium truncate">{t.title || "Direct Message"}</div>
                    {t.unread > 0 ? <Badge>{t.unread}</Badge> : null}
                  </div>
                  {t.lastMessage ? (
                    <div className="text-sm text-muted-foreground truncate">{t.lastMessage.body}</div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No messages yet</div>
                  )}
                </a>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Thread view or new composer */}
      <div className="col-span-12 md:col-span-8">
        {threadId ? <ThreadView threadId={threadId} messages={messages} refetchMessages={refetchMessages} /> : <NewThread />}
      </div>
    </div>
  );
}

function NewThread() {
  const [otherId, setOtherId] = useState("");
  const [title, setTitle] = useState("");
  const create = useMutation({
    mutationFn: (v: { participantIds: string[]; title?: string }) => createThread(v.participantIds, v.title),
  });

  return (
    <Card>
      <CardHeader><CardTitle>Start a conversation</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <div className="text-sm">Other user ID</div>
          <Input placeholder="uuid of the other user" value={otherId} onChange={e => setOtherId(e.target.value)} />
        </div>
        <div className="space-y-1">
          <div className="text-sm">Title (optional)</div>
          <Input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <Button
          disabled={!otherId || create.isPending}
          onClick={async () => {
            const threadId = await create.mutateAsync({ participantIds: [otherId], title: title || undefined });
            window.location.href = `/dm/${threadId}`;
          }}
        >
          {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
          Create
        </Button>
      </CardContent>
    </Card>
  );
}

function ThreadView({ threadId, messages, refetchMessages }: { threadId: string; messages: Message[]; refetchMessages: () => void; }) {
  const { user } = useUser();
  const [text, setText] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  // scroll to bottom
  useEffect(() => {
    boxRef.current?.scrollTo({ top: 999999, behavior: "smooth" });
  }, [messages]);

  const send = useMutation({
    mutationFn: (v: { text: string }) => sendMessage(threadId, v.text),
  });

  // mark read on focus/update
  useEffect(() => {
    if (!messages.length) return;
    const last = messages[messages.length - 1];
    markRead(threadId, last.id).catch(() => {});
  }, [threadId, messages]);

  // typing indicator
  useEffect(() => {
    if (!user?.id) return;
    const s = getDmSocket(user.id);
    let typing = false;
    let t: any;
    const onKey = () => {
      if (!typing) {
        typing = true;
        s.emit("typing", { threadId, typing: true });
      }
      clearTimeout(t);
      t = setTimeout(() => { typing = false; s.emit("typing", { threadId, typing: false }); }, 1200);
    };
    const el = document.getElementById("dm-input");
    el?.addEventListener("input", onKey);
    return () => el?.removeEventListener("input", onKey);
  }, [threadId, user?.id]);

  return (
    <Card className="h-full">
      <CardHeader className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <Link href="/dm"><a><Button variant="ghost" size="icon"><ArrowLeft /></Button></a></Link>
          <CardTitle className="text-lg">Conversation</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col h-[70vh]">
        <div ref={boxRef} className="flex-1 overflow-auto space-y-2 pr-1">
          {messages.map(m => {
            const mine = m.senderId === user?.id;
            return (
              <div key={m.id} className={`max-w-[80%] rounded px-3 py-2 text-sm ${mine ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}>
                <div className="whitespace-pre-wrap">{m.body}</div>
                <div className="mt-1 text-[11px] opacity-70">{new Date(m.createdAt).toLocaleTimeString()}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <Input id="dm-input" placeholder="Type your message…" value={text} onChange={e => setText(e.target.value)} onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!text.trim()) return;
              send.mutate({ text: text.trim() }, {
                onSuccess: () => { setText(""); refetchMessages(); },
              });
            }
          }} />
          <Button disabled={!text.trim() || send.isPending} onClick={() => {
            if (!text.trim()) return;
            send.mutate({ text: text.trim() }, {
              onSuccess: () => { setText(""); refetchMessages(); },
            });
          }}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
