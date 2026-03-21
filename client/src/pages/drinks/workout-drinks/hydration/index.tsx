import React from 'react';
import { Activity, Coffee, Droplets, Heart, Leaf, Sparkles, Sun, Timer } from 'lucide-react';
import { FilterCard, GoalFilter, WorkoutDrinksSubcategoryPage } from '../shared';
import { hydrationDrinks } from '@/data/drinks/workout-drinks/hydration';

const typeCards: FilterCard[] = [
  { id: 'sports-drink', name: 'Sports Drink', description: 'Simple carbohydrate-electrolyte blends for longer or hotter sessions.', icon: Droplets, detailA: 'Best for', detailAValue: '60+ min efforts', detailB: 'Timing', detailBValue: 'Before and during' },
  { id: 'produce-forward', name: 'Produce Forward', description: 'Water-rich fruits and vegetables layer fluids with flavor.', icon: Leaf, detailA: 'Best for', detailAValue: 'Low intensity or recovery days', detailB: 'Timing', detailBValue: 'Anytime' },
  { id: 'tea-electrolyte', name: 'Tea + Electrolytes', description: 'Light caffeine plus sodium for a gentler hydration boost.', icon: Coffee, detailA: 'Best for', detailAValue: 'Afternoon training', detailB: 'Timing', detailBValue: 'Pre or during' },
];

const goalFilters: GoalFilter[] = [
  { id: 'electrolyte-balance', name: 'Electrolyte Balance', icon: Droplets, color: 'text-cyan-600' },
  { id: 'heat-relief', name: 'Heat Relief', icon: Sun, color: 'text-sky-600' },
  { id: 'endurance', name: 'Endurance', icon: Activity, color: 'text-blue-600' },
  { id: 'daily-hydration', name: 'Daily Hydration', icon: Leaf, color: 'text-teal-600' },
];

export default function HydrationDrinksPage() {
  return <WorkoutDrinksSubcategoryPage title="Hydration Drinks" backHref="/drinks/workout-drinks" backLabel="Back to Workout Drinks" badgeText="Hydration Focus" shareText="Explore ChefSire hydration drinks for electrolytes, cooling fluids, and endurance support." accent="cyan" icon={Droplets} sourceRoute="/drinks/workout-drinks/hydration" recipes={hydrationDrinks} typeTabLabel="Hydration Types" typeLabel="Hydration Types" typeField="hydrationType" typeCards={typeCards} goalFilters={goalFilters} crossSubcategories={[{ id: 'pre-workout', name: 'Pre-Workout', description: 'Prime your training session', route: '/drinks/workout-drinks/pre-workout', icon: Timer }, { id: 'post-workout', name: 'Post-Workout', description: 'Protein and recovery blends', route: '/drinks/workout-drinks/post-workout', icon: Heart }, { id: 'energy-boosters', name: 'Energy Boosters', description: 'Adaptogens and nootropics', route: '/drinks/workout-drinks/energy-boosters', icon: Sparkles }]} stats={{ first: { value: '180mg+', label: 'Avg Sodium', color: 'text-cyan-600' }, second: { value: '4.7★', label: 'Avg Rating', color: 'text-sky-600' }, third: { value: '5 min', label: 'Avg Prep', color: 'text-purple-600' } }} searchPlaceholder="Search hydration drinks..." primaryStat={{ label: 'Sodium', key: 'sodiumMg', color: 'text-cyan-600', suffix: 'mg' }} footer={{ labelA: 'Hydration', keyA: 'hydrationType', colorA: 'text-cyan-600', labelB: 'Best Window', keyB: 'bestTime', colorB: 'text-sky-600' }} buttonLabel="Mix Hydrator" />;
}
