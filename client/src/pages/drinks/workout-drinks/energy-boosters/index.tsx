import React from 'react';
import { Activity, Coffee, Droplets, Heart, Shield, Sparkles, Target, Timer, Zap } from 'lucide-react';
import { FilterCard, GoalFilter, WorkoutDrinksSubcategoryPage } from '../shared';
import { energyBoosterDrinks } from '@/data/drinks/workout-drinks/energy-boosters';

const typeCards: FilterCard[] = [
  { id: 'latte-style', name: 'Latte Style', description: 'Warm, comforting drinks built around spices, mushrooms, or cacao.', icon: Coffee, detailA: 'Best for', detailAValue: 'Morning ritual energy', detailB: 'Timing', detailBValue: 'Anytime' },
  { id: 'coffee-based', name: 'Coffee Based', description: 'Coffee paired with mushrooms or herbs for added focus support.', icon: Zap, detailA: 'Best for', detailAValue: 'Mental performance', detailB: 'Timing', detailBValue: 'Morning to midday' },
  { id: 'citrus-elixir', name: 'Citrus Elixir', description: 'Brighter drinks that lean on botanicals instead of heavy dairy.', icon: Activity, detailA: 'Best for', detailAValue: 'Stress-heavy days', detailB: 'Timing', detailBValue: 'Midday or pre-workout' },
];

const goalFilters: GoalFilter[] = [
  { id: 'focus', name: 'Focus', icon: Target, color: 'text-purple-600' },
  { id: 'stress-resilience', name: 'Stress Resilience', icon: Shield, color: 'text-fuchsia-600' },
  { id: 'steady-energy', name: 'Steady Energy', icon: Zap, color: 'text-violet-600' },
  { id: 'performance-support', name: 'Performance Support', icon: Activity, color: 'text-indigo-600' },
];

export default function EnergyBoosterDrinksPage() {
  return <WorkoutDrinksSubcategoryPage title="Energy Booster Drinks" backHref="/drinks/workout-drinks" backLabel="Back to Workout Drinks" badgeText="Adaptogen Boosters" shareText="Explore ChefSire energy booster drinks with adaptogens, mushrooms, and nootropic-friendly ingredients." accent="purple" icon={Sparkles} sourceRoute="/drinks/workout-drinks/energy-boosters" recipes={energyBoosterDrinks} typeTabLabel="Adaptogen Types" typeLabel="Adaptogen Types" typeField="boosterType" typeCards={typeCards} goalFilters={goalFilters} crossSubcategories={[{ id: 'pre-workout', name: 'Pre-Workout', description: 'Prime your training session', route: '/drinks/workout-drinks/pre-workout', icon: Timer }, { id: 'post-workout', name: 'Post-Workout', description: 'Protein and recovery blends', route: '/drinks/workout-drinks/post-workout', icon: Heart }, { id: 'hydration', name: 'Hydration', description: 'Electrolyte-focused drinks', route: '/drinks/workout-drinks/hydration', icon: Droplets }]} stats={{ first: { value: '4.7★', label: 'Avg Rating', color: 'text-purple-600' }, second: { value: '4 min', label: 'Avg Prep', color: 'text-fuchsia-600' }, third: { value: '4', label: 'Featured Picks', color: 'text-violet-600' } }} searchPlaceholder="Search energy booster drinks..." primaryStat={{ label: 'Adaptogen', key: 'keyAdaptogen', color: 'text-purple-600' }} footer={{ labelA: 'Caffeine', keyA: 'caffeineLevel', colorA: 'text-purple-600', labelB: 'Best Window', keyB: 'bestTime', colorB: 'text-fuchsia-600' }} buttonLabel="Brew Booster" />;
}
