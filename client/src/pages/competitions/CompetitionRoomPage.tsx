import React, { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { Video, Users, Timer, Trophy, Star, Flame, Zap, Camera, Send, Heart, Share2, Crown, Award, Target } from 'lucide-react';

export default function CompetitionRoomPage() {
  const { id } = useParams();
  const [timeLeft, setTimeLeft] = useState(3600);
  const [roomUrl, setRoomUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [presentation, setPresentation] = useState(8);
  const [creativity, setCreativity] = useState(8);
  const [technique, setTechnique] = useState(8);
  const [chatMessage, setChatMessage] = useState('');
  const [reactions, setReactions] = useState([]);
  const [confetti, setConfetti] = useState(false);
  const [competition, setCompetition] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch competition data
  useEffect(() => {
    const fetchCompetition = async () => {
      try {
        const response = await fetch(`/api/competitions/${id}`, {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setCompetition(data.competition);
          setParticipants(data.participants || []);

          // Calculate time left if competition is live
          if (data.competition?.status === 'live' && data.competition?.endTime) {
            const end = new Date(data.competition.endTime).getTime();
            const now = Date.now();
            const remaining = Math.floor((end - now) / 1000);
            setTimeLeft(Math.max(0, remaining));
          }
        }
      } catch (err) {
        console.error('Failed to load competition:', err);
      } finally {
        setLoadingData(false);
      }
    };

    if (id) {
      fetchCompetition();
    }
  }, [id]);

  // Check if video room exists on load
  useEffect(() => {
    checkExistingRoom();
  }, [id]);

  const checkExistingRoom = async () => {
    try {
      const response = await fetch(`/api/competitions/${id}/video-room`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRoomUrl(data.roomUrl);
      }
    } catch (err) {
      // No existing room found - this is expected
    }
  };

  const handleJoinVideo = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/video/room`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          competitionId: id,
          maxParticipants: 20
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create video room');
      }

      const data = await response.json();
      setRoomUrl(data.roomUrl);
    } catch (err) {
      setError(err.message);
      console.error('Error creating video room:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const addReaction = (emoji) => {
    const id = Date.now();
    setReactions(prev => [...prev, { id, emoji, x: Math.random() * 80 + 10, y: Math.random() * 20 + 40 }]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id));
    }, 2000);
  };

  const handleVote = () => {
    setConfetti(true);
    setTimeout(() => setConfetti(false), 3000);
  };

  if (loadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-xl">Loading competition...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-200 via-purple-200 to-pink-200 relative overflow-hidden">
      {/* REDUCED Background effects - only 6 elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-10"
            style={{
              background: `radial-gradient(circle, ${['#a78bfa', '#ec4899', '#06b6d4'][i % 3]} 0%, transparent 70%)`,
              width: Math.random() * 250 + 120 + 'px',
              height: Math.random() * 250 + 120 + 'px',
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
              animation: `gentle-float ${Math.random() * 30 + 20}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`
            }}
          />
        ))}
      </div>

      {confetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                left: Math.random() * 100 + '%',
                top: '-10px',
                width: '10px',
                height: '10px',
                background: `hsl(${Math.random() * 360}, 80%, 60%)`,
                animation: `fall ${Math.random() * 2 + 2}s linear`,
                animationDelay: `${Math.random() * 0.5}s`
              }}
            />
          ))}
        </div>
      )}

      {reactions.map(r => (
        <div
          key={r.id}
          className="fixed text-4xl pointer-events-none z-40"
          style={{
            left: `${r.x}%`,
            top: `${r.y}%`,
            animation: 'float-up 2s ease-out'
          }}
        >
          {r.emoji}
        </div>
      ))}

      <style>{`
        @keyframes gentle-float {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(15px, -15px); }
        }
        @keyframes float-up {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-200px) scale(1.5); }
        }
        @keyframes fall {
          to { transform: translateY(100vh) rotate(720deg); }
        }
      `}</style>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75"></div>
              <div className="relative px-4 py-2 bg-red-500 rounded-full flex items-center gap-2 text-white font-bold shadow-lg">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                LIVE
              </div>
            </div>
            <div className="px-4 py-2 bg-white/90 backdrop-blur-xl rounded-full text-gray-900 font-semibold border-2 border-gray-300 shadow-md">
              <Users className="inline w-4 h-4 mr-2" />
              {participants.length} Competing
            </div>
          </div>

          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-all"></div>
            <div className="relative px-8 py-4 bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl border-2 border-white/30 shadow-2xl">
              <div className="flex items-center gap-3">
                <Timer className="w-6 h-6 text-white" />
                <div className="text-4xl font-black text-white tabular-nums">{formatTime(timeLeft)}</div>
                <Flame className="w-6 h-6 text-yellow-300 animate-pulse" />
              </div>
            </div>
          </div>

          <button className="p-3 bg-white hover:bg-gray-50 rounded-full transition-all hover:scale-110 backdrop-blur-xl border-2 border-gray-300 shadow-md">
            <Share2 className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Video Container */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-3xl blur-2xl opacity-30 group-hover:opacity-50 transition-all"></div>
              <div className="relative bg-white border-2 border-gray-300 rounded-3xl overflow-hidden shadow-2xl">
                <div className="aspect-video flex items-center justify-center relative bg-gray-100">
                  {!roomUrl ? (
                    <div className="text-center p-8">
                      <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-6 font-medium">Ready to join the live cookoff?</p>
                      {error && (
                        <p className="text-red-600 text-sm mb-4 font-medium">{error}</p>
                      )}
                      <button
                        onClick={handleJoinVideo}
                        disabled={loading}
                        className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-full text-white font-bold transition-all duration-300 hover:scale-110 shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Video className="inline w-5 h-5 mr-2" />
                        {loading ? 'Creating Room...' : 'Join Live Video'}
                      </button>
                    </div>
                  ) : (
                    <iframe
                      src={roomUrl}
                      allow="camera; microphone; fullscreen; display-capture; autoplay"
                      className="w-full h-full"
                      title="Daily.co Video Room"
                    />
                  )}
                  
                  {roomUrl && (
                    <div className="absolute bottom-4 left-4 flex gap-2">
                      {['🔥', '👏', '😍', '🤩', '💯'].map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => addReaction(emoji)}
                          className="w-12 h-12 bg-white/90 hover:bg-white backdrop-blur-xl rounded-full text-2xl transition-all hover:scale-125 border-2 border-gray-300 shadow-lg"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Participants Grid */}
            <div className="grid sm:grid-cols-2 gap-4">
              {participants.map((p, i) => (
                <div
                  key={p.id}
                  className="relative group cursor-pointer"
                  onClick={() => setSelectedParticipant(p)}
                >
                  <div className={`absolute inset-0 bg-gradient-to-r rounded-2xl blur-xl transition-all ${
                    p.placement === 1 ? 'from-yellow-400 to-orange-400 opacity-40' :
                    p.placement === 2 ? 'from-gray-400 to-gray-500 opacity-30' :
                    p.placement === 3 ? 'from-amber-600 to-amber-700 opacity-30' :
                    'from-purple-400 to-pink-400 opacity-0'
                  } group-hover:opacity-50`}></div>
                  
                  <div className={`relative bg-white backdrop-blur-xl border-2 rounded-2xl p-4 transition-all duration-300 hover:scale-105 shadow-lg ${
                    selectedParticipant?.id === p.id ? 'border-purple-500 shadow-2xl scale-105' : 'border-gray-300'
                  }`}>
                    {p.placement <= 3 && (
                      <div className="absolute -top-3 -right-3 p-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full shadow-lg">
                        {p.placement === 1 ? <Crown className="w-5 h-5 text-white" /> :
                         p.placement === 2 ? <Award className="w-5 h-5 text-white" /> :
                         <Target className="w-5 h-5 text-white" />}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-4xl">{p.avatar}</div>
                      <div className="flex-1">
                        <div className="font-bold text-gray-900">{p.name}</div>
                        <div className="text-sm text-gray-700 font-medium">{p.dish}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-yellow-500">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="font-bold text-gray-900">{p.score}</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-700 font-medium">
                        <Users className="w-4 h-4" />
                        <span>{p.votes} votes</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Competition Info Card */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-red-400 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-all"></div>
              <div className="relative bg-white backdrop-blur-xl border-2 border-gray-300 rounded-2xl p-4 shadow-lg">
                <h3 className="text-gray-900 font-bold mb-3 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  Competition Info
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between text-gray-700">
                    <span className="font-medium">Theme:</span>
                    <span className="text-gray-900 font-semibold">🇮🇹 Italian Night</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-700">
                    <span className="font-medium">Duration:</span>
                    <span className="text-gray-900 font-semibold">60 minutes</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-700">
                    <span className="font-medium">Min Voters:</span>
                    <span className="text-gray-900 font-semibold">3 required</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-700">
                    <span className="font-medium">Status:</span>
                    <span className="px-2 py-1 bg-red-500 text-white rounded-full text-xs font-bold">LIVE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
