import React from 'react';
import { BarChart3, ChefHat, Clock, Package, Plus, Save, ShoppingCart, Sparkles, Target, TrendingUp, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

type ViewMode = 'day' | 'week' | 'month';

type PlannerTabSectionProps = {
  caloriesCurrent: number;
  calorieGoal: number;
  calorieProgress: number;
  remainingCalories: number;
  proteinCurrent: number;
  carbsCurrent: number;
  fatCurrent: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  today: string;
  viewMode: ViewMode;
  setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;
  generateWeekPlan: () => void;
  isGeneratingWeek: boolean;
  saveTemplate: () => void;
  handleAddMeal: (day?: string, mealType?: string) => void;
  selectedDate: string;
  setSelectedDate: React.Dispatch<React.SetStateAction<string>>;
  weekRange: { weekStart: string; weekEnd: string } | null;
  getCurrentWeekAnchor: () => string;
  parseDateOnly: (dateString: string) => Date;
  formatLocalDate: (date: Date) => string;
  weekDays: string[];
  getDateForWeekday: (weekday: string) => string;
  mealTypes: string[];
  weeklyMeals: Record<string, any>;
  getMealSlotItems: (weeklyMeals: Record<string, any>, day: string, mealType: string) => any[];
  getMealSlotTotals: (weeklyMeals: Record<string, any>, day: string, mealType: string) => { calories: number; protein: number; carbs: number; fat: number };
  gradeClass: (grade: string) => string;
  getNutritionGrade: (item: any, calorieGoal: number) => string;
  removeMealItem: (day: string, mealType: string, index: number) => void;
  dayNames: string[];
  handleAIRecipe: () => void;
  handleUsePantry: () => void;
  handleLoadTemplate: () => void;
  plannedSlots: number;
  totalSlots: number;
  unplannedDays: string[];
  groceryPendingCount: number;
  groceryCompletedCount: number;
  switchToGroceryTab: () => void;
  switchToPrepTab: () => void;
  switchToAnalyticsTab: () => void;
};

const PlannerTabSection = ({
  caloriesCurrent,
  calorieGoal,
  calorieProgress,
  remainingCalories,
  proteinCurrent,
  carbsCurrent,
  fatCurrent,
  proteinGoal,
  carbsGoal,
  fatGoal,
  today,
  viewMode,
  setViewMode,
  generateWeekPlan,
  isGeneratingWeek,
  saveTemplate,
  handleAddMeal,
  selectedDate,
  setSelectedDate,
  weekRange,
  getCurrentWeekAnchor,
  parseDateOnly,
  formatLocalDate,
  weekDays,
  getDateForWeekday,
  mealTypes,
  weeklyMeals,
  getMealSlotItems,
  getMealSlotTotals,
  gradeClass,
  getNutritionGrade,
  removeMealItem,
  dayNames,
  handleAIRecipe,
  handleUsePantry,
  handleLoadTemplate,
  plannedSlots,
  totalSlots,
  unplannedDays,
  groceryPendingCount,
  groceryCompletedCount,
  switchToGroceryTab,
  switchToPrepTab,
  switchToAnalyticsTab,
}: PlannerTabSectionProps) => {
  const planningProgress = totalSlots > 0 ? Math.round((plannedSlots / totalSlots) * 100) : 0;
  const completionLabel = plannedSlots === 0
    ? 'No meals planned yet'
    : plannedSlots === totalSlots
      ? 'Week fully planned'
      : `${plannedSlots}/${totalSlots} slots filled`;

  // Compute weekly totals (all 7 days, planned + logged)
  const weeklyTotals = weekDays.reduce(
    (acc, day) => {
      const dayDate = getDateForWeekday(day);
      const isPast = dayDate < today;
      const isToday = dayDate === today;
      const isFuture = dayDate > today;
      let dayCal = 0, dayProt = 0, dayCarbs = 0, dayFat = 0;
      mealTypes.forEach((mt) => {
        const t = getMealSlotTotals(weeklyMeals, day, mt);
        dayCal += t.calories; dayProt += t.protein; dayCarbs += t.carbs; dayFat += t.fat;
      });
      return {
        calories: acc.calories + dayCal,
        protein: acc.protein + dayProt,
        carbs: acc.carbs + dayCarbs,
        fat: acc.fat + dayFat,
        loggedCalories: acc.loggedCalories + (isPast || isToday ? dayCal : 0),
        plannedCalories: acc.plannedCalories + (isFuture ? dayCal : 0),
        daysWithMeals: acc.daysWithMeals + (dayCal > 0 ? 1 : 0),
        futureDaysWithMeals: acc.futureDaysWithMeals + (isFuture && dayCal > 0 ? 1 : 0),
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, loggedCalories: 0, plannedCalories: 0, daysWithMeals: 0, futureDaysWithMeals: 0 }
  );

  const weeklyCalorieGoal = calorieGoal * 7;
  const weeklyCaloriePct = weeklyCalorieGoal > 0 ? Math.min(100, Math.round((weeklyTotals.calories / weeklyCalorieGoal) * 100)) : 0;
  const weeklyProteinPct = proteinGoal * 7 > 0 ? Math.min(100, Math.round((weeklyTotals.protein / (proteinGoal * 7)) * 100)) : 0;

  // Slot type helpers
  const getDayStatus = (day: string): 'past' | 'today' | 'future' => {
    const d = getDateForWeekday(day);
    if (d > today) return 'future';
    if (d === today) return 'today';
    return 'past';
  };

  const slotAction = (day: string, hasItems: boolean) => {
    const status = getDayStatus(day);
    if (status === 'future') return hasItems ? 'Add more' : 'Plan';
    if (status === 'today') return hasItems ? 'Add more' : 'Log';
    return hasItems ? 'Add more' : 'Log';
  };

  const emptySlotLabel = (day: string) => {
    const status = getDayStatus(day);
    return status === 'future' ? 'Nothing planned — click to plan' : 'Nothing logged yet — tap to add';
  };

  const dayHeaderClass = (day: string) => {
    const status = getDayStatus(day);
    if (status === 'future') return 'bg-blue-50';
    if (status === 'today') return 'bg-orange-50';
    return 'bg-gray-50';
  };

  const slotCellClass = (day: string) => {
    const status = getDayStatus(day);
    if (status === 'future') return 'bg-blue-50/30';
    return '';
  };

  const addButtonClass = (day: string) => {
    const status = getDayStatus(day);
    if (status === 'future') return 'text-blue-500 hover:text-blue-700';
    return 'text-gray-400 hover:text-orange-500';
  };

  const futureDayCount = weekDays.filter((d) => getDayStatus(d) === 'future').length;

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/90 text-sm font-medium mb-1">Today's Calories</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">{caloriesCurrent.toLocaleString()}</span>
                <span className="text-white/80 text-lg">/ {calorieGoal.toLocaleString()} kcal</span>
              </div>
              <Progress value={calorieProgress} className="h-2 mt-3 bg-white/20" />
            </div>
            <div className="text-right">
              <div className="bg-white/20 backdrop-blur rounded-lg px-4 py-3">
                <p className="text-sm text-white/90">Remaining</p>
                <p className="text-2xl font-bold">{remainingCalories}</p>
                <p className="text-xs text-white/80">calories</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-white/15 backdrop-blur rounded-lg p-3 text-center"><p className="text-xs text-white/80">Protein</p><p className="text-lg font-semibold">{proteinCurrent}g</p></div>
            <div className="bg-white/15 backdrop-blur rounded-lg p-3 text-center"><p className="text-xs text-white/80">Carbs</p><p className="text-lg font-semibold">{carbsCurrent}g</p></div>
            <div className="bg-white/15 backdrop-blur rounded-lg p-3 text-center"><p className="text-xs text-white/80">Fat</p><p className="text-lg font-semibold">{fatCurrent}g</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly projection card */}
      {weeklyTotals.calories > 0 && (
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 via-white to-indigo-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              This Week's Projection
            </CardTitle>
            <CardDescription>
              {weeklyTotals.loggedCalories > 0 && weeklyTotals.plannedCalories > 0
                ? `${weeklyTotals.loggedCalories.toLocaleString()} kcal logged · ${weeklyTotals.plannedCalories.toLocaleString()} kcal planned ahead`
                : weeklyTotals.plannedCalories > 0
                  ? `${weeklyTotals.plannedCalories.toLocaleString()} kcal planned for ${weeklyTotals.futureDaysWithMeals} future day${weeklyTotals.futureDaysWithMeals !== 1 ? 's' : ''}`
                  : `${weeklyTotals.loggedCalories.toLocaleString()} kcal logged so far`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-600">Weekly calories ({weeklyTotals.calories.toLocaleString()} / {weeklyCalorieGoal.toLocaleString()} kcal)</span>
                <span className="font-semibold text-blue-700">{weeklyCaloriePct}%</span>
              </div>
              <Progress value={weeklyCaloriePct} className="h-1.5 bg-blue-100 [&>div]:bg-blue-500" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-md border bg-white p-2 text-center">
                <div className="font-semibold text-blue-700">{weeklyTotals.protein}g</div>
                <div className="text-gray-500">/ {proteinGoal * 7}g protein</div>
                <div className="text-[10px] text-gray-400">{weeklyProteinPct}% of goal</div>
              </div>
              <div className="rounded-md border bg-white p-2 text-center">
                <div className="font-semibold text-orange-600">{weeklyTotals.carbs}g</div>
                <div className="text-gray-500">/ {carbsGoal * 7}g carbs</div>
              </div>
              <div className="rounded-md border bg-white p-2 text-center">
                <div className="font-semibold text-purple-600">{weeklyTotals.fat}g</div>
                <div className="text-gray-500">/ {fatGoal * 7}g fat</div>
              </div>
            </div>
            {futureDayCount > 0 && weeklyTotals.futureDaysWithMeals < futureDayCount && (
              <p className="text-xs text-blue-700 bg-blue-100 rounded px-2 py-1">
                {futureDayCount - weeklyTotals.futureDaysWithMeals} future day{futureDayCount - weeklyTotals.futureDaysWithMeals !== 1 ? 's' : ''} still need meals planned — blue slots below are waiting.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-orange-200 bg-gradient-to-r from-orange-50 via-white to-amber-50">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Weekly Plan Status</CardTitle>
          <CardDescription>
            {completionLabel}. Keep momentum with the most useful next actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-600">Planner Coverage</span>
              <span className="font-semibold text-gray-900">{planningProgress}%</span>
            </div>
            <Progress value={planningProgress} className="h-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-gray-500 mb-1">Unplanned Days</p>
              <p className="text-lg font-semibold text-gray-900">{unplannedDays.length}</p>
              <p className="text-xs text-gray-500 mt-1 truncate">
                {unplannedDays.length > 0 ? unplannedDays.join(', ') : 'All days have meals'}
              </p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-gray-500 mb-1">Items to Buy</p>
              <p className="text-lg font-semibold text-orange-600">{groceryPendingCount}</p>
              <p className="text-xs text-gray-500 mt-1">{groceryCompletedCount} checked off</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-gray-500 mb-1">Focus</p>
              <p className="text-sm font-semibold text-gray-900">
                {unplannedDays.length > 0 ? 'Finish your week plan' : groceryPendingCount > 0 ? 'Shop & prep meals' : 'Review performance'}
              </p>
              <p className="text-xs text-gray-500 mt-1">Use quick actions below</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button variant="outline" size="sm" className="justify-start" onClick={switchToGroceryTab}>
              <ShoppingCart className="w-4 h-4 mr-2" />
              Open Grocery List
            </Button>
            <Button variant="outline" size="sm" className="justify-start" onClick={switchToPrepTab}>
              <Clock className="w-4 h-4 mr-2" />
              Build Prep Session
            </Button>
            <Button variant="outline" size="sm" className="justify-start" onClick={switchToAnalyticsTab}>
              <BarChart3 className="w-4 h-4 mr-2" />
              Review Analytics
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Button variant={viewMode === 'day' ? 'default' : 'outline'} size="sm" className="flex-1 md:flex-none" onClick={() => setViewMode('day')}>Day</Button>
          <Button variant={viewMode === 'week' ? 'default' : 'outline'} size="sm" className="flex-1 md:flex-none" onClick={() => setViewMode('week')}>Week</Button>
          <Button variant={viewMode === 'month' ? 'default' : 'outline'} size="sm" className="flex-1 md:flex-none" onClick={() => setViewMode('month')}>Month</Button>
        </div>
        <div className="flex items-center gap-2 flex-1 md:flex-none">
          <Button variant="outline" size="sm" className="flex-1 md:flex-none" onClick={generateWeekPlan} disabled={isGeneratingWeek} title="Auto-Plan Week">
            <Zap className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">{isGeneratingWeek ? 'Generating...' : 'Auto-Plan Week'}</span>
          </Button>
          <Button variant="outline" size="sm" className="flex-1 md:flex-none" onClick={saveTemplate} title="Save Template">
            <Save className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Save Template</span>
          </Button>
          <Button size="sm" className="flex-1 md:flex-none" onClick={() => handleAddMeal()}>
            <Plus className="w-4 h-4 mr-1.5" />Add Meal
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between bg-white rounded-lg px-4 py-2 shadow-sm">
        <button className="p-2 rounded-full hover:bg-gray-100 transition-colors" onClick={() => {
          const d = parseDateOnly(selectedDate);
          if (viewMode === 'day') d.setDate(d.getDate() - 1);
          else if (viewMode === 'week') d.setDate(d.getDate() - 7);
          else d.setMonth(d.getMonth() - 1);
          setSelectedDate(formatLocalDate(d));
        }}>&#8249;</button>
        <div className="text-sm font-medium text-gray-700 text-center">
          {viewMode === 'day' && new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          {viewMode === 'week' && weekRange && `${new Date(weekRange.weekStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(weekRange.weekEnd + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
          {viewMode === 'week' && !weekRange && `Week of ${new Date(getCurrentWeekAnchor() + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
          {viewMode === 'month' && new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        <div className="flex items-center gap-2">
          <button className="p-1.5 text-xs text-orange-600 hover:bg-orange-50 rounded transition-colors font-medium" onClick={() => setSelectedDate(formatLocalDate(new Date()))}>Today</button>
          <button className="p-2 rounded-full hover:bg-gray-100 transition-colors" onClick={() => {
            const d = parseDateOnly(selectedDate);
            if (viewMode === 'day') d.setDate(d.getDate() + 1);
            else if (viewMode === 'week') d.setDate(d.getDate() + 7);
            else d.setMonth(d.getMonth() + 1);
            setSelectedDate(formatLocalDate(d));
          }}>&#8250;</button>
        </div>
      </div>

      {viewMode === 'week' && (
        <>
          {plannedSlots === 0 && (
            <Card className="border-dashed border-orange-200 bg-orange-50/40">
              <CardContent className="p-6 text-center">
                <Target className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                <h3 className="font-semibold text-gray-900">Start planning your week</h3>
                <p className="text-sm text-gray-600 mt-1 mb-4">
                  Plan meals ahead in the blue future slots, auto-generate a week, or load a template. Blue = planned ahead. Orange = today. Gray = already logged.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button size="sm" onClick={generateWeekPlan} disabled={isGeneratingWeek}>
                    <Zap className="w-4 h-4 mr-2" />
                    {isGeneratingWeek ? 'Generating...' : 'Auto-Plan Week'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleAIRecipe}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI Suggestions
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleLoadTemplate}>
                    <Save className="w-4 h-4 mr-2" />
                    Load Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 px-1">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-300 inline-block" />Planned (future)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-100 border border-orange-300 inline-block" />Today</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-100 border border-gray-200 inline-block" />Logged (past)</span>
          </div>

          <div className="hidden md:block bg-white rounded-lg shadow-sm overflow-hidden overflow-x-auto">
            <div className="grid grid-cols-8 border-b min-w-[800px]">
              <div className="p-4 bg-gray-50 border-r"><span className="text-sm font-medium text-gray-500">Meal</span></div>
              {weekDays.map((day) => {
                const dayDate = getDateForWeekday(day);
                const isToday = dayDate === today;
                const isFuture = dayDate > today;
                return (
                  <div key={day} className={`p-4 border-r last:border-r-0 ${isFuture ? 'bg-blue-50' : isToday ? 'bg-orange-50' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-1.5">
                      <div className="text-sm font-medium text-gray-900">{day}</div>
                      {isFuture && <Badge variant="outline" className="text-[9px] py-0 px-1 border-blue-300 text-blue-600 leading-4">Plan</Badge>}
                      {isToday && <Badge variant="outline" className="text-[9px] py-0 px-1 border-orange-300 text-orange-600 leading-4">Today</Badge>}
                    </div>
                    <div className={`text-xs ${isToday ? 'text-orange-600 font-semibold' : isFuture ? 'text-blue-500' : 'text-gray-500'}`}>
                      {new Date(dayDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                );
              })}
            </div>
            {mealTypes.map((mealType) => (
              <div key={mealType} className="grid grid-cols-8 border-b last:border-b-0 min-w-[800px]">
                <div className="p-4 bg-gray-50 border-r flex items-center"><span className="text-sm font-medium text-gray-700 capitalize">{mealType}</span></div>
                {weekDays.map((day) => {
                  const items = getMealSlotItems(weeklyMeals, day, mealType);
                  const totals = getMealSlotTotals(weeklyMeals, day, mealType);
                  const isFuture = getDateForWeekday(day) > today;
                  return (
                    <div key={`${day}-${mealType}`} className={`p-2 border-r last:border-r-0 min-h-[72px] ${isFuture ? 'bg-blue-50/30' : ''}`}>
                      {items.length > 0 && (
                        <div className="space-y-1 mb-1">
                          {items.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-start justify-between gap-1 group">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-gray-900 truncate flex items-center gap-1">
                                  {item.name}
                                  {item.source === 'recipe' && <ChefHat className="w-3 h-3 text-orange-500" />}
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${gradeClass(getNutritionGrade(item, calorieGoal))}`}>{getNutritionGrade(item, calorieGoal)}</span>
                                </div>
                                <div className="text-xs text-gray-400">{item.calories} cal · P:{item.protein}g</div>
                              </div>
                              <button className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs leading-none mt-0.5 shrink-0" onClick={(e) => { e.stopPropagation(); removeMealItem(day, mealType, idx); }} title="Remove">✕</button>
                            </div>
                          ))}
                          {items.length > 1 && <div className="text-xs text-orange-600 font-medium border-t border-gray-100 pt-1">Total: {totals.calories} cal</div>}
                        </div>
                      )}
                      <button
                        className={`flex items-center gap-1 text-xs w-full mt-1 ${addButtonClass(day)}`}
                        onClick={() => handleAddMeal(day, mealType)}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{slotAction(day, items.length > 0)}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="md:hidden space-y-4">
            {weekDays.map((day) => {
              const dayDate = getDateForWeekday(day);
              const isToday = dayDate === today;
              const isFuture = dayDate > today;
              return (
                <Card key={day} className={isFuture ? 'border-blue-200' : isToday ? 'border-orange-200' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{day}</CardTitle>
                      {isFuture && <Badge variant="outline" className="border-blue-300 text-blue-600">Plan ahead</Badge>}
                      {isToday && <Badge variant="outline" className="border-orange-300 text-orange-600">Today</Badge>}
                    </div>
                    <CardDescription className={isToday ? 'text-orange-600 font-semibold' : isFuture ? 'text-blue-500' : ''}>
                      {new Date(dayDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {mealTypes.map((mealType) => (
                      <div key={`${day}-${mealType}`} className={`p-3 rounded-lg ${isFuture ? 'bg-blue-50' : 'bg-gray-50'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700 capitalize">{mealType}</span>
                          <button
                            className={`flex items-center gap-1 text-xs ${isFuture ? 'text-blue-500 hover:text-blue-700' : 'text-orange-500 hover:text-orange-700'}`}
                            onClick={() => handleAddMeal(day, mealType)}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {slotAction(day, getMealSlotItems(weeklyMeals, day, mealType).length > 0)}
                          </button>
                        </div>
                        {getMealSlotItems(weeklyMeals, day, mealType).length > 0 ? (
                          <div className="space-y-2">
                            {getMealSlotItems(weeklyMeals, day, mealType).map((item: any, idx: number) => (
                              <div key={idx} className="flex items-start justify-between gap-2 bg-white rounded p-2">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-900 truncate">{item.name}</div>
                                  <div className="flex gap-1 mt-1 flex-wrap"><Badge variant="secondary" className="text-xs">{item.calories} cal</Badge><Badge variant="secondary" className="text-xs">P: {item.protein}g</Badge></div>
                                </div>
                                <button className="text-red-400 hover:text-red-600 text-xs mt-0.5 shrink-0" onClick={() => removeMealItem(day, mealType, idx)}>✕</button>
                              </div>
                            ))}
                            {getMealSlotItems(weeklyMeals, day, mealType).length > 1 && <div className="text-xs text-orange-600 font-semibold text-right">Total: {getMealSlotTotals(weeklyMeals, day, mealType).calories} cal · P: {getMealSlotTotals(weeklyMeals, day, mealType).protein}g</div>}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">
                            {isFuture ? 'Tap Plan to schedule this meal' : 'Tap Log to record this meal'}
                          </p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {viewMode === 'day' && (
        <div className="space-y-4">
          {(() => {
            const isFutureDay = selectedDate > today;
            const isTodayDay = selectedDate === today;
            return (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {isTodayDay && <div className="bg-orange-50 border-b border-orange-100 px-4 py-2 flex items-center gap-2"><span className="w-2 h-2 bg-orange-500 rounded-full inline-block"></span><span className="text-xs font-medium text-orange-700">Today — log what you eat</span></div>}
                {isFutureDay && <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center gap-2"><span className="w-2 h-2 bg-blue-500 rounded-full inline-block"></span><span className="text-xs font-medium text-blue-700">Future day — plan your meals ahead. Items added here will be saved to your grocery list.</span></div>}
                {!isTodayDay && !isFutureDay && <div className="bg-gray-50 border-b border-gray-100 px-4 py-2 flex items-center gap-2"><span className="w-2 h-2 bg-gray-400 rounded-full inline-block"></span><span className="text-xs font-medium text-gray-500">Past day</span></div>}
                <div className="divide-y">
                  {mealTypes.map((mealType) => {
                    const dayName = dayNames[parseDateOnly(selectedDate).getDay()];
                    const items = getMealSlotItems(weeklyMeals, dayName, mealType);
                    const totals = getMealSlotTotals(weeklyMeals, dayName, mealType);
                    return (
                      <div key={mealType} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-800 capitalize">{mealType}</span>
                            {items.length > 0 && <span className="text-xs text-gray-400">{totals.calories} cal total</span>}
                          </div>
                          <button
                            className={`flex items-center gap-1 text-xs font-medium ${isFutureDay ? 'text-blue-500 hover:text-blue-700' : 'text-orange-500 hover:text-orange-700'}`}
                            onClick={() => handleAddMeal(dayName, mealType)}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {items.length > 0 ? 'Add more' : isFutureDay ? 'Plan meal' : 'Log meal'}
                          </button>
                        </div>
                        {items.length > 0 ? (
                          <div className="space-y-2">
                            {items.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-900 flex items-center gap-1">{item.name} {item.source === 'recipe' && <ChefHat className="w-3.5 h-3.5 text-orange-500" />} <span className={`px-1.5 py-0.5 rounded text-[10px] ${gradeClass(getNutritionGrade(item, calorieGoal))}`}>{getNutritionGrade(item, calorieGoal)}</span></div>
                                  <div className="flex gap-3 mt-0.5"><span className="text-xs text-gray-500">{item.calories} cal</span><span className="text-xs text-blue-500">P: {item.protein}g</span><span className="text-xs text-orange-500">C: {item.carbs}g</span><span className="text-xs text-purple-500">F: {item.fat}g</span></div>
                                </div>
                                <button className="text-red-400 hover:text-red-600 text-xs ml-2 shrink-0" onClick={() => removeMealItem(dayName, mealType, idx)}>✕</button>
                              </div>
                            ))}
                            {items.length > 1 && <div className="flex gap-4 text-xs font-semibold text-gray-600 px-1 pt-1 border-t"><span>{totals.calories} cal</span><span className="text-blue-500">P: {totals.protein}g</span><span className="text-orange-500">C: {totals.carbs}g</span><span className="text-purple-500">F: {totals.fat}g</span></div>}
                          </div>
                        ) : (
                          <div
                            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${isFutureDay ? 'border-blue-200 hover:border-blue-400 hover:bg-blue-50' : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'}`}
                            onClick={() => handleAddMeal(dayName, mealType)}
                          >
                            <p className="text-xs text-gray-400">{isFutureDay ? 'Nothing planned yet — click to plan' : 'Nothing logged yet — tap to add'}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {(() => {
                  const dayName = dayNames[parseDateOnly(selectedDate).getDay()];
                  const dayTotal = mealTypes.reduce((acc, mt) => {
                    const t = getMealSlotTotals(weeklyMeals, dayName, mt);
                    return { calories: acc.calories + t.calories, protein: acc.protein + t.protein, carbs: acc.carbs + t.carbs, fat: acc.fat + t.fat };
                  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
                  if (dayTotal.calories === 0) return null;
                  return <div className="bg-gray-50 border-t px-4 py-3 grid grid-cols-4 gap-2 text-center"><div><div className="text-lg font-bold text-gray-900">{dayTotal.calories}</div><div className="text-xs text-gray-500">Calories</div></div><div><div className="text-lg font-bold text-blue-600">{dayTotal.protein}g</div><div className="text-xs text-gray-500">Protein</div></div><div><div className="text-lg font-bold text-orange-500">{dayTotal.carbs}g</div><div className="text-xs text-gray-500">Carbs</div></div><div><div className="text-lg font-bold text-purple-600">{dayTotal.fat}g</div><div className="text-xs text-gray-500">Fat</div></div></div>;
                })()}
              </div>
            );
          })()}
        </div>
      )}

      {viewMode === 'month' && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="p-2 text-center text-xs font-semibold text-gray-500 border-r last:border-r-0">{d}</div>)}</div>
          {(() => {
            const anchor = parseDateOnly(selectedDate);
            const year = anchor.getFullYear();
            const month = anchor.getMonth();
            const firstDay = new Date(year, month, 1);
            const startOffset = (firstDay.getDay() + 6) % 7;
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
            const cells: React.ReactNode[] = [];
            for (let i = 0; i < totalCells; i++) {
              const cellDate = new Date(year, month, 1 - startOffset + i);
              const cellStr = formatLocalDate(cellDate);
              const inMonth = cellDate.getMonth() === month;
              const isToday = cellStr === today;
              const isFuture = cellStr > today;
              const isSelected = cellStr === selectedDate;
              const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][cellDate.getDay()];
              const hasAnyMeal = inMonth && mealTypes.some((mt) => getMealSlotItems(weeklyMeals, dayName, mt).length > 0);
              const dayTotalCal = inMonth ? mealTypes.reduce((acc, mt) => acc + getMealSlotTotals(weeklyMeals, dayName, mt).calories, 0) : 0;
              cells.push(
                <div key={cellStr} className={`min-h-[80px] p-1.5 border-r border-b last:border-r-0 cursor-pointer transition-colors ${!inMonth ? 'bg-gray-50' : isSelected ? 'bg-orange-50' : isFuture ? 'bg-blue-50/40 hover:bg-blue-50' : 'bg-white hover:bg-gray-50'}`} onClick={() => { if (inMonth) { setSelectedDate(cellStr); setViewMode('day'); } }}>
                  <div className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-orange-500 text-white' : inMonth ? isFuture ? 'text-blue-700' : 'text-gray-900' : 'text-gray-300'}`}>{cellDate.getDate()}</div>
                  {inMonth && hasAnyMeal && (
                    <div className="space-y-0.5">
                      <div className={`text-xs font-medium ${isFuture ? 'text-blue-600' : 'text-orange-600'}`}>{dayTotalCal} cal</div>
                      <div className="flex gap-0.5 flex-wrap">
                        {mealTypes.filter((mt) => getMealSlotItems(weeklyMeals, dayName, mt).length > 0).map((mt) => (
                          <span key={mt} className={`text-xs rounded px-1 leading-4 ${isFuture ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{mt[0].toUpperCase()}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {inMonth && !hasAnyMeal && <div className="flex items-center justify-center h-8 opacity-0 hover:opacity-100 transition-opacity"><Plus className="w-3.5 h-3.5 text-gray-300" /></div>}
                </div>
              );
            }
            const rows: React.ReactNode[] = [];
            for (let r = 0; r < totalCells / 7; r++) rows.push(<div key={r} className="grid grid-cols-7">{cells.slice(r * 7, r * 7 + 7)}</div>);
            return rows;
          })()}
          <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-500 flex gap-4 flex-wrap">
            <span><span className="inline-block w-4 h-4 bg-orange-500 rounded-full text-white text-center leading-4 mr-1">·</span> Today</span>
            <span><span className="inline-block bg-orange-100 text-orange-700 rounded px-1 mr-1">B</span> Logged</span>
            <span><span className="inline-block bg-blue-100 text-blue-700 rounded px-1 mr-1">B</span> Planned ahead</span>
            <span>Click any day to view/add meals</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleAIRecipe}><CardContent className="p-6 text-center"><Zap className="w-8 h-8 mx-auto mb-3 text-orange-500" /><h3 className="font-medium mb-2">AI Recipe Suggestions</h3><p className="text-sm text-gray-600">Get personalized recipe recommendations</p></CardContent></Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleUsePantry}><CardContent className="p-6 text-center"><Package className="w-8 h-8 mx-auto mb-3 text-green-500" /><h3 className="font-medium mb-2">Use Pantry Items</h3><p className="text-sm text-gray-600">Plan meals with what you have</p></CardContent></Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleLoadTemplate}><CardContent className="p-6 text-center"><Save className="w-8 h-8 mx-auto mb-3 text-blue-500" /><h3 className="font-medium mb-2">Load Template</h3><p className="text-sm text-gray-600">Use a saved meal plan template</p></CardContent></Card>
      </div>
    </div>
  );
};

export default PlannerTabSection;
