import React, { useState, useEffect } from 'react';
import { Flame, Users, Eye, Zap, Timer, ArrowRight, Clock, TrendingUp, Award, Crown } from 'lucide-react';

export default function LiveBattlesPage() {
  const [liveNow, setLiveNow] = useState([]);
  const [startingSoon, setStartingSoon] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch live and upcoming competitions
  useEffect(() => {
    const fetchBattles = async () => {
      try {
        // Fetch live competitions
        const liveResponse = await fetch('/api/competitions/library?status=live', {
          credentials: 'include',
        });

        // Fetch upcoming competitions
        const upcomingResponse = await fetch('/api/competitions/library?status=upcoming', {
          credentials: 'include',
        });

        if (liveResponse.ok) {
          const liveData = await liveResponse.json();
          const liveItems = (liveData.items || []).map(item => {
            // Calculate time left
            const endTime = item.endTime ? new Date(item.endTime).getTime() : Date.now();
            const now = Date.now();
            const timeLeft = Math.max(0, Math.floor((endTime - now) / 1000));

            return {
              id: item.id,
              title: item.title,
              theme: item.themeName,
              viewers: Math.floor(Math.random() * 50) + 20, // Mock viewer count for now
              timeLeft,
              participants: item.participants || 0,
              featured: false, // Can be enhanced later
            };
          });
          setLiveNow(liveItems);
        }

        if (upcomingResponse.ok) {
          const upcomingData = await upcomingResponse.json();
          const upcomingItems = (upcomingData.items || []).slice(0, 5).map(item => {
            // Calculate start time
            const startTime = item.startTime ? new Date(item.startTime).getTime() : Date.now();
            const now = Date.now();
            const startIn = Math.max(0, Math.floor((startTime - now) / (1000 * 60))); // minutes

            return {
              id: item.id,
              title: item.title,
              theme: item.themeName,
              participants: item.participants || 0,
              startIn,
            };
          });
          setStartingSoon(upcomingItems);
        }
      } catch (error) {
        console.error('Failed to fetch battles:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBattles();
    // Refresh every 30 seconds
    const interval = setInterval(fetchBattles, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-100 via-orange-100 to-yellow-100 relative overflow-hidden">
      {/* Subtle background animation - ONLY 6 elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-10"
            style={{
              background: `radial-gradient(circle, ${['#ef4444', '#f97316', '#eab308'][i % 3]} 0%, transparent 70%)`,
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
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.5); }
          50% { box-shadow: 0 0 40px rgba(239, 68, 68, 0.8); }
        }
      `}</style>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center mb-6 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 rounded-full blur-2xl opacity-30 animate-pulse"></div>
            <div 
              className="relative p-6 bg-gradient-to-br from-red-500 to-orange-500 rounded-3xl shadow-2xl"
              style={{ animation: 'pulse-glow 2s ease-in-out infinite' }}
            >
              <Flame className="w-16 h-16 text-white" />
            </div>
          </div>
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-orange-600 mb-4 tracking-tight">
            🔥 Live Battles
          </h1>
          <p className="text-xl text-gray-800 font-semibold">Jump into the action right now!</p>
          <div className="mt-4 text-gray-700 font-medium">
            <span className="text-2xl font-bold text-red-600">{liveNow.length}</span> battles happening NOW
          </div>
        </div>

        {/* Live Now Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75"></div>
                <div className="relative w-4 h-4 bg-red-500 rounded-full"></div>
              </div>
              LIVE NOW
            </h2>
            <div className="text-sm text-gray-600 font-medium">
              Auto-refreshes every 30s
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {liveNow.map((battle, i) => (
              <div
                key={battle.id}
                className={`relative group ${battle.featured ? 'md:col-span-2' : ''}`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 rounded-3xl blur-xl opacity-0 group-hover:opacity-50 transition-all duration-500"></div>
                
                <div className="relative bg-white border-2 border-gray-300 rounded-3xl overflow-hidden hover:border-red-400 transition-all duration-300 hover:scale-[1.02] shadow-xl">
                  {/* Live Banner */}
                  <div className="absolute top-4 left-4 z-10">
                    <div className="flex items-center gap-2 px-4 py-2 bg-red-500 rounded-full shadow-lg">
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                      <span className="text-white font-bold text-sm">LIVE</span>
                    </div>
                  </div>

                  {/* Gradient Header */}
                  <div className="relative h-48 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30"></div>
                    <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                      <div className="text-6xl">{battle.theme}</div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-full">
                          <Eye className="w-4 h-4 text-red-600" />
                          <span className="text-sm font-bold text-gray-900">{battle.viewers}</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-full">
                          <Users className="w-4 h-4 text-orange-600" />
                          <span className="text-sm font-bold text-gray-900">{battle.participants}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">{battle.title}</h3>
                    
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-orange-600">
                        <Timer className="w-5 h-5" />
                        <span className="text-lg font-bold">{formatTime(battle.timeLeft)} left</span>
                      </div>
                      <div className="px-3 py-1 bg-orange-100 rounded-full text-orange-700 text-xs font-semibold">
                        {Math.floor(battle.timeLeft / 60)} min remaining
                      </div>
                    </div>

                    <button 
                      onClick={() => window.location.href = `/competitions/${battle.id}`}
                      className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 rounded-2xl text-white font-bold text-lg transition-all duration-300 hover:scale-105 shadow-lg"
                    >
                      <Zap className="w-5 h-5" />
                      JOIN BATTLE NOW
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Starting Soon Section */}
        {startingSoon.length > 0 && (
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Clock className="w-8 h-8 text-orange-600" />
              Starting Soon
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              {startingSoon.map((battle) => (
                <div key={battle.id} className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-yellow-400 rounded-2xl blur-xl opacity-0 group-hover:opacity-40 transition-all duration-500"></div>
                  
                  <div className="relative bg-white border-2 border-gray-300 rounded-2xl p-6 hover:border-orange-400 transition-all duration-300 hover:scale-105 shadow-lg">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="text-4xl mb-2">{battle.theme}</div>
                        <h3 className="text-xl font-bold text-gray-900">{battle.title}</h3>
                      </div>
                      <div className="px-3 py-2 bg-orange-100 rounded-xl text-orange-700 font-bold">
                        {battle.startIn}m
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-gray-700 mb-4">
                      <Users className="w-4 h-4" />
                      <span className="text-sm font-medium">{battle.participants} waiting</span>
                    </div>

                    <button className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 rounded-xl text-white font-semibold transition-all duration-300 hover:scale-105">
                      Get Ready
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Banner */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-orange-400 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-all"></div>
          <div className="relative bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl p-6 border border-red-300 shadow-xl">
            <div className="grid grid-cols-3 gap-6 text-center text-white">
              <div>
                <TrendingUp className="w-8 h-8 mx-auto mb-2" />
                <div className="text-3xl font-black">{liveNow.reduce((sum, b) => sum + b.viewers, 0)}</div>
                <div className="text-red-100 font-medium">Total Viewers</div>
              </div>
              <div>
                <Flame className="w-8 h-8 mx-auto mb-2" />
                <div className="text-3xl font-black">{liveNow.length}</div>
                <div className="text-red-100 font-medium">Live Battles</div>
              </div>
              <div>
                <Award className="w-8 h-8 mx-auto mb-2" />
                <div className="text-3xl font-black">{liveNow.reduce((sum, b) => sum + b.participants, 0)}</div>
                <div className="text-red-100 font-medium">Competitors</div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-gray-700 font-medium mb-4">Want to browse all competitions?</p>
          <button 
            onClick={() => window.location.href = '/competitions'}
            className="px-8 py-3 bg-white hover:bg-gray-50 border-2 border-gray-300 rounded-full text-gray-900 font-semibold transition-all duration-300 hover:scale-105 shadow-md"
          >
            View All Competitions
          </button>
        </div>
      </div>
    </div>
  );
}
