import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { redirectToCanonicalRecipe } from '@/lib/canonical-routing';
import { resolveCanonicalDrinkSlug } from '@/data/drinks/canonical';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import RecipeKit from '@/components/recipes/RecipeKit';
import UniversalSearch from '@/components/UniversalSearch';
import { useDrinks } from '@/contexts/DrinksContext';
import {
  Apple,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  Clipboard,
  Coffee,
  FlaskConical,
  Heart,
  Leaf,
  RotateCcw,
  Search,
  Share2,
  Star,
  Target,
  Wine,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export type Measured = { amount: number | string; unit: string; item: string; note?: string };
export const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

export const toMetric = (unit: string, amount: number) => {
  const mlPerCup = 240, mlPerTbsp = 15, mlPerTsp = 5;
  switch (unit) {
    case 'cup': return { amount: Math.round(amount * mlPerCup), unit: 'ml' };
    case 'tbsp': return { amount: Math.round(amount * mlPerTbsp), unit: 'ml' };
    case 'tsp': return { amount: Math.round(amount * mlPerTsp), unit: 'ml' };
    case 'scoop (30g)': return { amount: Math.round(amount * 30), unit: 'g' };
    default: return { amount, unit };
  }
};

export const clamp = (n: number, min = 1, max = 6) => Math.max(min, Math.min(max, n));
export const toNiceFraction = (value: number) => {
  const rounded = Math.round(value * 4) / 4;
  const whole = Math.trunc(rounded);
  const frac = Math.round((rounded - whole) * 4);
  const fracMap: Record<number, string> = { 0: '', 1: '1/4', 2: '1/2', 3: '3/4' };
  const fracStr = fracMap[frac];
  if (!whole && fracStr) return fracStr;
  if (whole && fracStr) return `${whole} ${fracStr}`;
  return `${whole}`;
};
export const scaleAmount = (baseAmount: number | string, servings: number) => {
  const n = typeof baseAmount === 'number' ? baseAmount : parseFloat(String(baseAmount));
  if (Number.isNaN(n)) return baseAmount;
  return toNiceFraction(n * servings);
};

export type WorkoutDrinkRecipe = {
  id: string;
  name: string;
  description: string;
  image?: string;
  nutrition: { calories?: number; protein?: number; carbs?: number; fat?: number };
  difficulty: 'Easy' | 'Medium' | 'Hard';
  prepTime: number;
  rating: number;
  reviews: number;
  trending?: boolean;
  featured?: boolean;
  tags: string[];
  bestTime: string;
  goal: string;
  ingredients: string[];
  recipe: { servings: number; measurements: Measured[]; directions: string[] };
  [key: string]: any;
};

type ThemeName = 'orange' | 'green' | 'cyan' | 'purple';

type Theme = {
  text: string;
  textDark: string;
  bg: string;
  border: string;
  badge: string;
  button: string;
  gradient: string;
  navGradient: string;
  check: string;
  tag: string;
};

const themes: Record<ThemeName, Theme> = {
  orange: { text: 'text-orange-600', textDark: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-800', button: 'bg-orange-600 hover:bg-orange-700', gradient: 'from-orange-50 via-white to-red-50', navGradient: 'from-orange-50 to-red-50', check: 'text-orange-600', tag: 'bg-orange-100 text-orange-800 hover:bg-orange-200' },
  green: { text: 'text-green-600', textDark: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-800', button: 'bg-green-600 hover:bg-green-700', gradient: 'from-green-50 via-white to-emerald-50', navGradient: 'from-green-50 to-emerald-50', check: 'text-green-600', tag: 'bg-green-100 text-green-800 hover:bg-green-200' },
  cyan: { text: 'text-cyan-600', textDark: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200', badge: 'bg-cyan-100 text-cyan-800', button: 'bg-cyan-600 hover:bg-cyan-700', gradient: 'from-cyan-50 via-white to-sky-50', navGradient: 'from-cyan-50 to-sky-50', check: 'text-cyan-600', tag: 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200' },
  purple: { text: 'text-purple-600', textDark: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-800', button: 'bg-purple-600 hover:bg-purple-700', gradient: 'from-purple-50 via-white to-fuchsia-50', navGradient: 'from-purple-50 to-fuchsia-50', check: 'text-purple-600', tag: 'bg-purple-100 text-purple-800 hover:bg-purple-200' },
};

const otherDrinkHubs = [
  { id: 'protein-shakes', name: 'Protein Shakes', icon: FlaskConical, route: '/drinks/protein-shakes', description: 'Science-backed protein blends' },
  { id: 'smoothies', name: 'Smoothies', icon: Apple, route: '/drinks/smoothies', description: 'Fruit and veggie blends' },
  { id: 'detoxes', name: 'Detoxes', icon: Leaf, route: '/drinks/detoxes', description: 'Cleansing and wellness drinks' },
  { id: 'caffeinated', name: 'Caffeinated', icon: Coffee, route: '/drinks/caffeinated', description: 'Coffee, tea, and energy sips' },
  { id: 'potent-potables', name: 'Potent Potables', icon: Wine, route: '/drinks/potent-potables', description: 'Cocktails and mocktails' },
];

export type WorkoutSubcategoryLink = { id: string; name: string; description: string; route: string; icon: LucideIcon };
export type FilterCard = { id: string; name: string; description: string; icon: LucideIcon; detailA: string; detailAValue: string; detailB: string; detailBValue: string };
export type GoalFilter = { id: string; name: string; icon: LucideIcon; color: string };
export type StatConfig = { label: string; key: string; suffix?: string; color: string };
export type FooterConfig = { labelA: string; keyA: string; colorA: string; labelB: string; keyB: string; colorB: string };
export type PageStats = { first: { value: string; label: string; color: string }; second: { value: string; label: string; color: string }; third: { value: string; label: string; color: string } };

type Props = { title: string; backHref: string; backLabel: string; badgeText: string; shareText: string; accent: ThemeName; icon: LucideIcon; sourceRoute: string; recipes: WorkoutDrinkRecipe[]; typeTabLabel: string; typeLabel: string; typeField: string; typeCards: FilterCard[]; goalFilters: GoalFilter[]; crossSubcategories: WorkoutSubcategoryLink[]; stats: PageStats; searchPlaceholder: string; primaryStat: StatConfig; footer: FooterConfig; buttonLabel: string };

const getValue = (obj: Record<string, any>, path: string) => path.split('.').reduce<any>((acc, key) => (acc == null ? undefined : acc[key]), obj);

export function WorkoutDrinksSubcategoryPage(props: Props) {
  const { title, backHref, backLabel, badgeText, shareText, accent, icon: PageIcon, sourceRoute, recipes, typeTabLabel, typeLabel, typeField, typeCards, goalFilters, crossSubcategories, stats, searchPlaceholder, primaryStat, footer, buttonLabel } = props;
  const theme = themes[accent];
  const { addToFavorites, isFavorite, addToRecentlyViewed, userProgress, addPoints, incrementDrinksMade } = useDrinks();
  const [activeTab, setActiveTab] = useState<'browse' | 'types' | 'goals' | 'featured'>('browse');
  const [selectedGoal, setSelectedGoal] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'protein' | 'calories' | 'time'>('rating');
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [metricFlags, setMetricFlags] = useState<Record<string, boolean>>({});
  const [servingsById, setServingsById] = useState<Record<string, number>>({});

  const handleSharePage = async () => {
    const shareData = { title, text: shareText, url: typeof window !== 'undefined' ? window.location.href : '' };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`); alert('Link copied to clipboard!'); }
    } catch {
      try { await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`); alert('Link copied to clipboard!'); }
      catch { alert('Unable to share on this device.'); }
    }
  };

  const handleShareDrink = async (drink: WorkoutDrinkRecipe, servingsOverride?: number) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const servings = servingsOverride ?? servingsById[drink.id] ?? (drink.recipe?.servings || 1);
    const preview = drink.recipe.measurements.slice(0, 4).map((r) => `${typeof r.amount === 'number' ? scaleAmount(r.amount, servings) : r.amount} ${r.unit} ${r.item}`).join(' · ');
    const text = `${drink.name} • ${drink.goal} • ${String(drink[typeField] ?? '')}\n${preview || drink.ingredients.slice(0, 4).join(', ')}`;
    const shareData = { title: drink.name, text, url };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(`${drink.name}\n${text}\n${url}`); alert('Recipe copied to clipboard!'); }
    } catch {
      try { await navigator.clipboard.writeText(`${drink.name}\n${text}\n${url}`); alert('Recipe copied to clipboard!'); }
      catch { alert('Unable to share on this device.'); }
    }
  };

  const getCanonicalRecipeLink = (recipe: WorkoutDrinkRecipe): string | null => {
    const canonicalSlug = resolveCanonicalDrinkSlug({ slug: recipe.slug, name: recipe.name, sourceRoute });
    return canonicalSlug ? `/drinks/recipe/${encodeURIComponent(canonicalSlug)}` : null;
  };

  const getCanonicalRemixLink = (recipe: WorkoutDrinkRecipe): string | null => {
    const canonicalSlug = resolveCanonicalDrinkSlug({ slug: recipe.slug, name: recipe.name, sourceRoute });
    return canonicalSlug ? `/drinks/submit?remix=${encodeURIComponent(canonicalSlug)}` : null;
  };

  const openRecipeModal = (recipe: WorkoutDrinkRecipe) => {
    const canonicalSlug = resolveCanonicalDrinkSlug({ slug: recipe.slug, name: recipe.name, sourceRoute });
    if (redirectToCanonicalRecipe(canonicalSlug, '/drinks/recipe')) return;
    setSelectedRecipe(recipe);
    setShowKit(true);
  };

  const toDrinkItem = (drink: WorkoutDrinkRecipe) => ({ id: drink.id, name: drink.name, category: 'workout-drinks' as const, description: `${drink.goal} • ${String(drink[typeField] ?? '')}`, ingredients: drink.recipe.measurements.map((x) => `${x.amount} ${x.unit} ${x.item}`), nutrition: drink.nutrition, difficulty: drink.difficulty, prepTime: drink.prepTime, rating: drink.rating, reviews: drink.reviews, tags: drink.tags, featured: drink.featured, trending: drink.trending, bestTime: drink.bestTime, fitnessGoal: drink.goal, image: drink.image });

  const handleCompleteRecipe = () => {
    if (selectedRecipe) { addToRecentlyViewed(toDrinkItem(selectedRecipe)); incrementDrinksMade(); addPoints(25); }
    setShowKit(false); setSelectedRecipe(null);
  };

  const filteredDrinks = useMemo(() => {
    const filtered = recipes.filter((drink) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q || drink.name.toLowerCase().includes(q) || drink.description.toLowerCase().includes(q) || drink.ingredients.some((ingredient) => ingredient.toLowerCase().includes(q));
      const matchesGoal = !selectedGoal || drink.goal.toLowerCase().includes(selectedGoal.toLowerCase());
      const fieldValue = String(drink[typeField] ?? '').toLowerCase();
      const matchesType = !selectedType || fieldValue.includes(selectedType.toLowerCase());
      return matchesSearch && matchesGoal && matchesType;
    });
    filtered.sort((a, b) => sortBy === 'rating' ? b.rating - a.rating : sortBy === 'protein' ? (b.nutrition?.protein || 0) - (a.nutrition?.protein || 0) : sortBy === 'calories' ? (a.nutrition?.calories || 0) - (b.nutrition?.calories || 0) : a.prepTime - b.prepTime);
    return filtered;
  }, [recipes, searchQuery, selectedGoal, selectedType, sortBy, typeField]);

  const featuredDrinks = useMemo(() => recipes.filter((drink) => drink.featured), [recipes]);

  const renderRecipePreview = (drink: WorkoutDrinkRecipe, stopClicks = true) => {
    const useMetric = !!metricFlags[drink.id];
    const servings = servingsById[drink.id] ?? (drink.recipe?.servings || 1);
    return <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3"><div className="flex items-center justify-between mb-2"><div className="text-sm font-semibold text-gray-900">Recipe (serves {servings})</div><div className="flex items-center gap-2"><button className="px-2 py-1 border rounded text-sm" onClick={(e) => { if (stopClicks) e.stopPropagation(); setServingsById((prev) => ({ ...prev, [drink.id]: clamp((prev[drink.id] ?? 1) - 1) })); }}>-</button><div className="min-w-[2ch] text-center text-sm">{servings}</div><button className="px-2 py-1 border rounded text-sm" onClick={(e) => { if (stopClicks) e.stopPropagation(); setServingsById((prev) => ({ ...prev, [drink.id]: clamp((prev[drink.id] ?? 1) + 1) })); }}>+</button><Button variant="outline" size="sm" onClick={(e) => { if (stopClicks) e.stopPropagation(); setServingsById((prev) => ({ ...prev, [drink.id]: drink.recipe?.servings || 1 })); }}><RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset</Button></div></div><ul className="text-sm leading-6 text-gray-800 space-y-1">{drink.recipe.measurements.slice(0, 4).map((ing, i) => { const isNum = typeof ing.amount === 'number'; const scaledDisplay = isNum ? scaleAmount(ing.amount as number, servings) : ing.amount; const show = useMetric && isNum ? toMetric(ing.unit, Number((typeof ing.amount === 'number' ? ing.amount : parseFloat(String(ing.amount))) * servings)) : { amount: scaledDisplay, unit: ing.unit }; return <li key={i} className="flex items-start gap-2"><Check className={`h-4 w-4 ${theme.check} mt-0.5`} /><span><span className={`${theme.textDark} font-semibold`}>{show.amount} {show.unit}</span> {ing.item}{ing.note ? <span className="text-gray-600 italic"> — {ing.note}</span> : null}</span></li>; })}{drink.recipe.measurements.length > 4 && <li className="text-xs text-gray-600">…plus {drink.recipe.measurements.length - 4} more • <button type="button" onClick={(e) => { if (stopClicks) e.stopPropagation(); openRecipeModal(drink); }} className="underline underline-offset-2">Show more</button></li>}</ul><div className="flex gap-2 mt-3"><Button variant="outline" size="sm" onClick={async (e) => { if (stopClicks) e.stopPropagation(); const lines = drink.recipe.measurements.map((ing) => { if (useMetric && typeof ing.amount === 'number') { const metric = toMetric(ing.unit, Number(ing.amount) * servings); return `- ${metric.amount} ${metric.unit} ${ing.item}${ing.note ? ` — ${ing.note}` : ''}`; } const scaled = typeof ing.amount === 'number' ? scaleAmount(ing.amount, servings) : ing.amount; return `- ${scaled} ${ing.unit} ${ing.item}${ing.note ? ` — ${ing.note}` : ''}`; }); try { await navigator.clipboard.writeText(`${drink.name} (serves ${servings})\n${lines.join('\n')}`); alert('Recipe copied!'); } catch { alert('Unable to copy on this device.'); } }}><Clipboard className="w-4 h-4 mr-1" /> Copy</Button><Button variant="outline" size="sm" onClick={(e) => { if (stopClicks) e.stopPropagation(); handleShareDrink(drink, servings); }}><Share2 className="w-4 h-4 mr-1" /> Share</Button><Button variant="outline" size="sm" onClick={(e) => { if (stopClicks) e.stopPropagation(); setMetricFlags((prev) => ({ ...prev, [drink.id]: !prev[drink.id] })); }}>{useMetric ? 'US' : 'Metric'}</Button></div><div className="mt-4 pt-4 border-t border-gray-200"><div className="grid grid-cols-2 gap-4 text-sm"><div className="text-center"><div className="font-semibold text-gray-700">{footer.labelA}:</div><div className={`${footer.colorA} font-medium`}>{String(drink[footer.keyA] ?? '—')}</div></div><div className="text-center"><div className="font-semibold text-gray-700">{footer.labelB}:</div><div className={`${footer.colorB} font-medium`}>{String(drink[footer.keyB] ?? '—')}</div></div></div><div className="text-center mt-2"><div className="font-semibold text-gray-700">Best Time:</div><div className={`${theme.text} font-medium text-sm`}>{drink.bestTime}</div></div></div></div>;
  };

  const header = <div className="bg-white border-b border-gray-200 sticky top-0 z-40"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="flex items-center justify-between h-16"><div className="flex items-center gap-4"><Link href={backHref}><Button variant="ghost" size="sm" className="text-gray-500"><ArrowLeft className="h-4 w-4 mr-2" />{backLabel}</Button></Link><div className="h-6 w-px bg-gray-300" /><div className="flex items-center gap-2"><PageIcon className={`h-6 w-6 ${theme.text}`} /><h1 className="text-2xl font-bold text-gray-900">{title}</h1><Badge className={theme.badge}>{badgeText}</Badge></div></div><div className="flex items-center gap-4"><Button variant="outline" size="sm" onClick={() => setShowUniversalSearch(true)}><Search className="h-4 w-4 mr-2" />Universal Search</Button><div className="flex items-center gap-2 text-sm text-gray-600"><Star className="h-4 w-4 text-yellow-500" /><span>Level {userProgress.level}</span><div className="w-px h-4 bg-gray-300" /><span>{userProgress.totalPoints} XP</span></div><Button size="sm" className={theme.button} onClick={handleSharePage}><Share2 className="h-4 w-4 mr-2" />Share Page</Button></div></div></div></div>;

  return <div className={`min-h-screen bg-gradient-to-br ${theme.gradient}`}>{showUniversalSearch && <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20" onClick={() => setShowUniversalSearch(false)}><div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}><div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10"><h2 className="text-lg font-semibold">Search All Drinks</h2><Button variant="ghost" size="sm" onClick={() => setShowUniversalSearch(false)}><X className="h-4 w-4" /></Button></div><div className="p-4"><UniversalSearch className="w-full" /></div></div></div>}{selectedRecipe && <RecipeKit open={showKit} onClose={() => { setShowKit(false); setSelectedRecipe(null); }} accent={accent} pointsReward={25} onComplete={handleCompleteRecipe} item={{ id: selectedRecipe.id, name: selectedRecipe.name, prepTime: selectedRecipe.prepTime, directions: selectedRecipe.recipe?.directions || [], measurements: selectedRecipe.recipe?.measurements || [], baseNutrition: selectedRecipe.nutrition || {}, defaultServings: servingsById[selectedRecipe.id] ?? selectedRecipe.recipe?.servings ?? 1 }} />}{header}<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"><Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200 mb-6"><CardContent className="p-4"><h3 className="text-sm font-semibold text-gray-700 mb-3">Explore Other Drink Categories</h3><div className="grid grid-cols-1 md:grid-cols-5 gap-3">{otherDrinkHubs.map((hub) => { const Icon = hub.icon; return <Link key={hub.id} href={hub.route}><Button variant="outline" className="w-full justify-start"><Icon className={`h-4 w-4 mr-2 ${theme.text}`} /><div className="text-left flex-1"><div className="font-medium text-sm">{hub.name}</div><div className="text-xs text-gray-500">{hub.description}</div></div><ArrowRight className="h-3 w-3 ml-auto" /></Button></Link>; })}</div></CardContent></Card><Card className={`bg-gradient-to-r ${theme.navGradient} ${theme.border} mb-6`}><CardContent className="p-4"><h3 className="text-sm font-semibold text-gray-700 mb-3">Other Workout Drink Subcategories</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-3">{crossSubcategories.map((subcategory) => { const Icon = subcategory.icon; return <Link key={subcategory.id} href={subcategory.route}><Button variant="outline" className="w-full justify-start"><Icon className={`h-4 w-4 mr-2 ${theme.text}`} /><div className="text-left flex-1"><div className="font-medium text-sm">{subcategory.name}</div><div className="text-xs text-gray-500">{subcategory.description}</div></div><ArrowRight className="h-3 w-3 ml-auto" /></Button></Link>; })}</div></CardContent></Card><div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"><Card><CardContent className="p-4 text-center"><div className={`text-2xl font-bold ${stats.first.color}`}>{stats.first.value}</div><div className="text-sm text-gray-600">{stats.first.label}</div></CardContent></Card><Card><CardContent className="p-4 text-center"><div className={`text-2xl font-bold ${stats.second.color}`}>{stats.second.value}</div><div className="text-sm text-gray-600">{stats.second.label}</div></CardContent></Card><Card><CardContent className="p-4 text-center"><div className={`text-2xl font-bold ${stats.third.color}`}>{stats.third.value}</div><div className="text-sm text-gray-600">{stats.third.label}</div></CardContent></Card><Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-orange-600">6</div><div className="text-sm text-gray-600">Recipes</div></CardContent></Card></div><div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1">{[{ id: 'browse', label: 'Browse All', icon: Search }, { id: 'types', label: typeTabLabel, icon: BarChart3 }, { id: 'goals', label: 'By Goal', icon: Target }, { id: 'featured', label: 'Featured', icon: Star }].map((tab) => { const Icon = tab.icon; return <Button key={tab.id} variant={activeTab === tab.id ? 'default' : 'ghost'} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 ${activeTab === tab.id ? 'bg-white shadow-sm' : ''}`}><Icon className="h-4 w-4 mr-2" />{tab.label}</Button>; })}</div>{activeTab === 'browse' && <div><div className="flex flex-col md:flex-row gap-4 mb-6"><div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" /><Input placeholder={searchPlaceholder} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-12 text-base" /></div><div className="flex flex-col sm:flex-row gap-3 sm:gap-2"><select className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm whitespace-nowrap" value={selectedGoal} onChange={(e) => setSelectedGoal(e.target.value)}><option value="">All Goals</option>{goalFilters.map((goal) => <option key={goal.id} value={goal.name}>{goal.name}</option>)}</select><select className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm whitespace-nowrap" value={selectedType} onChange={(e) => setSelectedType(e.target.value)}><option value="">All {typeLabel}</option>{typeCards.map((type) => <option key={type.id} value={type.name}>{type.name}</option>)}</select><select className="px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm whitespace-nowrap" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}><option value="rating">Sort by Rating</option><option value="protein">Sort by Protein</option><option value="calories">Sort by Calories</option><option value="time">Sort by Prep Time</option></select></div></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{filteredDrinks.map((drink) => { const canonicalRecipeLink = getCanonicalRecipeLink(drink); const canonicalRemixLink = getCanonicalRemixLink(drink); const primaryValue = getValue(drink, primaryStat.key) ?? '—'; const primarySuffix = getValue(drink, primaryStat.key) ? (primaryStat.suffix || '') : ''; return <Card key={drink.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => openRecipeModal(drink)}><CardHeader className="pb-2"><div className="flex items-start justify-between gap-4"><div className="md:flex-1"><CardTitle className="text-lg mb-1">{drink.name}</CardTitle><p className="text-sm text-gray-600 mb-2">{drink.description}</p></div><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); addToFavorites(toDrinkItem(drink)); }} className="text-gray-400 hover:text-red-500"><Heart className={`h-4 w-4 ${isFavorite(drink.id) ? 'fill-red-500 text-red-500' : ''}`} /></Button></div><div className="flex flex-wrap items-center gap-2 mb-2"><Badge variant="outline">{String(drink[typeField] ?? '—')}</Badge><Badge className={theme.badge}>{drink.goal}</Badge>{drink.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}</div></CardHeader><CardContent><div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm"><div><div className={`font-bold ${primaryStat.color}`}>{primaryValue}{primarySuffix}</div><div className="text-gray-500">{primaryStat.label}</div></div><div><div className="font-bold text-green-600">{drink.nutrition?.calories ?? '—'}</div><div className="text-gray-500">Calories</div></div><div><div className="font-bold text-purple-600">{drink.prepTime}min</div><div className="text-gray-500">Prep</div></div></div><div className="flex items-center justify-between mb-4"><div className="flex items-center gap-1"><Star className="h-4 w-4 text-yellow-400 fill-current" /><span className="font-medium">{drink.rating}</span><span className="text-gray-500 text-sm">({drink.reviews})</span></div><Badge variant="outline" className="text-xs">{drink.difficulty}</Badge></div>{renderRecipePreview(drink)}<div className="flex flex-wrap gap-1 mb-4">{drink.tags.map((tag) => <Badge key={tag} variant="secondary" className={`text-xs ${theme.tag}`}>{tag}</Badge>)}</div><div className="mt-3"><Button className={`w-full ${theme.button}`} onClick={(e) => { e.stopPropagation(); openRecipeModal(drink); }}><Zap className="h-4 w-4 mr-2" />Open Recipe (+25 XP)</Button></div>{canonicalRecipeLink && canonicalRemixLink ? <div className="mt-3 flex gap-2 text-xs text-muted-foreground"><Link href={canonicalRecipeLink} className="underline underline-offset-2 hover:text-foreground">Canonical Recipe</Link><span>•</span><Link href={canonicalRemixLink} className="underline underline-offset-2 hover:text-foreground">Remix</Link></div> : null}</CardContent></Card>; })}</div></div>}{activeTab === 'types' && <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{typeCards.map((type) => { const Icon = type.icon; const typeDrinks = recipes.filter((drink) => String(drink[typeField] ?? '').toLowerCase().includes(type.name.toLowerCase())); return <Card key={type.id} className="hover:shadow-lg transition-shadow"><CardHeader><div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2"><div className={`p-2 ${theme.bg} rounded-lg w-fit`}><Icon className={`h-6 w-6 ${theme.text}`} /></div><div><CardTitle className="text-lg">{type.name}</CardTitle><p className="text-sm text-gray-600">{type.description}</p></div></div></CardHeader><CardContent><div className="space-y-3 mb-4"><div className="flex justify-between text-sm"><span className="text-gray-600">{type.detailA}:</span><span className="font-medium text-right">{type.detailAValue}</span></div><div className="flex justify-between text-sm"><span className="text-gray-600">{type.detailB}:</span><span className="font-medium text-right">{type.detailBValue}</span></div><div className="flex justify-between text-sm"><span className="text-gray-600">Recipes:</span><span className="font-medium">{typeDrinks.length}</span></div></div><Button className={`w-full ${theme.button}`} onClick={() => { setSelectedType(type.name); setActiveTab('browse'); }}>View {type.name}</Button></CardContent></Card>; })}</div>}{activeTab === 'goals' && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">{goalFilters.map((goal) => { const Icon = goal.icon; const goalDrinks = recipes.filter((drink) => drink.goal.toLowerCase().includes(goal.name.toLowerCase())); return <Card key={goal.id} className="hover:shadow-lg transition-shadow"><CardHeader><div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2"><div className={`p-2 rounded-lg ${goal.color.replace('text-', 'bg-').replace('-600', '-100')} w-fit`}><Icon className={`h-6 w-6 ${goal.color}`} /></div><CardTitle className="text-lg">{goal.name}</CardTitle></div></CardHeader><CardContent><div className="text-center"><div className={`text-3xl font-bold ${goal.color} mb-1`}>{goalDrinks.length}</div><div className="text-sm text-gray-600 mb-4">Optimized Recipes</div><Button className={`w-full ${theme.button}`} onClick={() => { setSelectedGoal(goal.name); setActiveTab('browse'); }}>View {goal.name}</Button></div></CardContent></Card>; })}</div>}{activeTab === 'featured' && <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">{featuredDrinks.map((drink) => { const primaryValue = getValue(drink, primaryStat.key) ?? '—'; const primarySuffix = getValue(drink, primaryStat.key) ? (primaryStat.suffix || '') : ''; return <Card key={drink.id} className="overflow-hidden hover:shadow-xl transition-shadow"><div className="relative">{drink.image && <img src={drink.image} alt={drink.name} className="w-full h-48 object-cover" />}<div className="absolute top-4 left-4"><Badge className="bg-yellow-500 text-white">Featured</Badge></div><div className="absolute top-4 right-4"><Button variant="ghost" size="sm" onClick={() => addToFavorites(toDrinkItem(drink))} className="bg-white/80 hover:bg-white text-gray-600 hover:text-red-500"><Heart className={`h-4 w-4 ${isFavorite(drink.id) ? 'fill-red-500 text-red-500' : ''}`} /></Button></div></div><CardHeader><CardTitle className="text-xl">{drink.name}</CardTitle><p className="text-gray-600">{drink.description}</p><div className="flex items-center gap-2 mt-2"><Badge variant="outline">{String(drink[typeField] ?? '—')}</Badge><Badge className={theme.badge}>{drink.goal}</Badge><div className="flex items-center gap-1 ml-auto"><Star className="h-4 w-4 text-yellow-400 fill-current" /><span className="font-medium">{drink.rating}</span><span className="text-gray-500 text-sm">({drink.reviews})</span></div></div></CardHeader><CardContent><div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg"><div className="text-center"><div className={`text-xl font-bold ${primaryStat.color}`}>{primaryValue}{primarySuffix}</div><div className="text-xs text-gray-600">{primaryStat.label}</div></div><div className="text-center"><div className="text-xl font-bold text-green-600">{drink.nutrition?.calories ?? '—'}</div><div className="text-xs text-gray-600">Calories</div></div><div className="text-center"><div className="text-xl font-bold text-orange-600">{drink.nutrition?.carbs ?? '—'}{drink.nutrition?.carbs ? 'g' : ''}</div><div className="text-xs text-gray-600">Carbs</div></div><div className="text-center"><div className="text-xl font-bold text-purple-600">{drink.prepTime}min</div><div className="text-xs text-gray-600">Prep</div></div></div>{renderRecipePreview(drink, false)}<div className="flex flex-wrap gap-1 mb-4">{drink.tags.map((tag) => <Badge key={tag} variant="secondary" className={`text-xs ${theme.tag}`}>{tag}</Badge>)}</div><Button className={`w-full ${theme.button}`} onClick={() => openRecipeModal(drink)}><Zap className="h-4 w-4 mr-2" />Open Recipe (+25 XP)</Button></CardContent></Card>; })}</div>}<Card className={`bg-gradient-to-r ${theme.navGradient} ${theme.border} mt-8`}><CardContent className="p-6"><div className="flex items-center justify-between"><div><h3 className="text-lg font-bold mb-2">Your Progress</h3><div className="flex items-center gap-4"><Badge variant="outline" className={theme.text}>Level {userProgress.level}</Badge><Badge variant="outline" className={theme.text}>{userProgress.totalPoints} XP</Badge><Badge variant="outline" className="text-green-600">{userProgress.totalDrinksMade} Drinks Made</Badge></div></div><div className="text-center"><Progress value={userProgress.dailyGoalProgress} className="w-32 mb-2" /><div className="text-xs text-gray-500">Daily Goal Progress</div></div></div></CardContent></Card></div></div>;
}
