import React from 'react';
import { Camera, CheckCircle, ChevronDown, DollarSign, Download, Filter, Lightbulb, Package, Plus, ShoppingCart, Sparkles, Star, TrendingUp, Users, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { PlannerGrocerySuggestion } from '@/components/meal-planner/plannerGroceryUtils';

type GroceryTabSectionProps = {
  groceryList: any[];
  weekRange: { weekStart: string; weekEnd: string } | null;
  getCurrentWeekAnchor: () => string;
  setShowAddGroceryModal: React.Dispatch<React.SetStateAction<boolean>>;
  setShowScanModal: React.Dispatch<React.SetStateAction<boolean>>;
  optimizeShoppingList: () => void;
  exportGroceryList: () => void;
  toggleGroceryItem: (index: number) => void;
  normalizedSavingsReport: any;
  checkPantryFirst: () => void;
  shareWithFamily: () => void;
  onGoToPlanner: () => void;
  onGenerateWeekPlan: () => void;
  isGeneratingWeek: boolean;
  onGoToPrep: () => void;
  prepGroceryBlockersCount: number;
  onResolvePrepGroceryBlockers: () => void;
  canResolvePrepGroceryBlockers: boolean;
  blockerItemSuggestions: Array<{
    id: string;
    name: string;
    category: string;
    reason: string;
    alreadyOnList: boolean;
  }>;
  onAddBlockerSuggestion: (suggestion: {
    id: string;
    name: string;
    category: string;
    reason: string;
    alreadyOnList: boolean;
  }) => void;
  blockerSuggestionResolvedCount: number;
  blockerSuggestionTrackedCount: number;
  unresolvedBlockerSuggestionNames: string[];
  resolvedBlockerSuggestionNames: string[];
  canResolveTrackedSuggestionBlockers: boolean;
  onResolveTrackedSuggestionBlockers: () => void;
  plannerGrocerySuggestions: PlannerGrocerySuggestion[];
  pendingPlannerGroceryCount: number;
  resolvedPlannerGroceryCount: number;
  onAcceptPlannerGrocerySuggestion: (suggestion: PlannerGrocerySuggestion) => void;
  onDismissPlannerGrocerySuggestion: (suggestion: PlannerGrocerySuggestion) => void;
  onTogglePlannerGrocerySuggestion: (suggestion: PlannerGrocerySuggestion) => void;
  onEditPlannerGrocerySuggestion: (suggestion: PlannerGrocerySuggestion) => void;
};

const GroceryTabSection = ({
  groceryList,
  weekRange,
  getCurrentWeekAnchor,
  setShowAddGroceryModal,
  setShowScanModal,
  optimizeShoppingList,
  exportGroceryList,
  toggleGroceryItem,
  normalizedSavingsReport,
  checkPantryFirst,
  shareWithFamily,
  onGoToPlanner,
  onGenerateWeekPlan,
  isGeneratingWeek,
  onGoToPrep,
  prepGroceryBlockersCount,
  onResolvePrepGroceryBlockers,
  canResolvePrepGroceryBlockers,
  blockerItemSuggestions,
  onAddBlockerSuggestion,
  blockerSuggestionResolvedCount,
  blockerSuggestionTrackedCount,
  unresolvedBlockerSuggestionNames,
  resolvedBlockerSuggestionNames,
  canResolveTrackedSuggestionBlockers,
  onResolveTrackedSuggestionBlockers,
  plannerGrocerySuggestions,
  pendingPlannerGroceryCount,
  resolvedPlannerGroceryCount,
  onAcceptPlannerGrocerySuggestion,
  onDismissPlannerGrocerySuggestion,
  onTogglePlannerGrocerySuggestion,
  onEditPlannerGrocerySuggestion,
}: GroceryTabSectionProps) => {
  const buyItems = groceryList.filter((i: any) => !i.isPantryItem);
  const checkedBuyItems = buyItems.filter((i: any) => i.checked).length;
  const pendingBuyItems = buyItems.filter((i: any) => !i.checked).length;
  const visiblePlannerGrocerySuggestions = plannerGrocerySuggestions.filter((suggestion) => !suggestion.dismissed);
  const groupedPlannerGrocerySuggestions = visiblePlannerGrocerySuggestions.reduce((groups, suggestion) => {
    const key = suggestion.category || 'From Recipe';
    groups[key] = [...(groups[key] || []), suggestion];
    return groups;
  }, {} as Record<string, PlannerGrocerySuggestion[]>);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 via-white to-orange-50">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-blue-600 font-semibold mb-1">Next step</p>
                <h3 className="font-semibold text-gray-900">
                  {buyItems.length === 0 ? 'No list yet — start from your planner' : pendingBuyItems > 0 ? 'Finish this list, then prep meals' : 'Shopping complete — move to prep'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {buyItems.length === 0
                    ? 'Generate a week plan to auto-populate your shopping list.'
                    : `${checkedBuyItems}/${buyItems.length} shopping items checked off.`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={onGoToPlanner}>
                  Back to Planner
                </Button>
                {buyItems.length === 0 && (
                  <Button size="sm" onClick={onGenerateWeekPlan} disabled={isGeneratingWeek}>
                    <Zap className="w-4 h-4 mr-2" />
                    {isGeneratingWeek ? 'Generating...' : 'Auto-Plan Week'}
                  </Button>
                )}
                {buyItems.length > 0 && (
                  <Button size="sm" onClick={onGoToPrep}>
                    Plan Prep Session
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>


        {visiblePlannerGrocerySuggestions.length > 0 && (
          <Card className="border-purple-200 bg-gradient-to-r from-purple-50 via-white to-orange-50">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2 text-purple-900">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    Planner grocery intelligence
                  </CardTitle>
                  <CardDescription className="text-purple-700">
                    Generated from structured meal items for this week. Accept items to add them to your saved list, or check/dismiss derived suggestions for readiness tracking.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-purple-200 text-purple-700">{visiblePlannerGrocerySuggestions.length} generated</Badge>
                  <Badge variant="outline" className="border-orange-200 text-orange-700">{pendingPlannerGroceryCount} missing</Badge>
                  <Badge variant="outline" className="border-green-200 text-green-700">{resolvedPlannerGroceryCount} resolved</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(groupedPlannerGrocerySuggestions).map(([category, suggestions]) => (
                <div key={category} className="rounded-xl border border-purple-100 bg-white/80 p-3">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-xs uppercase tracking-wide text-purple-700 font-semibold">{category}</p>
                    <Badge variant="secondary" className="text-xs">{suggestions.length} item{suggestions.length === 1 ? '' : 's'}</Badge>
                  </div>
                  <div className="space-y-2">
                    {suggestions.map((suggestion) => {
                      const isResolved = suggestion.checked || suggestion.accepted;
                      const sourcePreview = suggestion.linkedMealNames.slice(0, 3).join(', ');
                      return (
                        <details key={suggestion.id} className={`group rounded-lg border p-3 transition ${isResolved ? 'border-green-100 bg-green-50/50' : 'border-gray-200 bg-white hover:border-purple-200'}`}>
                          <summary className="list-none cursor-pointer">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div className="flex items-start gap-3 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={suggestion.checked}
                                  className="mt-0.5 w-5 h-5 rounded border-gray-300 cursor-pointer accent-purple-500"
                                  onChange={(event) => {
                                    event.preventDefault();
                                    onTogglePlannerGrocerySuggestion(suggestion);
                                  }}
                                />
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className={`text-sm font-semibold ${isResolved ? 'text-green-800' : 'text-gray-900'}`}>{suggestion.name}</p>
                                    {suggestion.generated && <Badge variant="outline" className="text-[10px] border-purple-200 text-purple-700">generated</Badge>}
                                    {suggestion.sourceRecipeIds.length > 0 && <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700">recipe-linked</Badge>}
                                    {suggestion.pantryMatchStatus !== 'missing' && <Badge variant="outline" className="text-[10px] border-green-200 text-green-700 bg-green-50">already in pantry</Badge>}
                                    {suggestion.onManualList && <Badge variant="outline" className="text-[10px] border-orange-200 text-orange-700">on list</Badge>}
                                  </div>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {suggestion.quantitySummary} • {suggestion.sourceMealsCount} source meal{suggestion.sourceMealsCount === 1 ? '' : 's'}{sourcePreview ? `: ${sourcePreview}` : ''}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                {!suggestion.accepted && !suggestion.onManualList && suggestion.pantryMatchStatus === 'missing' && (
                                  <Button size="sm" variant="outline" onClick={(event) => { event.preventDefault(); onAcceptPlannerGrocerySuggestion(suggestion); }}>
                                    <Plus className="w-3.5 h-3.5 mr-1" />Accept
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" onClick={(event) => { event.preventDefault(); onEditPlannerGrocerySuggestion(suggestion); }}>Edit</Button>
                                <Button size="sm" variant="ghost" className="text-gray-500" onClick={(event) => { event.preventDefault(); onDismissPlannerGrocerySuggestion(suggestion); }}>Remove</Button>
                                <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" />
                              </div>
                            </div>
                          </summary>
                          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                            <div className="flex flex-wrap gap-1.5">
                              {suggestion.rows.slice(0, 8).map((row) => (
                                <Badge key={row.id} variant="secondary" className="text-xs bg-gray-100 text-gray-700">
                                  {row.rawName}{row.quantity ? ` • ${row.quantity}` : ''}
                                </Badge>
                              ))}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-600">
                              <p><span className="font-medium text-gray-800">Source meals:</span> {suggestion.linkedMealNames.join(', ')}</p>
                              <p><span className="font-medium text-gray-800">Pantry:</span> {suggestion.pantryMatchStatus === 'missing' ? 'No pantry/list match yet' : `Matched ${suggestion.pantryMatches.join(', ') || 'pantry item'}`}</p>
                            </div>
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {prepGroceryBlockersCount > 0 && (
          <Card className="border-amber-200 bg-amber-50/60">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-amber-700 font-semibold mb-1">Prep blocker bridge</p>
                  <p className="text-sm font-medium text-amber-900">
                    {prepGroceryBlockersCount === 1
                      ? '1 prep blocker is waiting on grocery.'
                      : `${prepGroceryBlockersCount} prep blockers are waiting on grocery.`}
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Finish shopping, then mark blockers resolved to continue prep.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={onResolvePrepGroceryBlockers} disabled={!canResolvePrepGroceryBlockers}>
                  Mark Grocery Blockers Resolved
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {blockerSuggestionTrackedCount > 0 && (
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">Suggestion resolution</p>
                <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                  {blockerSuggestionResolvedCount}/{blockerSuggestionTrackedCount} resolved
                </Badge>
              </div>
              <p className="text-sm text-emerald-900">
                {unresolvedBlockerSuggestionNames.length > 0
                  ? `Pending blocker-linked items: ${unresolvedBlockerSuggestionNames.join(', ')}.`
                  : 'All blocker-linked suggestion items are checked off.'}
              </p>
              {resolvedBlockerSuggestionNames.length > 0 && (
                <p className="text-xs text-emerald-700">
                  Completed from Grocery: {resolvedBlockerSuggestionNames.join(', ')}.
                </p>
              )}
              {canResolveTrackedSuggestionBlockers && (
                <Button size="sm" variant="outline" onClick={onResolveTrackedSuggestionBlockers}>
                  Resolve blocker from Grocery
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {blockerItemSuggestions.length > 0 && (
          <Card className="border-indigo-200 bg-indigo-50/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-indigo-800">
                <Lightbulb className="w-4 h-4 text-indigo-600" />
                Blocker item suggestions
              </CardTitle>
              <CardDescription className="text-xs text-indigo-700">
                Quick-add likely grocery items from active prep blockers and blocker notes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {blockerItemSuggestions.map((suggestion) => (
                <div key={suggestion.id} className="rounded-lg border border-indigo-100 bg-white p-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{suggestion.name}</p>
                    <p className="text-xs text-gray-500">
                      {suggestion.category} • Suggested {suggestion.reason}
                    </p>
                  </div>
                  {suggestion.alreadyOnList ? (
                    <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">
                      Already on list
                    </Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => onAddBlockerSuggestion(suggestion)}>
                      Add to Grocery
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {(() => {
          const pantryOwned = groceryList.filter((i: any) => i.isPantryItem && !i.checked);
          const stillNeeded = groceryList.filter((i: any) => !i.isPantryItem && !i.checked);
          if (groceryList.length === 0) return null;
          return (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0"><Package className="w-5 h-5 text-green-600" /></div><div><p className="text-xs text-green-700 font-medium">Already in Pantry</p><p className="text-2xl font-bold text-green-800">{pantryOwned.length}</p><p className="text-xs text-green-600">items you own</p></div></div>
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0"><ShoppingCart className="w-5 h-5 text-orange-500" /></div><div><p className="text-xs text-orange-700 font-medium">Still Need to Buy</p><p className="text-2xl font-bold text-orange-800">{stillNeeded.length}</p><p className="text-xs text-orange-600">items to get</p></div></div>
            </div>
          );
        })()}

        {(() => {
          const pantryOwned = groceryList.filter((i: any) => i.isPantryItem && !i.checked);
          if (pantryOwned.length === 0) return null;
          return (
            <Card className="border-green-200 bg-green-50/40">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2 text-green-800"><CheckCircle className="w-4 h-4 text-green-600" />Already in Your Pantry</CardTitle>
                  <Badge className="bg-green-100 text-green-700 border-green-200">{pantryOwned.length} owned</Badge>
                </div>
                <CardDescription className="text-green-700 text-xs">These items are in your pantry — no need to buy them</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pantryOwned.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-green-100">
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-800">{item.name || item.item}{item.optional ? <span className="text-xs text-gray-500"> (optional)</span> : null}</span>
                        {item.notes && <p className="text-xs text-gray-400 truncate">{item.notes}</p>}
                      </div>
                      {item.amount && <span className="text-xs text-gray-500 shrink-0">{item.amount}</span>}
                      <Badge variant="outline" className="text-xs text-green-600 border-green-300 shrink-0">In Pantry</Badge>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-green-600 mt-3 text-center"><a href="/pantry" className="underline hover:text-green-800 font-medium">View &amp; manage your full pantry →</a></p>
              </CardContent>
            </Card>
          );
        })()}

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Shopping List</CardTitle>
                <CardDescription className="mt-1">
                  {weekRange
                    ? `Week of ${new Date(weekRange.weekStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(weekRange.weekEnd + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : `Week of ${new Date(getCurrentWeekAnchor() + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setShowAddGroceryModal(true)}><Plus className="w-4 h-4 mr-2" />Add Item</Button>
                <Button size="sm" variant="outline" onClick={() => setShowScanModal(true)}><Camera className="w-4 h-4 mr-2" />Scan</Button>
                <Button variant="outline" size="sm" onClick={optimizeShoppingList}><Filter className="w-4 h-4 mr-2" />Optimize</Button>
                <Button variant="outline" size="sm" onClick={exportGroceryList}><Download className="w-4 h-4 mr-2" />Export</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {groceryList.filter((i: any) => !i.isPantryItem).length === 0 && groceryList.length === 0 ? (
                <div className="text-center py-8 text-gray-500"><ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>No items in your grocery list</p><p className="text-sm mt-1">Add items or generate a week plan to get started</p></div>
              ) : groceryList.filter((i: any) => !i.isPantryItem).length === 0 ? (
                <div className="text-center py-8"><CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" /><p className="font-medium text-green-700">Your pantry covers everything!</p><p className="text-sm text-gray-500 mt-1">All items for this week are already in your pantry</p></div>
              ) : (
                (() => {
                  const categories = Array.from(new Set(buyItems.map((item: any) => item.category || 'Other')));
                  const categoryOrder = ['Protein', 'Produce', 'Grains', 'Dairy', 'From Recipe', 'Other'];
                  const sortedCategories = (categories as string[]).sort((a, b) => {
                    const aIndex = categoryOrder.indexOf(a);
                    const bIndex = categoryOrder.indexOf(b);
                    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
                    if (aIndex === -1) return 1;
                    if (bIndex === -1) return -1;
                    return aIndex - bIndex;
                  });
                  return sortedCategories.map((category) => (
                    <div key={category}>
                      <h3 className="font-medium text-sm text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-2">{category}<span className="text-xs font-normal normal-case text-gray-400">({buyItems.filter((i: any) => (i.category || 'Other') === category).length} items)</span></h3>
                      <div className="space-y-2">
                        {buyItems.filter((item: any) => (item.category || 'Other') === category).map((item: any) => {
                          const globalIndex = groceryList.findIndex((i: any) => i === item);
                          return (
                            <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${item.checked ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-200 hover:border-orange-200 hover:bg-orange-50/30'}`}>
                              <input type="checkbox" checked={item.checked} className="w-5 h-5 rounded border-gray-300 cursor-pointer accent-orange-500" onChange={() => toggleGroceryItem(globalIndex)} />
                              <div className="flex-1 min-w-0"><span className={`text-sm font-medium ${item.checked ? 'line-through text-gray-400' : 'text-gray-900'}`}>{item.name || item.item}{item.optional ? <span className="text-xs text-gray-500"> (optional)</span> : null}</span>{item.notes && <p className="text-xs text-gray-400 truncate mt-0.5">{item.notes}</p>}</div>
                              {item.amount && <span className="text-xs text-gray-500 shrink-0 bg-gray-100 rounded px-2 py-0.5">{item.amount}</span>}
                              {item.checked && <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Progress</CardTitle></CardHeader>
          <CardContent>
            {(() => {
              const total = groceryList.filter((i: any) => !i.isPantryItem).length;
              const checked = groceryList.filter((i: any) => !i.isPantryItem && i.checked).length;
              const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
              const estimatedTotal = groceryList.reduce((s: number, i: any) => s + Number(i.estimatedPrice || 0), 0);
              const pantryCount = groceryList.filter((i: any) => i.isPantryItem).length;
              return (
                <div className="space-y-4">
                  <div><div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-600">Items Checked Off</span><span className="text-sm font-semibold text-gray-900">{checked} / {total}</span></div><Progress value={pct} className="h-2.5" />{pct === 100 && total > 0 && <p className="text-xs text-green-600 font-medium mt-1.5 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Shopping complete!</p>}</div>
                  {pantryCount > 0 && <div className="flex items-center justify-between py-2 px-3 bg-green-50 rounded-lg border border-green-100"><span className="text-xs text-green-700 flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Pantry saves you buying</span><span className="text-xs font-semibold text-green-800">{pantryCount} items</span></div>}
                  <div className="pt-3 border-t"><p className="text-xs text-gray-500 mb-1">Estimated Cost</p><p className="text-2xl font-bold text-gray-900">{estimatedTotal > 0 ? `$${estimatedTotal.toFixed(2)}` : '—'}</p>{estimatedTotal === 0 && <p className="text-xs text-gray-400 mt-1">Add prices in item details to track spend</p>}</div>
                  <div className="pt-3 border-t"><a href="/pantry" className="flex items-center justify-between w-full text-sm text-orange-600 hover:text-orange-800 font-medium group"><span className="flex items-center gap-2"><Package className="w-4 h-4" />Open Full Pantry &amp; Shopping List</span><span className="group-hover:translate-x-0.5 transition-transform">→</span></a><p className="text-xs text-gray-400 mt-1">Manage pantry stock, expiry dates &amp; more</p></div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {normalizedSavingsReport && (
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><DollarSign className="w-5 h-5 text-green-600" />Savings Report</CardTitle><CardDescription>Your grocery budget performance</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-lg p-3"><p className="text-xs text-gray-600 mb-1">Total Saved</p><p className="text-2xl font-bold text-green-600">${normalizedSavingsReport.totalSaved.toFixed(2)}</p><p className="text-xs text-gray-500 mt-1">{normalizedSavingsReport.savingsRate} savings rate</p></div>
                <div className="bg-white rounded-lg p-3"><p className="text-xs text-gray-600 mb-1">Pantry Savings</p><p className="text-2xl font-bold text-emerald-600">${normalizedSavingsReport.pantrySavings.toFixed(2)}</p><p className="text-xs text-gray-500 mt-1">{normalizedSavingsReport.pantryItemCount} items owned</p></div>
              </div>
              <div className="pt-3 border-t border-green-200"><p className="text-xs font-medium text-gray-700 mb-2">Top Saving Categories:</p><div className="space-y-2">{normalizedSavingsReport.topSavingCategories.slice(0, 3).map((category: any, idx: number) => <div key={idx} className="flex items-center justify-between text-xs"><span className="text-gray-600">{category?.category || 'Other'}</span><span className="font-medium text-green-600">-${Number(category?.saved || 0).toFixed(2)}</span></div>)}</div></div>
              <div className="bg-white rounded-lg p-3 text-center"><div className="flex items-center justify-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-green-600" /><p className="text-xs font-medium text-gray-700">Smart Shopping</p></div><p className="text-xs text-gray-600">You're spending {normalizedSavingsReport.savingsRate} less than estimated!</p></div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-lg">Smart Features</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" size="sm" onClick={checkPantryFirst}><Package className="w-4 h-4 mr-2" />Check Pantry First</Button>
            <Button variant="outline" className="w-full justify-start" size="sm" onClick={shareWithFamily}><Users className="w-4 h-4 mr-2" />Share with Family</Button>
            <Button variant="outline" className="w-full justify-start" size="sm"><Star className="w-4 h-4 mr-2" />Add to Favorites</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GroceryTabSection;
