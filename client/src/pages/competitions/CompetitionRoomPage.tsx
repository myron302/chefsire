// client/src/pages/competitions/CompetitionRoomPage.tsx
import * as React from "react";

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
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  // Dev header for now:
  if (!headers.has("x-user-id")) headers.set("x-user-id", DEV_USER_ID);
  const resp = await fetch(path, { ...init, headers });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = (data && (data.error || data.message)) || `Request failed: ${resp.status}`;
    throw new Error(msg);
  }
  return data;
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

  const endCountdown = useCountdown(detail?.competition?.endTime ?? null);
  const judgingCountdown = useCountdown(detail?.competition?.judgingClosesAt ?? null);

  const isHost = React.useMemo(() => {
    if (!detail) return false;
    return (
      detail.participants.some(
        (p) => p.userId === DEV_USER_ID && p.role === "host"
      ) || detail.competition.creatorId === DEV_USER_ID
    );
  }, [detail]);

  const isCompetitor = React.useMemo(() => {
    if (!detail) return false;
    return detail.participants.some(
      (p) => p.userId === DEV_USER_ID && p.role === "competitor"
    );
  }, [detail]);

  async function reload() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const d = await api(`/api/competitions/${encodeURIComponent(id)}`);
      setDetail(d);
      // pick a participant for default voting dropdown
      const anyCompetitor = (d.participants as Participant[]).find(
        (p) => p.role === "competitor"
      );
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
    setError(null);
    try {
      await api(`/api/competitions/${encodeURIComponent(id)}/start`, {
        method: "POST",
      });
      await reload();
    } catch (e: any) {
      setError(e?.message || "Failed to start");
    }
  }

  async function handleEnd() {
    if (!id) return;
    setError(null);
    try {
      await api(`/api/competitions/${encodeURIComponent(id)}/end`, {
        method: "POST",
      });
      await reload();
    } catch (e: any) {
      setError(e?.message || "Failed to end");
    }
  }

  async function handleComplete() {
    if (!id) return;
    setError(null);
    try {
      await api(`/api/competitions/${encodeURIComponent(id)}/complete`, {
        method: "POST",
      });
      await reload();
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
        body: JSON.stringify({
          dishTitle,
          dishDescription,
          finalDishPhotoUrl,
        }),
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
    setError(null);
    try {
      await api(`/api/competitions/${encodeURIComponent(id)}/votes`, {
        method: "POST",
        body: JSON.stringify({
          participantId: voteParticipantId,
          presentation,
          creativity,
          technique,
        }),
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
    return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {detail?.competition?.title || "Competition Room"}
          </h1>
          <p className="text-sm text-gray-600">
            Theme: <span className="font-medium">{detail?.competition?.themeName || "—"}</span>
          </p>
          <p className="text-sm text-gray-600">
            Status:{" "}
            <span className="font-medium capitalize">
              {detail?.competition?.status || "—"}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Host actions */}
          {isHost && detail?.competition?.status === "upcoming" && (
            <button
              onClick={handleStart}
              className="px-4 py-2 rounded bg-black text-white"
            >
              Start Competition
            </button>
          )}
          {isHost && detail?.competition?.status === "live" && (
            <button
              onClick={handleEnd}
              className="px-4 py-2 rounded bg-black text-white"
            >
              End & Open Judging (24h)
            </button>
          )}
          {isHost && detail?.competition?.status === "judging" && (
            <button
              onClick={handleComplete}
              className="px-4 py-2 rounded bg-black text-white"
            >
              Finalize Results
            </button>
          )}
          {/* Video */}
          <button
            onClick={handleJoinVideo}
            className="px-4 py-2 rounded border"
          >
            Join Live Video
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-red-800">
          {error}
        </div>
      )}

      {/* Timers */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded border p-4">
          <div className="text-sm text-gray-600 mb-1">Ends At</div>
          <div className="font-mono">
            {detail?.competition?.endTime ? new Date(detail.competition.endTime).toLocaleString() : "—"}
          </div>
          {detail?.competition?.status === "live" && (
            <div className="text-sm text-gray-600 mt-1">Countdown: {endCountdown}</div>
          )}
        </div>
        <div className="rounded border p-4">
          <div className="text-sm text-gray-600 mb-1">Judging Closes</div>
          <div className="font-mono">
            {detail?.competition?.judgingClosesAt
              ? new Date(detail.competition.judgingClosesAt).toLocaleString()
              : "—"}
          </div>
          {detail?.competition?.status === "judging" && (
            <div className="text-sm text-gray-600 mt-1">Countdown: {judgingCountdown}</div>
          )}
        </div>
        <div className="rounded border p-4">
          <div className="text-sm text-gray-600 mb-1">Official?</div>
          <div className="font-mono">
            {detail?.competition?.isOfficial ? "Yes" : "No / TBD"}
          </div>
        </div>
      </div>

      {/* Video embed */}
      <div className="mt-6">
        {roomUrl ? (
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
            <div>Click “Join Live Video” to start or join the room</div>
          </div>
        )}
      </div>

      {/* Participants */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Participants</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(detail?.participants || []).map((p) => {
            const tally = detail?.voteTallies?.find((t) => t.participantId === p.id);
            return (
              <div key={p.id} className="rounded border p-4">
                <div className="text-sm text-gray-600">Role: {p.role}</div>
                <div className="font-semibold">{p.dishTitle || "—"}</div>
                {p.finalDishPhotoUrl ? (
                  <img
                    src={p.finalDishPhotoUrl}
                    alt={p.dishTitle || "dish"}
                    className="mt-2 w-full h-40 object-cover rounded"
                  />
                ) : (
                  <div className="mt-2 h-40 grid place-items-center text-gray-400 border rounded">
                    No photo yet
                  </div>
                )}
                <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                  {p.dishDescription || "—"}
                </div>
                <div className="mt-2 text-sm">
                  Voters: <span className="font-medium">{tally?.voters ?? 0}</span>
                </div>
                {typeof p.placement === "number" && (
                  <div className="mt-1 text-sm">
                    Placement: <span className="font-medium">#{p.placement}</span>
                  </div>
                )}
                {typeof p.totalScore === "number" && (
                  <div className="mt-1 text-sm">
                    Total Score: <span className="font-medium">{p.totalScore}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Submit dish (competitors) */}
      {(detail?.competition?.status === "live" || detail?.competition?.status === "judging") && (
        <div className="mt-10">
          <h2 className="text-xl font-semibold mb-2">Submit / Update Your Dish</h2>
          <form onSubmit={handleSubmitDish} className="rounded border p-4 grid gap-3 max-w-2xl">
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
            <div>
              <button
                type="submit"
                className="px-4 py-2 rounded bg-black text-white"
                disabled={!isCompetitor && !isHost}
                title={!isCompetitor && !isHost ? "Only competitors/host in this comp can submit" : ""}
              >
                Save Dish
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Voting (spectators only) */}
      {(detail?.competition?.status === "live" || detail?.competition?.status === "judging") && (
        <div className="mt-10">
          <h2 className="text-xl font-semibold mb-2">Vote</h2>
          <form onSubmit={handleVote} className="rounded border p-4 grid gap-3 max-w-2xl">
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
            <div>
              <button type="submit" className="px-4 py-2 rounded bg-black text-white">
                Submit Vote
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Note: participants in this competition cannot vote.
            </p>
          </form>
        </div>
      )}

      {/* Completed summary */}
      {detail?.competition?.status === "completed" && (
        <div className="mt-10 rounded border p-4">
          <h2 className="text-xl font-semibold mb-2">Results</h2>
          <p className="text-sm">
            Official:{" "}
            <span className="font-medium">
              {detail.competition.isOfficial ? "Yes" : "No"}
            </span>
          </p>
          <p className="text-sm">
            Winner Participant ID:{" "}
            <span className="font-mono">{detail.competition.winnerParticipantId || "—"}</span>
          </p>
        </div>
      )}

      {/* Loader */}
      {loading && (
        <div className="mt-6 text-gray-500">Loading…</div>
      )}
    </div>
  );
}
