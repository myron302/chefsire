import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { ChefHat, Sparkles, Timer, Users, Lock, Globe, Zap, Star, Trophy, Flame, ArrowRight, Wand2 } from 'lucide-react';

const THEMES = [
  { id: 'freestyle', name: 'Freestyle', icon: '🎨', blurb: 'Anything goes!', gradient: 'from-purple-500 via-pink-500 to-orange-500', glow: 'purple' },
  { id: 'italian', name: 'Italian Night', icon: '🇮🇹', blurb: 'Pasta perfection', gradient: 'from-green-500 via-white to-red-500', glow: 'green' },
  { id: 'taco', name: 'Taco Tuesday', icon: '🌮', blurb: 'Fiesta flavors', gradient: 'from-yellow-400 to-orange-500', glow: 'orange' },
  { id: 'asian', name: 'Asian Fusion', icon: '🥢', blurb: 'Bold & balanced', gradient: 'from-red-500 to-yellow-400', glow: 'red' },
  { id: 'comfort', name: 'Comfort Food', icon: '🍲', blurb: 'Soul-warming', gradient: 'from-amber-600 to-orange-400', glow: 'amber' },
  { id: 'healthy', name: 'Healthy Fit', icon: '🥗', blurb: 'Lean & clean', gradient: 'from-green-400 to-emerald-500', glow: 'emerald' },
  { id: 'desserts', name: 'Desserts', icon: '🍰', blurb: 'Sweet victories', gradient: 'from-pink-400 to-rose-500', glow: 'pink' },
  { id: 'quick', name: '30-Min Sprint', icon: '⏱️', blurb: 'Speed cooking', gradient: 'from-blue-400 to-cyan-500', glow: 'cyan' },
  { id: 'budget', name: '$10 Challenge', icon: '💰', blurb: 'Thrifty genius', gradient: 'from-green-600 to-teal-500', glow: 'teal' },
  { id: 'leftover', name: 'Leftover Remix', icon: '♻️', blurb: 'Zero waste hero', gradient: 'from-emerald-500 to-green-600', glow: 'green' },
  { id: 'regional', name: 'Regional', icon: '🌍', blurb: 'Local legends', gradient: 'from-purple-500 to-pink-500', glow: 'purple' },
  { id: 'bbq', name: 'BBQ & Grilling', icon: '🔥', blurb: 'Smoky & charred', gradient: 'from-red-600 to-orange-600', glow: 'red' },
  { id: 'breakfast', name: 'Breakfast', icon: '🥞', blurb: 'Morning fuel', gradient: 'from-yellow-300 to-orange-400', glow: 'yellow' },
  { id: 'seafood', name: 'Seafood', icon: '🦞', blurb: 'Ocean\'s bounty', gradient: 'from-blue-500 to-cyan-400', glow: 'cyan' },
  { id: 'vegan', name: 'Vegan/Veggie', icon: '🌱', blurb: 'Plant power', gradient: 'from-green-500 to-lime-400', glow: 'lime' },
  { id: 'street-food', name: 'Street Food', icon: '🍢', blurb: 'Global street eats', gradient: 'from-orange-500 to-red-500', glow: 'orange' },
  { id: 'holiday', name: 'Holiday', icon: '🎄', blurb: 'Festive feasts', gradient: 'from-red-500 to-green-500', glow: 'red' },
  { id: 'fusion', name: 'Wild Fusion', icon: '🌪️', blurb: 'Creative chaos', gradient: 'from-indigo-500 to-purple-500', glow: 'purple' },
  { id: 'one-pot', name: 'One-Pot', icon: '🍯', blurb: 'Simple & hearty', gradient: 'from-amber-500 to-yellow-500', glow: 'amber' },
  { id: 'appetizers', name: 'Appetizers', icon: '🥟', blurb: 'Small bites', gradient: 'from-orange-400 to-pink-400', glow: 'orange' },
  { id: 'soups', name: 'Soups & Stews', icon: '🥘', blurb: 'Warming bowls', gradient: 'from-orange-600 to-red-600', glow: 'orange' },
  { id: 'pizza', name: 'Pizza', icon: '🍕', blurb: 'Dough mastery', gradient: 'from-red-500 to-yellow-500', glow: 'red' },
  { id: 'burgers', name: 'Burgers', icon: '🍔', blurb: 'Stacked high', gradient: 'from-yellow-500 to-red-500', glow: 'yellow' },
  { id: 'spicy', name: 'Spicy Heat', icon: '🌶️', blurb: 'Fire & flavor', gradient: 'from-red-600 to-orange-700', glow: 'red' },
  { id: 'kid-friendly', name: 'Kid-Friendly', icon: '👶', blurb: 'Family fun', gradient: 'from-blue-300 to-pink-300', glow: 'blue' },
  { id: 'farm-table', name: 'Farm-to-Table', icon: '🌾', blurb: 'Fresh & local', gradient: 'from-green-600 to-yellow-600', glow: 'green' },
  { id: 'french', name: 'French', icon: '🇫🇷', blurb: 'Elegant & refined', gradient: 'from-blue-500 to-red-500', glow: 'blue' },
  { id: 'mexican', name: 'Mexican', icon: '🇲🇽', blurb: 'Bold & vibrant', gradient: 'from-green-500 to-red-500', glow: 'green' },
  { id: 'japanese', name: 'Japanese', icon: '🇯🇵', blurb: 'Precision & art', gradient: 'from-red-500 to-white', glow: 'red' },
  { id: 'indian', name: 'Indian Curry', icon: '🇮🇳', blurb: 'Spice symphony', gradient: 'from-orange-500 to-green-500', glow: 'orange' }
];

