import { AlertCircle, DollarSign, Info, Lock, TrendingUp } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";

import { BudgetAllocation, budgetIconTone } from "@/pages/services/lib/wedding-planning-core";

interface BudgetBreakdownItem extends BudgetAllocation {
  amount: number;
}

interface WeddingPlanningBudgetSectionProps {
  showBudgetCalculator: boolean;
  budgetRange: number[];
  handleBudgetRangeChange: (nextRange: number[]) => void;
  budgetBreakdown: BudgetBreakdownItem[];
  spendByCategory: Map<BudgetAllocation["key"], number>;
  updateBudgetAllocation: (key: BudgetAllocation["key"], nextPercentage: number) => void;
  guestCount: number[];
  isOverBudget: boolean;
  budgetStatusLabel: string;
  budgetDelta: number;
  budgetUsedPct: number;
  totalSpent: number;
  isElite: boolean;
  dynamicSavings: number;
  handleViewBudgetReport: () => void;
  handleGoPremium: () => void;
}

export function WeddingPlanningBudgetSection({
  showBudgetCalculator,
  budgetRange,
  handleBudgetRangeChange,
  budgetBreakdown,
  spendByCategory,
  updateBudgetAllocation,
  guestCount,
  isOverBudget,
  budgetStatusLabel,
  budgetDelta,
  budgetUsedPct,
  totalSpent,
  isElite,
  dynamicSavings,
  handleViewBudgetReport,
  handleGoPremium,
}: WeddingPlanningBudgetSectionProps) {
  return (
    <>
      {showBudgetCalculator && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Smart Budget Calculator</CardTitle>
            <CardDescription>Optimize your wedding budget across all vendor categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Total Budget</label>
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-2xl font-bold">${budgetRange[1].toLocaleString()}</span>
                  <Slider value={budgetRange} onValueChange={handleBudgetRangeChange} max={100000} min={5000} step={1000} className="flex-1" />
                </div>
              </div>

              <div className="grid gap-3 mt-6">
                {budgetBreakdown.map((item) => (
                  <div key={item.key} className="p-3 bg-muted rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <item.icon className={`w-5 h-5 ${budgetIconTone(item.key)}`} />
                        <div>
                          <p className="font-medium">{item.category}</p>
                          <p className="text-xs text-muted-foreground">{item.percentage}% of budget</p>
                        </div>
                      </div>
                      <span className="font-semibold">${item.amount.toLocaleString()}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>${Math.round(Number(spendByCategory.get(item.key) || 0)).toLocaleString()} planned</span>
                        <span>${Math.round(item.amount - Number(spendByCategory.get(item.key) || 0)).toLocaleString()} remaining</span>
                      </div>
                      <Progress
                        value={
                          item.amount <= 0
                            ? 0
                            : Math.max(0, Math.min(100, Math.round((Number(spendByCategory.get(item.key) || 0) / item.amount) * 100)))
                        }
                        className="h-2"
                      />
                    </div>

                    {item.key !== "other" && (
                      <Slider value={[item.percentage]} onValueChange={(value) => updateBudgetAllocation(item.key, value[0] ?? item.percentage)} max={100} min={0} step={1} />
                    )}
                  </div>
                ))}
              </div>

              <Alert>
                <Info className="h-4 w-4 text-purple-600" />
                <AlertDescription>
                  Based on {guestCount[0]} guests. Catering typically represents the largest portion of your wedding budget.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Your Current Budget</CardTitle>
            <CardDescription>Target: ${budgetRange[1].toLocaleString()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert className={isOverBudget ? "border-red-300 bg-red-50 text-red-700" : "border-green-300 bg-green-50 text-green-700"}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="font-medium">
                  {budgetStatusLabel}: ${Math.abs(budgetDelta).toLocaleString()}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Progress value={budgetUsedPct} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>${totalSpent.toLocaleString()} planned</span>
                  <span>{isOverBudget ? `${Math.abs(budgetDelta).toLocaleString()} over` : `${budgetDelta.toLocaleString()} remaining`}</span>
                </div>
              </div>

              <Slider value={budgetRange} onValueChange={handleBudgetRangeChange} max={100000} min={5000} step={1000} className="flex-1" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>${budgetRange[0].toLocaleString()}</span>
                <span>${budgetRange[1].toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={isElite ? "border-amber-500/50" : "border-gray-200"}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className={isElite ? "text-amber-700" : "text-gray-500"}>{isElite ? "AI-Powered Budget Optimizer" : "Budget Optimization (Elite)"}</CardTitle>
            {isElite ? <TrendingUp className="w-6 h-6 text-amber-600" /> : <Lock className="w-6 h-6 text-gray-400" />}
          </CardHeader>
          <CardContent>
            {isElite ? (
              <div className="space-y-3">
                <p className="text-4xl font-bold text-green-600">
                  <DollarSign className="w-6 h-6 inline mr-1 text-green-600" />
                  {dynamicSavings.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  Projected savings by optimizing your venue and catering budget against similar couples in your area.
                </p>
                <Button size="sm" onClick={handleViewBudgetReport}>
                  View Detailed Report
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-4xl font-bold text-gray-400">Locked</p>
                <p className="text-sm text-muted-foreground">
                  Unlock the AI-Powered Budget Optimizer (Elite tier) to find an average of
                  <span className="font-bold text-amber-600"> $4,200</span> in hidden savings based on your criteria and AI recommendations.
                </p>
                <Button size="sm" variant="outline" className="bg-amber-100 border-amber-300" onClick={handleGoPremium}>
                  <TrendingUp className="w-4 h-4 mr-2 text-amber-600" />
                  Upgrade to Elite
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
