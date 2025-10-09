import React, { useState, useEffect } from 'react';
import { Search, Sparkles, Filter, Timer, Users, Trophy, Flame, Calendar, Video, Eye, Plus, Layers, Home, TrendingUp, Zap, Star } from 'lucide-react';

const THEMES = [
  { id: 'italian', name: 'Italian Night', icon: '🇮🇹', gradient: 'from-green-500 via-white to-red-500' },
  { id: 'taco', name: 'Taco Tuesday', icon: '🌮', gradient: 'from-yellow-400 to-orange-500' },
  { id: 'asian-fusion', name: 'Asian Fusion', icon: '🥢', gradient: 'from-red-500 to-yellow-400' },
  { id: 'comfort', name: 'Comfort Food', icon: '🍲', gradient: 'from-amber-600 to-orange-400' },
  { id: 'healthy', name: 'Healthy / Fitness', icon: '🥗', gradient: 'from-green-400 to-emerald-500' },
  { id: 'desserts', name: 'Desserts & Baking', icon: '🍰', gradient: 'from-pink-400 to-rose-500' },
  { id: 'quick', name: 'Quick 30-Min', icon: '⏱️', gradient: 'from-blue-400 to-cyan-500' },
  { id: 'budget', name: 'Budget ($10)', icon: '💰', gradient: 'from-green-600 to-teal-500' },
  { id: 'leftover', name: 'Leftover Remix', icon: '♻️', gradient: 'from-emerald-500 to-green-600' },
  { id: 'regional', name: 'Regional Specialties', icon: '🌍', gradient: 'from-purple-500 to-pink-500' }
];

const STATUS_OPTIONS = [
  { id: 'all', label: 'All', icon: Layers, color: 'gray' },
  { id: 'live', label: 'Live Now', icon: Zap, color: 'green' },
  { id: 'upcoming', label: 'Upcoming', icon: Calendar, color: 'blue' },
  { id: 'judging', label: 'Judging', icon: Star, color: 'amber' },
  { id: 'completed', label: 'Completed', icon: Trophy, color: 'purple' }
];