const DURATIONS = [30, 45, 60, 90, 120];

export default function CreateCompetitionPage() {
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState('');
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [duration, setDuration] = useState(60);
  const [isPrivate, setIsPrivate] = useState(false);
  const [minVoters, setMinVoters] = useState(3);
  const [step, setStep] = useState(1);
  const [hoveredTheme, setHoveredTheme] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);

  const handleCreate = async () => {
    if (!selectedTheme) return;

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/competitions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title || null,
          themeName: selectedTheme.id,
          recipeId: null,
          isPrivate,
          timeLimitMinutes: duration,
          minOfficialVoters: minVoters,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create competition');
      }

      const data = await response.json();

      // Navigate to the created competition
      setLocation(`/competitions/${data.id}`);
    } catch (err) {
      console.error('Error creating competition:', err);
      setError(err.message || 'Failed to create competition. Please try again.');
      setIsCreating(false);
    }
  };

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-200 via-purple-200 to-rose-200 relative overflow-hidden">
      {/* REDUCED Animated background - only 6 elements */}
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
              animation: `gentle-float ${Math.random() * 35 + 25}s ease-in-out infinite`,
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
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(168, 85, 247, 0.5); }
          50% { box-shadow: 0 0 60px rgba(168, 85, 247, 0.8), 0 0 100px rgba(236, 72, 153, 0.5); }
        }
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        .shimmer-effect {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          background-size: 1000px 100%;
          animation: shimmer 2.5s infinite;
        }
      `}</style>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-12">
        {/* Header with animated chef icon */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center mb-6 relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 rounded-full blur-3xl opacity-40 animate-pulse"></div>
            <div 
              className="relative p-8 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full shadow-2xl transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12"
              style={{ animation: 'pulse-glow 3s ease-in-out infinite' }}
            >
              <ChefHat className="w-20 h-20 text-white" />
            </div>
            <div className="absolute -top-2 -right-2 p-2 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full animate-bounce shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-900 via-purple-900 to-pink-900 mb-4 tracking-tight drop-shadow-sm">
            Create Your Cookoff
          </h1>
          <p className="text-xl text-gray-900 font-semibold drop-shadow-sm">Design an epic culinary battle in 3 simple steps</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-3">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex items-center gap-3 transition-all duration-500 ${step >= s ? 'opacity-100' : 'opacity-40'}`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-500 shadow-lg ${
                  step >= s
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white scale-110'
                    : 'bg-white/70 text-gray-400 border border-gray-200'
                }`}>
                  {step > s ? '✓' : s}
                </div>
                <span className="text-gray-800 font-semibold">
                  {s === 1 ? 'Theme' : s === 2 ? 'Details' : 'Settings'}
                </span>
              </div>
            ))}
          </div>
          <div className="h-3 bg-white/70 rounded-full overflow-hidden backdrop-blur-xl border border-gray-200 shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 transition-all duration-500 rounded-full shimmer-effect"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Step 1: Theme Selection */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold text-gray-900 mb-3 flex items-center justify-center gap-3 drop-shadow-sm">
                <Wand2 className="w-8 h-8 text-purple-600" />
                Choose Your Theme
              </h2>
              <p className="text-gray-800 text-lg font-medium">Pick the culinary style that defines your battle ({THEMES.length} themes available)</p>
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 max-h-[600px] overflow-y-auto pr-2">
              {THEMES.map((theme, i) => (
                <div
                  key={theme.id}
                  className="relative group cursor-pointer"
                  onClick={() => setSelectedTheme(theme)}
                  onMouseEnter={() => setHoveredTheme(theme.id)}
                  onMouseLeave={() => setHoveredTheme(null)}
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  {selectedTheme?.id === theme.id && (
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-2xl blur-xl animate-pulse opacity-50"></div>
                  )}
                  
                  <div className={`relative bg-white backdrop-blur-xl border-2 rounded-2xl p-6 transition-all duration-300 hover:scale-110 hover:-translate-y-2 shadow-lg ${
                    selectedTheme?.id === theme.id
                      ? 'border-purple-600 bg-white shadow-2xl scale-105'
                      : 'border-gray-300 hover:border-purple-400'
                  }`}>
                    <div className="text-5xl mb-3 transition-transform duration-300 group-hover:scale-125 group-hover:rotate-12">
                      {theme.icon}
                    </div>
                    <div className="text-gray-900 font-bold text-sm mb-1">{theme.name}</div>
                    <div className="text-gray-700 text-xs font-medium">{theme.blurb}</div>
                    
                    {selectedTheme?.id === theme.id && (
                      <div className="absolute top-2 right-2 p-1 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full shadow-lg">
                        <Star className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center mt-8">
              <button
                onClick={() => selectedTheme && setStep(2)}
                disabled={!selectedTheme}
                className="flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-full text-white font-bold text-lg transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl disabled:hover:scale-100"
              >
                Continue
                <ArrowRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold text-gray-900 mb-3 flex items-center justify-center gap-3 drop-shadow-sm">
                <Flame className="w-8 h-8 text-orange-500" />
                Competition Details
              </h2>
              <p className="text-gray-800 text-lg font-medium">Name your battle and set the duration</p>
            </div>

            <div className="max-w-2xl mx-auto space-y-6">
              {/* Title Input */}
              <div className="relative group">
                <label className="block text-gray-900 font-bold mb-3 text-lg">Battle Title</label>
                <div className="relative">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Epic Pasta Showdown"
                    className="w-full px-6 py-5 bg-white backdrop-blur-xl border-2 border-gray-300 rounded-2xl text-gray-900 placeholder-gray-500 font-medium focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all text-lg shadow-sm"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Trophy className="w-6 h-6 text-purple-500" />
                  </div>
                </div>
              </div>

              {/* Duration Selector */}
              <div>
                <label className="block text-gray-900 font-bold mb-3 text-lg flex items-center gap-2">
                  <Timer className="w-5 h-5" />
                  Time Limit
                </label>
                <div className="grid grid-cols-5 gap-3">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={`p-4 rounded-2xl font-bold text-lg transition-all duration-300 hover:scale-110 shadow-md ${
                        duration === d
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-2xl scale-110'
                          : 'bg-white text-gray-800 hover:bg-gray-50 border-2 border-gray-300'
                      }`}
                    >
                      {d}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Theme Display */}
              {selectedTheme && (
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-pink-400/20 rounded-2xl blur-xl"></div>
                  <div className="relative bg-white backdrop-blur-xl border-2 border-gray-300 rounded-2xl p-6 shadow-lg">
                    <div className="flex items-center gap-4">
                      <div className="text-6xl">{selectedTheme.icon}</div>
                      <div className="flex-1">
                        <div className="text-sm text-gray-600 mb-1 font-medium">Selected Theme</div>
                        <div className="text-2xl font-bold text-gray-900">{selectedTheme.name}</div>
                        <div className="text-gray-700 text-sm font-medium">{selectedTheme.blurb}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-medium text-sm transition-all"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-center gap-4 mt-8">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-2 px-8 py-4 bg-white hover:bg-gray-50 rounded-full text-gray-900 font-semibold border-2 border-gray-300 transition-all duration-300 hover:scale-105 shadow-md"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => title && setStep(3)}
                disabled={!title}
                className="flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-full text-white font-bold text-lg transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl disabled:hover:scale-100"
              >
                Continue
                <ArrowRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Settings */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold text-gray-900 mb-3 flex items-center justify-center gap-3 drop-shadow-sm">
                <Zap className="w-8 h-8 text-yellow-500" />
                Final Settings
              </h2>
              <p className="text-gray-800 text-lg font-medium">Configure privacy and voting requirements</p>
            </div>

            <div className="max-w-2xl mx-auto space-y-6">
              {/* Privacy Toggle */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-400/10 to-pink-400/10 rounded-2xl blur-xl"></div>
                <div className="relative bg-white backdrop-blur-xl border-2 border-gray-300 rounded-2xl p-6 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-4 rounded-2xl ${isPrivate ? 'bg-orange-100' : 'bg-green-100'}`}>
                        {isPrivate ? <Lock className="w-8 h-8 text-orange-600" /> : <Globe className="w-8 h-8 text-green-600" />}
                      </div>
                      <div>
                        <div className="text-xl font-bold text-gray-900 mb-1">
                          {isPrivate ? 'Private Competition' : 'Public Competition'}
                        </div>
                        <div className="text-gray-700 text-sm font-medium">
                          {isPrivate ? 'Only people with invite link can join' : 'Anyone can discover and join'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsPrivate(!isPrivate)}
                      className={`relative w-20 h-10 rounded-full transition-all duration-300 ${
                        isPrivate ? 'bg-orange-500' : 'bg-green-500'
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-8 h-8 bg-white rounded-full shadow-lg transition-all duration-300 ${
                          isPrivate ? 'right-1' : 'left-1'
                        }`}
                      ></div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Min Voters */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-cyan-400/10 rounded-2xl blur-xl"></div>
                <div className="relative bg-white backdrop-blur-xl border-2 border-gray-300 rounded-2xl p-6 shadow-lg">
                  <label className="block text-gray-900 font-bold mb-4 text-lg flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Minimum Voters for Official Status
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={minVoters}
                      onChange={(e) => setMinVoters(Number(e.target.value))}
                      className="flex-1 h-3 bg-gray-200 rounded-full appearance-none cursor-pointer accent-purple-500"
                    />
                    <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500 w-20 text-center">
                      {minVoters}
                    </div>
                  </div>
                  <p className="text-gray-700 text-sm mt-2 font-medium">
                    Competition needs {minVoters} viewer votes to become "official"
                  </p>
                </div>
              </div>

              {/* Summary Card */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur-2xl opacity-20 animate-pulse"></div>
                <div className="relative bg-gradient-to-r from-purple-100 to-pink-100 backdrop-blur-xl border-2 border-purple-300 rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center gap-3 mb-4">
                    <Sparkles className="w-6 h-6 text-purple-600" />
                    <h3 className="text-2xl font-bold text-gray-900">Competition Summary</h3>
                  </div>
                  <div className="space-y-3 text-gray-900">
                    <div className="flex items-center justify-between py-2 border-b border-purple-200">
                      <span className="text-gray-700 font-medium">Title:</span>
                      <span className="font-bold">{title || 'Untitled'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-purple-200">
                      <span className="text-gray-700 font-medium">Theme:</span>
                      <span className="font-bold flex items-center gap-2">
                        <span>{selectedTheme?.icon}</span>
                        {selectedTheme?.name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-purple-200">
                      <span className="text-gray-700 font-medium">Duration:</span>
                      <span className="font-bold">{duration} minutes</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-purple-200">
                      <span className="text-gray-700 font-medium">Privacy:</span>
                      <span className="font-bold">{isPrivate ? '🔒 Private' : '🌍 Public'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-gray-700 font-medium">Min Voters:</span>
                      <span className="font-bold">{minVoters} people</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="max-w-2xl mx-auto mt-4">
                <div className="bg-red-100 border-2 border-red-300 rounded-2xl p-4 text-red-800 font-medium text-center">
                  {error}
                </div>
              </div>
            )}

            <div className="flex justify-center gap-4 mt-8">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={isCreating}
                className="flex items-center gap-2 px-8 py-4 bg-white hover:bg-gray-50 rounded-full text-gray-900 font-semibold border-2 border-gray-300 transition-all duration-300 hover:scale-105 shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={isCreating}
                className="relative group flex items-center gap-3 px-12 py-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-full text-white font-bold text-xl transition-all duration-300 hover:scale-110 shadow-2xl overflow-hidden disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <div className="absolute inset-0 shimmer-effect"></div>
                <Trophy className="w-7 h-7 relative z-10" />
                <span className="relative z-10">
                  {isCreating ? 'Creating...' : 'Launch Competition!'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
