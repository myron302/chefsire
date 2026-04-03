import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Plus, X } from "lucide-react";

import { BudgetAllocation, inferBudgetKeyFromTask, PlanningTask } from "@/pages/services/lib/wedding-planning-core";

interface WeddingPlanningTasksSectionProps {
  completedTasks: number;
  planningTasks: PlanningTask[];
  planningProgress: number;
  openProgressEditor: () => void;
  isProgressEditorOpen: boolean;
  handleProgressEditorOpenChange: (open: boolean) => void;
  newPlanningTaskLabel: string;
  setNewPlanningTaskLabel: (value: string) => void;
  newPlanningTaskBudgetKey: BudgetAllocation["key"];
  setNewPlanningTaskBudgetKey: (value: BudgetAllocation["key"]) => void;
  newPlanningTaskCost: string;
  setNewPlanningTaskCost: (value: string) => void;
  addEditorTask: () => void;
  budgetAllocations: BudgetAllocation[];
  progressEditorTasks: PlanningTask[];
  toggleEditorTask: (taskId: string) => void;
  updateEditorTaskLabel: (taskId: string, label: string) => void;
  updateEditorTaskBudgetKey: (taskId: string, budgetKey: BudgetAllocation["key"]) => void;
  updateEditorTaskCost: (taskId: string, raw: string) => void;
  removeEditorTask: (taskId: string) => void;
  savePlanningTasks: () => void;
}

export function WeddingPlanningTasksSection({
  completedTasks,
  planningTasks,
  planningProgress,
  openProgressEditor,
  isProgressEditorOpen,
  handleProgressEditorOpenChange,
  newPlanningTaskLabel,
  setNewPlanningTaskLabel,
  newPlanningTaskBudgetKey,
  setNewPlanningTaskBudgetKey,
  newPlanningTaskCost,
  setNewPlanningTaskCost,
  addEditorTask,
  budgetAllocations,
  progressEditorTasks,
  toggleEditorTask,
  updateEditorTaskLabel,
  updateEditorTaskBudgetKey,
  updateEditorTaskCost,
  removeEditorTask,
  savePlanningTasks,
}: WeddingPlanningTasksSectionProps) {
  return (
    <Card className="mb-6">
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h3 className="font-semibold text-sm md:text-base">Your Wedding Planning Progress</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs md:text-sm text-muted-foreground">
              {completedTasks} of {planningTasks.length} items completed
            </span>
            <Button variant="outline" size="sm" onClick={openProgressEditor}>
              Edit
            </Button>
          </div>
        </div>

        <Progress value={planningProgress} className="mb-4" />

        <div className="grid grid-cols-4 md:grid-cols-7 gap-2 md:gap-3">
          {planningTasks.map((task) => (
            <div key={task.id} className="text-center">
              <div
                className={`w-7 h-7 md:w-8 md:h-8 mx-auto rounded-full flex items-center justify-center mb-1 ${
                  task.completed ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
                }`}
              >
                {task.completed && <span className="text-xs">✅</span>}
              </div>
              <span className="text-[10px] md:text-xs line-clamp-2">{task.label}</span>
            </div>
          ))}
        </div>

        <Dialog open={isProgressEditorOpen} onOpenChange={handleProgressEditorOpenChange}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Wedding Progress</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px_140px_auto] gap-2">
                <Input
                  value={newPlanningTaskLabel}
                  onChange={(event) => setNewPlanningTaskLabel(event.target.value)}
                  placeholder="Add a planning item (e.g. officiant, transportation)"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addEditorTask();
                    }
                  }}
                />
                <Select value={newPlanningTaskBudgetKey} onValueChange={(value) => setNewPlanningTaskBudgetKey(value as BudgetAllocation["key"])}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {budgetAllocations.map((a) => (
                      <SelectItem key={a.key} value={a.key}>
                        {a.category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  inputMode="numeric"
                  className="text-sm"
                  placeholder="Cost (USD)"
                  value={newPlanningTaskCost}
                  onChange={(event) => setNewPlanningTaskCost(event.target.value)}
                />
                <Button variant="outline" onClick={addEditorTask} className="sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Optional: add a category + cost so it automatically rolls up into the Smart Budget sections.
              </p>

              <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
                {progressEditorTasks.map((task) => (
                  <div key={task.id} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border bg-background p-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Button variant="outline" size="sm" className="shrink-0" onClick={() => toggleEditorTask(task.id)}>
                        {task.completed ? "✅" : "⚪️"}
                      </Button>
                      <Input
                        className="min-w-0"
                        value={task.label}
                        onChange={(event) => updateEditorTaskLabel(task.id, event.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:w-[360px]">
                      <Select
                        value={(task.budgetKey ?? inferBudgetKeyFromTask(task)) as BudgetAllocation["key"]}
                        onValueChange={(value) => updateEditorTaskBudgetKey(task.id, value as BudgetAllocation["key"])}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          {budgetAllocations.map((a) => (
                            <SelectItem key={a.key} value={a.key}>
                              {a.category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        type="number"
                        inputMode="numeric"
                        className="text-sm"
                        placeholder="Cost (USD)"
                        value={typeof task.cost === "number" ? String(task.cost) : ""}
                        onChange={(event) => updateEditorTaskCost(task.id, event.target.value)}
                      />
                    </div>

                    <Button variant="ghost" size="sm" className="self-end sm:self-auto" onClick={() => removeEditorTask(task.id)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => handleProgressEditorOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={savePlanningTasks}>Save</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
