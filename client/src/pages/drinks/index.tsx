import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Sparkles, Clock, Users, Trophy, Heart, Star, Calendar, 
  CheckCircle, Target, Flame, Droplets, Leaf, Apple,
  Timer, Award, TrendingUp, ChefHat, Zap, Gift, Plus,
  Dumbbell, Activity, BarChart3, Shuffle, Camera, Share2,
  Coffee, Wine, Martini, Blend, Milk, Wheat, ArrowRight,
  Crown, Shield, Rocket, Compass, Map, Navigation
} from 'lucide-react';

// User stats that sync across all drink pages
const userStats = {
  level: 15,
  xp: 2890,
  nextLevelXp: 3200,
  streak: 12,
  totalDrinks: 127,
  favoriteCategory: 'smoothies',
  achievementsUnlocked: 23,
  weeklyGoal: 7,
  weeklyProgress: 5
};

// Dynamic drink categories with real engagement metrics
const drinkCategories = [
  {
    id: 'smoothies',
    name: 'Smoothies & Bowls',
    icon: '🥤',
    gradient: 'from-purple-500 to-pink-500',
    description: 'Interactive smoothie builder with workout integration',
    features: ['Custom Builder', 'Nutrition Tracking', 'Workout Goals'],
    stats: { made: 47, favorites: 12, xpEarned: 2890 },
    trending: true,
    newFeatures: 2,
    link: '/drinks/smoothies',
    image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=400&h=300&fit=crop'
  },
  {
    id: 'detox',
    name: 'Detox & Cleanses',
    icon: '🌿',
    gradient: 'from-green-500 to-teal-500',
    description: 'Gamified detox programs with daily challenges',
    features: ['Daily Challenges', 'Progress Tracking', 'Community Goals'],
    stats: { made: 23, favorites: 8, xpEarned: 1150 },
    hot: true,
    link: '/drinks/detox',
    image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop'
  },
  {
    id: 'protein',
    name: 'Protein Shakes',
    icon: '💪',
    gradient: 'from-blue-500 to-cyan-500',
    description: 'Muscle-building shakes with fitness tracking',
    features: ['Muscle Targets', 'Macro Calculator', 'Gym Integration'],
    stats: { made: 31, favorites: 9, xpEarned: 1560 },
    comingSoon: false,
    link: '/drinks/protein-shakes',
    image: 'https://images.unsplash.com/photo-1544829099-b9a0c5303bff?w=400&h=300&fit=crop'
  },
  {
    id: 'cocktails',
    name: 'Cocktails',
    icon: '🍸',
    gradient: 'from-red-500 to-orange-500',
    description: 'Advanced mixology with AR features and cocktail battles',
    features: ['AR Mixology', 'Cocktail Battles', 'Skill Progression'],
    stats: { made: 0, favorites: 0, xpEarned: 0 },
    comingSoon: true,
    premium: true,
    link: '/drinks/cocktails',
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=300&fit=crop'
  },
  {
    id: 'mocktails',
    name: 'Mocktails',
    icon: '🍹',
    gradient: 'from-pink-500 to-rose-500',
    description: 'Family-friendly creativity contests and challenges',
    features: ['Family Challenges', 'Creative Contests', 'Kid-Safe Recipes'],
    stats: { made: 0, favorites: 0, xpEarned: 0 },
    comingSoon: true,
    link: '/drinks/mocktails',
    image: 'https://images.unsplash.com/photo-1515517224771-3094db1bd2c8?w=400&h=300&fit=crop'
  },
  {
    id: 'coffee',
    name: 'Coffee & Espresso',
    icon: '☕',
    gradient: 'from-yellow-600 to-orange-600',
    description: 'Barista-level coffee crafting with bean knowledge',
    features: ['Bean Explorer', 'Brewing Guides', 'Taste Profiles'],
    stats: { made: 26, favorites: 15, xpEarned: 780 },
    link: '/drinks/coffee',
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop'
  }
];

