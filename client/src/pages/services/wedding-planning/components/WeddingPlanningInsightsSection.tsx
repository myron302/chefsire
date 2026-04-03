import { ArrowRight, DollarSign, Info, Sparkles, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

import { WeddingPlanningView } from "@/pages/services/lib/wedding-planning-core";

interface RoadmapStep {
  id: string;
  label: string;
  done: boolean;
  source: string;
  reason: string;
  target: "checklist" | "budget" | "calendar" | "details" | "vendors" | null;
  dueLabel?: string;
}

interface InsightsTip {
  id: string;
  title: string;
  detail: string;
  source: string;
  severity?: "info" | "watch" | "warning";
  action?: "budget" | "checklist" | "calendar" | null;
}

interface TopBudgetItem {
  key: string;
  category: string;
  target: number;
  spent: number;
  remaining: number;
}

interface NoteTip {
  id: string;
  title: string;
  detail: string;
}

interface ReminderAction {
  id: string;
  label: string;
  done: boolean;
}

interface WeddingPlanningInsightsSectionProps {
  mode: WeddingPlanningView;
  daysUntilWedding: number | null;
  nextAutomatedStep: RoadmapStep | null;
  openProgressEditor: () => void;
  handleViewBudgetReport: () => void;
  setIsCalendarAddOpen: (open: boolean) => void;
  automatedRoadmap: RoadmapStep[];
  combinedInsightsTips: InsightsTip[];
  totalBudget: number;
  topBudgetItems: TopBudgetItem[];
  newCustomTipTitle: string;
  setNewCustomTipTitle: (value: string) => void;
  newCustomTipDetail: string;
  setNewCustomTipDetail: (value: string) => void;
  addCustomTip: () => void;
  customTips: NoteTip[];
  removeCustomTip: (id: string) => void;
  newCustomActionLabel: string;
  setNewCustomActionLabel: (value: string) => void;
  addCustomAction: () => void;
  customActions: ReminderAction[];
  toggleCustomActionDone: (id: string) => void;
  removeCustomAction: (id: string) => void;
}

export function WeddingPlanningInsightsSection({
  mode,
  daysUntilWedding,
  nextAutomatedStep,
  openProgressEditor,
  handleViewBudgetReport,
  setIsCalendarAddOpen,
  automatedRoadmap,
  combinedInsightsTips,
  totalBudget,
  topBudgetItems,
  newCustomTipTitle,
  setNewCustomTipTitle,
  newCustomTipDetail,
  setNewCustomTipDetail,
  addCustomTip,
  customTips,
  removeCustomTip,
  newCustomActionLabel,
  setNewCustomActionLabel,
  addCustomAction,
  customActions,
  toggleCustomActionDone,
  removeCustomAction,
}: WeddingPlanningInsightsSectionProps) {
  return (
    <>
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm flex-shrink-0">
              <Info className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg font-bold">Wedding 101: DIY Planning Tutorial</CardTitle>
              <CardDescription className="text-sm">
                A simple beginner-friendly roadmap you can follow while the smart planner tracks your real progress.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal pl-5 space-y-3 text-sm leading-relaxed">
            <li><span className="font-semibold">Set your vision + budget:</span> Align on style, rough guest count, and a budget range. Start broad, then tighten with real quotes.</li>
            <li><span className="font-semibold">Build the guest list draft:</span> Create your A-list first, then expand if budget and venue capacity allow.</li>
            <li><span className="font-semibold">Lock venue + date:</span> Venue and date decisions drive almost everything else (vendors, timing, logistics, travel).</li>
            <li><span className="font-semibold">Book major vendors:</span> Prioritize catering, photography/video, music, and florals/decor based on your budget and guest count.</li>
            <li><span className="font-semibold">Plan decor + rentals:</span> Decide what you can DIY vs. rent (linens, chairs, signage, centerpieces, arches).</li>
            <li><span className="font-semibold">Handle attire + beauty:</span> Start dress/suit decisions early enough for alterations, fittings, and beauty trials.</li>
            <li><span className="font-semibold">Food + cake decisions:</span> Tastings, menu choices, dietary needs, and dessert/cake planning should be scheduled early.</li>
            <li><span className="font-semibold">Ceremony logistics:</span> Officiant, vows, marriage license requirements, and ceremony flow all need a small checklist.</li>
            <li><span className="font-semibold">Build the timeline:</span> Add tastings, fittings, walkthroughs, rehearsal, payment deadlines, and day-of milestones to your calendar.</li>
            <li><span className="font-semibold">Final confirmations:</span> Confirm RSVPs, vendor times, final payments, emergency kit items, and contact list.</li>
          </ol>
          <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
            Inspiration: common wedding-planning guidance used across major wedding resources and community planning advice.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-500 flex items-center justify-center shadow-sm flex-shrink-0">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg font-bold">Smart Planning Roadmap</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  This section auto-tracks your progress from your checklist, budget, calendar, quotes, and wedding details — and suggests what to do next.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100">Automated</Badge>
              {typeof daysUntilWedding === "number" && (
                <Badge variant="secondary" className="text-xs">
                  {daysUntilWedding >= 0 ? `${daysUntilWedding} days to go` : `${Math.abs(daysUntilWedding)} days since date`}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className={["rounded-2xl border p-4 md:p-5", nextAutomatedStep ? "bg-purple-50/70 border-purple-200" : "bg-emerald-50 border-emerald-200"].join(" ")}>
            {nextAutomatedStep ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-xl bg-purple-600 flex items-center justify-center flex-shrink-0"><ArrowRight className="h-4 w-4 text-white" /></div>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide font-semibold text-purple-700">Your next best step</p>
                    <p className="text-base md:text-lg font-semibold leading-snug whitespace-normal break-words">{nextAutomatedStep.label}</p>
                    <p className="text-xs md:text-sm text-muted-foreground mt-1 leading-relaxed whitespace-normal break-words">{nextAutomatedStep.reason}</p>
                    <p className="text-[11px] md:text-xs text-purple-700/90 mt-1 whitespace-normal break-words">{nextAutomatedStep.source}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {nextAutomatedStep.dueLabel && <Badge className="bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100">{nextAutomatedStep.dueLabel}</Badge>}
                  {nextAutomatedStep.target === "checklist" && <Button size="sm" variant="outline" onClick={openProgressEditor}>Open checklist editor</Button>}
                  {nextAutomatedStep.target === "budget" && <Button size="sm" variant="outline" onClick={handleViewBudgetReport}>Open budget report</Button>}
                  {nextAutomatedStep.target === "calendar" && <Button size="sm" variant="outline" onClick={() => setIsCalendarAddOpen(true)}>Add calendar event</Button>}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0">
                  <svg className="h-4 w-4 text-white" viewBox="0 0 16 16" fill="none"><path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div>
                  <p className="font-semibold text-emerald-700">You’re in great shape</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">Your main roadmap items are complete. Use the checklist editor and calendar to keep fine details moving.</p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Automated Roadmap</p>
                <p className="text-xs text-muted-foreground">{automatedRoadmap.filter((s) => s.done).length}/{automatedRoadmap.length} complete</p>
              </div>
              <div className="space-y-2">
                {automatedRoadmap.map((step) => {
                  const isNext = !!nextAutomatedStep && nextAutomatedStep.id === step.id;
                  return (
                    <div key={step.id} className={["rounded-xl border p-3 md:p-3.5 transition-colors", step.done ? "bg-emerald-50 border-emerald-200" : isNext ? "bg-purple-50 border-purple-300" : "bg-muted/30 border-transparent"].join(" ")}>
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex-shrink-0">
                          {step.done ? <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center"><svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l2.4 2.4L10 2.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></div> : isNext ? <div className="h-5 w-5 rounded-full bg-purple-600 flex items-center justify-center"><ArrowRight className="h-3 w-3 text-white" /></div> : <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start gap-2">
                            <p className={["text-sm font-medium leading-relaxed min-w-0 whitespace-normal break-words", step.done ? "text-muted-foreground line-through" : "text-foreground"].join(" ")}>{step.label}</p>
                            {step.dueLabel && !step.done && <Badge variant="secondary" className="text-[10px] h-auto py-0.5 px-1.5">{step.dueLabel}</Badge>}
                            {step.done && <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white text-[10px] h-auto py-0.5 px-1.5">Done</Badge>}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground leading-relaxed whitespace-normal break-words">{step.reason}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground/90 leading-relaxed whitespace-normal break-words">{step.source}</p>
                          {isNext && !step.done && <p className="mt-1 text-xs font-semibold text-purple-700">Do this next →</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Smart Tips</p>
                  <Badge variant="secondary" className="text-[10px]">Auto-generated</Badge>
                </div>
                {combinedInsightsTips.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-4 text-center">
                    <Sparkles className="h-5 w-5 text-muted-foreground mx-auto mb-1.5" />
                    <p className="text-xs text-muted-foreground">Add a wedding date, guest count, or quotes and this section will get smarter automatically.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {combinedInsightsTips.map((tip) => {
                      const tone = tip.severity === "warning" ? "border-red-200 bg-red-50" : tip.severity === "watch" ? "border-amber-200 bg-amber-50" : "border-transparent bg-muted/30";
                      return (
                        <div key={tip.id} className={["rounded-xl border p-3", tone].join(" ")}>
                          <div className="flex items-start gap-2.5">
                            <div className={["mt-0.5 h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0", tip.severity === "warning" ? "bg-red-100 text-red-700" : tip.severity === "watch" ? "bg-amber-100 text-amber-700" : "bg-purple-100 text-purple-700"].join(" ")}>
                              <Sparkles className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium leading-relaxed whitespace-normal break-words">{tip.title}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed whitespace-normal break-words">{tip.detail}</p>
                              <p className="mt-1 text-[11px] text-muted-foreground/90 leading-relaxed whitespace-normal break-words">{tip.source}</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {tip.action === "budget" && <Button size="sm" variant="outline" onClick={handleViewBudgetReport}>Open budget report</Button>}
                                {tip.action === "checklist" && <Button size="sm" variant="outline" onClick={openProgressEditor}>Open checklist</Button>}
                                {tip.action === "calendar" && <Button size="sm" variant="outline" onClick={() => setIsCalendarAddOpen(true)}>Add calendar milestone</Button>}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {totalBudget > 0 && (
                <div className="rounded-xl border p-3 md:p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-muted-foreground" /><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Budget Watch</p></div>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleViewBudgetReport}>Full report</Button>
                  </div>
                  <div className="space-y-2">
                    {topBudgetItems.map((b) => {
                      const denom = Math.max(1, b.target || 1);
                      const pct = Math.min(100, Math.round((Math.max(0, b.spent) / denom) * 100));
                      const isOver = b.remaining < 0;
                      return (
                        <div key={b.key} className={["rounded-lg border p-2.5", isOver ? "bg-red-50 border-red-200" : "bg-muted/30 border-transparent"].join(" ")}>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium whitespace-normal break-words">{b.category}</p>
                              <p className="text-[11px] text-muted-foreground whitespace-normal break-words">Spent ${Number(b.spent || 0).toLocaleString()} / target ${Number(b.target || 0).toLocaleString()}</p>
                            </div>
                            <span className={["text-xs font-semibold flex-shrink-0", isOver ? "text-red-600" : "text-emerald-600"].join(" ")}>{isOver ? `$${Math.abs(Number(b.remaining || 0)).toLocaleString()} over` : `$${Number(b.remaining || 0).toLocaleString()} left`}</span>
                          </div>
                          <Progress value={pct} className={["h-1.5", isOver ? "[&>div]:bg-red-500" : ""].join(" ")} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {mode !== "hub" && <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pt-1">
            <div className="rounded-xl border p-3 md:p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pinned Notes (Optional)</p>
                  <p className="text-xs text-muted-foreground mt-1">Your own reminders — separate from the automated roadmap.</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">Saved</Badge>
              </div>

              <div className="space-y-2 mb-3">
                <Input value={newCustomTipTitle} onChange={(e) => setNewCustomTipTitle(e.target.value)} placeholder="Short note title (e.g., Ask aunt about cake stand)" />
                <Textarea value={newCustomTipDetail} onChange={(e) => setNewCustomTipDetail(e.target.value)} placeholder="Optional details" rows={2} />
                <div className="flex justify-end"><Button size="sm" onClick={addCustomTip}>Pin note</Button></div>
              </div>

              {customTips.length === 0 ? <p className="text-xs text-muted-foreground">No pinned notes yet.</p> : (
                <div className="space-y-2">
                  {customTips.map((tip) => (
                    <div key={tip.id} className="rounded-lg border p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium whitespace-normal break-words">{tip.title || "Pinned note"}</p>
                          {tip.detail ? <p className="mt-0.5 text-xs text-muted-foreground whitespace-normal break-words leading-relaxed">{tip.detail}</p> : null}
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => removeCustomTip(tip.id)} aria-label="Remove pinned note">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border p-3 md:p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Personal Reminders (Optional)</p>
                  <p className="text-xs text-muted-foreground mt-1">Simple manual checklist items. These do not change auto progress.</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">Saved</Badge>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <Input value={newCustomActionLabel} onChange={(e) => setNewCustomActionLabel(e.target.value)} placeholder="Add a personal reminder" className="flex-1" />
                <Button size="sm" onClick={addCustomAction} className="sm:w-auto w-full">Add reminder</Button>
              </div>

              {customActions.length === 0 ? <p className="text-xs text-muted-foreground">No personal reminders yet.</p> : (
                <div className="space-y-2">
                  {customActions.map((a) => (
                    <div key={a.id} className="rounded-lg border p-2.5">
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => toggleCustomActionDone(a.id)}
                          className={["mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors", a.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/30"].join(" ")}
                          aria-label={a.done ? "Mark reminder not done" : "Mark reminder done"}
                        >
                          {a.done ? <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none"><path d="M2 6l2.4 2.4L10 2.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
                        </button>

                        <div className="min-w-0 flex-1">
                          <p className={["text-sm leading-relaxed whitespace-normal break-words", a.done ? "line-through text-muted-foreground" : ""].join(" ")}>{a.label}</p>
                        </div>

                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => removeCustomAction(a.id)} aria-label="Remove personal reminder">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>}
        </CardContent>
      </Card>
    </>
  );
}
