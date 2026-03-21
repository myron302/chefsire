import React from 'react';
import { Activity, BarChart3, Coffee, Gauge, Heart, Sparkles, Target, Timer, Zap } from 'lucide-react';
import { FilterCard, GoalFilter, WorkoutDrinksSubcategoryPage } from '../shared';
import { preWorkoutDrinks } from '@/data/drinks/workout-drinks/pre-workout';

const typeCards: FilterCard[] = [
  { id: 'nitric-oxide', name: 'Nitric Oxide', description: 'Beetroot and watermelon support blood flow and perceived endurance.', icon: Gauge, detailA: 'Best for', detailAValue: 'Strength + endurance days', detailB: 'Timing', detailBValue: '60-90 min before' },
  { id: 'balanced-caffeine', name: 'Balanced Caffeine', description: 'Coffee and matcha pair alertness with carbs or theanine.', icon: Coffee, detailA: 'Best for', detailAValue: 'Focus and tempo work', detailB: 'Timing', detailBValue: '30-60 min before' },
  { id: 'carb-loading', name: 'Carb Loading', description: 'Banana and oats top off glycogen for longer efforts.', icon: BarChart3, detailA: 'Best for', detailAValue: 'Intervals and long sessions', detailB: 'Timing', detailBValue: '45-90 min before' },
];

const goalFilters: GoalFilter[] = [
  { id: 'power-output', name: 'Power Output', icon: Zap, color: 'text-orange-600' },
  { id: 'nitric-oxide', name: 'Nitric Oxide Support', icon: Activity, color: 'text-red-600' },
  { id: 'endurance-fuel', name: 'Endurance Fuel', icon: BarChart3, color: 'text-amber-600' },
  { id: 'focus', name: 'Focus', icon: Target, color: 'text-yellow-600' },
];

export default function PreWorkoutDrinksPage() {
  return <WorkoutDrinksSubcategoryPage title="Pre-Workout Drinks" backHref="/drinks/workout-drinks" backLabel="Back to Workout Drinks" badgeText="Orange Fuel" shareText="Explore ChefSire pre-workout drinks for blood flow, carbs, and smart caffeine." accent="orange" icon={Timer} sourceRoute="/drinks/workout-drinks/pre-workout" recipes={preWorkoutDrinks} typeTabLabel="Fuel Types" typeLabel="Fuel Types" typeField="fuelType" typeCards={typeCards} goalFilters={goalFilters} crossSubcategories={[{ id: 'post-workout', name: 'Post-Workout', description: 'Protein and recovery blends', route: '/drinks/workout-drinks/post-workout', icon: Heart }, { id: 'hydration', name: 'Hydration', description: 'Electrolyte-focused drinks', route: '/drinks/workout-drinks/hydration', icon: Activity }, { id: 'energy-boosters', name: 'Energy Boosters', description: 'Adaptogens and nootropics', route: '/drinks/workout-drinks/energy-boosters', icon: Sparkles }]} stats={{ first: { value: 'Moderate', label: 'Typical Caffeine', color: 'text-orange-600' }, second: { value: '4.7★', label: 'Avg Rating', color: 'text-green-600' }, third: { value: '4 min', label: 'Avg Prep', color: 'text-purple-600' } }} searchPlaceholder="Search pre-workout drinks..." primaryStat={{ label: 'Protein', key: 'nutrition.protein', color: 'text-orange-600', suffix: 'g' }} footer={{ labelA: 'Caffeine', keyA: 'caffeineLevel', colorA: 'text-orange-600', labelB: 'Key Ingredient', keyB: 'keyIngredient', colorB: 'text-red-600' }} buttonLabel="Mix This Fuel" />;
}