export default function EnhancedLibraryPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [theme, setTheme] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [stats, setStats] = useState({ total: 156, live: 8, upcoming: 24, judging: 12 });

  // Animated counter
  const [counter, setCounter] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setCounter(prev => (prev + 1) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Mock data for demo
  const mockItems = [
    { id: '1', title: 'Midnight Pasta Showdown', themeName: 'Italian Night', status: 'live', isPrivate: false, timeLimitMinutes: 60, createdAt: new Date().toISOString(), participants: 6 },
    { id: '2', title: 'Taco Fiesta Challenge', themeName: 'Taco Tuesday', status: 'judging', isPrivate: false, timeLimitMinutes: 45, createdAt: new Date().toISOString(), participants: 8 },
    { id: '3', title: 'Asian Fusion Battle', themeName: 'Asian Fusion', status: 'upcoming', isPrivate: true, timeLimitMinutes: 90, createdAt: new Date().toISOString(), participants: 4 },
    { id: '4', title: 'Dessert Wars Championship', themeName: 'Desserts & Baking', status: 'completed', isPrivate: false, timeLimitMinutes: 120, createdAt: new Date().toISOString(), participants: 10 },
    { id: '5', title: 'Budget Kitchen Heroes', themeName: 'Budget ($10)', status: 'live', isPrivate: false, timeLimitMinutes: 30, createdAt: new Date().toISOString(), participants: 5 },
    { id: '6', title: 'Lightning Round Cook-Off', themeName: 'Quick 30-Min', status: 'upcoming', isPrivate: false, timeLimitMinutes: 30, createdAt: new Date().toISOString(), participants: 7 }
  ];

  useEffect(() => {
    setItems(mockItems);
  }, []);

  const getStatusBadge = (s) => {
    const colors = {
      live: 'bg-gradient-to-r from-green-500 to-emerald-500 animate-pulse',
      judging: 'bg-gradient-to-r from-amber-500 to-orange-500',
      completed: 'bg-gradient-to-r from-blue-500 to-purple-500',
      upcoming: 'bg-gradient-to-r from-gray-500 to-slate-500'
    };
    return colors[s] || colors.upcoming;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-200 via-purple-200 to-pink-200 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-20"
            style={{
              background: `radial-gradient(circle, ${['#fbbf24', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'][i % 5]} 0%, transparent 70%)`,
              width: Math.random() * 400 + 100 + 'px',
              height: Math.random() * 400 + 100 + 'px',
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
              animation: `float ${Math.random() * 20 + 10}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(20px, -20px) rotate(90deg); }
          50% { transform: translate(-20px, 20px) rotate(180deg); }
          75% { transform: translate(20px, 20px) rotate(270deg); }
        }
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        .shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          background-size: 1000px 100%;
          animation: shimmer 2s infinite;
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(168, 85, 247, 0.4); }
          50% { box-shadow: 0 0 40px rgba(168, 85, 247, 0.8), 0 0 60px rgba(236, 72, 153, 0.4); }
        }
      `}</style>

      {/* Hero Section */}
      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex items-center justify-between mb-8">
            <button className="flex items-center gap-2 px-4 py-2 bg-white/90 hover:bg-white backdrop-blur-xl rounded-full transition-all duration-300 hover:scale-105 text-gray-700 border border-gray-200 shadow-md">
              <Home className="w-4 h-4" />
              <span>Home</span>
            </button>
            <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 rounded-full transition-all duration-300 hover:scale-105 text-white font-semibold shadow-lg">
              <Plus className="w-5 h-5" />
              Create Competition
            </button>
          </div>

          {/* Animated Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center mb-6 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 rounded-full blur-3xl opacity-40 animate-pulse"></div>
              <div className="relative p-6 bg-gradient-to-br from-pink-500 to-purple-500 rounded-3xl shadow-2xl" style={{ animation: 'glow 3s ease-in-out infinite' }}>
                <Layers className="w-16 h-16 text-white" />
              </div>
            </div>
            <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 mb-4 tracking-tight">
              Cookoff Arena
            </h1>
            <p className="text-xl text-gray-700 max-w-2xl mx-auto font-medium">
              Join live battles, watch epic replays, and become a culinary legend
            </p>
          </div>

          {/* Animated Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { icon: TrendingUp, label: 'Total Battles', value: stats.total, color: 'from-blue-500 to-cyan-500' },
              { icon: Zap, label: 'Live Now', value: stats.live, color: 'from-green-500 to-emerald-500' },
              { icon: Star, label: 'Judging', value: stats.judging, color: 'from-amber-500 to-orange-500' },
              { icon: Trophy, label: 'Champions', value: '42', color: 'from-purple-500 to-pink-500' }
            ].map((stat, i) => (
              <div
                key={i}
                className="relative group cursor-pointer"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500 rounded-2xl" style={{ backgroundImage: `linear-gradient(to right, var(--tw-gradient-stops))` }}></div>
                <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 hover:bg-white/20 transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${stat.color} mb-3`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-sm text-purple-200 mb-1">{stat.label}</div>
                  <div className="text-3xl font-bold text-white">{stat.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 mb-8">
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search epic battles..."
                className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all shadow-sm"
              />
            </div>
            <button className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-2xl text-white font-semibold transition-all duration-300 hover:scale-105 shadow-lg">
              Search
            </button>
          </div>

          {/* Status Filter Pills */}
          <div className="flex flex-wrap gap-3 mb-6">
            {STATUS_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  onClick={() => setStatus(opt.id)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all duration-300 hover:scale-105 shadow-md ${
                    status === opt.id
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Theme Filter */}
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              Filter by Theme
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTheme('')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm ${
                  theme === '' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                All Themes
              </button>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105 shadow-sm ${
                    theme === t.id
                      ? `bg-gradient-to-r ${t.gradient} text-white shadow-lg`
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  <span className="mr-1">{t.icon}</span>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Competition Cards Grid */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 pb-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, i) => (
            <div
              key={item.id}
              className="group relative cursor-pointer"
              onMouseEnter={() => setHoveredCard(item.id)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className={`absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl blur-xl opacity-0 group-hover:opacity-50 transition-all duration-500`}></div>
              
              <div className="relative bg-white/90 backdrop-blur-xl border border-gray-200 rounded-3xl overflow-hidden hover:bg-white transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                {/* Card Header */}
                <div className={`relative h-32 bg-gradient-to-r ${THEMES.find(t => t.name === item.themeName)?.gradient || 'from-purple-400 to-pink-400'} overflow-hidden`}>
                  {item.status === 'live' && (
                    <div className="absolute inset-0 shimmer"></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20"></div>
                  <div className="relative h-full p-4 flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div className={`px-3 py-1 rounded-full text-xs font-bold text-white ${getStatusBadge(item.status)} shadow-lg`}>
                        {item.status === 'live' && <Zap className="inline w-3 h-3 mr-1" />}
                        {item.status.toUpperCase()}
                      </div>
                      {item.isPrivate && (
                        <div className="px-3 py-1 rounded-full text-xs font-semibold bg-white/90 backdrop-blur-sm text-gray-700 border border-gray-200 shadow-sm">
                          🔒 Private
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-white drop-shadow-lg">
                      <div className="flex items-center gap-2">
                        <Flame className="w-4 h-4" />
                        <span className="text-sm font-semibold">{item.timeLimitMinutes}min</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span className="text-sm font-semibold">{item.participants}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 bg-white">
                  <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-purple-600 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-4">Theme: {item.themeName}</p>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Calendar className="w-4 h-4" />
                      {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-full text-white text-sm font-semibold transition-all duration-300 hover:scale-105 shadow-md">
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Footer */}
        <div className="mt-12 relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-3xl blur-2xl opacity-30 group-hover:opacity-50 transition-all duration-500"></div>
          <div className="relative bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl p-8 border border-purple-300 shadow-2xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-white">
                <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  <Sparkles className="w-6 h-6" />
                  Ready to Battle?
                </h3>
                <p className="text-purple-100">Create your own cookoff and challenge the community!</p>
              </div>
              <button className="px-8 py-4 bg-white text-purple-600 hover:bg-purple-50 rounded-full font-bold text-lg transition-all duration-300 hover:scale-105 shadow-2xl whitespace-nowrap">
                <Plus className="w-5 h-5 inline mr-2" />
                Create Competition
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
