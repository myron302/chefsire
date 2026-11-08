import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { Users, Timer, Trophy, Star, Flame, Share2, Crown, Award, Target, Video, ArrowLeft, Send } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { roomAffordances } from './competition-room-rules';

type Competition = {
  id: string;
  creatorId: string;
  title: string | null;
  themeName: string | null;
  status: 'upcoming' | 'live' | 'judging' | 'completed' | 'canceled' | string;
  isPrivate: boolean;
  timeLimitMinutes: number;
  minOfficialVoters: number;
  startTime: string | null;
  endTime: string | null;
  winnerParticipantId: string | null;
};

type Participant = {
  id: string;
  userId: string;
  role: string;
  dishTitle: string | null;
  dishDescription: string | null;
  finalDishPhotoUrl: string | null;
  totalScore: number | null;
  placement: number | null;
};

type Detail = {
  competition: Competition;
  participants: Participant[];
  voteTallies: { participantId: string; voters: number }[];
};

type PublicUser = { id: string; username?: string; displayName?: string | null; avatar?: string | null };

const STATUS_STYLE: Record<string, string> = {
  upcoming: 'bg-gray-600',
  live: 'bg-red-500',
  judging: 'bg-amber-500',
  completed: 'bg-purple-600',
  canceled: 'bg-gray-400',
};

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  return data;
}

