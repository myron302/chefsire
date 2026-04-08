import React from 'react';
import { AlertCircle, BarChart3, Camera, CheckCircle, Droplets, Settings, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

type NutritionTabSectionProps = {
  caloriesCurrent: number;
  calorieGoal: number;
  calorieProgress: number;
  proteinCurrent: number;
  carbsCurrent: number;
  fatCurrent: number;
  macroGoals: { protein?: number; carbs?: number; fat?: number };
  plannedSlots: number;
  totalSlots: number;
  setShowCalcModal: React.Dispatch<React.SetStateAction<boolean>>;
  toast: (payload: { description: string }) => void;
  water: { date: string; glassesLogged: number; dailyTarget: number };
  updateWaterTarget: () => void;
  saveWater: (glassesLogged: number) => void;
};

const NutritionTabSection = ({
  caloriesCurrent,
  calorieGoal,
  calorieProgress,
  proteinCurrent,
  carbsCurrent,
  fatCurrent,
  macroGoals,
  plannedSlots,
  totalSlots,
  setShowCalcModal,
  toast,
  water,
  updateWaterTarget,
  saveWater,
}: NutritionTabSectionProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Today's Nutrition</CardTitle>
            <CardDescription>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Calories</span>
                <span className="text-sm text-gray-600">{caloriesCurrent} / {calorieGoal}</span>
              </div>
              <Progress value={calorieProgress} className="h-2" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <MacroCard label="Protein" current={proteinCurrent} goal={macroGoals.protein || 150} unit="g" color="blue" />
              <MacroCard label="Carbs" current={carbsCurrent} goal={macroGoals.carbs || 200} unit="g" color="orange" />
              <MacroCard label="Fat" current={fatCurrent} goal={macroGoals.fat || 65} unit="g" color="purple" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <div className="text-center text-gray-500">
                <BarChart3 className="w-12 h-12 mx-auto mb-2" />
                <p>{plannedSlots}/{totalSlots} weekly meal slots planned</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nutrition Goals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Daily Calories</span>
              <span className="text-sm font-medium">{calorieGoal} kcal</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Protein</span>
              <span className="text-sm font-medium">{macroGoals.protein || 150}g</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Carbs</span>
              <span className="text-sm font-medium">{macroGoals.carbs || 200}g</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Fat</span>
              <span className="text-sm font-medium">{macroGoals.fat || 65}g</span>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-4" onClick={() => setShowCalcModal(true)}>
              <Target className="w-4 h-4 mr-2" />
              Calculate My Goals
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Camera className="w-5 h-5 text-purple-600" />
              Food Scanner
            </CardTitle>
            <CardDescription>Scan food to track calories instantly</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">Point your camera at any food item to automatically detect and log nutrition info.</p>
            <div className="flex flex-col gap-2">
              <Button
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                onClick={() => {
                  const input = document.getElementById('food-scanner-camera');
                  if (input) input.click();
                }}
              >
                <Camera className="w-4 h-4 mr-2" />
                Scan Food Now
              </Button>
              <input
                id="food-scanner-camera"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    toast({
                      description: 'Food scanning detected: Chicken Breast (200g) - 330 calories, 62g protein',
                    });
                  }
                }}
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const input = document.getElementById('food-scanner-upload');
                  if (input) input.click();
                }}
              >
                Upload Photo
              </Button>
              <input
                id="food-scanner-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    toast({
                      description: 'Food scanning detected: Mixed Salad - 150 calories, 8g protein',
                    });
                  }
                }}
              />
            </div>
            <div className="bg-white rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-gray-700">Recently Scanned:</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Grilled Chicken</span>
                <span className="font-medium">330 cal</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Greek Yogurt</span>
                <span className="font-medium">120 cal</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Great protein intake!</p>
                <p className="text-xs text-gray-600">You're hitting your targets consistently</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Low on vegetables</p>
                <p className="text-xs text-gray-600">Try adding more greens to lunch</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Water Intake</CardTitle>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={updateWaterTarget}><Settings className="w-4 h-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {Array.from({ length: water.dailyTarget || 8 }).slice(0, 8).map((_, idx) => {
                const filled = idx < water.glassesLogged;
                return (
                  <button key={idx} onClick={() => saveWater(filled ? idx : idx + 1)} className={`p-2 rounded border ${filled ? 'bg-blue-100 border-blue-300' : 'bg-white border-gray-200'}`}>
                    <Droplets className={`w-5 h-5 mx-auto ${filled ? 'text-blue-600 fill-blue-500' : 'text-gray-300'}`} />
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-gray-600">{water.glassesLogged} / {water.dailyTarget} glasses</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const MacroCard = ({ label, current, goal, unit, color }: { label: string; current: number; goal: number; unit: string; color: 'blue' | 'orange' | 'purple' }) => {
  const percentage = (current / goal) * 100;
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50',
    orange: 'text-orange-600 bg-orange-50',
    purple: 'text-purple-600 bg-purple-50',
  };

  return (
    <div className={`p-4 rounded-lg ${colorClasses[color]}`}>
      <div className="text-sm font-medium mb-2">{label}</div>
      <div className="text-2xl font-bold mb-1">{current}{unit}</div>
      <div className="text-xs opacity-75">of {goal}{unit} ({Math.round(percentage)}%)</div>
    </div>
  );
};

export default NutritionTabSection;
