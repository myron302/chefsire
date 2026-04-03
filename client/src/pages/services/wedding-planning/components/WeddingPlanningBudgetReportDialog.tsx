import { Lock, Sparkles, Shield, Share2, Zap } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

import { BudgetAllocation, budgetIconTone } from "@/pages/services/lib/wedding-planning-core";

type BudgetReportRow = BudgetAllocation & {
  target: number;
  spent: number;
  remaining: number;
  pct: number;
};

interface WeddingPlanningBudgetReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isPremium: boolean;
  totalBudget: number;
  totalSpent: number;
  budgetDelta: number;
  budgetStatusLabel: string;
  budgetUsedPct: number;
  dynamicSavings: number;
  budgetReportRows: BudgetReportRow[];
  onClose: () => void;
  onGoPremium: () => void;
  onExportBudgetCsv: () => void;
}

export function WeddingPlanningBudgetReportDialog({
  isOpen,
  onOpenChange,
  isPremium,
  totalBudget,
  totalSpent,
  budgetDelta,
  budgetStatusLabel,
  budgetUsedPct,
  dynamicSavings,
  budgetReportRows,
  onClose,
  onGoPremium,
  onExportBudgetCsv,
}: WeddingPlanningBudgetReportDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>AI Budget Detail Report</DialogTitle>
        </DialogHeader>

        {!isPremium ? (
          <div className="space-y-4">
            <Alert>
              <AlertDescription className="flex items-start gap-2">
                <Lock className="h-4 w-4 mt-0.5" />
                <span>
                  Detailed budget insights are a Premium feature. You can preview your totals here, then upgrade to unlock the
                  full category breakdown and savings guidance.
                </span>
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-2xl border bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground">Total budget</p>
                <p className="text-lg font-bold">${totalBudget.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground">Total planned (tracked)</p>
                <p className="text-lg font-bold">${totalSpent.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className={`text-lg font-bold ${budgetDelta < 0 ? "text-red-600" : "text-green-600"}`}>{budgetStatusLabel}</p>
              </div>
            </div>

            <div className="rounded-2xl border bg-white/60 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Budget used</p>
                <Badge variant="secondary">{budgetUsedPct}%</Badge>
              </div>
              <Progress value={budgetUsedPct} className="mt-2 h-2" />
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button onClick={onGoPremium}>
                <Sparkles className="h-4 w-4 mr-2 text-white" />
                Upgrade to Premium
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="rounded-2xl border bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground">Projected savings</p>
                <p className="text-lg font-bold">${dynamicSavings.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground">Total budget</p>
                <p className="text-lg font-bold">${totalBudget.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground">Total planned (tracked)</p>
                <p className="text-lg font-bold">${totalSpent.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground">Remaining</p>
                <p className={`text-lg font-bold ${budgetDelta < 0 ? "text-red-600" : "text-green-600"}`}>
                  ${Math.abs(budgetDelta).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border bg-white/60 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <p className="text-sm font-semibold">Category breakdown</p>
                </div>

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={onExportBudgetCsv}>
                    <Share2 className="h-4 w-4 mr-2 text-indigo-600" />
                    Export CSV
                  </Button>
                </div>
              </div>

              <div className="mt-3 overflow-hidden rounded-xl border">
                <div className="grid grid-cols-12 bg-muted/60 px-3 py-2 text-xs font-medium">
                  <div className="col-span-5">Category</div>
                  <div className="col-span-2 text-right">Target</div>
                  <div className="col-span-2 text-right">Spent</div>
                  <div className="col-span-2 text-right">Remaining</div>
                  <div className="col-span-1 text-right">%</div>
                </div>

                <div className="divide-y bg-white/60">
                  {budgetReportRows.map((r) => (
                    <div key={r.key} className="grid grid-cols-12 items-center px-3 py-2">
                      <div className="col-span-5 flex items-center gap-2 min-w-0">
                        <r.icon className={`h-4 w-4 ${budgetIconTone(r.key)} flex-shrink-0`} />
                        <p className="text-sm font-medium truncate">{r.category}</p>
                        <Badge variant="secondary" className="ml-1 text-[10px]">
                          {r.percentage}%
                        </Badge>
                      </div>
                      <div className="col-span-2 text-right text-sm font-semibold">${r.target.toLocaleString()}</div>
                      <div className="col-span-2 text-right text-sm">${r.spent.toLocaleString()}</div>
                      <div className="col-span-2 text-right text-sm">
                        <span className={r.remaining < 0 ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
                          ${Math.abs(r.remaining).toLocaleString()}
                        </span>
                      </div>
                      <div className="col-span-1 text-right text-xs text-muted-foreground">{r.pct}%</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-muted/60 p-3">
                <div className="flex items-start gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    Tip: if you&apos;re over budget, adjust guest count or re-balance venue + catering first — that&apos;s where most
                    big swings happen.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
