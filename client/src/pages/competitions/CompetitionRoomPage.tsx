// client/src/pages/competitions/CompetitionRoomPage.tsx
import * as React from "react";
import { useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { Camera, Clock, Send, Users, Vote, Flame, Video, Trophy, User as UserIcon, Film } from "lucide-react";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function getAuthHeaders(): HeadersInit {
  const dev = typeof window !== "undefined" ? localStorage.getItem("devUserId") : null;
  return dev ? { "x-user-id": dev } : {};
}
function useInterval(callback: () => void, delay: number | null) {
  const saved = React.useRef(callback);
  React.useEffect(() => { saved.current = callback; }, [callback]);
  React.useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

type Competition = {
  id: string;
  title: string | null;
  status: "upcoming" | "live" | "judging" | "completed" | "canceled";
  themeName: string | null;
  isPrivate: boolean;
  startTime: string | null;
  endTime: string | null;
  judgingClosesAt: string | null;
  timeLimitMinutes: number;
  minOfficialVoters: number;
  videoRecordingUrl: string | null;
  isOfficial: boolean;
  winnerParticipantId: string | null;
};

type Participant = {
  id: string;
  competitionId: string;
  userId: string;
  role: "competitor" | "host" | "judge";
  dishTitle: string | null;
  dishDescription: string | null;
  finalDishPhotoUrl: string | null;
  totalScore: number | null;
  placement: number | null;
};

type VoteTally = { participantId: string; voters: number };

type CompetitionDetail = {
  competition: Competition;
  participants: Participant[];
  voteTallies: VoteTally[];
  media: { id: string; type: "recording" | "clip" | "highlight"; url: string }[];
};

// ---------------------------------------------------------------------------
// Data hooks
// ---------------------------------------------------------------------------
function useCompetition(id: string) {
  return useQuery({
    queryKey: ["competition", id],
    queryFn: async (): Promise<CompetitionDetail> => {
      const res = await fetch(`/api/competitions/${id}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to load competition");
      return res.json();
    },
    refetchInterval: (data) => {
      // Poll faster during live/judging
      const status = data?.competition?.status;
      if (status === "live") return 2000;
      if (status === "judging") return 5000;
      return 30_000;
    },
  });
}

function useStart(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/competitions/${id}/start`, { method: "POST", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Unable to start competition");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Cookoff started!" });
      qc.invalidateQueries({ queryKey: ["competition", id] });
    },
  });
}

function useEnd(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/competitions/${id}/end`, { method: "POST", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Unable to end competition");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Judging opened for 24 hours" });
      qc.invalidateQueries({ queryKey: ["competition", id] });
    },
  });
}

function useSubmitDish(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { dishTitle?: string; dishDescription?: string; finalDishPhotoUrl?: string }) => {
      const res = await fetch(`/api/competitions/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.error || "Submit failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Dish submitted!" });
      qc.invalidateQueries({ queryKey: ["competition", id] });
    },
  });
}

