import React from 'react';
import { BarChart3, Dumbbell, Droplets, Heart, Shield, Sparkles, Timer } from 'lucide-react';
import { FilterCard, GoalFilter, WorkoutDrinksSubcategoryPage } from '../shared';
import { postWorkoutDrinks } from '@/data/drinks/workout-drinks/post-workout';

const typeCards: FilterCard[] = [
  { id: 'glycogen', name: 'Glycogen Replenishment', description: 'Carb-forward drinks that quickly refill training fuel stores.', icon: BarChart3, detailA: 'Best for', detailAValue: 'Long or high-volume sessions', detailB: 'Timing', detailBValue: '0-45 min after' },
  { id: 'anti-inflammatory', name: 'Anti-Inflammatory', description: 'Colorful ingredients support soreness management and overall recovery.', icon: Shield, detailA: 'Best for', detailAValue: 'Back-to-back training days', detailB: 'Timing', detailBValue: '0-2 hours after' },
  { id: 'protein', name: 'Protein Synthesis', description: 'Leucine-rich protein and vitamin C friendly pairings support repair.', icon: Dumbbell, detailA: 'Best for', detailAValue: 'Strength and hypertrophy', detailB: 'Timing', detailBValue: 'Immediately after' },
];

const goalFilters: GoalFilter[] = [
  { id: 'protein-synthesis', name: 'Protein Synthesis', icon: Dumbbell, color: 'text-green-600' },
  { id: 'glycogen-replenishment', name: 'Glycogen Replenishment', icon: BarChart3, color: 'text-emerald-600' },
  { id: 'anti-inflammatory', name: 'Anti-Inflammatory', icon: Shield, color: 'text-lime-600' },
  { id: 'rehydration', name: 'Rehydration', icon: Droplets, color: 'text-cyan-600' },
];

export default function PostWorkoutDrinksPage() {
  return <WorkoutDrinksSubcategoryPage title="Post-Workout Drinks" backHref="/drinks/workout-drinks" backLabel="Back to Workout Drinks" badgeText="Recovery Blend" shareText="Explore ChefSire post-workout drinks for protein, carbs, and smart recovery." accent="green" icon={Heart} sourceRoute="/drinks/workout-drinks/post-workout" recipes={postWorkoutDrinks} typeTabLabel="Recovery Focus" typeLabel="Recovery Focus" typeField="recoveryFocus" typeCards={typeCards} goalFilters={goalFilters} crossSubcategories={[{ id: 'pre-workout', name: 'Pre-Workout', description: 'Prime your training session', route: '/drinks/workout-drinks/pre-workout', icon: Timer }, { id: 'hydration', name: 'Hydration', description: 'Electrolyte-focused drinks', route: '/drinks/workout-drinks/hydration', icon: Droplets }, { id: 'energy-boosters', name: 'Energy Boosters', description: 'Adaptogens and nootropics', route: '/drinks/workout-drinks/energy-boosters', icon: Sparkles }]} stats={{ first: { value: '22g+', label: 'Avg Protein', color: 'text-green-600' }, second: { value: '4.7★', label: 'Avg Rating', color: 'text-emerald-600' }, third: { value: '4 min', label: 'Avg Prep', color: 'text-purple-600' } }} searchPlaceholder="Search post-workout drinks..." primaryStat={{ label: 'Protein', key: 'nutrition.protein', color: 'text-green-600', suffix: 'g' }} footer={{ labelA: 'Recovery', keyA: 'recoveryFocus', colorA: 'text-green-600', labelB: 'Best Window', keyB: 'bestTime', colorB: 'text-emerald-600' }} buttonLabel="Start Recovery" />;
}
