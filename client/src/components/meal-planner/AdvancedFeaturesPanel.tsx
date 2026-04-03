import React, { useState, useEffect } from 'react';
import {
  Brain, Calendar, Refrigerator, ShoppingBag, Trophy,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';
import { RecommendationsTabSection } from './sections/advanced/RecommendationsTabSection';
import { MealPrepTabSection } from './sections/advanced/MealPrepTabSection';
import { LeftoversTabSection } from './sections/advanced/LeftoversTabSection';
import { GroceryTabSection } from './sections/advanced/GroceryTabSection';
import { AchievementsTabSection } from './sections/advanced/AchievementsTabSection';

interface Recommendation {
  id: string;
  recipe?: any;
  recommendationType: string;
  reason: string;
  score: string;
  targetDate: string;
  mealType: string;
}

interface Leftover {
  id: string;
  recipeName: string;
  quantity: string;
  storedDate: string;
  expiryDate?: string;
  storageLocation: string;
  consumed: boolean;
}

interface MealPrepSchedule {
  id: string;
  prepDay: string;
  prepTime?: string;
  batchRecipes: any[];
  shoppingDay?: string;
  completed: boolean;
  reminderEnabled: boolean;
}

// Shape returned by GET /api/achievements
interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  xpReward: number;
  unlocked: boolean;
  progress: number;
}

interface GroceryItem {
  id: string;
  ingredientName: string;
  quantity?: string;
  category?: string;
  estimatedPrice?: string;
  actualPrice?: string;
  purchased: boolean;
  isPantryItem: boolean;
  aisle?: string;
  priority: string;
}