export default function CompetitionRoomPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useUser();

  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  const [people, setPeople] = useState<Record<string, PublicUser>>({});
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [dishTitle, setDishTitle] = useState('');
  const [dishDescription, setDishDescription] = useState('');

  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [presentation, setPresentation] = useState(8);
  const [creativity, setCreativity] = useState(8);
  const [technique, setTechnique] = useState(8);
  const [confetti, setConfetti] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/competitions/${encodeURIComponent(id)}`, { credentials: 'include' });
      if (res.status === 404) {
        setLoadState('notfound');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Detail = await res.json();
      setDetail(data);
      setLoadState('ready');
    } catch {
      setLoadState((prev) => (prev === 'ready' ? prev : 'error'));
    }
  }, [id]);

  useEffect(() => {
    load();
    const refresh = setInterval(load, 15000);
    return () => clearInterval(refresh);
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Resolve display names for the creator and participants (public profile data only).
  useEffect(() => {
    if (!detail) return;
    const ids = Array.from(new Set([detail.competition.creatorId, ...detail.participants.map((p) => p.userId)]));
    const missing = ids.filter((uid) => uid && !people[uid]);
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map((uid) =>
        fetch(`/api/users/${encodeURIComponent(uid)}`, { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    ).then((rows) => {
      if (cancelled) return;
      setPeople((prev) => {
        const next = { ...prev };
        missing.forEach((uid, i) => {
          next[uid] = rows[i] || { id: uid };
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [detail, people]);

  const comp = detail?.competition;
  const isHost = !!user && !!comp && user.id === comp.creatorId;
  const myEntry = detail?.participants.find((p) => p.userId === user?.id);
  const competitors = useMemo(() => (detail?.participants ?? []).filter((p) => p.role !== 'host' || p.dishTitle), [detail]);
  const tallies = useMemo(() => {
    const map: Record<string, number> = {};
    (detail?.voteTallies ?? []).forEach((t) => {
      map[t.participantId] = Number(t.voters) || 0;
    });
    return map;
  }, [detail]);

  const secondsLeft =
    comp?.status === 'live' && comp.endTime ? Math.max(0, Math.floor((new Date(comp.endTime).getTime() - now) / 1000)) : null;

  const nameOf = (uid: string) => {
    const p = people[uid];
    return p?.displayName || p?.username || 'Chef';
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  };

  const run = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await fn();
      if (success) setNotice(success);
      await load();
    } catch (err: any) {
      setActionError(err?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const requireSignIn = () => {
    setLocation(`/login?next=${encodeURIComponent(`/competitions/${id}`)}`);
  };

  const submitDish = () => {
    if (!user) return requireSignIn();
    run(
      () =>
        postJson(`/api/competitions/${id}/submit`, {
          dishTitle: dishTitle.trim() || undefined,
          dishDescription: dishDescription.trim() || undefined,
        }),
      myEntry ? 'Your dish was updated.' : "You're in! Good luck."
    );
  };

  const castVote = () => {
    if (!user) return requireSignIn();
    if (!selectedParticipant) return;
    run(async () => {
      await postJson(`/api/competitions/${id}/votes`, { participantId: selectedParticipant, presentation, creativity, technique });
      setConfetti(true);
      setTimeout(() => setConfetti(false), 2500);
    }, 'Vote recorded.');
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: comp?.title || 'ChefSire Cookoff', url });
      else {
        await navigator.clipboard.writeText(url);
        setNotice('Link copied.');
      }
    } catch {
      /* user dismissed */
    }
  };

  if (loadState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-200 via-purple-200 to-pink-200 flex items-center justify-center">
        <p className="text-gray-800 font-semibold" role="status">Loading competition…</p>
      </div>
    );
  }

  if (loadState !== 'ready' || !comp) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-200 via-purple-200 to-pink-200 flex items-center justify-center px-4">
        <div className="bg-white/90 rounded-3xl p-10 text-center shadow-xl max-w-md">
          <p className="text-xl font-bold text-gray-900 mb-2">
            {loadState === 'notfound' ? "This competition doesn't exist or is private." : "This competition couldn't load right now."}
          </p>
          <button
            onClick={() => setLocation('/competitions')}
            className="mt-4 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-white font-semibold shadow-md"
          >
            Back to Cookoff Arena
          </button>
        </div>
      </div>
    );
  }

  const status = comp.status;
  const rules = roomAffordances({
    status,
    signedIn: !!user,
    isHost,
    hasEntry: !!myEntry,
    competitorCount: competitors.length,
  });
  const { canSubmit, canVote } = rules;
  const ranked = status === 'completed'
    ? [...competitors].sort((a, b) => (a.placement ?? 999) - (b.placement ?? 999))
    : competitors;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-200 via-purple-200 to-pink-200 relative overflow-hidden">
      {confetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {[...Array(40)].map((_, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                left: `${(i * 37) % 100}%`,
                top: '-10px',
                width: '10px',
                height: '10px',
                background: `hsl(${(i * 47) % 360}, 80%, 60%)`,
                animation: `fall ${2 + (i % 5) * 0.4}s linear`,
              }}
            />
          ))}
        </div>
      )}
      <style>{`@keyframes fall { to { transform: translateY(100vh) rotate(720deg); } }`}</style>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setLocation('/competitions')}
              className="p-3 bg-white hover:bg-gray-50 rounded-full border-2 border-gray-300 shadow-md"
              aria-label="Back to Cookoff Arena"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className={`px-4 py-2 ${STATUS_STYLE[status] || 'bg-gray-600'} rounded-full flex items-center gap-2 text-white font-bold shadow-lg`}>
              {status === 'live' && <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>}
              {String(status).toUpperCase()}
            </div>
            <div className="px-4 py-2 bg-white/90 rounded-full text-gray-900 font-semibold border-2 border-gray-300 shadow-md">
              <Users className="inline w-4 h-4 mr-2" />
              {competitors.length} Competing
            </div>
          </div>

          {secondsLeft !== null && (
            <div className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl border-2 border-white/30 shadow-2xl flex items-center gap-3">
              <Timer className="w-6 h-6 text-white" />
              <div className="text-3xl font-black text-white tabular-nums">{formatTime(secondsLeft)}</div>
              <Flame className="w-6 h-6 text-yellow-300" />
            </div>
          )}

          <button
            onClick={share}
            className="p-3 bg-white hover:bg-gray-50 rounded-full border-2 border-gray-300 shadow-md"
            aria-label="Share competition"
          >
            <Share2 className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-1">{comp.title || 'Untitled Cookoff'}</h1>
        <p className="text-gray-800 font-medium mb-6">Hosted by {nameOf(comp.creatorId)}</p>

        {(actionError || notice) && (
          <div
            className={`mb-6 rounded-2xl px-4 py-3 font-medium ${actionError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}
            role="status"
          >
            {actionError || notice}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Host controls */}
            {rules.hostAction && (
              <div className="bg-white border-2 border-gray-300 rounded-3xl p-6 shadow-xl">
                <h2 className="text-lg font-bold text-gray-900 mb-2">Host controls</h2>
                <p className="text-gray-700 text-sm mb-4">
                  {status === 'upcoming' && `Start the battle to open entries. The clock runs for ${comp.timeLimitMinutes} minutes.`}
                  {status === 'live' && 'End cooking to open judging.'}
                  {status === 'judging' && 'Finalize results once enough votes are in.'}
                </p>
                <button
                  disabled={busy}
                  onClick={() => {
                    const action = rules.hostAction!;
                    run(() => postJson(`/api/competitions/${id}/${action.endpoint}`), action.success);
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-white font-bold shadow-lg disabled:opacity-50"
                >
                  {rules.hostAction.label}
                </button>
              </div>
            )}

            {/* Upcoming: entries open when the host starts */}
            {rules.waitingForHost && (
              <div className="bg-white/90 border-2 border-gray-300 rounded-3xl p-6 shadow-xl">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Waiting for the host to start</h2>
                <p className="text-gray-700 text-sm">Entries open as soon as {nameOf(comp.creatorId)} starts the battle. This page updates automatically.</p>
              </div>
            )}

            {/* Join / submit dish */}
            {(canSubmit || rules.promptSignInToCompete) && (
              <div className="bg-white border-2 border-gray-300 rounded-3xl p-6 shadow-xl">
                <h2 className="text-lg font-bold text-gray-900 mb-3">{myEntry ? 'Your dish' : 'Join this battle'}</h2>
                {!user ? (
                  <button onClick={requireSignIn} className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-full text-white font-bold shadow-lg">
                    Sign in to compete
                  </button>
                ) : (
                  <div className="space-y-3">
                    <input
                      value={dishTitle}
                      onChange={(e) => setDishTitle(e.target.value)}
                      maxLength={200}
                      placeholder={myEntry?.dishTitle || "What are you cooking?"}
                      className="w-full rounded-xl border-2 border-gray-300 px-4 py-3"
                      aria-label="Dish name"
                    />
                    <textarea
                      value={dishDescription}
                      onChange={(e) => setDishDescription(e.target.value)}
                      maxLength={4000}
                      rows={3}
                      placeholder={myEntry?.dishDescription || 'Describe your dish (optional)'}
                      className="w-full rounded-xl border-2 border-gray-300 px-4 py-3"
                      aria-label="Dish description"
                    />
                    <button
                      disabled={busy}
                      onClick={submitDish}
                      className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-full text-white font-bold shadow-lg disabled:opacity-50"
                    >
                      <Send className="inline w-4 h-4 mr-2" />
                      {myEntry ? 'Update my dish' : 'Join & submit dish'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Competitors */}
            {ranked.length === 0 ? (
              <div className="bg-white/90 border-2 border-gray-300 rounded-3xl p-8 text-center shadow-lg">
                <p className="text-gray-900 font-bold text-lg">No competitors yet.</p>
                <p className="text-gray-700">Share the link to invite chefs to this battle.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {ranked.map((p) => {
                  const place = status === 'completed' ? p.placement : null;
                  const selectable = canVote;
                  return (
                    <button
                      type="button"
                      key={p.id}
                      disabled={!selectable}
                      onClick={() => selectable && setSelectedParticipant(p.id)}
                      className={`relative text-left bg-white border-2 rounded-2xl p-4 shadow-lg transition-all ${
                        selectedParticipant === p.id ? 'border-purple-500 shadow-2xl' : 'border-gray-300'
                      } ${selectable ? 'hover:scale-[1.02] cursor-pointer' : 'cursor-default'}`}
                    >
                      {place && place <= 3 && (
                        <div className="absolute -top-3 -right-3 p-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full shadow-lg">
                          {place === 1 ? <Crown className="w-5 h-5 text-white" /> : place === 2 ? <Award className="w-5 h-5 text-white" /> : <Target className="w-5 h-5 text-white" />}
                        </div>
                      )}
                      {p.finalDishPhotoUrl && (
                        <img src={p.finalDishPhotoUrl} alt={p.dishTitle || 'Dish'} className="w-full h-40 object-cover rounded-xl mb-3" loading="lazy" />
                      )}
                      <div className="font-bold text-gray-900">{nameOf(p.userId)}</div>
                      <div className="text-sm text-gray-700 font-medium mb-2">{p.dishTitle || 'Dish to be revealed'}</div>
                      <div className="flex items-center justify-between text-sm">
                        {typeof p.totalScore === 'number' && (
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            <span className="font-bold text-gray-900">{p.totalScore}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-gray-700 font-medium">
                          <Users className="w-4 h-4" />
                          <span>{tallies[p.id] ?? 0} votes</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Voting */}
            {canVote && (
              <div className="bg-white border-2 border-gray-300 rounded-3xl p-6 shadow-xl">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Cast your vote</h2>
                <p className="text-gray-700 text-sm mb-4">
                  {selectedParticipant ? `Scoring ${nameOf(ranked.find((p) => p.id === selectedParticipant)?.userId || '')}` : 'Tap a competitor above to score their dish.'}
                </p>
                {[
                  { label: 'Presentation', value: presentation, set: setPresentation },
                  { label: 'Creativity', value: creativity, set: setCreativity },
                  { label: 'Technique', value: technique, set: setTechnique },
                ].map((s) => (
                  <label key={s.label} className="block mb-3">
                    <div className="flex justify-between text-sm font-semibold text-gray-800">
                      <span>{s.label}</span>
                      <span>{s.value}/10</span>
                    </div>
                    <input type="range" min={1} max={10} value={s.value} onChange={(e) => s.set(Number(e.target.value))} className="w-full" />
                  </label>
                ))}
                <button
                  disabled={busy || !selectedParticipant}
                  onClick={castVote}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-white font-bold shadow-lg disabled:opacity-50"
                >
                  Submit Vote
                </button>
              </div>
            )}
            {rules.promptSignInToVote && (
              <button onClick={requireSignIn} className="px-6 py-3 bg-white border-2 border-gray-300 rounded-full font-bold text-gray-900 shadow">
                Sign in to vote
              </button>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            <div className="bg-white border-2 border-gray-300 rounded-2xl p-4 shadow-lg">
              <h3 className="text-gray-900 font-bold mb-3 flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                Competition Info
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-gray-700">
                  <span className="font-medium">Theme:</span>
                  <span className="text-gray-900 font-semibold">{comp.themeName || 'Freestyle'}</span>
                </div>
                <div className="flex items-center justify-between text-gray-700">
                  <span className="font-medium">Duration:</span>
                  <span className="text-gray-900 font-semibold">{comp.timeLimitMinutes} minutes</span>
                </div>
                <div className="flex items-center justify-between text-gray-700">
                  <span className="font-medium">Min voters:</span>
                  <span className="text-gray-900 font-semibold">{comp.minOfficialVoters} required</span>
                </div>
                <div className="flex items-center justify-between text-gray-700">
                  <span className="font-medium">Visibility:</span>
                  <span className="text-gray-900 font-semibold">{comp.isPrivate ? 'Private' : 'Public'}</span>
                </div>
              </div>
            </div>

            {status === 'completed' && ranked[0]?.placement === 1 && (
              <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl p-4 shadow-lg text-white">
                <Trophy className="w-6 h-6 mb-2" />
                <div className="font-black text-lg">Champion: {nameOf(ranked[0].userId)}</div>
                <div className="font-medium">{ranked[0].dishTitle}</div>
              </div>
            )}

            <div className="bg-white/90 border-2 border-gray-300 rounded-2xl p-4 shadow-lg text-sm text-gray-700">
              <Video className="w-5 h-5 text-gray-500 mb-2" />
              Live video and dish photo uploads are coming soon. For now, enter your dish name and description, and vote here.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
