// client/src/pages/competitions/CompetitionRoomPage.tsx
import * as React from "react";
import { useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type Participant = {
  id: string;
  competitionId: string;
  userId: string;
  role: "host" | "competitor" | "judge";
  dishTitle?: string | null;
  dishDescription?: string | null;
  finalDishPhotoUrl?: string | null;
  totalScore?: number | null;
  placement?: number | null;
};

type Vote = {
  id: string;
  competitionId: string;
  voterId: string;
  participantId: string;
  presentation: number;
  creativity: number;
  technique: number;
  createdAt: string;
};

type CompetitionDetail = {
  competition: {
    id: string;
    creatorId: string;
    title?: string | null;
    themeName?: string | null;
    status: "upcoming" | "live" | "judging" | "completed" | "canceled";
    isPrivate: boolean;
    timeLimitMinutes: number;
    minOfficialVoters: number;
    startTime?: string | null;
    endTime?: string | null;
    judgingClosesAt?: string | null;
    videoRecordingUrl?: string | null;
    isOfficial: boolean;
    winnerParticipantId?: string | null;
    createdAt: string;
    updatedAt: string;
  };
  participants: Participant[];
  voteTallies: { participantId: string; voters: number }[];
  media: any[];
};

function getDevUserId() {
  let id = localStorage.getItem("devUserId");
  if (!id) {
    id = `user-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem("devUserId", id);
  }
  return id;
}

async function fetchCompetition(id: string): Promise<CompetitionDetail> {
  const res = await fetch(`/api/competitions/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Failed to load competition (HTTP ${res.status})`);
  }
  return await res.json();
}

async function postJSON(path: string, body?: any) {
  const userId = getDevUserId();
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": userId },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Request failed: ${path} (HTTP ${res.status})`);
  }
  return await res.json();
}