// Cross-platform achievements
const achievements = [
  { id: 1, name: 'Smoothie Rookie', icon: '🥤', description: 'Created first smoothie', unlocked: true },
  { id: 2, name: 'Green Machine', icon: '🌿', description: 'Completed detox challenge', unlocked: true },
  { id: 3, name: 'Protein Warrior', icon: '💪', description: 'Made 10 protein shakes', unlocked: true },
  { id: 4, name: 'Streak Master', icon: '🔥', description: '7-day creation streak', unlocked: true },
  { id: 5, name: 'Social Butterfly', icon: '👥', description: 'Shared 5 creations', unlocked: false },
  { id: 6, name: 'Mixology Expert', icon: '🍸', description: 'Master cocktail creation', unlocked: false }
];

// Weekly leaderboard
const leaderboard = [
  { rank: 1, name: 'SmoothieKing92', xp: 15420, avatar: '👑' },
  { rank: 2, name: 'HealthyVibes', xp: 12680, avatar: '🌟' },
  { rank: 3, name: 'FitnessFanatic', xp: 11250, avatar: '💪' },
  { rank: 4, name: 'You', xp: 2890, avatar: '🚀' },
  { rank: 5, name: 'WellnessWarrior', xp: 2650, avatar: '🌿' }
];

// Featured community content
const communitySpotlight = [
  {
    id: 1,
    type: 'smoothie',
    name: 'Tropical Paradise Blast',
    creator: 'HealthyVibes',
    likes: 847,
    image: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=200&h=150&fit=crop',
    trending: true
  },
  {
    id: 2,
    type: 'detox',
    name: '3-Day Green Reset',
    creator: 'DetoxQueen',
    likes: 623,
    image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=200&h=150&fit=crop',
    hot: true
  },
  {
    id: 3,
    type: 'protein',
    name: 'Post-Workout Beast Mode',
    creator: 'MuscleMaker',
    likes: 912,
    image: 'https://images.unsplash.com/photo-1544829099-b9a0c5303bff?w=200&h=150&fit=crop',
    featured: true
  }
];

