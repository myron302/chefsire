import React, { useState, useEffect } from ‘react’;
import { Card, CardContent } from “@/components/ui/card”;
import { Badge } from “@/components/ui/badge”;
import { Button } from “@/components/ui/button”;
import { Progress } from “@/components/ui/progress”;
import {
Sparkles, Clock, Users, Trophy, Heart, Star, Calendar,
CheckCircle, Target, Flame, Droplets, Leaf, Apple,
Timer, Award, TrendingUp, ChefHat, Zap, Gift
} from ‘lucide-react’;

type Params = { params?: Record<string, string> };

// Mock data for detox programs
const detoxPrograms = [
{
id: 1,
name: “Green Goddess 3-Day Reset”,
duration: “3 days”,
difficulty: “Beginner”,
participants: 2847,
rating: 4.8,
description: “Gentle introduction to detoxing with nutrient-rich green juices”,
benefits: [“Increased Energy”, “Better Digestion”, “Clearer Skin”],
calories: “800-1000/day”,
image: “https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400&h=300&fit=crop”,
featured: true,
trending: true
},
{
id: 2,
name: “Citrus Burst 1-Day Cleanse”,
duration: “1 day”,
difficulty: “Beginner”,
participants: 1563,
rating: 4.6,
description: “Quick vitamin C boost with energizing citrus blends”,
benefits: [“Vitamin C Boost”, “Immune Support”, “Mental Clarity”],
calories: “600-800/day”,
image: “https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400&h=300&fit=crop”,
featured: false,
trending: false
},
{
id: 3,
name: “Ultimate 7-Day Transformation”,
duration: “7 days”,
difficulty: “Advanced”,
participants: 892,
rating: 4.9,
description: “Complete body reset with structured meal plans and supplements”,
benefits: [“Deep Cleanse”, “Weight Loss”, “Habit Reset”, “Increased Metabolism”],
calories: “1000-1200/day”,
image: “https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop”,
featured: true,
trending: true
}
];

const quickDetoxes = [
{
name: “Morning Kickstart”,
time: “5 min”,
ingredients: [“Lemon”, “Ginger”, “Cayenne”, “Water”],
benefits: “Metabolism boost”,
icon: “🌅”
},
{
name: “Green Power Shot”,
time: “3 min”,
ingredients: [“Spinach”, “Apple”, “Cucumber”, “Mint”],
benefits: “Instant energy”,
icon: “⚡”
},
{
name: “Afternoon Refresh”,
time: “4 min”,
ingredients: [“Cucumber”, “Lime”, “Coconut Water”],
benefits: “Hydration boost”,
icon: “💧”
}
];

const userStats = {
level: 8,
xp: 1250,
streak: 5,
completedDetoxes: 12,
totalDays: 28,
badges: [“Green Warrior”, “Consistency King”, “Detox Explorer”]
};

