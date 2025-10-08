import React, { useState, useEffect } from 'react';
import { Search, Sparkles, Filter, Timer, Users, Trophy, Flame, Calendar, Video, Eye, Plus, Layers, Home, Play, TrendingUp, Crown, Medal, Zap, Clock } from 'lucide-react';

const THEMES = [
  { id: 'italian', name: 'Italian Night', icon: '🇮🇹', gradient: 'from-green-500 via-white to-red-500' },
  { id: 'taco', name: 'Taco Tuesday', icon: '🌮', gradient: 'from-yellow-400 to-orange-500' },
  { id: 'asian-fusion', name: 'Asian Fusion', icon: '🥢', gradient: 'from-red-500 to-yellow-400' },
  { id: 'comfort', name: 'Comfort Food', icon: '🍲', gradient: 'from-amber-600 to-orange-500' },
  { id: 'healthy', name: 'Healthy / Fitness', icon: '🥗', gradient: 'from-green-400 to-emerald-500' },
  { id: 'desserts', name: 'Desserts & Baking', icon: '🍰', gradient: 'from-pink-400 to-rose-500' },
  { id: 'quick', name: 'Quick 30-Min', icon: '⏱️', gradient: 'from-blue-400 to-cyan-500' },
  { id: 'budget', name: 'Budget ($10)', icon: '💰', gradient: 'from-green-600 to-teal-500' },
  { id: 'leftover', name: 'Leftover Remix', icon: '♻️', gradient: 'from-emerald-500 to-green-600' },
  { id: 'regional', name: 'Regional Specialties', icon: '🚐', gradient: 'from-purple-500 to-pink-500' },
];

const STATUS_OPTIONS = [
  { id: 'all', label: 'All Battles', icon: Layers },
  { id: 'live', label: 'Live Now', icon: Zap },
  { id: 'upcoming', label: 'Starting Soon', icon: Clock },
  { id: 'judging', label: 'Judging', icon: Trophy },
  { id: 'completed', label: 'Hall of Fame', icon: Crown },
];

