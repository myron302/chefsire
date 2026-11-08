import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Search, Sparkles, Filter, Timer, Users, Trophy, Flame, Calendar, Video, Eye, Plus, Layers, Home, TrendingUp, Zap, Star } from 'lucide-react';

const THEMES = [
  { id: 'freestyle', name: 'Freestyle', icon: '🎨', gradient: 'from-purple-500 via-pink-500 to-orange-500' },
  { id: 'italian', name: 'Italian Night', icon: '🇮🇹', gradient: 'from-green-500 via-white to-red-500' },
  { id: 'taco', name: 'Taco Tuesday', icon: '🌮', gradient: 'from-yellow-400 to-orange-500' },
  { id: 'asian-fusion', name: 'Asian Fusion', icon: '🥢', gradient: 'from-red-500 to-yellow-400' },
  { id: 'comfort', name: 'Comfort Food', icon: '🍲', gradient: 'from-amber-600 to-orange-400' },
  { id: 'healthy', name: 'Healthy / Fitness', icon: '🥗', gradient: 'from-green-400 to-emerald-500' },
  { id: 'desserts', name: 'Desserts & Baking', icon: '🍰', gradient: 'from-pink-400 to-rose-500' },
  { id: 'quick', name: 'Quick 30-Min', icon: '⏱️', gradient: 'from-blue-400 to-cyan-500' },
  { id: 'budget', name: 'Budget ($10)', icon: '💰', gradient: 'from-green-600 to-teal-500' },
  { id: 'leftover', name: 'Leftover Remix', icon: '♻️', gradient: 'from-emerald-500 to-green-600' },
  { id: 'regional', name: 'Regional Specialties', icon: '🌍', gradient: 'from-purple-500 to-pink-500' },
  { id: 'bbq', name: 'BBQ & Grilling', icon: '🔥', gradient: 'from-red-600 to-orange-600' },
  { id: 'breakfast', name: 'Breakfast & Brunch', icon: '🥞', gradient: 'from-yellow-300 to-orange-400' },
  { id: 'seafood', name: 'Seafood Spectacular', icon: '🦞', gradient: 'from-blue-500 to-cyan-400' },
  { id: 'vegan', name: 'Vegan / Vegetarian', icon: '🌱', gradient: 'from-green-500 to-lime-400' },
  { id: 'street-food', name: 'Street Food', icon: '🍢', gradient: 'from-orange-500 to-red-500' },
  { id: 'holiday', name: 'Holiday & Seasonal', icon: '🎄', gradient: 'from-red-500 to-green-500' },
  { id: 'fusion', name: 'Wild Fusion', icon: '🌪️', gradient: 'from-indigo-500 to-purple-500' },
  { id: 'one-pot', name: 'One-Pot Wonders', icon: '🍯', gradient: 'from-amber-500 to-yellow-500' },
  { id: 'appetizers', name: 'Appetizers', icon: '🥟', gradient: 'from-orange-400 to-pink-400' },
  { id: 'soups', name: 'Soups & Stews', icon: '🥘', gradient: 'from-orange-600 to-red-600' },
  { id: 'pizza', name: 'Pizza & Flatbreads', icon: '🍕', gradient: 'from-red-500 to-yellow-500' },
  { id: 'burgers', name: 'Burgers & Sandwiches', icon: '🍔', gradient: 'from-yellow-500 to-red-500' },
  { id: 'spicy', name: 'Spicy Challenge', icon: '🌶️', gradient: 'from-red-600 to-orange-700' },
  { id: 'kid-friendly', name: 'Kid-Friendly', icon: '👶', gradient: 'from-blue-300 to-pink-300' },
  { id: 'farm-table', name: 'Farm-to-Table', icon: '🌾', gradient: 'from-green-600 to-yellow-600' },
  { id: 'french', name: 'French Cuisine', icon: '🇫🇷', gradient: 'from-blue-500 to-red-500' },
  { id: 'mexican', name: 'Mexican Fiesta', icon: '🇲🇽', gradient: 'from-green-500 to-red-500' },
  { id: 'japanese', name: 'Japanese', icon: '🇯🇵', gradient: 'from-red-500 to-white' },
  { id: 'indian', name: 'Indian Curry', icon: '🇮🇳', gradient: 'from-orange-500 to-green-500' }
];