export default function DetoxesPage({ params }: Params) {
const type = params?.type?.replaceAll(”-”, “ “);
const [selectedProgram, setSelectedProgram] = useState(null);
const [currentChallenge, setCurrentChallenge] = useState({
name: “7-Day Green Challenge”,
progress: 65,
participants: 1247,
daysLeft: 2
});
const [showSuccess, setShowSuccess] = useState(false);

const handleStartProgram = (program) => {
setSelectedProgram(program);
setShowSuccess(true);
setTimeout(() => setShowSuccess(false), 3000);
};

const getDifficultyColor = (difficulty) => {
switch(difficulty) {
case ‘Beginner’: return ‘bg-green-100 text-green-800’;
case ‘Intermediate’: return ‘bg-yellow-100 text-yellow-800’;
case ‘Advanced’: return ‘bg-red-100 text-red-800’;
default: return ‘bg-gray-100 text-gray-800’;
}
};

return (
<div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
{/* Success Animation */}
{showSuccess && (
<div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
<div className="bg-green-500 text-white p-6 rounded-2xl shadow-2xl animate-bounce">
<div className="text-center">
<CheckCircle className="w-16 h-16 mx-auto mb-4" />
<h2 className="text-2xl font-bold">Detox Started! 🌱</h2>
<p className="text-lg">Your journey begins now!</p>
</div>
</div>
</div>
)}

```
  <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-8">
    
    {/* Header with User Stats */}
    <div className="text-center relative">
      <div className="absolute top-0 right-0 bg-white rounded-2xl p-4 shadow-lg border">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className="font-bold">Level {userStats.level}</span>
          </div>
          <div className="flex items-center gap-1">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="font-bold">{userStats.streak} day streak</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-blue-500" />
            <span className="font-bold">{userStats.xp} XP</span>
          </div>
        </div>
      </div>

      <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
        Detox & Cleanse Hub 🌿
      </h1>
      <p className="text-xl text-gray-600 mb-6">
        Transform your body, boost your energy, and reset your health
      </p>
      
      {type && (
        <Badge className="mb-4 text-lg px-4 py-2 bg-green-100 text-green-800">
          {type}
        </Badge>
      )}
    </div>

    {/* Current Challenge Banner */}
    <Card className="bg-gradient-to-r from-green-500 to-teal-600 text-white border-0 shadow-xl">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <Target className="w-6 h-6" />
              {currentChallenge.name}
            </h3>
            <p className="text-green-100 mb-3">
              Join {currentChallenge.participants.toLocaleString()} others in this community challenge
            </p>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Timer className="w-4 h-4" />
                <span>{currentChallenge.daysLeft} days left</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{currentChallenge.participants.toLocaleString()} participants</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold mb-2">{currentChallenge.progress}%</div>
            <Progress value={currentChallenge.progress} className="w-32 mb-3" />
            <Button variant="secondary" className="bg-white text-green-600 hover:bg-green-50">
              Continue Challenge
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Quick Detox Shots */}
    <div>
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Zap className="w-6 h-6 text-yellow-500" />
        Quick Detox Shots
      </h2>
      <div className="grid md:grid-cols-3 gap-4">
        {quickDetoxes.map((shot, index) => (
          <Card key={index} className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{shot.icon}</span>
                <div>
                  <h3 className="font-bold">{shot.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-3 h-3" />
                    <span>{shot.time}</span>
                  </div>
                </div>
              </div>
              <div className="mb-3">
                <div className="flex flex-wrap gap-1">
                  {shot.ingredients.map((ingredient, i) => (
                    <span key={i} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      {ingredient}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-3">{shot.benefits}</p>
              <Button size="sm" className="w-full bg-green-500 hover:bg-green-600">
                Make Now (+25 XP)
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>

    {/* Featured Detox Programs */}
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-purple-500" />
          Detox Programs
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Calendar className="w-4 h-4 mr-1" />
            1 Day
          </Button>
          <Button variant="outline" size="sm">
            <Calendar className="w-4 h-4 mr-1" />
            3 Days
          </Button>
          <Button variant="outline" size="sm">
            <Calendar className="w-4 h-4 mr-1" />
            7+ Days
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {detoxPrograms.map((program) => (
          <Card key={program.id} className={`relative overflow-hidden transition-all hover:scale-105 hover:shadow-xl ${program.featured ? 'ring-2 ring-purple-500' : ''}`}>
            {program.featured && (
              <div className="absolute top-2 left-2 z-10">
                <Badge className="bg-purple-500 text-white">
                  <Star className="w-3 h-3 mr-1" />
                  Featured
                </Badge>
              </div>
            )}
            {program.trending && (
              <div className="absolute top-2 right-2 z-10">
                <Badge className="bg-red-500 text-white">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Trending
                </Badge>
              </div>
            )}
            
            <div className="relative">
              <img 
                src={program.image} 
                alt={program.name}
                className="w-full h-48 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute bottom-2 left-2 text-white">
                <Badge className={getDifficultyColor(program.difficulty)}>
                  {program.difficulty}
                </Badge>
              </div>
            </div>

            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold">{program.name}</h3>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                  <span className="text-sm font-bold">{program.rating}</span>
                </div>
              </div>

              <p className="text-gray-600 mb-4">{program.description}</p>

              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <span>{program.duration}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-green-500" />
                  <span>{program.participants.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Apple className="w-4 h-4 text-red-500" />
                  <span>{program.calories}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-pink-500" />
                  <span>Health boost</span>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2 text-sm">Benefits:</h4>
                <div className="flex flex-wrap gap-1">
                  {program.benefits.map((benefit, index) => (
                    <span key={index} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {benefit}
                    </span>
                  ))}
                </div>
              </div>

              <Button 
                className="w-full bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700"
                onClick={() => handleStartProgram(program)}
              >
                Start Program (+100 XP)
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>

    {/* Achievement Showcase */}
    <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
      <CardContent className="p-6">
        <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Award className="w-6 h-6 text-yellow-600" />
          Your Achievements
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          {userStats.badges.map((badge, index) => (
            <div key={index} className="flex items-center gap-3 bg-white rounded-lg p-3 shadow-sm">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-sm">{badge}</div>
                <div className="text-xs text-gray-600">Unlocked!</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            You've completed <span className="font-bold text-green-600">{userStats.completedDetoxes}</span> detoxes 
            and <span className="font-bold text-blue-600">{userStats.totalDays}</span> total cleanse days!
          </p>
        </div>
      </CardContent>
    </Card>

    {/* Community Feed Preview */}
    <Card>
      <CardContent className="p-6">
        <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-500" />
          Community Activity
        </h3>
        <div className="space-y-3">
          {[
            { user: "Sarah_Wellness", action: "completed", program: "Green Goddess 3-Day", time: "2 hours ago" },
            { user: "HealthyMike92", action: "started", program: "Citrus Burst Cleanse", time: "4 hours ago" },
            { user: "DetoxQueen", action: "shared", program: "Ultimate 7-Day", time: "6 hours ago" }
          ].map((activity, index) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {activity.user[0]}
              </div>
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-bold">{activity.user}</span> {activity.action} <span className="text-green-600 font-medium">{activity.program}</span>
                </p>
                <p className="text-xs text-gray-500">{activity.time}</p>
              </div>
              <Heart className="w-4 h-4 text-gray-400 hover:text-red-500 cursor-pointer" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
</div>
```

);
}