function StatusBadge({ status }: { status: CompetitionDetail["competition"]["status"] }) {
  const color =
    status === "live" ? "bg-green-600" :
    status === "judging" ? "bg-amber-600" :
    status === "completed" ? "bg-gray-700" :
    status === "upcoming" ? "bg-blue-600" :
    "bg-gray-500";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs text-white ${color}`}>
      {status.toUpperCase()}
    </span>
  );
}

export default function CompetitionRoomPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id!;
  const qc = useQueryClient();

  const devUserId = getDevUserId();

  const { data, isLoading, error } = useQuery({
    queryKey: ["competition", id],
    queryFn: () => fetchCompetition(id),
    refetchOnWindowFocus: false,
  });

  const startMutation = useMutation({
    mutationFn: () => postJSON(`/api/competitions/${id}/start`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["competition", id] }),
  });
  const endMutation = useMutation({
    mutationFn: () => postJSON(`/api/competitions/${id}/end`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["competition", id] }),
  });
  const completeMutation = useMutation({
    mutationFn: () => postJSON(`/api/competitions/${id}/complete`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["competition", id] }),
  });
  const submitMutation = useMutation({
    mutationFn: (payload: { dishTitle?: string; dishDescription?: string; finalDishPhotoUrl?: string }) =>
      postJSON(`/api/competitions/${id}/submit`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competition", id] });
      setDishTitle("");
      setDishDescription("");
      setFinalDishPhotoUrl("");
    },
  });
  const voteMutation = useMutation({
    mutationFn: (payload: { participantId: string; presentation: number; creativity: number; technique: number }) =>
      postJSON(`/api/competitions/${id}/votes`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["competition", id] }),
  });

  const [dishTitle, setDishTitle] = React.useState("");
  const [dishDescription, setDishDescription] = React.useState("");
  const [finalDishPhotoUrl, setFinalDishPhotoUrl] = React.useState("");

  if (isLoading) {
    return <div className="p-6">Loading room…</div>;
  }
  if (error || !data) {
    return (
      <div className="p-6 text-red-600">
        {(error as any)?.message || "Failed to load room"}
      </div>
    );
  }

  const { competition, participants, voteTallies } = data;
  const myParticipant = participants.find((p) => p.userId === devUserId);
  const isCreator = competition.creatorId === devUserId;

  const votersByPid = new Map(voteTallies.map((v) => [v.participantId, v.voters]));
  const sortedParticipants = [...participants].sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {competition.title || `${competition.themeName || "Cookoff"}`}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
            <StatusBadge status={competition.status} />
            <span>Theme: <strong>{competition.themeName || "—"}</strong></span>
            <span>•</span>
            <span>Time limit: {competition.timeLimitMinutes}m</span>
            <span>•</span>
            <span>Min voters: {competition.minOfficialVoters}</span>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            You are <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">{devUserId}</span>
            {isCreator ? " (creator)" : myParticipant ? ` (participant: ${myParticipant.role})` : " (spectator)"}
          </div>
        </div>

        {isCreator && (
          <div className="flex gap-2">
            {competition.status === "upcoming" && (
              <button
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending}
                className="rounded bg-green-600 px-3 py-2 text-white disabled:opacity-50"
              >
                {startMutation.isPending ? "Starting…" : "Start"}
              </button>
            )}
            {competition.status === "live" && (
              <button
                onClick={() => endMutation.mutate()}
                disabled={endMutation.isPending}
                className="rounded bg-amber-600 px-3 py-2 text-white disabled:opacity-50"
              >
                {endMutation.isPending ? "Ending…" : "End → Judging"}
              </button>
            )}
            {competition.status === "judging" && (
              <button
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                className="rounded bg-gray-800 px-3 py-2 text-white disabled:opacity-50"
              >
                {completeMutation.isPending ? "Finalizing…" : "Finalize Results"}
              </button>
            )}
          </div>
        )}
      </header>

      {/* Participants */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Participants</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {sortedParticipants.map((p) => (
            <article key={p.id} className="rounded border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm text-gray-600">user: {p.userId}</div>
                  <div className="font-semibold">{p.dishTitle || <span className="text-gray-400">No submission yet</span>}</div>
                  {p.dishDescription ? (
                    <p className="mt-1 text-sm text-gray-700">{p.dishDescription}</p>
                  ) : null}
                </div>
                <div className="text-right">
                  {typeof p.totalScore === "number" && (
                    <div className="text-xl font-bold">{p.totalScore}</div>
                  )}
                  {typeof p.placement === "number" && (
                    <div className="text-xs text-gray-500">place: {p.placement}</div>
                  )}
                  <div className="text-xs text-gray-500">
                    voters: {votersByPid.get(p.id) ?? 0}
                  </div>
                </div>
              </div>
              {p.finalDishPhotoUrl && (
                <img
                  src={p.finalDishPhotoUrl}
                  alt={p.dishTitle || "dish image"}
                  className="mt-3 h-40 w-full rounded object-cover"
                />
              )}

              {/* Voting form for spectators during live/judging */}
              {(competition.status === "live" || competition.status === "judging") && !isCreator && (!myParticipant) && (
                <VoteForm
                  onVote={(vals) =>
                    voteMutation.mutate({
                      participantId: p.id,
                      presentation: vals.presentation,
                      creativity: vals.creativity,
                      technique: vals.technique,
                    })
                  }
                  isPending={voteMutation.isPending}
                />
              )}
            </article>
          ))}
        </div>
      </section>

      {/* Submit block for competitors (during live/judging) */}
      {(competition.status === "live" || competition.status === "judging") && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">Submit Your Dish</h2>
          <div className="rounded border p-4">
            {myParticipant ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitMutation.mutate({
                    dishTitle: dishTitle || undefined,
                    dishDescription: dishDescription || undefined,
                    finalDishPhotoUrl: finalDishPhotoUrl || undefined,
                  });
                }}
                className="grid gap-3"
              >
                <div>
                  <label className="block text-sm font-medium">Dish Title</label>
                  <input
                    value={dishTitle}
                    onChange={(e) => setDishTitle(e.target.value)}
                    className="mt-1 w-full rounded border px-3 py-2"
                    placeholder="e.g. Nonna’s Carbonara"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Description</label>
                  <textarea
                    value={dishDescription}
                    onChange={(e) => setDishDescription(e.target.value)}
                    className="mt-1 w-full rounded border px-3 py-2"
                    rows={3}
                    placeholder="What makes it special? Any twists?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Final Dish Photo URL</label>
                  <input
                    value={finalDishPhotoUrl}
                    onChange={(e) => setFinalDishPhotoUrl(e.target.value)}
                    className="mt-1 w-full rounded border px-3 py-2"
                    placeholder="https://…"
                  />
                </div>
                {submitMutation.error ? (
                  <div className="rounded bg-red-50 p-2 text-sm text-red-700">
                    {(submitMutation.error as any).message || "Submit failed"}
                  </div>
                ) : null}
                <div>
                  <button
                    disabled={submitMutation.isPending}
                    className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
                  >
                    {submitMutation.isPending ? "Saving…" : "Save Submission"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-sm text-gray-600">
                You’re a spectator. To submit a dish, join this competition as a participant (backend or future UI).
              </div>
            )}
          </div>
        </section>
      )}

      {/* Completed summary */}
      {competition.status === "completed" && (
        <section className="rounded border p-4">
          <h2 className="mb-2 text-lg font-semibold">Results</h2>
          {competition.winnerParticipantId ? (
            <div className="text-sm">
              Winner:{" "}
              <span className="font-mono bg-green-100 px-1 py-0.5 rounded">
                {competition.winnerParticipantId}
              </span>
              {sortedParticipants.find((p) => p.id === competition.winnerParticipantId)?.dishTitle
                ? ` — ${(sortedParticipants.find((p) => p.id === competition.winnerParticipantId) as any).dishTitle}`
                : ""}
            </div>
          ) : (
            <div className="text-sm text-gray-600">No winner recorded.</div>
          )}
          <div className="mt-3 text-xs text-gray-500">
            Official: {competition.isOfficial ? "Yes" : "No"}
          </div>
        </section>
      )}
    </div>
  );
}

function VoteForm({
  onVote,
  isPending,
}: {
  onVote: (vals: { presentation: number; creativity: number; technique: number }) => void;
  isPending: boolean;
}) {
  const [presentation, setPresentation] = React.useState(8);
  const [creativity, setCreativity] = React.useState(8);
  const [technique, setTechnique] = React.useState(8);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onVote({ presentation, creativity, technique });
      }}
      className="mt-4 grid grid-cols-3 items-end gap-3"
    >
      <div>
        <label className="block text-xs font-medium">Presentation</label>
        <input
          type="number"
          min={1}
          max={10}
          value={presentation}
          onChange={(e) => setPresentation(parseInt(e.target.value || "1", 10))}
          className="mt-1 w-full rounded border px-2 py-1"
        />
      </div>
      <div>
        <label className="block text-xs font-medium">Creativity</label>
        <input
          type="number"
          min={1}
          max={10}
          value={creativity}
          onChange={(e) => setCreativity(parseInt(e.target.value || "1", 10))}
          className="mt-1 w-full rounded border px-2 py-1"
        />
      </div>
      <div>
        <label className="block text-xs font-medium">Technique</label>
        <input
          type="number"
          min={1}
          max={10}
          value={technique}
          onChange={(e) => setTechnique(parseInt(e.target.value || "1", 10))}
          className="mt-1 w-full rounded border px-2 py-1"
        />
      </div>
      <div className="col-span-3">
        <button
          disabled={isPending}
          className="w-full rounded bg-indigo-600 px-3 py-2 text-white disabled:opacity-50"
        >
          {isPending ? "Submitting…" : "Submit Vote"}
        </button>
      </div>
    </form>
  );
}