export default function DrinksHubPage() {
  const [activeSection, setActiveSection] = useState('explore');
  const [timeOfDay, setTimeOfDay] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setTimeOfDay('morning');
    else if (hour < 17) setTimeOfDay('afternoon');
    else setTimeOfDay('evening');
  }, []);

  const getTimeBasedGreeting = () => {
    const greetings = {
      morning: { text: 'Good morning! Start your day right ☀️', suggestion: 'Try an energizing smoothie or detox shot' },
      afternoon: { text: 'Afternoon boost time! ⚡', suggestion: 'Perfect time for a protein shake post-workout' },
      evening: { text: 'Evening wind-down 🌙', suggestion: 'How about a relaxing herbal mocktail?' }
    };
    return greetings[timeOfDay] || greetings.morning;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative max-w-7xl mx-auto px-4 py-16 md:py-24">
          
          {/* Top Stats Bar */}
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-300" />
                <span className="font-bold">Level {userStats.level}</span>
                <span className="text-sm opacity-80">({userStats.xp}/{userStats.nextLevelXp} XP)</span>
              </div>
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-300" />
                <span className="font-bold">{userStats.streak} day streak</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-300" />
                <span className="font-bold">{userStats.achievementsUnlocked} achievements</span>
              </div>
            </div>
            <Button variant="secondary" className="bg-white/20 hover:bg-white/30 backdrop-blur-lg border-white/20">
              <Gift className="w-4 h-4 mr-2" />
              Daily Bonus
            </Button>
          </div>

          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              Drink Creation Studio
            </h1>
            <p className="text-xl md:text-2xl mb-2 opacity-90">
              {getTimeBasedGreeting().text}
            </p>
            <p className="text-lg opacity-75 mb-8">
              {getTimeBasedGreeting().suggestion}
            </p>
            
            {/* Weekly Progress */}
            <div className="max-w-md mx-auto bg-white/20 backdrop-blur-lg rounded-2xl p-6">
              <div className="flex justify-between items-center mb-3">
                <span className="font-semibold">Weekly Goal</span>
                <span className="text-sm">{userStats.weeklyProgress}/{userStats.weeklyGoal} drinks</span>
              </div>
              <Progress 
                value={(userStats.weeklyProgress / userStats.weeklyGoal) * 100} 
                className="h-3 bg-white/20" 
              />
              <p className="text-sm mt-2 opacity-75">
                {userStats.weeklyGoal - userStats.weeklyProgress} more drinks to complete your weekly goal!
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-12">
        
        {/* Navigation Tabs */}
        <div className="flex justify-center">
          <div className="bg-white p-1 rounded-2xl shadow-lg flex gap-1">
            {[
              { id: 'explore', label: '🗺️ Explore Categories', icon: Compass },
              { id: 'community', label: '👥 Community Hub', icon: Users },
              { id: 'achievements', label: '🏆 Achievements', icon: Trophy },
              { id: 'stats', label: '📊 My Stats', icon: BarChart3 }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={`px-6 py-3 rounded-xl font-medium transition-all ${
                  activeSection === tab.id 
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Explore Categories Section */}
        {activeSection === 'explore' && (
          <div className="space-y-8">
            
            {/* Quick Actions */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-r from-green-500 to-teal-500 text-white border-0">
                <CardContent className="p-6 text-center">
                  <Zap className="w-12 h-12 mx-auto mb-3" />
                  <h3 className="text-xl font-bold mb-2">Quick Smoothie</h3>
                  <p className="text-sm opacity-90 mb-4">3-minute energy boost</p>
                  <Button variant="secondary">Create Now</Button>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0">
                <CardContent className="p-6 text-center">
                  <Target className="w-12 h-12 mx-auto mb-3" />
                  <h3 className="text-xl font-bold mb-2">Daily Challenge</h3>
                  <p className="text-sm opacity-90 mb-4">Green ingredient focus</p>
                  <Button variant="secondary">Join 3,247 others</Button>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0">
                <CardContent className="p-6 text-center">
                  <Shuffle className="w-12 h-12 mx-auto mb-3" />
                  <h3 className="text-xl font-bold mb-2">Surprise Me!</h3>
                  <p className="text-sm opacity-90 mb-4">Random recipe generator</p>
                  <Button variant="secondary">Roll the Dice</Button>
                </CardContent>
              </Card>
            </div>

            {/* Drink Categories Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {drinkCategories.map((category) => (
                <Card key={category.id} className="overflow-hidden hover:shadow-2xl transition-all hover:scale-105 group">
                  <div className="relative">
                    <img 
                      src={category.image} 
                      alt={category.name}
                      className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className={`absolute inset-0 bg-gradient-to-t ${category.gradient} opacity-80`} />
                    
                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                      {category.trending && <Badge className="bg-orange-500 text-white">🔥 Trending</Badge>}
                      {category.hot && <Badge className="bg-red-500 text-white">🌶️ Hot</Badge>}
                      {category.premium && <Badge className="bg-yellow-500 text-white">👑 Premium</Badge>}
                      {category.newFeatures > 0 && <Badge className="bg-green-500 text-white">✨ {category.newFeatures} New</Badge>}
                    </div>
                    
                    {/* Coming Soon Overlay */}
                    {category.comingSoon && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="bg-white rounded-full px-4 py-2 font-bold text-gray-800">
                          🚀 Coming Soon
                        </div>
                      </div>
                    )}

                    <div className="absolute bottom-3 left-3 text-white">
                      <div className="text-4xl mb-2">{category.icon}</div>
                      <h3 className="text-2xl font-bold">{category.name}</h3>
                    </div>
                  </div>

                  <CardContent className="p-6">
                    <p className="text-gray-600 mb-4">{category.description}</p>
                    
                    {/* Features */}
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-1 mb-3">
                        {category.features.map((feature, index) => (
                          <span key={index} className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 mb-4 text-sm">
                      <div className="text-center">
                        <div className="font-bold text-lg">{category.stats.made}</div>
                        <div className="text-xs text-gray-600">made</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-lg">{category.stats.favorites}</div>
                        <div className="text-xs text-gray-600">favorites</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-lg">{category.stats.xpEarned}</div>
                        <div className="text-xs text-gray-600">XP earned</div>
                      </div>
                    </div>

                    <Button 
                      className={`w-full bg-gradient-to-r ${category.gradient} hover:opacity-90 text-white`}
                      disabled={category.comingSoon}
                    >
                      {category.comingSoon ? 'Notify Me' : 'Explore'} 
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Community Hub Section */}
        {activeSection === 'community' && (
          <div className="space-y-8">
            
            {/* Leaderboard */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-yellow-500" />
                  Weekly Leaderboard
                </h3>
                <div className="space-y-3">
                  {leaderboard.map((user) => (
                    <div key={user.rank} className={`flex items-center justify-between p-3 rounded-lg ${
                      user.name === 'You' ? 'bg-gradient-to-r from-purple-100 to-pink-100 border-2 border-purple-200' : 'bg-gray-50'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          user.rank <= 3 ? 'bg-yellow-500 text-white' : 'bg-gray-200'
                        }`}>
                          {user.rank <= 3 ? user.rank : user.avatar}
                        </div>
                        <div>
                          <div className="font-bold">{user.name}</div>
                          <div className="text-sm text-gray-600">{user.xp.toLocaleString()} XP this week</div>
                        </div>
                      </div>
                      {user.rank <= 3 && <Crown className="w-5 h-5 text-yellow-500" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Community Spotlight */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-purple-500" />
                  Community Spotlight
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {communitySpotlight.map((item) => (
                    <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-all">
                      <img src={item.image} alt={item.name} className="w-full h-32 object-cover" />
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          {item.trending && <Badge className="bg-orange-500 text-white text-xs">🔥 Trending</Badge>}
                          {item.hot && <Badge className="bg-red-500 text-white text-xs">🌶️ Hot</Badge>}
                          {item.featured && <Badge className="bg-purple-500 text-white text-xs">⭐ Featured</Badge>}
                        </div>
                        <h4 className="font-bold text-sm mb-1">{item.name}</h4>
                        <p className="text-xs text-gray-600 mb-2">by {item.creator}</p>
                        <div className="flex items-center gap-1">
                          <Heart className="w-3 h-3 text-red-500" />
                          <span className="text-xs">{item.likes}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Achievements Section */}
        {activeSection === 'achievements' && (
          <Card>
            <CardContent className="p-6">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Award className="w-6 h-6 text-yellow-500" />
                Achievements ({userStats.achievementsUnlocked}/50)
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {achievements.map((achievement) => (
                  <div key={achievement.id} className={`p-4 rounded-lg border-2 transition-all ${
                    achievement.unlocked 
                      ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200' 
                      : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}>
                    <div className="text-center">
                      <div className="text-4xl mb-2">{achievement.icon}</div>
                      <h4 className="font-bold mb-1">{achievement.name}</h4>
                      <p className="text-sm text-gray-600">{achievement.description}</p>
                      {achievement.unlocked && (
                        <CheckCircle className="w-5 h-5 text-green-500 mx-auto mt-2" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Section */}
        {activeSection === 'stats' && (
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-4">Your Journey</h3>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Drinks Created</span>
                    <span className="font-bold">{userStats.totalDrinks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current Level</span>
                    <span className="font-bold">Level {userStats.level}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Experience Points</span>
                    <span className="font-bold">{userStats.xp.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Longest Streak</span>
                    <span className="font-bold">{userStats.streak} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Favorite Category</span>
                    <span className="font-bold capitalize">{userStats.favoriteCategory}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-4">Progress to Next Level</h3>
                <div className="space-y-3">
                  <Progress 
                    value={(userStats.xp / userStats.nextLevelXp) * 100} 
                    className="h-3"
                  />
                  <div className="flex justify-between text-sm">
                    <span>{userStats.xp} XP</span>
                    <span>{userStats.nextLevelXp} XP</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {userStats.nextLevelXp - userStats.xp} XP until Level {userStats.level + 1}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}
