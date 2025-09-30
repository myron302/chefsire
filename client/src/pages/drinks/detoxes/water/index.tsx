import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { 
  Sparkles, Clock, Users, Trophy, Heart, Star, Calendar, 
  CheckCircle, Target, Flame, Droplets, Leaf, Apple,
  Timer, Award, TrendingUp, ChefHat, Zap, Gift, Plus,
  Activity, BarChart3, Shuffle, Camera, Share2, PlayCircle,
  Sun, Moon, Coffee, Wind, Waves, Sunrise, ArrowRight
} from 'lucide-react';

type Params = { params?: Record<string, string> };

const detoxCategories = [
  {
    id: 'juices',
    name: 'Detox Juices',
    route: '/drinks/detoxes/juices',
    icon: Droplets,
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-600',
    description: 'Nutrient-packed juice blends for deep cleansing',
    recipeCount: 8,
    avgCalories: 105,
    featured: true
  },
  {
    id: 'teas',
    name: 'Detox Teas',
    route: '/drinks/detoxes/teas',
    icon: Coffee,
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-600',
    description: 'Healing herbal teas for gentle cleansing',
    recipeCount: 8,
    avgCalories: 4,
    featured: true
  },
  {
    id: 'waters',
    name: 'Infused Waters',
    route: '/drinks/detoxes/waters',
    icon: Waves,
    color: 'from-cyan-500 to-blue-500',
    bgColor: 'bg-cyan-50',
    textColor: 'text-cyan-600',
    description: 'Zero-calorie hydration with natural flavors',
    recipeCount: 12,
    avgCalories: 10,
    featured: true
  }
];

const detoxPrograms = [
  {
    id: 'green-reset',
    name: '3-Day Green Reset',
    duration: 3,
    difficulty: 'Easy',
    icon: Leaf,
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-600',
    description: 'Gentle cleanse focused on leafy greens and hydration',
    benefits: ['Improved energy', 'Clear skin', 'Better digestion'],
    drinks: ['Green juice', 'Cucumber mint water', 'Spinach smoothie'],
    participants: 2847,
    rating: 4.8,
    calories: 1200,
    featured: true
  },
  {
    id: 'juice-cleanse',
    name: '5-Day Juice Cleanse',
    duration: 5,
    difficulty: 'Medium',
    icon: Droplets,
    color: 'from-orange-500 to-red-500',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-600',
    description: 'Full juice cleanse with multiple daily servings',
    benefits: ['Weight management', 'Toxin elimination', 'Mental clarity'],
    drinks: ['Carrot ginger', 'Beet apple', 'Green detox', 'Citrus blast'],
    participants: 1923,
    rating: 4.6,
    calories: 1000,
    featured: true
  },
  {
    id: 'herbal-infusion',
    name: '7-Day Herbal Detox',
    duration: 7,
    difficulty: 'Easy',
    icon: Coffee,
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-600',
    description: 'Healing herbs and teas for gentle cleansing',
    benefits: ['Reduced inflammation', 'Better sleep', 'Stress relief'],
    drinks: ['Dandelion tea', 'Ginger turmeric', 'Chamomile blend'],
    participants: 1567,
    rating: 4.7,
    calories: 1400,
    featured: false
  },
  {
    id: 'water-detox',
    name: '1-Day Water Flush',
    duration: 1,
    difficulty: 'Hard',
    icon: Waves,
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-600',
    description: 'Intensive hydration-focused cleanse',
    benefits: ['Quick reset', 'Hydration boost', 'System flush'],
    drinks: ['Lemon water', 'Coconut water', 'Herbal tea'],
    participants: 3421,
    rating: 4.5,
    calories: 800,
    featured: true
  },
  {
    id: 'seasonal-spring',
    name: 'Spring Renewal',
    duration: 14,
    difficulty: 'Medium',
    icon: Sunrise,
    color: 'from-yellow-500 to-green-500',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-600',
    description: 'Two-week seasonal cleanse with spring ingredients',
    benefits: ['Seasonal alignment', 'Energy boost', 'Allergy relief'],
    drinks: ['Dandelion greens', 'Nettle tea', 'Spring berry blend'],
    participants: 892,
    rating: 4.9,
    calories: 1300,
    featured: false
  }
];

