import React from 'react';
import { ChefHat, Package, Plus, Save, Sparkles, Zap } from 'lucide-react';
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
  weekDays: readonly string[];
  getDateForWeekday: (weekday: string) => string;
  mealTypes: readonly string[];
  weeklyMeals: Record<string, any>;
  getMealSlotItems: (weeklyMeals: Record<string, any>, day: string, mealType: string) => any[];
  getMealSlotTotals: (weeklyMeals: Record<string, any>, day: string, mealType: string) => { calories: number; protein: number; carbs: number; fat: number };
  gradeClass: (grade: string) => string;
  getNutritionGrade: (item: any, calorieGoal: number) => string;
  removeMealItem: (day: string, mealType: string, index: number) => void;
  dayNames: readonly string[];
  handleAIRecipe: () => void;
  handleUsePantry: () => void;
  handleLoadTemplate: () => void;
};

const PlannerTabSection = ({
  caloriesCurrent,
  calorieGoal,
  calorieProgress,
  remainingCalories,
  proteinCurrent,
  carbsCurrent,
  fatCurrent,
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
}: PlannerTabSectionProps) => {
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

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Button variant={viewMode === 'day' ? 'default' : 'outline'} size="sm" className="flex-1 md:flex-none" onClick={() => setViewMode('day')}>Day</Button>
          <Button variant={viewMode === 'week' ? 'default' : 'outline'} size="sm" className="flex-1 md:flex-none" onClick={() => setViewMode('week')}>Week</Button>
          <Button variant={viewMode === 'month' ? 'default' : 'outline'} size="sm" className="flex-1 md:flex-none" onClick={() => setViewMode('month')}>Month</Button>
        </div>
        <div className="flex items-center gap-2 flex-1 md:flex-none">
          <Button variant="outline" size="sm" className="flex-1 md:flex-none" onClick={generateWeekPlan} disabled={isGeneratingWeek}><Zap className="w-4 h-4 mr-2" />{isGeneratingWeek ? 'Generating...' : 'Auto-Plan Week'}</Button>
          <Button variant="outline" size="sm" className="flex-1 md:flex-none" onClick={saveTemplate}><Save className="w-4 h-4 mr-2" />Save Template</Button>
          <Button size="sm" className="flex-1 md:flex-none" onClick={() => handleAddMeal()}><Plus className="w-4 h-4 mr-2" />Add Meal</Button>
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
          <div className="hidden md:block bg-white rounded-lg shadow-sm overflow-hidden overflow-x-auto">
            <div className="grid grid-cols-8 border-b min-w-[800px]">
              <div className="p-4 bg-gray-50 border-r"><span className="text-sm font-medium text-gray-500">Meal</span></div>
              {weekDays.map((day) => (
                <div key={day} className="p-4 bg-gray-50 border-r last:border-r-0">
                  <div className="text-sm font-medium text-gray-900">{day}</div>
                  <div className={`text-xs ${getDateForWeekday(day) === formatLocalDate(new Date()) ? 'text-orange-600 font-semibold' : 'text-gray-500'}`}>{new Date(getDateForWeekday(day) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                </div>
              ))}
            </div>
            {mealTypes.map((mealType) => (
              <div key={mealType} className="grid grid-cols-8 border-b last:border-b-0 min-w-[800px]">
                <div className="p-4 bg-gray-50 border-r flex items-center"><span className="text-sm font-medium text-gray-700 capitalize">{mealType}</span></div>
                {weekDays.map((day) => {
                  const items = getMealSlotItems(weeklyMeals, day, mealType);
                  const totals = getMealSlotTotals(weeklyMeals, day, mealType);
                  return (
                    <div key={`${day}-${mealType}`} className="p-2 border-r last:border-r-0 min-h-[72px]">
                      {items.length > 0 && (
                        <div className="space-y-1 mb-1">
                          {items.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-start justify-between gap-1 group">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-gray-900 truncate flex items-center gap-1">{item.name} {item.source === 'recipe' && <ChefHat className="w-3 h-3 text-orange-500" />} <span className={`px-1.5 py-0.5 rounded text-[10px] ${gradeClass(getNutritionGrade(item, calorieGoal))}`}>{getNutritionGrade(item, calorieGoal)}</span></div>
                                <div className="text-xs text-gray-400">{item.calories} cal · P:{item.protein}g</div>
                              </div>
                              <button className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs leading-none mt-0.5 shrink-0" onClick={(e) => { e.stopPropagation(); removeMealItem(day, mealType, idx); }} title="Remove">✕</button>
                            </div>
                          ))}
                          {items.length > 1 && <div className="text-xs text-orange-600 font-medium border-t border-gray-100 pt-1">Total: {totals.calories} cal</div>}
                        </div>
                      )}
                      <button className="flex items-center gap-1 text-xs text-gray-400 hover:text-orange-500 w-full mt-1" onClick={() => handleAddMeal(day, mealType)}><Plus className="w-3.5 h-3.5" /><span>{items.length > 0 ? 'Add more' : 'Add'}</span></button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="md:hidden space-y-4">
            {weekDays.map((day) => (
              <Card key={day}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{day}</CardTitle>
                  <CardDescription className={getDateForWeekday(day) === formatLocalDate(new Date()) ? 'text-orange-600 font-semibold' : ''}>{new Date(getDateForWeekday(day) + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {mealTypes.map((mealType) => (
                    <div key={`${day}-${mealType}`} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 capitalize">{mealType}</span>
                        <button className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-700" onClick={() => handleAddMeal(day, mealType)}><Plus className="w-3.5 h-3.5" />{getMealSlotItems(weeklyMeals, day, mealType).length > 0 ? 'Add more' : 'Add'}</button>
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
                      ) : <p className="text-xs text-gray-500">Tap Add to log meals</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {viewMode === 'day' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {selectedDate === formatLocalDate(new Date()) && <div className="bg-orange-50 border-b border-orange-100 px-4 py-2 flex items-center gap-2"><span className="w-2 h-2 bg-orange-500 rounded-full inline-block"></span><span className="text-xs font-medium text-orange-700">Today</span></div>}
            <div className="divide-y">
              {mealTypes.map((mealType) => {
                const dayName = dayNames[parseDateOnly(selectedDate).getDay()];
                const items = getMealSlotItems(weeklyMeals, dayName, mealType);
                const totals = getMealSlotTotals(weeklyMeals, dayName, mealType);
                return (
                  <div key={mealType} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2"><span className="text-sm font-semibold text-gray-800 capitalize">{mealType}</span>{items.length > 0 && <span className="text-xs text-gray-400">{totals.calories} cal total</span>}</div>
                      <button className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-700 font-medium" onClick={() => handleAddMeal(dayName, mealType)}><Plus className="w-3.5 h-3.5" />{items.length > 0 ? 'Add more' : 'Add meal'}</button>
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
                    ) : <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-orange-300 hover:bg-orange-50 transition-colors" onClick={() => handleAddMeal(dayName, mealType)}><p className="text-xs text-gray-400">Nothing logged yet — tap to add</p></div>}
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
        </div>
      )}

      {viewMode === 'month' && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="p-2 text-center text-xs font-semibold text-gray-500 border-r last:border-r-0">{d}</div>)}</div>
          {(() => {
            const anchor = parseDateOnly(selectedDate);
            const year = anchor.getFullYear();
            const month = anchor.getMonth();
            const today = formatLocalDate(new Date());
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
              const isSelected = cellStr === selectedDate;
              const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][cellDate.getDay()];
              const hasAnyMeal = inMonth && mealTypes.some((mt) => getMealSlotItems(weeklyMeals, dayName, mt).length > 0);
              const dayTotalCal = inMonth ? mealTypes.reduce((acc, mt) => acc + getMealSlotTotals(weeklyMeals, dayName, mt).calories, 0) : 0;
              cells.push(
                <div key={cellStr} className={`min-h-[80px] p-1.5 border-r border-b last:border-r-0 cursor-pointer transition-colors ${!inMonth ? 'bg-gray-50' : isSelected ? 'bg-orange-50' : 'bg-white hover:bg-gray-50'}`} onClick={() => { if (inMonth) { setSelectedDate(cellStr); setViewMode('day'); } }}>
                  <div className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-orange-500 text-white' : inMonth ? 'text-gray-900' : 'text-gray-300'}`}>{cellDate.getDate()}</div>
                  {inMonth && hasAnyMeal && <div className="space-y-0.5"><div className="text-xs text-orange-600 font-medium">{dayTotalCal} cal</div><div className="flex gap-0.5 flex-wrap">{mealTypes.filter((mt) => getMealSlotItems(weeklyMeals, dayName, mt).length > 0).map((mt) => <span key={mt} className="text-xs bg-orange-100 text-orange-700 rounded px-1 leading-4">{mt[0].toUpperCase()}</span>)}</div></div>}
                  {inMonth && !hasAnyMeal && <div className="flex items-center justify-center h-8 opacity-0 hover:opacity-100 transition-opacity"><Plus className="w-3.5 h-3.5 text-gray-300" /></div>}
                </div>
              );
            }
            const rows: React.ReactNode[] = [];
            for (let r = 0; r < totalCells / 7; r++) rows.push(<div key={r} className="grid grid-cols-7">{cells.slice(r * 7, r * 7 + 7)}</div>);
            return rows;
          })()}
          <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-500 flex gap-4"><span><span className="inline-block w-4 h-4 bg-orange-500 rounded-full text-white text-center leading-4 mr-1">·</span> Today</span><span><span className="inline-block bg-orange-100 text-orange-700 rounded px-1 mr-1">B</span> Breakfast logged</span><span>Click any day to view/add meals</span></div>
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