function useVote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { participantId: string; presentation: number; creativity: number; technique: number }) => {
      const res = await fetch(`/api/competitions/${id}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.error || "Voting failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Vote submitted" });
      qc.invalidateQueries({ queryKey: ["competition", id] });
    },
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function CompetitionRoomPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id!;
  const { data, isLoading, isError } = useCompetition(id);
  const startMut = useStart(id);
  const endMut = useEnd(id);

  const comp = data?.competition;
  const participants = data?.participants ?? [];
  const tallies = React.useMemo(() => {
    const map = new Map<string, number>();
    (data?.voteTallies ?? []).forEach((t) => map.set(t.participantId, t.voters));
    return map;
  }, [data]);

  // countdown clock
  const [now, setNow] = React.useState(() => Date.now());
  useInterval(() => setNow(Date.now()), comp?.status === "live" || comp?.status === "judging" ? 1000 : null);

  function timeLeftLabel() {
    if (!comp) return "";
    const nowD = new Date(now);
    if (comp.status === "live" && comp.endTime) {
      const end = new Date(comp.endTime);
      if (end.getTime() > now) return `${formatDistanceToNowStrict(end, { addSuffix: false })} left`;
      return "Finishing…";
    }
    if (comp.status === "judging" && comp.judgingClosesAt) {
      const close = new Date(comp.judgingClosesAt);
      if (close.getTime() > now) return `Voting ends in ${formatDistanceToNowStrict(close, { addSuffix: false })}`;
      return "Judging closing…";
    }
    return "";
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <Skeleton className="h-8 w-64" />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </div>
    );
  }
  if (isError || !comp) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-red-600">Failed to load cookoff.</p>
      </div>
    );
  }

  const isLive = comp.status === "live";
  const isJudging = comp.status === "judging";
  const isCompleted = comp.status === "completed";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <Video className="h-6 w-6" />
          <h1 className="font-serif text-2xl">{comp.title || "Cookoff Room"}</h1>
        </div>
        <Badge variant="secondary" className="ml-0 sm:ml-2">{comp.themeName || "Freestyle"}</Badge>
        <Badge className="ml-auto capitalize">{comp.status}</Badge>
      </header>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <div className="text-sm">
              {isLive && <span>Cooking ends: <strong>{new Date(comp.endTime!).toLocaleTimeString()}</strong></span>}
              {isJudging && <span>Voting closes: <strong>{new Date(comp.judgingClosesAt!).toLocaleTimeString()}</strong></span>}
              {!isLive && !isJudging && comp.startTime && (
                <span>Started: {new Date(comp.startTime).toLocaleString()}</span>
              )}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">{timeLeftLabel()}</div>
        </CardHeader>
        <CardContent>
          {/* LIVE PHASE ------------------------------------------------------ */}
          {isLive && (
            <LiveGrid
              competitionId={comp.id}
              participants={participants}
              endTime={comp.endTime!}
              onEnd={() => endMut.mutate()}
            />
          )}

          {/* JUDGING PHASE --------------------------------------------------- */}
          {isJudging && <JudgingPanel competitionId={comp.id} participants={participants} closeAt={comp.judgingClosesAt!} />}

          {/* COMPLETED / ARCHIVE -------------------------------------------- */}
          {isCompleted && <ArchivePanel competition={comp} participants={participants} />}
        </CardContent>
      </Card>

      {/* Admin/creator quick controls: show start if upcoming */}
      {comp.status === "upcoming" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => startMut.mutate()} disabled={startMut.isPending}>
            <Camera className="mr-2 h-4 w-4" />
            Start Cookoff
          </Button>
          <div className="text-xs text-muted-foreground">Time limit: {comp.timeLimitMinutes} minutes</div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live grid (placeholder video tiles) + submit modal
// ---------------------------------------------------------------------------
function LiveGrid({
  competitionId,
  participants,
  endTime,
  onEnd,
}: {
  competitionId: string;
  participants: Participant[];
  endTime: string;
  onEnd: () => void;
}) {
  const endAt = new Date(endTime).getTime();
  const [now, setNow] = React.useState(() => Date.now());
  useInterval(() => setNow(Date.now()), 1000);
  const pct = Math.max(0, Math.min(100, 100 - ((endAt - now) / (60_000 /* ms per min */) / 60) * 100));

  return (
    <div className="space-y-6">
      <Progress value={pct} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {participants
          .filter((p) => p.role === "competitor" || p.role === "host")
          .map((p) => (
            <div key={p.id} className="relative rounded-2xl border bg-black/5 p-3">
              {/* Video placeholder tile */}
              <div className="flex h-48 items-center justify-center rounded-xl bg-muted">
                <UserIcon className="h-10 w-10 opacity-70" />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-sm font-medium truncate">User {p.userId.slice(0, 6)}</div>
                <SubmitDishDialog competitionId={competitionId} />
              </div>
            </div>
          ))}
      </div>

      <div className="flex items-center justify-between rounded-xl border p-3">
        <div className="text-sm text-muted-foreground">
          Need to wrap up early? You can end the cookoff and open the 24-hour judging window.
        </div>
        <Button variant="secondary" onClick={onEnd}>
          <FlagIcon />
          End & Open Judging
        </Button>
      </div>
    </div>
  );
}

function SubmitDishDialog({ competitionId }: { competitionId: string }) {
  const submitMut = useSubmitDish(competitionId);
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [photoUrl, setPhotoUrl] = React.useState("");

  const onSubmit = () => {
    submitMut.mutate(
      { dishTitle: title || undefined, dishDescription: desc || undefined, finalDishPhotoUrl: photoUrl || undefined },
      { onSuccess: () => { setOpen(false); setTitle(""); setDesc(""); setPhotoUrl(""); } }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Send className="mr-2 h-3.5 w-3.5" />
          Submit Dish
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit Final Dish</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="dtitle">Dish Title</Label>
            <Input id="dtitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Citrus Basque Cheesecake" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ddesc">Description</Label>
            <Textarea id="ddesc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Key techniques, flavors, plating notes…" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="durl">Photo URL</Label>
            <Input id="durl" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={onSubmit} disabled={submitMut.isPending}>
              {submitMut.isPending ? "Submitting…" : "Submit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Judging panel (24h window) – spectator voting only
// ---------------------------------------------------------------------------
function JudgingPanel({
  competitionId,
  participants,
  closeAt,
}: {
  competitionId: string;
  participants: Participant[];
  closeAt: string;
}) {
  const voteMut = useVote(competitionId);
  const [now, setNow] = React.useState(() => Date.now());
  useInterval(() => setNow(Date.now()), 1000);

  const closes = new Date(closeAt);
  const endsIn = closes.getTime() > now ? formatDistanceToNowStrict(closes, { addSuffix: false }) : "Closing…";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Vote className="h-4 w-4" />
        Voting ends in <strong className="ml-1">{endsIn}</strong>
      </div>
      <Separator />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {participants
          .filter((p) => p.role === "competitor" || p.role === "host")
          .map((p) => <VoteCard key={p.id} p={p} onVote={(scores) => voteMut.mutate({ participantId: p.id, ...scores })} />)}
      </div>
    </div>
  );
}

function VoteCard({
  p,
  onVote,
}: {
  p: Participant;
  onVote: (scores: { presentation: number; creativity: number; technique: number }) => void;
}) {
  const [presentation, setPresentation] = React.useState(7);
  const [creativity, setCreativity] = React.useState(7);
  const [technique, setTechnique] = React.useState(7);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <UserIcon className="h-4 w-4" />
          {p.dishTitle || `Chef ${p.userId.slice(0, 6)}`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
          {/* photo if available */}
          {p.finalDishPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.finalDishPhotoUrl} alt={p.dishTitle ?? "dish"} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No photo</div>
          )}
        </div>
        {p.dishDescription && <p className="text-sm text-muted-foreground line-clamp-3">{p.dishDescription}</p>}

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <Label>Presentation</Label>
            <Input type="number" min={1} max={10} value={presentation} onChange={(e) => setPresentation(clamp1to10(e.target.value))} />
          </div>
          <div>
            <Label>Creativity</Label>
            <Input type="number" min={1} max={10} value={creativity} onChange={(e) => setCreativity(clamp1to10(e.target.value))} />
          </div>
          <div>
            <Label>Technique</Label>
            <Input type="number" min={1} max={10} value={technique} onChange={(e) => setTechnique(clamp1to10(e.target.value))} />
          </div>
        </div>

        <Button className="w-full" onClick={() => onVote({ presentation, creativity, technique })}>
          <Flame className="mr-2 h-4 w-4" /> Submit Vote
        </Button>
      </CardContent>
    </Card>
  );
}

function clamp1to10(v: string) {
  const n = parseInt(v || "0", 10);
  return Math.max(1, Math.min(10, isNaN(n) ? 1 : n));
}

// ---------------------------------------------------------------------------
// Archive / results
// ---------------------------------------------------------------------------
function ArchivePanel({ competition, participants }: { competition: Competition; participants: Participant[] }) {
  const winner = participants.find((p) => p.id === competition.winnerParticipantId);
  return (
    <div className="space-y-4">
      {competition.videoRecordingUrl ? (
        <a href={competition.videoRecordingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm underline">
          <Film className="h-4 w-4" />
          Watch recording
        </a>
      ) : (
        <div className="text-sm text-muted-foreground">Recording will appear here when available.</div>
      )}

      <div className="rounded-xl border p-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <div className="text-sm">
            {winner ? (
              <>
                Winner: <strong>{winner.dishTitle || `Chef ${winner.userId.slice(0, 6)}`}</strong>{" "}
                {competition.isOfficial ? <Badge className="ml-2">Official</Badge> : <Badge variant="secondary" className="ml-2">Exhibition</Badge>}
              </>
            ) : (
              "Results pending."
            )}
          </div>
        </div>
        <Separator className="my-3" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {participants
            .filter((p) => p.role === "competitor" || p.role === "host")
            .sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99))
            .map((p) => (
              <div key={p.id} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-medium">{p.dishTitle || `Chef ${p.userId.slice(0, 6)}`}</div>
                  {p.placement && <Badge>#{p.placement}</Badge>}
                </div>
                <div className="aspect-video w-full overflow-hidden rounded bg-muted">
                  {p.finalDishPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.finalDishPhotoUrl} alt={p.dishTitle ?? "dish"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No photo</div>
                  )}
                </div>
                {typeof p.totalScore === "number" && (
                  <div className="mt-2 text-xs text-muted-foreground">Total score: {p.totalScore}</div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// tiny icon
function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M6 3a1 1 0 0 0-1 1v16.5a1.5 1.5 0 1 0 2 0V14h6.382l1.447 1.341A2 2 0 0 0 17.764 16H21a1 1 0 1 0 0-2h-3.236l-2.211-2.05a2 2 0 0 0-1.353-.53H7V4a1 1 0 0 0-1-1Z" />
    </svg>
  );
}