const dailyTasks = [
  { id: 1, task: 'Morning lemon water', time: '7:00 AM', completed: true, points: 10 },
  { id: 2, task: 'Green juice', time: '10:00 AM', completed: true, points: 15 },
  { id: 3, task: 'Afternoon cleanse drink', time: '2:00 PM', completed: false, points: 15 },
  { id: 4, task: 'Herbal tea', time: '4:00 PM', completed: false, points: 10 },
  { id: 5, task: 'Evening elixir', time: '7:00 PM', completed: false, points: 15 }
];

const achievements = [
  { id: 'first-day', name: 'First Day Complete', description: 'Finish your first cleanse day', progress: 1, total: 1, unlocked: true },
  { id: 'three-day', name: '3-Day Warrior', description: 'Complete a 3-day program', progress: 2, total: 3, unlocked: false },
  { id: 'week-long', name: 'Week Champion', description: 'Complete a 7-day cleanse', progress: 0, total: 7, unlocked: false },
  { id: 'community', name: 'Community Member', description: 'Join 5 group challenges', progress: 3, total: 5, unlocked: false }
];

const communityStats = {
  activePrograms: 156,
  completedToday: 89,
  totalParticipants: 12847,
  averageRating: 4.7
};

export default function DetoxesPage({ params }: Params) {
  const [selectedProgram, setSelectedProgram] = useState(detoxPrograms[0]);
  const [currentDay, setCurrentDay] = useState(1);
  const [showAchievements, setShowAchievements] = useState(false);
  const [userPoints, setUserPoints] = useState(145);
  const [tasks, setTasks] = useState(dailyTasks);
  const [streak, setStreak] = useState(3);
  
  const type = params?.type?.replaceAll("-", " ");

  const completedTasksToday = tasks.filter(t => t.completed).length;
  const dailyProgress = (completedTasksToday / tasks.length) * 100;

  const handleTaskComplete = (taskId: number) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { ...task, completed: !task.completed }
        : task
    ));
    
    const task = tasks.find(t => t.id === taskId);
    if (task && !task.completed) {
      setUserPoints(prev => prev + task.points);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
            <Leaf className="h-10 w-10 text-green-500" />
            Detoxes & Cleanses
            {type && <span className="text-muted-foreground">• {type}</span>}
          </h1>
          <p className="text-lg text-muted-foreground mt-2">
            Wellness-focused cleanse programs with community support
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-600">{userPoints} pts</div>
          <div className="text-sm text-muted-foreground">
            <Flame className="h-4 w-4 inline mr-1 text-orange-500" />
            {streak} day streak
          </div>
        </div>
      </div>

      {/* Daily Progress Card */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-semibold">Today's Progress</h3>
              <p className="text-sm text-muted-foreground">Day {currentDay} of {selectedProgram.duration}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-green-600">{Math.round(dailyProgress)}%</div>
              <div className="text-sm text-muted-foreground">{completedTasksToday}/{tasks.length} tasks</div>
            </div>
          </div>
          <Progress value={dailyProgress} className="h-3 mb-2" />
          <p className="text-sm text-green-700">
            {completedTasksToday === tasks.length 
              ? "Amazing! All tasks completed today!" 
              : `${tasks.length - completedTasksToday} tasks remaining`}
          </p>
        </CardContent>
      </Card>

      {/* Detox Categories - Quick Navigation */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Explore Detox Types</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {detoxCategories.map(category => (
            <Link key={category.id} href={category.route}>
              <Card className="cursor-pointer hover:shadow-xl transition-all hover:-translate-y-2 overflow-hidden">
                <div className={`h-2 bg-gradient-to-r ${category.color}`} />
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-full ${category.bgColor}`}>
                      <category.icon className={`h-8 w-8 ${category.textColor}`} />
                    </div>
                    {category.featured && (
                      <Badge className="bg-yellow-500">
                        <Star className="h-3 w-3 mr-1" />
                        Popular
                      </Badge>
                    )}
                  </div>
                  
                  <h3 className="text-xl font-bold mb-2">{category.name}</h3>
                  <p className="text-gray-600 mb-4 text-sm">{category.description}</p>
                  
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="text-center p-2 bg-gray-50 rounded">
                      <div className="font-bold text-lg">{category.recipeCount}</div>
                      <div className="text-xs text-gray-600">Recipes</div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 rounded">
                      <div className="font-bold text-lg">{category.avgCalories}</div>
                      <div className="text-xs text-gray-600">Avg Cal</div>
                    </div>
                  </div>
                  
                  <Button className={`w-full bg-gradient-to-r ${category.color}`}>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Explore {category.name}
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Program Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Program Cards */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Choose Your Program</h2>
              <Button variant="outline" onClick={() => setShowAchievements(!showAchievements)}>
                <Trophy className="h-4 w-4 mr-2" />
                Achievements
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {detoxPrograms.map(program => (
                <Card 
                  key={program.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    selectedProgram.id === program.id ? 'ring-2 ring-green-500' : ''
                  }`}
                  onClick={() => setSelectedProgram(program)}
                >
                  <div className={`h-2 bg-gradient-to-r ${program.color}`} />
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${program.bgColor}`}>
                          <program.icon className={`h-6 w-6 ${program.textColor}`} />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{program.name}</h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{program.duration} days</span>
                            <span>•</span>
                            <span>{program.difficulty}</span>
                          </div>
                        </div>
                      </div>
                      {program.featured && (
                        <Badge className="bg-yellow-500">
                          <Star className="h-3 w-3 mr-1" />
                          Featured
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground mb-3">
                      {program.description}
                    </p>

                    <div className="space-y-2 mb-3">
                      <div className="text-sm font-semibold">Key Benefits:</div>
                      <div className="flex flex-wrap gap-1">
                        {program.benefits.map(benefit => (
                          <Badge key={benefit} variant="outline" className="text-xs">
                            {benefit}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {program.participants.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          {program.rating}
                        </span>
                      </div>
                      <Button 
                        size="sm"
                        className={selectedProgram.id === program.id ? 'bg-green-600' : ''}
                      >
                        {selectedProgram.id === program.id ? 'Selected' : 'Select'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Today's Tasks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-6 w-6 text-green-600" />
                Today's Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tasks.map(task => (
                  <div 
                    key={task.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      task.completed ? 'bg-green-50 border-green-200' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleTaskComplete(task.id)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          task.completed 
                            ? 'bg-green-500 border-green-500' 
                            : 'border-gray-300 hover:border-green-500'
                        }`}
                      >
                        {task.completed && <CheckCircle className="h-4 w-4 text-white" />}
                      </button>
                      <div>
                        <div className={`font-medium ${task.completed ? 'line-through text-gray-500' : ''}`}>
                          {task.task}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {task.time}
                        </div>
                      </div>
                    </div>
                    <Badge variant={task.completed ? "secondary" : "default"}>
                      +{task.points} pts
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Achievements Panel */}
          {showAchievements && (
            <Card className="border-2 border-yellow-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-6 w-6 text-yellow-500" />
                  Your Achievements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {achievements.map(achievement => (
                    <div 
                      key={achievement.id} 
                      className={`p-4 rounded-lg border ${
                        achievement.unlocked 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">{achievement.name}</span>
                        {achievement.unlocked && <CheckCircle className="h-5 w-5 text-green-500" />}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{achievement.description}</p>
                      <Progress value={(achievement.progress / achievement.total) * 100} className="h-2" />
                      <div className="text-xs text-muted-foreground mt-1">
                        {achievement.progress}/{achievement.total}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Program Details & Actions */}
        <div className="space-y-6">
          {/* Selected Program Details */}
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Program Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-bold text-xl mb-2">{selectedProgram.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedProgram.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-muted-foreground">Duration</div>
                  <div className="font-bold">{selectedProgram.duration} days</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-muted-foreground">Difficulty</div>
                  <div className="font-bold">{selectedProgram.difficulty}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-muted-foreground">Daily Calories</div>
                  <div className="font-bold">{selectedProgram.calories}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-muted-foreground">Rating</div>
                  <div className="font-bold flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    {selectedProgram.rating}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Daily Drinks</h4>
                <div className="space-y-2">
                  {selectedProgram.drinks.map((drink, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <Droplets className="h-4 w-4 text-green-600" />
                      <span>{drink}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <Button className="w-full bg-green-600 hover:bg-green-700">
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Start Program
                </Button>
                <Button variant="outline" className="w-full">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share with Friends
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Community Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-600" />
                Community
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Active Programs</span>
                <span className="font-bold">{communityStats.activePrograms}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Completed Today</span>
                <span className="font-bold">{communityStats.completedToday}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Participants</span>
                <span className="font-bold">{communityStats.totalParticipants.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Avg Rating</span>
                <span className="font-bold flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  {communityStats.averageRating}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