export default function CompetitionLibraryPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [theme, setTheme] = useState('');
  const [loading, setLoading] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [floatingParticles, setFloatingParticles] = useState([]);

  // Generate floating particles for ambient animation
  useEffect(() => {
    const particles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 10 + Math.random() * 10,
      size: 4 + Math.random() * 8
    }));
    setFloatingParticles(particles);
  }, []);

  // Mock data - replace with real API call
  const competitions = [
    { id: '1', title: 'Friday Night Pasta Battle', themeName: 'Italian Night', status: 'live', isPrivate: false, timeLimitMinutes: 90, createdAt: new Date().toISOString(), participants: 8, viewers: 234 },
    { id: '2', title: 'Taco Showdown Supreme', themeName: 'Taco Tuesday', status: 'judging', isPrivate: false, timeLimitMinutes: 60, createdAt: new Date().toISOString(), participants: 6, viewers: 156 },
    { id: '3', title: 'Dessert Duel Championship', themeName: 'Desserts & Baking', status: 'completed', isPrivate: false, timeLimitMinutes: 120, createdAt: new Date().toISOString(), participants: 10, viewers: 892, winner: 'ChefMaster99' },
    { id: '4', title: '30-Min Express Challenge', themeName: 'Quick 30-Min', status: 'upcoming', isPrivate: true, timeLimitMinutes: 30, createdAt: new Date().toISOString(), participants: 4, viewers: 0 },
    { id: '5', title: 'Budget Warrior Battle', themeName: 'Budget ($10)', status: 'live', isPrivate: false, timeLimitMinutes: 75, createdAt: new Date().toISOString(), participants: 7, viewers: 178 },
    { id: '6', title: 'Comfort Food Classic', themeName: 'Comfort Food', status: 'completed', isPrivate: false, timeLimitMinutes: 90, createdAt: new Date().toISOString(), participants: 9, viewers: 456, winner: 'FoodieQueen' },
  ];

  const statusBadge = (s) => {
    const colors = {
      live: 'bg-gradient-to-r from-green-500 to-emerald-600 animate-pulse',
      judging: 'bg-gradient-to-r from-amber-500 to-orange-600',
      completed: 'bg-gradient-to-r from-blue-600 to-cyan-600',
      upcoming: 'bg-gradient-to-r from-purple-600 to-pink-600',
    };
    return (
      <span className={`${colors[s] || 'bg-gray-600'} text-white text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wide shadow-lg`}>
        {s === 'live' && <span className="inline-block w-2 h-2 bg-white rounded-full mr-1 animate-ping" />}
        {s}
      </span>
    );
  };

  const filteredComps = competitions.filter(c => 
    (status === 'all' || c.status === status) &&
    (!theme || c.themeName === theme) &&
    (!q || c.title.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated Background Particles */}
      {floatingParticles.map(particle => (
        <div
          key={particle.id}
          className="absolute rounded-full bg-white/5 backdrop-blur-sm"
          style={{
            left: `${particle.left}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            animation: `float ${particle.duration}s ease-in-out infinite`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          50% { transform: translateY(-100vh) translateX(20px); opacity: 0.6; }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(236, 72, 153, 0.5); }
          50% { box-shadow: 0 0 40px rgba(236, 72, 153, 0.8), 0 0 60px rgba(147, 51, 234, 0.6); }
        }
        .hover-glow:hover {
          animation: glow 2s ease-in-out infinite;
        }
      `}</style>

      {/* Hero Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/50" />
        <div className="max-w-7xl mx-auto px-4 py-16 relative z-10">
          <div className="flex items-center justify-between mb-8">
            <button className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-lg rounded-full transition-all hover:scale-105">
              <Home className="w-4 h-4 text-white" />
              <span className="text-white font-medium">Home</span>
            </button>
            <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 rounded-full shadow-lg transition-all hover:scale-105 hover:shadow-pink-500/50">
              <Plus className="w-5 h-5 text-white" />
              <span className="text-white font-bold">Create Epic Battle</span>
            </button>
          </div>

          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="p-4 bg-gradient-to-br from-pink-500 to-purple-600 rounded-3xl shadow-2xl hover:scale-110 transition-transform hover-glow">
                <Trophy className="w-12 h-12 text-white" />
              </div>
            </div>
            <h1 className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 mb-4 animate-pulse">
              Battle Arena
            </h1>
            <p className="text-xl text-purple-200 max-w-2xl mx-auto">
              Watch live culinary showdowns, vote for champions, and relive epic cooking battles
            </p>
          </div>

          {/* Live Stats Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { icon: Zap, label: 'Live Battles', value: '3', color: 'from-green-400 to-emerald-600' },
              { icon: Users, label: 'Active Viewers', value: '568', color: 'from-blue-400 to-cyan-600' },
              { icon: Trophy, label: 'Champions', value: '127', color: 'from-yellow-400 to-orange-600' },
              { icon: Video, label: 'Total Battles', value: '1.2K', color: 'from-pink-400 to-rose-600' },
            ].map((stat, i) => (
              <div key={i} className="bg-white/5 backdrop-blur-lg rounded-2xl p-4 border border-white/10 hover:bg-white/10 transition-all hover:scale-105 cursor-pointer">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 bg-gradient-to-br ${stat.color} rounded-lg`}>
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm text-purple-300">{stat.label}</span>
                </div>
                <div className="text-3xl font-bold text-white">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="max-w-7xl mx-auto px-4 mb-8">
        {/* Search Bar */}
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search epic battles..."
                className="w-full bg-white/10 border border-white/20 rounded-xl pl-12 pr-4 py-3 text-white placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <button className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl font-bold text-white hover:scale-105 transition-transform">
              Search
            </button>
          </div>

          {/* Status Filter Pills */}
          <div className="flex flex-wrap gap-3">
            {STATUS_OPTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => setStatus(s.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all hover:scale-105 ${
                    status === s.id
                      ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg'
                      : 'bg-white/10 text-purple-300 hover:bg-white/20'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Theme Filter */}
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-bold text-white">Filter by Theme</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <button
              onClick={() => setTheme('')}
              className={`p-3 rounded-xl font-medium transition-all hover:scale-105 ${
                !theme ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white' : 'bg-white/10 text-purple-300 hover:bg-white/20'
              }`}
            >
              All Themes
            </button>
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.name)}
                className={`p-3 rounded-xl font-medium transition-all hover:scale-105 ${
                  theme === t.name ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white' : 'bg-white/10 text-purple-300 hover:bg-white/20'
                }`}
              >
                <div className="text-2xl mb-1">{t.icon}</div>
                <div className="text-xs">{t.name}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Competition Grid */}
      <div className="max-w-7xl mx-auto px-4 pb-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredComps.map((comp) => (
            <div
              key={comp.id}
              onMouseEnter={() => setHoveredCard(comp.id)}
              onMouseLeave={() => setHoveredCard(null)}
              className="group relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-2xl overflow-hidden border border-white/20 hover:border-pink-500/50 transition-all hover:scale-105 hover:shadow-2xl hover:shadow-pink-500/20 cursor-pointer"
            >
              {/* Animated gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/0 via-purple-500/0 to-cyan-500/0 group-hover:from-pink-500/10 group-hover:via-purple-500/10 group-hover:to-cyan-500/10 transition-all duration-500" />
              
              {/* Header Banner */}
              <div className="relative h-32 bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-600 overflow-hidden">
                <div className="absolute inset-0 bg-black/20" />
                {comp.status === 'live' && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                )}
                <style>{`
                  @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                  }
                  .animate-shimmer { animation: shimmer 3s infinite; }
                `}</style>
                
                <div className="absolute top-3 left-3 flex gap-2">
                  {statusBadge(comp.status)}
                  {comp.isPrivate && (
                    <span className="bg-black/40 backdrop-blur-sm text-white text-xs px-3 py-1 rounded-full font-bold">
                      🔒 PRIVATE
                    </span>
                  )}
                </div>

                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-400" />
                  <span className="text-white font-bold text-sm">{comp.timeLimitMinutes}min Battle</span>
                </div>

                {comp.status === 'live' && (
                  <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <Eye className="w-4 h-4 text-white" />
                    <span className="text-white font-bold text-xs">{comp.viewers}</span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="relative p-5">
                <h3 className="text-xl font-bold text-white mb-2 line-clamp-1">{comp.title}</h3>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  <span className="text-purple-300 text-sm">{comp.themeName}</span>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <Users className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                    <div className="text-white font-bold text-sm">{comp.participants}</div>
                    <div className="text-purple-400 text-xs">Chefs</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <Calendar className="w-4 h-4 text-pink-400 mx-auto mb-1" />
                    <div className="text-white font-bold text-sm">Today</div>
                    <div className="text-purple-400 text-xs">Date</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <Trophy className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
                    <div className="text-white font-bold text-sm">{comp.status === 'completed' ? '👑' : '—'}</div>
                    <div className="text-purple-400 text-xs">Winner</div>
                  </div>
                </div>

                {comp.winner && (
                  <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg p-3 mb-4 border border-yellow-500/30">
                    <div className="flex items-center gap-2">
                      <Crown className="w-5 h-5 text-yellow-400" />
                      <div>
                        <div className="text-xs text-yellow-300">Champion</div>
                        <div className="text-white font-bold">{comp.winner}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <button className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 rounded-xl font-bold text-white transition-all hover:scale-105 flex items-center justify-center gap-2 shadow-lg">
                  {comp.status === 'live' ? (
                    <><Play className="w-5 h-5" /> Join Live</>
                  ) : comp.status === 'completed' ? (
                    <><Video className="w-5 h-5" /> Watch Replay</>
                  ) : (
                    <><Eye className="w-5 h-5" /> View Details</>
                  )}
                </button>
              </div>

              {/* Hover Effect Border */}
              {hoveredCard === comp.id && (
                <div className="absolute inset-0 border-2 border-pink-500 rounded-2xl pointer-events-none animate-pulse" />
              )}
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredComps.length === 0 && (
          <div className="text-center py-16">
            <div className="inline-block p-6 bg-white/5 backdrop-blur-lg rounded-3xl mb-4">
              <Trophy className="w-16 h-16 text-purple-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">No battles found</h3>
            <p className="text-purple-300 mb-6">Try adjusting your filters or create a new epic showdown!</p>
            <button className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full font-bold text-white hover:scale-105 transition-transform shadow-lg">
              <Plus className="inline w-5 h-5 mr-2" />
              Create Your First Battle
            </button>
          </div>
        )}
      </div>

      {/* Floating CTA */}
      <div className="fixed bottom-8 right-8 z-50">
        <button className="p-4 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full shadow-2xl hover:scale-110 transition-transform hover-glow">
          <Plus className="w-8 h-8 text-white" />
        </button>
      </div>
    </div>
  );
}