export const AdvancedFeaturesPanel = () => {
  const { user } = useUser();
  const { toast } = useToast();

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [leftovers, setLeftovers] = useState<Leftover[]>([]);
  const [mealPrepSchedules, setMealPrepSchedules] = useState<MealPrepSchedule[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [budgetSummary, setBudgetSummary] = useState({ estimated: 0, actual: 0, difference: 0 });
  const [loading, setLoading] = useState(false);

  const [showLeftoverForm, setShowLeftoverForm] = useState(false);
  const [leftoverForm, setLeftoverForm] = useState({
    recipeName: '', quantity: '', storageLocation: 'fridge', expiryDate: '',
  });

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchRecommendations(), fetchLeftovers(), fetchMealPrepSchedules(),
        fetchAchievements(), fetchGroceryList(),
      ]);
    } catch (error) {
      console.error('Error loading advanced features:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Recommendations ──────────────────────────────────────────────────────

  const fetchRecommendations = async () => {
    try {
      const res = await fetch('/api/meal-planner/meal-recommendations', { credentials: 'include' });
      if (res.ok) setRecommendations((await res.json()).recommendations || []);
    } catch (e) { console.error(e); }
  };

  const generateRecommendations = async () => {
    try {
      const res = await fetch('/api/meal-planner/meal-recommendations/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ targetDate: new Date().toISOString(), mealType: 'lunch' }),
      });
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
        toast({ title: 'Success', description: `Generated ${data.recommendations?.length || 0} recommendations!` });
      }
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate recommendations' }); }
  };

  const acceptRecommendation = async (id: string) => {
    try {
      const res = await fetch(`/api/meal-planner/meal-recommendations/${id}/accept`, { method: 'PATCH', credentials: 'include' });
      if (!res.ok) throw new Error();
      await fetchRecommendations();
      toast({ title: 'Added to plan' });
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Could not accept recommendation' }); }
  };

  const dismissRecommendation = async (id: string) => {
    try {
      const res = await fetch(`/api/meal-planner/meal-recommendations/${id}/dismiss`, { method: 'PATCH', credentials: 'include' });
      if (!res.ok) throw new Error();
      await fetchRecommendations();
      toast({ title: 'Dismissed' });
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Could not dismiss recommendation' }); }
  };

  // ── Meal Prep  (route: /prep-schedules, NOT /meal-prep-schedules) ────────

  const fetchMealPrepSchedules = async () => {
    try {
      const res = await fetch('/api/meal-planner/prep-schedules', { credentials: 'include' });
      if (res.ok) setMealPrepSchedules((await res.json()).schedules || []);
    } catch (e) { console.error(e); }
  };

  const quickCreateMealPrepSchedule = async () => {
    try {
      const res = await fetch('/api/meal-planner/prep-schedules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ prepDay: 'sunday', prepTime: '14:00', shoppingDay: 'saturday', batchRecipes: [], reminderEnabled: true }),
      });
      if (res.ok) { await fetchMealPrepSchedules(); toast({ title: 'Schedule created!' }); }
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Failed to create prep schedule' }); }
  };

  const markPrepScheduleComplete = async (id: string) => {
    try {
      const res = await fetch(`/api/meal-planner/prep-schedules/${id}/complete`, { method: 'PATCH', credentials: 'include' });
      if (!res.ok) throw new Error();
      await fetchMealPrepSchedules();
      toast({ title: 'Nice work!', description: 'Meal prep marked complete.' });
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Could not update prep schedule' }); }
  };

  // ── Leftovers ────────────────────────────────────────────────────────────

  const fetchLeftovers = async () => {
    try {
      const res = await fetch('/api/meal-planner/leftovers?consumed=false', { credentials: 'include' });
      if (res.ok) setLeftovers((await res.json()).leftovers || []);
    } catch (e) { console.error(e); }
  };

  const submitLeftover = async () => {
    if (!leftoverForm.recipeName || !leftoverForm.quantity) {
      toast({ variant: 'destructive', title: 'Missing fields', description: 'Name and quantity are required.' });
      return;
    }
    try {
      const res = await fetch('/api/meal-planner/leftovers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ ...leftoverForm, storedDate: new Date().toISOString().split('T')[0], expiryDate: leftoverForm.expiryDate || undefined }),
      });
      if (res.ok) {
        await fetchLeftovers();
        setLeftoverForm({ recipeName: '', quantity: '', storageLocation: 'fridge', expiryDate: '' });
        setShowLeftoverForm(false);
        toast({ title: 'Tracked!', description: 'Leftover added.' });
      }
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Failed to add leftover' }); }
  };

  const markLeftoverConsumed = async (id: string, wasted = false) => {
    try {
      const res = await fetch(`/api/meal-planner/leftovers/${id}/consume`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ wasted }),
      });
      if (res.ok) { await fetchLeftovers(); toast({ title: wasted ? 'Marked as wasted' : 'Marked as consumed' }); }
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Failed to update leftover' }); }
  };

  // ── Achievements  (route: /api/achievements, NOT /api/meal-planner/achievements) ──

  const fetchAchievements = async () => {
    try {
      const res = await fetch('/api/achievements', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAchievements(data.achievements || []);
        setTotalPoints(data.stats?.totalPoints || 0);
      }
    } catch (e) { console.error(e); }
  };

  const checkAchievements = async () => {
    try {
      const res = await fetch('/api/achievements/check', { method: 'POST', credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        await fetchAchievements();
        toast({ title: data.count > 0 ? `🎉 ${data.count} achievement${data.count > 1 ? 's' : ''} unlocked!` : 'Checked!', description: data.count > 0 ? 'Keep it up!' : 'No new achievements yet — keep going!' });
      }
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Failed to check achievements' }); }
  };

  // ── Smart Grocery ────────────────────────────────────────────────────────

  const fetchGroceryList = async () => {
    try {
      const res = await fetch('/api/meal-planner/grocery-list?purchased=false', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setGroceryItems(data.items || []);
        setBudgetSummary(data.budget || { estimated: 0, actual: 0, difference: 0 });
      }
    } catch (e) { console.error(e); }
  };

  const checkPantry = async () => {
    try {
      const res = await fetch('/api/meal-planner/grocery-list/check-pantry', { method: 'POST', credentials: 'include' });
      if (res.ok) { const data = await res.json(); await fetchGroceryList(); toast({ title: 'Pantry Check Complete', description: `Found ${data.matched} items already in your pantry!` }); }
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Failed to check pantry' }); }
  };

  const getOptimizedGroceryList = async () => {
    try {
      const res = await fetch('/api/meal-planner/grocery-list/optimized', { credentials: 'include' });
      if (res.ok) { const data = await res.json(); toast({ title: 'List Optimized', description: `Organized ${data.totalItems} items by store layout!` }); }
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Failed to optimize list' }); }
  };

  const getDaysUntilExpiry = (expiryDate: string) =>
    Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto p-4">
      <Tabs defaultValue="recommendations" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="recommendations"><Brain className="w-4 h-4 mr-2" />AI Recommendations</TabsTrigger>
          <TabsTrigger value="mealprep"><Calendar className="w-4 h-4 mr-2" />Meal Prep</TabsTrigger>
          <TabsTrigger value="leftovers"><Refrigerator className="w-4 h-4 mr-2" />Leftovers</TabsTrigger>
          <TabsTrigger value="grocery"><ShoppingBag className="w-4 h-4 mr-2" />Smart Grocery</TabsTrigger>
          <TabsTrigger value="achievements"><Trophy className="w-4 h-4 mr-2" />Achievements</TabsTrigger>
        </TabsList>

        {/* AI Recommendations */}
        <TabsContent value="recommendations" className="space-y-4">
          <RecommendationsTabSection
            recommendations={recommendations}
            onGenerateRecommendations={generateRecommendations}
            onAcceptRecommendation={acceptRecommendation}
            onDismissRecommendation={dismissRecommendation}
          />
        </TabsContent>

        {/* Meal Prep */}
        <TabsContent value="mealprep" className="space-y-4">
          <MealPrepTabSection
            mealPrepSchedules={mealPrepSchedules}
            onCreateSchedule={quickCreateMealPrepSchedule}
            onMarkComplete={markPrepScheduleComplete}
          />
        </TabsContent>

        {/* Leftovers */}
        <TabsContent value="leftovers" className="space-y-4">
          <LeftoversTabSection
            leftovers={leftovers}
            showLeftoverForm={showLeftoverForm}
            leftoverForm={leftoverForm}
            onShowLeftoverForm={() => setShowLeftoverForm(true)}
            onHideLeftoverForm={() => setShowLeftoverForm(false)}
            onLeftoverFormChange={setLeftoverForm}
            onSubmitLeftover={submitLeftover}
            onMarkLeftoverConsumed={markLeftoverConsumed}
            getDaysUntilExpiry={getDaysUntilExpiry}
          />
        </TabsContent>

        {/* Smart Grocery */}
        <TabsContent value="grocery" className="space-y-4">
          <GroceryTabSection
            budgetSummary={budgetSummary}
            groceryItems={groceryItems}
            onCheckPantry={checkPantry}
            onOptimizeList={getOptimizedGroceryList}
          />
        </TabsContent>

        {/* Achievements */}
        <TabsContent value="achievements" className="space-y-4">
          <AchievementsTabSection
            totalPoints={totalPoints}
            achievements={achievements}
            onCheckAchievements={checkAchievements}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvancedFeaturesPanel;
