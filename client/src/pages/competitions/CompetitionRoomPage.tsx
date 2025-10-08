// client/src/pages/competitions/CompetitionRoomPage.tsx
import * as React from "react";
import { useLocation } from "wouter";

export default function CompetitionRoomPage() {
  const [, params] = useLocation(); // wouter gives us pathname, not params; we’ll parse it
  const [roomId, setRoomId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [roomUrl, setRoomUrl] = React.useState<string | null>(null);

  // extract :id from /competitions/:id
  React.useEffect(() => {
    const match = window.location.pathname.match(/\/competitions\/([^/]+)/);
    setRoomId(match ? match[1] : null);
  }, []);

  async function createOrGetVideoRoom() {
    if (!roomId) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/competitions/${encodeURIComponent(roomId)}/video-room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // For now, if your backend uses x-user-id, include it here while auth is WIP:
          "x-user-id": "user-dev-1",
        },
        body: JSON.stringify({ privacy: "public" }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data?.error || "Failed to create video room");
      } else {
        setRoomUrl(data.roomUrl);
      }
    } catch (e: any) {
      setError(e?.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Competition Room</h1>
        <div className="flex gap-2">
          <button
            onClick={createOrGetVideoRoom}
            disabled={loading || !roomId}
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          >
            {loading ? "Preparing Video…" : "Join Live Video"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-red-800">
          {error}
        </div>
      )}

      {/* Video area */}
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
          <div>Click “Join Live Video” to start the room</div>
        </div>
      )}

      {/* You can keep your existing scoreboard / chat / submissions UI below */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">Live Chat & Scores</h2>
        <div className="rounded border p-4 text-gray-500">
          Coming next: real-time chat and scoreboard.
        </div>
      </div>
    </div>
  );
}
