import React, { useState, useEffect } from 'react';
import { Video, Users, Timer, Trophy, Star, Flame, Zap, Camera, Send, Heart, Share2, Crown, Award, Target } from 'lucide-react';

export default function EnhancedRoomPage() {
  const [timeLeft, setTimeLeft] = useState(3600); // 60 minutes in seconds
  const [roomUrl, setRoomUrl] = useState(null);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [presentation, setPresentation] = useState(8);
  const [creativity, setCreativity] = useState(8);
  const [technique, setTechnique] = useState(8);
  const [chatMessage, setChatMessage] = useState('');
  const [reactions, setReactions] = useState([]);
  const [confetti, setConfetti] = useState(false);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const mockParticipants = [
    { id: 1, name: 'Chef Mario', dish: 'Truffle Risotto', avatar: '👨‍🍳', votes: 12, score: 8.5, placement: 1 },
    { id: 2, name: 'Julia Masters', dish: 'Beef Wellington', avatar: '👩‍🍳', votes: 10, score: 8.2, placement: 2 },
    { id: 3, name: 'Gordon Fierce', dish: 'Pan-Seared Scallops', avatar: '🧑‍🍳', votes: 8, score: 7.8, placement: 3 },
    { id: 4, name: 'Rachel Sweets', dish: 'Chocolate Soufflé', avatar: '👩‍🍳', votes: 7, score: 7.5, placement: 4 }
  ];

  const mockChat = [
    { user: 'FoodieKing', msg: 'That plating is incredible! 🔥', time: '2m ago' },
    { user: 'CulinaryPro', msg: 'The technique on that sear though...', time: '5m ago' },
    { user: 'ChefWannabe', msg: 'I need that recipe ASAP!', time: '8m ago' }
  ];

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white opacity-5"
            style={{
              width: Math.random() * 300 + 100 + 'px',
              height: Math.random() * 300 + 100 + 'px',
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
              animation: `float ${Math.random() * 20 + 10}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`
            }}
          />
        ))}
      </div>

      {/* Confetti effect */}
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

      {/* Floating reactions */}
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
        @keyframes float {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(20px, -20px) rotate(120deg); }
          66% { transform: translate(-20px, 20px) rotate(240deg); }
        }
        @keyframes float-up {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-200px) scale(1.5); }
        }
        @keyframes fall {
          to { transform: translateY(100vh) rotate(720deg); }
        }
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          100% { box-shadow: 0 0 0 20px rgba(239, 68, 68, 0); }
        }
      `}</style>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75"></div>
              <div className="relative px-4 py-2 bg-red-500 rounded-full flex items-center gap-2 text-white font-bold">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                LIVE
              </div>
            </div>
            <div className="px-4 py-2 bg-white/10 backdrop-blur-xl rounded-full text-white font-semibold border border-white/20">
              <Users className="inline w-4 h-4 mr-2" />
              {mockParticipants.length} Competing
            </div>
          </div>

          {/* Timer */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-all"></div>
            <div className="relative px-8 py-4 bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl border-2 border-white/30">
              <div className="flex items-center gap-3">
                <Timer className="w-6 h-6 text-white" />
                <div className="text-4xl font-black text-white tabular-nums">{formatTime(timeLeft)}</div>
                <Flame className="w-6 h-6 text-yellow-300 animate-pulse" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all hover:scale-110 backdrop-blur-xl border border-white/20">
              <Share2 className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Video + Participants */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Container */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-30 group-hover:opacity-50 transition-all"></div>
              <div className="relative bg-black/40 backdrop-blur-xl border-2 border-white/20 rounded-3xl overflow-hidden">
                <div className="aspect-video bg-gradient-to-br from-purple-900/50 to-pink-900/50 flex items-center justify-center relative">
                  {!roomUrl ? (
                    <div className="text-center p-8">
                      <Video className="w-16 h-16 text-white mx-auto mb-4 opacity-50" />
                      <p className="text-white/70 mb-6">Click below to join the live room</p>
                      <button
                        onClick={() => setRoomUrl('active')}
                        className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-full text-white font-bold transition-all duration-300 hover:scale-110 shadow-2xl"
                      >
                        <Video className="inline w-5 h-5 mr-2" />
                        Join Live Video
                      </button>
                    </div>
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-800 to-purple-900 flex items-center justify-center">
                      <div className="text-white/50 text-center">
                        <Video className="w-20 h-20 mx-auto mb-4 animate-pulse" />
                        <p className="text-lg">Live video would appear here</p>
                        <p className="text-sm">(Daily.co integration)</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Quick Reactions */}
                  <div className="absolute bottom-4 left-4 flex gap-2">
                    {['🔥', '👏', '😍', '🤩', '💯'].map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => addReaction(emoji)}
                        className="w-12 h-12 bg-black/60 hover:bg-black/80 backdrop-blur-xl rounded-full text-2xl transition-all hover:scale-125 border border-white/20"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Participants Grid */}
            <div className="grid sm:grid-cols-2 gap-4">
              {mockParticipants.map((p, i) => (
                <div
                  key={p.id}
                  className="relative group cursor-pointer"
                  onClick={() => setSelectedParticipant(p)}
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-r rounded-2xl blur-xl transition-all ${
                    p.placement === 1 ? 'from-yellow-500 to-orange-500 opacity-50' :
                    p.placement === 2 ? 'from-gray-400 to-gray-500 opacity-30' :
                    p.placement === 3 ? 'from-amber-600 to-amber-700 opacity-30' :
                    'from-purple-500 to-pink-500 opacity-0'
                  } group-hover:opacity-60`}></div>
                  
                  <div className={`relative bg-white/10 backdrop-blur-xl border-2 rounded-2xl p-4 transition-all duration-300 hover:scale-105 ${
                    selectedParticipant?.id === p.id ? 'border-purple-400 bg-white/20' : 'border-white/20'
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
                        <div className="font-bold text-white">{p.name}</div>
                        <div className="text-sm text-purple-200">{p.dish}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-yellow-400">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="font-bold">{p.score}</span>
                      </div>
                      <div className="flex items-center gap-1 text-purple-300">
                        <Users className="w-4 h-4" />
                        <span>{p.votes} votes</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Chat + Voting */}
          <div className="space-y-6">
            {/* Live Chat */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-all"></div>
              <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600/40 to-cyan-600/40 px-4 py-3 border-b border-white/20">
                  <div className="flex items-center gap-2 text-white font-bold">
                    <Zap className="w-5 h-5 text-cyan-400" />
                    Live Chat
                    <span className="ml-auto text-xs bg-green-500 px-2 py-1 rounded-full">42 online</span>
                  </div>
                </div>
                
                <div className="h-64 overflow-y-auto p-4 space-y-3">
                  {mockChat.map((chat, i) => (
                    <div key={i} className="animate-in slide-in-from-bottom">
                      <div className="flex items-start gap-2">
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {chat.user[0]}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-semibold text-white">{chat.user}</span>
                            <span className="text-xs text-purple-300">{chat.time}</span>
                          </div>
                          <p className="text-sm text-purple-100">{chat.msg}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="p-3 border-t border-white/20 bg-black/20">
                  <div className="flex gap-2">
                    <input
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      placeholder="Send a message..."
                      className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-full text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <button className="p-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-full transition-all hover:scale-110">
                      <Send className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Voting Panel */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-all"></div>
              <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600/40 to-pink-600/40 px-4 py-3 border-b border-white/20">
                  <div className="flex items-center gap-2 text-white font-bold">
                    <Star className="w-5 h-5 text-yellow-400" />
                    Cast Your Vote
                  </div>
                </div>
                
                <div className="p-4 space-y-4">
                  {/* Participant Selector */}
                  <div>
                    <label className="block text-purple-200 text-sm font-semibold mb-2">Vote for:</label>
                    <select
                      value={selectedParticipant?.id || ''}
                      onChange={(e) => setSelectedParticipant(mockParticipants.find(p => p.id === Number(e.target.value)))}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select a chef...</option>
                      {mockParticipants.map(p => (
                        <option key={p.id} value={p.id} className="bg-slate-800">
                          {p.avatar} {p.name} - {p.dish}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedParticipant && (
                    <div className="space-y-4 animate-in fade-in">
                      {/* Presentation Score */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-white text-sm font-semibold flex items-center gap-2">
                            <Camera className="w-4 h-4 text-pink-400" />
                            Presentation
                          </label>
                          <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
                            {presentation}
                          </div>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={presentation}
                          onChange={(e) => setPresentation(Number(e.target.value))}
                          className="w-full h-3 bg-white/20 rounded-full appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, #ec4899 0%, #ec4899 ${presentation * 10}%, rgba(255,255,255,0.2) ${presentation * 10}%, rgba(255,255,255,0.2) 100%)`
                          }}
                        />
                      </div>

                      {/* Creativity Score */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-white text-sm font-semibold flex items-center gap-2">
                            <Zap className="w-4 h-4 text-yellow-400" />
                            Creativity
                          </label>
                          <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
                            {creativity}
                          </div>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={creativity}
                          onChange={(e) => setCreativity(Number(e.target.value))}
                          className="w-full h-3 bg-white/20 rounded-full appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, #fbbf24 0%, #fbbf24 ${creativity * 10}%, rgba(255,255,255,0.2) ${creativity * 10}%, rgba(255,255,255,0.2) 100%)`
                          }}
                        />
                      </div>

                      {/* Technique Score */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-white text-sm font-semibold flex items-center gap-2">
                            <Target className="w-4 h-4 text-cyan-400" />
                            Technique
                          </label>
                          <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                            {technique}
                          </div>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={technique}
                          onChange={(e) => setTechnique(Number(e.target.value))}
                          className="w-full h-3 bg-white/20 rounded-full appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${technique * 10}%, rgba(255,255,255,0.2) ${technique * 10}%, rgba(255,255,255,0.2) 100%)`
                          }}
                        />
                      </div>

                      {/* Total Score Display */}
                      <div className="relative mt-4">
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl blur-lg opacity-50"></div>
                        <div className="relative bg-gradient-to-r from-purple-600/60 to-pink-600/60 backdrop-blur-xl rounded-xl p-4 border border-white/30">
                          <div className="text-center">
                            <div className="text-sm text-purple-200 mb-1">Total Score</div>
                            <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400">
                              {((presentation + creativity + technique) / 3).toFixed(1)}
                            </div>
                            <div className="text-xs text-purple-300 mt-1">out of 10.0</div>
                          </div>
                        </div>
                      </div>

                      {/* Submit Vote Button */}
                      <button
                        onClick={handleVote}
                        className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-xl text-white font-bold text-lg transition-all duration-300 hover:scale-105 shadow-2xl relative overflow-hidden group"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                        <Trophy className="inline w-6 h-6 mr-2" />
                        Submit Vote
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Competition Info Card */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-all"></div>
              <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4">
                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-400" />
                  Competition Info
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between text-purple-200">
                    <span>Theme:</span>
                    <span className="text-white font-semibold">🇮🇹 Italian Night</span>
                  </div>
                  <div className="flex items-center justify-between text-purple-200">
                    <span>Duration:</span>
                    <span className="text-white font-semibold">60 minutes</span>
                  </div>
                  <div className="flex items-center justify-between text-purple-200">
                    <span>Min Voters:</span>
                    <span className="text-white font-semibold">3 required</span>
                  </div>
                  <div className="flex items-center justify-between text-purple-200">
                    <span>Status:</span>
                    <span className="px-2 py-1 bg-red-500 text-white rounded-full text-xs font-bold">LIVE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-xl border-t border-white/20 p-4 z-20">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-white">
                <div className="text-sm text-purple-300">Watching:</div>
                <div className="font-bold">127 viewers</div>
              </div>
              <div className="h-8 w-px bg-white/20"></div>
              <div className="text-white">
                <div className="text-sm text-purple-300">Total Votes:</div>
                <div className="font-bold">37 votes</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full text-white font-semibold transition-all hover:scale-105 flex items-center gap-2">
                <Heart className="w-5 h-5" />
                Favorite
              </button>
              <button className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-full text-white font-bold transition-all hover:scale-105 flex items-center gap-2 shadow-lg">
                <Share2 className="w-5 h-5" />
                Share Battle
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