const STATUS_OPTIONS = [
  { id: 'all', label: 'All', icon: Layers, color: 'gray' },
  { id: 'live', label: 'Live Now', icon: Zap, color: 'green' },
  { id: 'upcoming', label: 'Upcoming', icon: Calendar, color: 'blue' },
  { id: 'judging', label: 'Judging', icon: Star, color: 'amber' },
  { id: 'completed', label: 'Completed', icon: Trophy, color: 'purple' }
];

export default function CompetitionsLibraryPage() {
  const [, setLocation] = useLocation();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [theme, setTheme] = useState('');
  const [loading, setLoading] = useState(false);
  type CompetitionItem = {
    id: string;
    title: string;
    themeName?: string | null;
    status: string;
    isPrivate?: boolean;
    timeLimitMinutes?: number | null;
    createdAt: string;
    participants?: number;
  };
  const [items, setItems] = useState<CompetitionItem[]>([]);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  // The API reports `note` when the competitions tables have not been created in this database yet.
  const [notReady, setNotReady] = useState(false);

  // Read status from URL query parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const statusParam = urlParams.get('status');
    if (statusParam && STATUS_OPTIONS.find(opt => opt.id === statusParam)) {
      setStatus(statusParam);
    }
  }, []);

  // Real competitions from the API (the old hardcoded demo list and stats are gone).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/competitions/library?limit=100', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        if (cancelled) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setNotReady(Boolean(data?.note));
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const themeName = THEMES.find((t) => t.id === theme)?.name;
  const visibleItems = items.filter((item) =>
    (status === 'all' || item.status === status) &&
    (!themeName || item.themeName === themeName) &&
    (!q.trim() || String(item.title || '').toLowerCase().includes(q.trim().toLowerCase()))
  );
  const stats = {
    total: items.length,
    live: items.filter((item) => item.status === 'live').length,
    judging: items.filter((item) => item.status === 'judging').length,
    champions: items.filter((item) => item.status === 'completed').length,
  };

  const getStatusBadge = (s: string) => {
    const colors: Record<string, string> = {
      live: 'bg-gradient-to-r from-green-500 to-emerald-500 animate-pulse',
      judging: 'bg-gradient-to-r from-amber-500 to-orange-500',
      completed: 'bg-gradient-to-r from-blue-500 to-purple-500',
      upcoming: 'bg-gradient-to-r from-gray-500 to-slate-500'
    };
    return colors[s] || colors.upcoming;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-200 via-purple-200 to-pink-200 relative overflow-hidden">
      {/* REDUCED background effects - only 6 elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-10"
            style={{
              background: `radial-gradient(circle, ${['#a78bfa', '#ec4899', '#06b6d4'][i % 3]} 0%, transparent 70%)`,
              width: Math.random() * 300 + 150 + 'px',
              height: Math.random() * 300 + 150 + 'px',
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
              animation: `gentle-float ${Math.random() * 30 + 20}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes gentle-float {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(15px, -15px); }
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
            <button 
              onClick={() => window.location.href = '/'}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 backdrop-blur-xl rounded-full transition-all duration-300 hover:scale-105 text-gray-900 font-semibold border border-gray-300 shadow-lg"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </button>
            <button
              onClick={() => setLocation('/competitions/new')}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 rounded-full transition-all duration-300 hover:scale-105 text-white font-semibold shadow-lg"
            >
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
            <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-900 via-purple-900 to-pink-900 mb-4 tracking-tight drop-shadow-sm">
              Cookoff Arena
            </h1>
            <p className="text-xl text-gray-900 max-w-2xl mx-auto font-semibold drop-shadow-sm">
              Join live battles, watch epic replays, and become a culinary legend
            </p>
          </div>

          {/* Animated Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { icon: TrendingUp, label: 'Total Battles', value: stats.total, color: 'from-blue-500 to-cyan-500' },
              { icon: Zap, label: 'Live Now', value: stats.live, color: 'from-green-500 to-emerald-500' },
              { icon: Star, label: 'Judging', value: stats.judging, color: 'from-amber-500 to-orange-500' },
              { icon: Trophy, label: 'Champions', value: stats.champions, color: 'from-purple-500 to-pink-500' }
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
        <div className="bg-white/90 backdrop-blur-xl border-2 border-gray-300 rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600 group-hover:text-gray-900 transition-colors" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search epic battles..."
                className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-300 rounded-2xl text-gray-900 placeholder-gray-500 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all shadow-sm"
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
                  className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all duration-300 hover:scale-105 shadow-md ${
                    status === opt.id
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg scale-105'
                      : 'bg-white text-gray-900 hover:bg-gray-50 border-2 border-gray-300'
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
            <div className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              Filter by Theme ({THEMES.length} themes available)
            </div>
            <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto pr-2">
              <button
                onClick={() => setTheme('')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm ${
                  theme === '' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg scale-105' : 'bg-white text-gray-900 hover:bg-gray-50 border-2 border-gray-300'
                }`}
              >
                All Themes
              </button>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105 shadow-sm ${
                    theme === t.id
                      ? `bg-gradient-to-r ${t.gradient} text-white shadow-lg border-2 border-white`
                      : 'bg-white text-gray-900 hover:bg-gray-50 border-2 border-gray-300'
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
        {(loading || loadError || notReady || visibleItems.length === 0) && (
          <div className="bg-white/90 rounded-3xl p-10 text-center shadow-xl mb-6" role="status">
            {loading ? (
              <p className="text-gray-700 font-semibold">Loading competitions…</p>
            ) : loadError ? (
              <p className="text-gray-700 font-semibold">Competitions couldn't load right now. Please try again shortly.</p>
            ) : notReady ? (
              <p className="text-gray-900 text-xl font-bold">Cookoff Arena battles are opening soon. Check back shortly!</p>
            ) : (
              <>
                <p className="text-gray-900 text-xl font-bold mb-2">
                  {items.length === 0 ? 'No competitions yet — start the first one!' : 'No competitions match these filters.'}
                </p>
                <button
                  onClick={() => setLocation('/competitions/new')}
                  className="mt-3 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-white font-semibold shadow-md"
                >
                  Create Competition
                </button>
              </>
            )}
          </div>
        )}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleItems.map((item, i) => (
            <div
              key={item.id}
              className="group relative cursor-pointer"
              onMouseEnter={() => setHoveredCard(item.id)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className={`absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl blur-xl opacity-0 group-hover:opacity-50 transition-all duration-500`}></div>
              
              <div className="relative bg-white backdrop-blur-xl border-2 border-gray-300 rounded-3xl overflow-hidden hover:border-purple-400 transition-all duration-300 hover:scale-105 hover:shadow-2xl">
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
                        <span className="text-sm font-semibold">{item.participants ?? ''}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 bg-white">
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-purple-700 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-gray-700 font-medium text-sm mb-4">Theme: {item.themeName}</p>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-gray-700 font-medium">
                      <Calendar className="w-4 h-4" />
                      {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                    <button 
                      onClick={() => window.location.href = `/competitions/${item.id}`}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-full text-white text-sm font-semibold transition-all duration-300 hover:scale-105 shadow-md"
                    >
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
              <button
                onClick={() => setLocation('/competitions/new')}
                className="px-8 py-4 bg-white text-purple-600 hover:bg-purple-50 rounded-full font-bold text-lg transition-all duration-300 hover:scale-105 shadow-2xl whitespace-nowrap"
              >
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
