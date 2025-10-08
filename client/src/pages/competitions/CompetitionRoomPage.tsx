// client/src/pages/competitions/CompetitionRoomPage.tsx
import * as React from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sword,
  Users,
  Timer,
  Trophy,
  Film,
  Sparkles,
  ArrowLeft,
  Video,
  Eye,
  ShieldCheck,
  Camera,
  Image as ImageIcon,
  Star,
  Flame,
  CheckCircle2,
  Clock,
  Share2,
  Copy,
} from "lucide-react";

/** Utility: parse :id from /competitions/:id */
function useCompetitionId() {
  const [id, setId] = React.useState<string | null>(null);
  React.useEffect(() => {
    const m = window.location.pathname.match(/\/competitions\/([^/]+)/);
    setId(m ? decodeURIComponent(m[1]) : null);
  }, []);
  return id;
}

/** Utility: simple countdown text */
function useCountdown(target?: string | null) {
  const [text, setText] = React.useState<string>("");
  React.useEffect(() => {
    if (!target) {
      setText("");
      return;
    }
    const t = new Date(target).getTime();
    if (!isFinite(t)) return;
    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, t - now);
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      setText(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [target]);
  return text;
}

/** Types – mirror the API shapes we return from the server */
type Competition = {
  id: string;
  creatorId: string;
  title: string | null;
  themeName: string | null;
  recipeId: string | null;
  status: "upcoming" | "live" | "judging" | "completed" | "canceled";
  isPrivate: boolean;
  timeLimitMinutes: number;
  minOfficialVoters: number;
  startTime?: string | null;
  endTime?: string | null;
  judgingClosesAt?: string | null;
  videoRecordingUrl?: string | null;
  winnerParticipantId?: string | null;
  isOfficial?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type Participant = {
  id: string;
  competitionId: string;
  userId: string;
  role: "host" | "competitor" | "judge" | string;
  dishTitle?: string | null;
  dishDescription?: string | null;
  finalDishPhotoUrl?: string | null;
  totalScore?: number | null;
  placement?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

type VoteTally = {
  participantId: string;
  voters: number;
};

type CompetitionDetail = {
  competition: Competition;
  participants: Participant[];
  voteTallies: VoteTally[];
  media: any[];
};

/** Replace this once real auth is wired */
const DEV_USER_ID = "user-dev-1";

/** Fetch helper with x-user-id header while auth is WIP */
async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  if (!headers.has("x-user-id")) headers.set("x-user-id", DEV_USER_ID);
  const resp = await fetch(path, { ...init, headers });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = (data && (data.error || data.message)) || `Request failed: ${resp.status}`;
    throw new Error(msg);
  }
  return data;
}

/** Tiny confetti (no deps) */
function burstConfetti() {
  for (let i = 0; i < 80; i++) {
    const d = document.createElement("div");
    d.style.position = "fixed";
    d.style.top = "-10px";
    d.style.left = Math.random() * 100 + "vw";
    d.style.width = "8px";
    d.style.height = "14px";
    d.style.transform = `rotate(${Math.random() * 360}deg)`;
    d.style.background = `hsl(${Math.random() * 360}, 80%, 60%)`;
    d.style.zIndex = "9999";
    d.style.opacity = "0.9";
    d.style.borderRadius = "2px";
    d.style.pointerEvents = "none";
    document.body.appendChild(d);
    const endY = window.innerHeight + 30;
    const endX = (Math.random() - 0.5) * 120;
    const t = 1000 + Math.random() * 1000;
    d.animate(
      [
        { transform: d.style.transform, opacity: 0.9, offset: 0 },
        { transform: `translate(${endX}px, ${endY}px) rotate(${Math.random() * 720}deg)`, opacity: 0, offset: 1 },
      ],
      { duration: t, easing: "cubic-bezier(.17,.67,.83,.67)" }
    ).onfinish = () => d.remove();
  }
}

export default function CompetitionRoomPage() {
  const id = useCompetitionId();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<CompetitionDetail | null>(null);
  const [roomUrl, setRoomUrl] = React.useState<string | null>(null);

  // dish form (for competitors)
  const [dishTitle, setDishTitle] = React.useState("");
  const [dishDescription, setDishDescription] = React.useState("");
  const [finalDishPhotoUrl, setFinalDishPhotoUrl] = React.useState("");

  // vote form (for spectators)
  const [voteParticipantId, setVoteParticipantId] = React.useState("");
  const [presentation, setPresentation] = React.useState(8);
  const [creativity, setCreativity] = React.useState(8);
  const [technique, setTechnique] = React.useState(8);

  // simple, local “anti-spam” rate-limit (client-side only)
  const lastVoteRef = React.useRef<number>(0);

  const endCountdown = useCountdown(detail?.competition?.endTime ?? null);
  const judgingCountdown = useCountdown(detail?.competition?.judgingClosesAt ?? null);

  const isHost = React.useMemo(() => {
    if (!detail) return false;
    return (
      detail.participants.some((p) => p.userId === DEV_USER_ID && p.role === "host") ||
      detail.competition.creatorId === DEV_USER_ID
    );
  }, [detail]);

  const isCompetitor = React.useMemo(() => {
    if (!detail) return false;
    return detail.participants.some((p) => p.userId === DEV_USER_ID && p.role === "competitor");
  }, [detail]);

  async function reload() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const d = await api(`/api/competitions/${encodeURIComponent(id)}`);
      setDetail(d);
      const anyCompetitor = (d.participants as Participant[]).find((p) => p.role === "competitor");
      if (anyCompetitor) setVoteParticipantId(anyCompetitor.id);
    } catch (e: any) {
      setError(e?.message || "Failed to load competition");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleStart() {
    if (!id) return;
    if (!confirm("Start competition now? The timer will begin.")) return;
    setError(null);
    try {
      await api(`/api/competitions/${encodeURIComponent(id)}/start`, { method: "POST" });
      await reload();
    } catch (e: any) {
      setError(e?.message || "Failed to start");
    }
  }

  async function handleEnd() {
    if (!id) return;
    if (!confirm("End cooking and open the 24-hour judging window?")) return;
    setError(null);
    try {
      await api(`/api/competitions/${encodeURIComponent(id)}/end`, { method: "POST" });
      await reload();
    } catch (e: any) {
      setError(e?.message || "Failed to end");
    }
  }

  async function handleComplete() {
    if (!id) return;
    if (!confirm("Finalize results now? This will publish placements and lock voting.")) return;
    setError(null);
    try {
      await api(`/api/competitions/${encodeURIComponent(id)}/complete`, { method: "POST" });
      await reload();
      burstConfetti();
    } catch (e: any) {
      setError(e?.message || "Failed to complete");
    }
  }

  async function handleSubmitDish(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    try {
      await api(`/api/competitions/${encodeURIComponent(id)}/submit`, {
        method: "POST",
        body: JSON.stringify({ dishTitle, dishDescription, finalDishPhotoUrl }),
      });
      setDishTitle("");
      setDishDescription("");
      setFinalDishPhotoUrl("");
      await reload();
    } catch (e: any) {
      setError(e?.message || "Failed to submit dish");
    }
  }

  async function handleVote(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    const now = Date.now();
    if (now - lastVoteRef.current < 3500) {
      setError("Easy there! Please wait a few seconds between votes.");
      return;
    }
    lastVoteRef.current = now;
    setError(null);
    try {
      await api(`/api/competitions/${encodeURIComponent(id)}/votes`, {
        method: "POST",
        body: JSON.stringify({ participantId: voteParticipantId, presentation, creativity, technique }),
      });
      await reload();
    } catch (e: any) {
      setError(e?.message || "Failed to vote");
    }
  }

  async function handleJoinVideo() {
    if (!id) return;
    setError(null);
    try {
      const data = await api(`/api/competitions/${encodeURIComponent(id)}/video-room`, {
        method: "POST",
        body: JSON.stringify({ privacy: "public" }),
      });
      setRoomUrl(data.roomUrl);
    } catch (e: any) {
      setRoomUrl(null);
      setError(
        e?.message ||
          "Video room not available. Make sure DAILY_API_KEY and DAILY_SUBDOMAIN are set in your server environment."
      );
    }
  }

  function copyInvite() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(
      () => alert("Invite link copied!"),
      () => alert("Copy failed — you can manually share the URL.")
    );
  }

  const statusColor =
    detail?.competition?.status === "live"
      ? "bg-green-600"
      : detail?.competition?.status === "judging"
      ? "bg-amber-500"
      : detail?.competition?.status === "completed"
      ? "bg-blue-600"
      : "bg-neutral-600";

  const isLoadingSkeleton = loading && !detail;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-rose-50 to-purple-50">
      {/* HERO */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-fuchsia-700 via-purple-800 to-rose-700" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-pink-400/20 blur-3xl rounded-full" />
        <div className="absolute -bottom-24 -left-24 w-[32rem] h-[32rem] bg-purple-400/20 blur-3xl rounded-full" />

        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex items-start justify-between gap-4">
            <div className="text-white">
              <Link href="/explore">
                <Button variant="ghost" className="text-white mb-3 hover:bg-white/20">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              </Link>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-white/15 rounded-2xl backdrop-blur">
                  <Sword className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                    {detail?.competition?.title || (isLoadingSkeleton ? "Loading…" : "ChefSire Cookoff")}
                  </h1>
                  <p className="text-purple-100">
                    Theme: <span className="font-semibold">{detail?.competition?.themeName || (isLoadingSkeleton ? "…" : "—")}</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge className={`${statusColor} text-white`}>{detail?.competition?.status ?? "—"}</Badge>
                {detail?.competition?.isPrivate && (
                  <Badge variant="outline" className="border-white/50 text-white/90">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Private
                  </Badge>
                )}
                <Badge variant="outline" className="border-white/50 text-white/90">
                  <Timer className="w-3.5 h-3.5 mr-1" />
                  {detail?.competition?.timeLimitMinutes ?? 60} min limit
                </Badge>
                <Badge variant="outline" className="border-white/50 text-white/90">
                  <Users className="w-3.5 h-3.5 mr-1" />
                  {detail?.participants?.length ?? 0} participants
                </Badge>
                <Button onClick={copyInvite} size="sm" variant="secondary" className="ml-2 bg-white text-fuchsia-800">
                  <Share2 className="w-4 h-4 mr-1" />
                  Share
                </Button>
              </div>
            </div>

            {/* Host actions */}
            <div className="flex flex-col gap-2">
              {isHost && detail?.competition?.status === "upcoming" && (
                <Button onClick={handleStart} className="bg-green-500 hover:bg-green-600 text-white">
                  <Flame className="mr-2 h-4 w-4" />
                  Start Competition
                </Button>
              )}
              {isHost && detail?.competition?.status === "live" && (
                <Button onClick={handleEnd} className="bg-amber-500 hover:bg-amber-600 text-white">
                  <Clock className="mr-2 h-4 w-4" />
                  End & Open Judging (24h)
                </Button>
              )}
              {isHost && detail?.competition?.status === "judging" && (
                <Button onClick={handleComplete} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Finalize Results
                </Button>
              )}

              <Button onClick={handleJoinVideo} variant="secondary" className="bg-white text-fuchsia-800">
                <Video className="mr-2 h-4 w-4" />
                Join Live Video
              </Button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <Card className="bg-white/10 border-white/20 text-white backdrop-blur hover:bg-white/15 transition">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-purple-100">Time Remaining</span>
                  <Timer className="w-4 h-4" />
                </div>
                <div className="text-2xl mt-2 font-bold">
                  {detail?.competition?.status === "live" ? endCountdown || "—" : "—"}
                </div>
                <Progress
                  value={
                    detail?.competition?.status === "live" && detail?.competition?.endTime && detail?.competition?.startTime
                      ? Math.max(
                          0,
                          Math.min(
                            100,
                            100 -
                              ((Date.now() - new Date(detail.competition.startTime).getTime()) /
                                (new Date(detail.competition.endTime).getTime() -
                                  new Date(detail.competition.startTime).getTime())) *
                                100
                          )
                        )
                      : 0
                  }
                  className="mt-3"
                />
              </CardContent>
            </Card>

            <Card className="bg-white/10 border-white/20 text-white backdrop-blur hover:bg-white/15 transition">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-purple-100">Judging Window</span>
                  <Eye className="w-4 h-4" />
                </div>
                <div className="text-2xl mt-2 font-bold">
                  {detail?.competition?.status === "judging" ? judgingCountdown || "—" : "—"}
                </div>
                <p className="text-xs text-purple-100 mt-2">
                  Minimum voters: {detail?.competition?.minOfficialVoters ?? 3}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/10 border-white/20 text-white backdrop-blur hover:bg-white/15 transition">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-purple-100">Official Status</span>
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="text-2xl mt-2 font-bold">
                  {detail?.competition?.isOfficial ? "Official" : "TBD"}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 border-white/20 text-white backdrop-blur hover:bg-white/15 transition">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-purple-100">Recording</span>
                  <Film className="w-4 h-4" />
                </div>
                <div className="text-2xl mt-2 font-bold">
                  {detail?.competition?.videoRecordingUrl ? "Available" : "—"}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 mt-6">
          <div className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Video + Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 overflow-hidden hover:shadow-xl transition-transform hover:-translate-y-[2px]">
            <div className="bg-gradient-to-r from-fuchsia-50 to-rose-50 border-b p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-fuchsia-600" />
                <span className="text-sm font-medium">Live Room</span>
              </div>
              <Badge variant="outline" className="text-xs">
                Prebuilt UI (Daily)
              </Badge>
            </div>
            <CardContent className="p-4">
              {isLoadingSkeleton ? (
                <div className="w-full aspect-video rounded border animate-pulse bg-gray-100" />
              ) : roomUrl ? (
                <div className="w-full aspect-video rounded overflow-hidden border">
                  <iframe
                    src={`${roomUrl}?embed=1&autojoin=1`}
                    allow="camera; microphone; display-capture; autoplay; clipboard-read; clipboard-write"
                    allowFullScreen
                    title="ChefSire Live Room"
                    className="w-full h-full"
                  />
                </div>
              ) : (
                <div className="w-full aspect-video rounded border grid place-items-center text-gray-500">
                  <div className="flex flex-col items-center">
                    <Video className="mb-2 h-6 w-6" />
                    Click “Join Live Video” to start or join the room
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden hover:shadow-xl transition-transform hover:-translate-y-[2px]">
            <div className="bg-gradient-to-r from-purple-50 to-rose-50 border-b p-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium">Competition Info</span>
            </div>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Theme</span>
                <Badge>{detail?.competition?.themeName || (isLoadingSkeleton ? "…" : "—")}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Recipe</span>
                <span className="font-mono text-xs">{detail?.competition?.recipeId || "—"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Created</span>
                <span>
                  {detail?.competition?.createdAt ? new Date(detail.competition.createdAt).toLocaleString() : "—"}
                </span>
              </div>
              {detail?.competition?.winnerParticipantId && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Winner</span>
                  <span className="font-mono">{detail.competition.winnerParticipantId}</span>
                </div>
              )}
              <div className="pt-2">
                <Button onClick={copyInvite} variant="outline" className="w-full">
                  <Copy className="w-4 h-4 mr-2" /> Copy Invite Link
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Participants */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-50 to-pink-50 border-b p-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium">Participants</span>
            </div>
            <CardContent className="p-4">
              {isLoadingSkeleton ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded border p-3 animate-pulse bg-gray-50 h-64" />
                  ))}
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(detail?.participants || []).map((p) => {
                    const tally = detail?.voteTallies?.find((t) => t.participantId === p.id);
                    const place = typeof p.placement === "number" ? p.placement : null;
                    const placeBadge =
                      place === 1
                        ? "bg-yellow-500 text-white"
                        : place === 2
                        ? "bg-gray-400 text-white"
                        : place === 3
                        ? "bg-amber-700 text-white"
                        : "bg-gray-100 text-gray-700";

                    const isWinner =
                      detail?.competition?.status === "completed" &&
                      detail?.competition?.winnerParticipantId === p.id;

                    return (
                      <Card
                        key={p.id}
                        className="relative overflow-hidden hover:shadow-lg transition-transform hover:-translate-y-[2px]"
                      >
                        {isWinner && (
                          <div className="absolute top-2 left-[-50px] rotate-[-30deg] bg-yellow-400 text-yellow-900 text-xs font-bold px-12 py-1 shadow">
                            WINNER
                          </div>
                        )}
                        <div className="p-3 border-b flex items-center justify-between">
                          <div className="text-xs text-gray-600 capitalize">{p.role}</div>
                          {place && (
                            <Badge className={`${placeBadge} text-xs`}>
                              <Trophy className="w-3 h-3 mr-1" />
                              #{place}
                            </Badge>
                          )}
                        </div>
                        <CardContent className="p-3">
                          <div className="font-semibold text-sm">{p.dishTitle || "Untitled Dish"}</div>
                          {p.finalDishPhotoUrl ? (
                            <img
                              src={p.finalDishPhotoUrl}
                              alt={p.dishTitle || "dish"}
                              className="mt-2 w-full h-36 object-cover rounded"
                            />
                          ) : (
                            <div className="mt-2 h-36 grid place-items-center text-gray-400 border rounded">
                              <ImageIcon className="w-5 h-5" />
                            </div>
                          )}
                          <div className="mt-2 text-xs text-gray-700 whitespace-pre-wrap line-clamp-4">
                            {p.dishDescription || "No description yet."}
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs">
                            <span className="text-gray-600">Voters</span>
                            <span className="font-medium">{tally?.voters ?? 0}</span>
                          </div>
                          {typeof p.totalScore === "number" && (
                            <div className="mt-1 flex items-center justify-between text-xs">
                              <span className="text-gray-600">Total Score</span>
                              <span className="font-medium">{p.totalScore}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions: Submit Dish / Vote */}
          <div className="space-y-6">
            {(detail?.competition?.status === "live" || detail?.competition?.status === "judging") && (
              <Card className="overflow-hidden">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-b p-3 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-emerald-700" />
                  <span className="text-sm font-medium">Submit / Update Your Dish</span>
                </div>
                <CardContent className="p-4">
                  <form onSubmit={handleSubmitDish} className="grid gap-3">
                    <div>
                      <label className="block text-sm mb-1">Dish Title</label>
                      <input
                        value={dishTitle}
                        onChange={(e) => setDishTitle(e.target.value)}
                        className="w-full border rounded px-3 py-2"
                        placeholder="e.g., Lemon Ricotta Gnocchi"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Dish Description</label>
                      <textarea
                        value={dishDescription}
                        onChange={(e) => setDishDescription(e.target.value)}
                        className="w-full border rounded px-3 py-2 min-h-[100px]"
                        placeholder="Describe technique, flavors, and plating."
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Final Dish Photo URL</label>
                      <input
                        value={finalDishPhotoUrl}
                        onChange={(e) => setFinalDishPhotoUrl(e.target.value)}
                        className="w-full border rounded px-3 py-2"
                        placeholder="https://…"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={!isCompetitor && !isHost}
                      title={!isCompetitor && !isHost ? "Only competitors/host in this comp can submit" : ""}
                    >
                      Save Dish
                    </Button>
                    {!isCompetitor && !isHost && (
                      <p className="text-xs text-gray-500">Only competitors/host in this room can submit dishes.</p>
                    )}
                  </form>
                </CardContent>
              </Card>
            )}

            {(detail?.competition?.status === "live" || detail?.competition?.status === "judging") && (
              <Card className="overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border-b p-3 flex items-center gap-2">
                  <Star className="w-4 h-4 text-indigo-700" />
                  <span className="text-sm font-medium">Vote (Spectators)</span>
                </div>
                <CardContent className="p-4">
                  <form onSubmit={handleVote} className="grid gap-3">
                    <div>
                      <label className="block text-sm mb-1">Participant</label>
                      <select
                        value={voteParticipantId}
                        onChange={(e) => setVoteParticipantId(e.target.value)}
                        className="w-full border rounded px-3 py-2"
                      >
                        {(detail?.participants || [])
                          .filter((p) => p.role === "competitor")
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.dishTitle ? `${p.dishTitle} (${p.userId.slice(0, 6)})` : `${p.userId.slice(0, 6)}`}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <label className="block">
                        <span className="text-sm">Presentation: {presentation}</span>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          value={presentation}
                          onChange={(e) => setPresentation(Number(e.target.value))}
                          className="w-full"
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm">Creativity: {creativity}</span>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          value={creativity}
                          onChange={(e) => setCreativity(Number(e.target.value))}
                          className="w-full"
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm">Technique: {technique}</span>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          value={technique}
                          onChange={(e) => setTechnique(Number(e.target.value))}
                          className="w-full"
                        />
                      </label>
                    </div>
                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                      Submit Vote
                    </Button>
                    <p className="text-xs text-gray-500">Note: participants in this competition cannot vote.</p>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Completed summary */}
            {detail?.competition?.status === "completed" && (
              <Card className="overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b p-3 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-blue-700" />
                  <span className="text-sm font-medium">Results</span>
                </div>
                <CardContent className="p-4">
                  <div className="grid gap-2 text-sm">
                    <div>
                      Official:{" "}
                      <span className="font-medium">{detail.competition.isOfficial ? "Yes" : "No"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      Winner Participant ID:
                      <Badge variant="outline" className="font-mono">
                        {detail.competition.winnerParticipantId || "—"}
                      </Badge>
                    </div>
                    <div className="pt-2">
                      <Link href="/competitions/library">
                        <Button variant="secondary">View Library / Replays</Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* FOOTER CTA */}
      <div className="bg-gradient-to-r from-purple-600 to-rose-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5" /> Want to start your own Cookoff?
            </div>
            <p className="text-purple-200 text-sm">
              Pick a theme, set a timer, and invite friends or the whole community.
            </p>
          </div>
          <Link href="/competitions/new">
            <Button variant="secondary" className="bg-white text-purple-700 hover:bg-white/90">
              Create Competition
            </Button>
          </Link>
        </div>
      </div>

      {/* Loader */}
      {loading && <div className="fixed bottom-4 right-4 rounded bg-black/80 text-white px-3 py-2">Loading…</div>}
    </div>
  );
}
