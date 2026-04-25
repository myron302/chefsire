import React from 'react';
import { Save, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildTemplateSlotDiff } from '@/components/meal-planner/nutritionMealPlannerUtils';

type LoadTemplateModalProps = {
  open: boolean;
  onClose: () => void;
  onLoadTemplate: (templateName: string, mergeMode: 'replace' | 'append') => void;
  currentWeeklyMeals: Record<string, any>;
};

type TemplateImpactSummary = {
  filledSlots: number;
  overwriteSlots: number;
  noChangeSlots: number;
  templateMealItems: number;
  currentMealItems: number;
  appendAddedMealItems: number;
};

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TEMPLATE_PINNED_STORAGE_KEY = 'meal-template-pinned-v1';
const TEMPLATE_MERGE_PREFERENCES_STORAGE_KEY = 'meal-template-merge-preferences-v1';

const toItems = (value: any): any[] => {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
};

const loadPinnedTemplateNames = (): string[] => {
  try {
    const raw = localStorage.getItem(TEMPLATE_PINNED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed
      .map((name) => (typeof name === 'string' ? name.trim() : ''))
      .filter((name) => Boolean(name))));
  } catch {
    return [];
  }
};

const savePinnedTemplateNames = (templateNames: string[]) => {
  const deduped = Array.from(new Set(templateNames.map((name) => name.trim()).filter(Boolean)));
  localStorage.setItem(TEMPLATE_PINNED_STORAGE_KEY, JSON.stringify(deduped));
};

const loadTemplateMergePreferences = (): Record<string, 'replace' | 'append'> => {
  try {
    const raw = localStorage.getItem(TEMPLATE_MERGE_PREFERENCES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const normalizedEntries = Object.entries(parsed).flatMap(([templateName, mergeMode]) => {
      const normalizedName = typeof templateName === 'string' ? templateName.trim() : '';
      if (!normalizedName) return [];
      return [[normalizedName, mergeMode === 'append' ? 'append' : 'replace'] as const];
    });
    return Object.fromEntries(normalizedEntries);
  } catch {
    return {};
  }
};

const getTemplateMergePreference = (templateName: string): 'replace' | 'append' => {
  const normalizedName = templateName.trim();
  if (!normalizedName) return 'replace';
  const preferences = loadTemplateMergePreferences();
  return preferences[normalizedName] === 'append' ? 'append' : 'replace';
};

const setTemplateMergePreference = (templateName: string, mergeMode: 'replace' | 'append') => {
  const normalizedName = templateName.trim();
  if (!normalizedName) return;
  const existing = loadTemplateMergePreferences();
  localStorage.setItem(
    TEMPLATE_MERGE_PREFERENCES_STORAGE_KEY,
    JSON.stringify({ ...existing, [normalizedName]: mergeMode }),
  );
};

const buildImpactSummary = (currentWeek: Record<string, any>, templateWeek: Record<string, any>): TemplateImpactSummary => {
  let filledSlots = 0;
  let overwriteSlots = 0;
  let noChangeSlots = 0;
  let templateMealItems = 0;
  let currentMealItems = 0;
  let appendAddedMealItems = 0;

  for (const day of WEEK_DAYS) {
    for (const mealType of MEAL_TYPES) {
      const currentItems = toItems(currentWeek?.[day]?.[mealType]);
      const templateItems = toItems(templateWeek?.[day]?.[mealType]);
      if (currentItems.length > 0) {
        currentMealItems += currentItems.length;
      }

      if (templateItems.length === 0) continue;

      templateMealItems += templateItems.length;
      filledSlots += 1;
      if (currentItems.length === 0) {
        appendAddedMealItems += templateItems.length;
        continue;
      }

      const currentSerialized = JSON.stringify(currentItems);
      const templateSerialized = JSON.stringify(templateItems);
      if (currentSerialized === templateSerialized) {
        noChangeSlots += 1;
      } else {
        overwriteSlots += 1;
      }
    }
  }

  return { filledSlots, overwriteSlots, noChangeSlots, templateMealItems, currentMealItems, appendAddedMealItems };
};

const LoadTemplateModal = ({ open, onClose, onLoadTemplate, currentWeeklyMeals }: LoadTemplateModalProps) => {
  const [selectedTemplate, setSelectedTemplate] = React.useState<string | null>(null);
  const [mergeMode, setMergeMode] = React.useState<'replace' | 'append'>('replace');
  const [pinnedTemplates, setPinnedTemplates] = React.useState<string[]>([]);

  const rawTemplates = React.useMemo(() => {
    const savedTemplates: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('meal-template-')) {
        savedTemplates.push(key.replace('meal-template-', ''));
      }
    }
    return savedTemplates;
  }, [open]);

  const templates = React.useMemo(() => {
    const pinnedSet = new Set(pinnedTemplates);
    return [...rawTemplates].sort((a, b) => {
      const aPinned = pinnedSet.has(a);
      const bPinned = pinnedSet.has(b);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return a.localeCompare(b);
    });
  }, [rawTemplates, pinnedTemplates]);

  const impactPreview = React.useMemo(() => {
    if (!selectedTemplate) return null;
    try {
      const templateRaw = localStorage.getItem(`meal-template-${selectedTemplate}`);
      if (!templateRaw) return null;

      const templateWeek = JSON.parse(templateRaw);
      return buildImpactSummary(currentWeeklyMeals, templateWeek);
    } catch {
      return null;
    }
  }, [selectedTemplate, open, currentWeeklyMeals]);

  const slotDiffPreview = React.useMemo(() => {
    if (!selectedTemplate) return [];
    try {
      const templateRaw = localStorage.getItem(`meal-template-${selectedTemplate}`);
      if (!templateRaw) return [];
      const templateWeek = JSON.parse(templateRaw);
      return buildTemplateSlotDiff(currentWeeklyMeals, templateWeek, mergeMode);
    } catch {
      return [];
    }
  }, [selectedTemplate, open, currentWeeklyMeals, mergeMode]);

  React.useEffect(() => {
    if (!open) {
      setSelectedTemplate(null);
      setMergeMode('replace');
      return;
    }

    const rawPinnedTemplateNames = loadPinnedTemplateNames();
    const availableTemplateNames = new Set(rawTemplates);
    const sanitizedPinnedTemplateNames = rawPinnedTemplateNames.filter((templateName) => availableTemplateNames.has(templateName));

    if (sanitizedPinnedTemplateNames.length !== rawPinnedTemplateNames.length) {
      savePinnedTemplateNames(sanitizedPinnedTemplateNames);
    }

    setPinnedTemplates((prev) => {
      const prevJoined = prev.join('||');
      const nextJoined = sanitizedPinnedTemplateNames.join('||');
      return prevJoined === nextJoined ? prev : sanitizedPinnedTemplateNames;
    });

    if (templates.length > 0) {
      setSelectedTemplate((prev) => (prev && templates.includes(prev) ? prev : templates[0]));
    } else {
      setSelectedTemplate(null);
    }
  }, [open, rawTemplates, templates]);

  React.useEffect(() => {
    if (!selectedTemplate) {
      setMergeMode('replace');
      return;
    }
    setMergeMode(getTemplateMergePreference(selectedTemplate));
  }, [selectedTemplate]);

  const togglePinnedTemplate = (templateName: string) => {
    setPinnedTemplates((prev) => {
      const nextPinnedTemplates = prev.includes(templateName)
        ? prev.filter((name) => name !== templateName)
        : [...prev, templateName];
      savePinnedTemplateNames(nextPinnedTemplates);
      return nextPinnedTemplates;
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Save className="w-6 h-6 text-blue-500" />
            Load Template
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>

        <p className="text-gray-600 mb-2">Select a saved meal plan template to load:</p>
        <p className="text-xs text-gray-500 mb-6">Pin your best templates to keep them at the top for faster weekly reuse.</p>

        <div className="space-y-3">
          {templates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Save className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No saved templates yet</p>
              <p className="text-sm mt-1">Create a meal plan and click "Save Template" to save it</p>
            </div>
          ) : (
            <>
              {templates.map((templateName) => {
                const isSelected = selectedTemplate === templateName;
                const isPinned = pinnedTemplates.includes(templateName);
                return (
                  <div
                    key={templateName}
                    className={`p-4 border rounded-lg cursor-pointer flex items-center justify-between ${isSelected ? 'border-blue-400 bg-blue-50' : 'hover:bg-gray-50'}`}
                    onClick={() => setSelectedTemplate(templateName)}
                  >
                    <div>
                      <h4 className="font-medium flex items-center gap-2">
                        {templateName}
                        {isPinned ? (
                          <span className="text-[10px] uppercase tracking-wide rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5">Pinned</span>
                        ) : null}
                      </h4>
                      <p className="text-xs text-gray-500">{isSelected ? 'Selected for preview' : 'Click to preview impact'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={isPinned ? `Unpin ${templateName}` : `Pin ${templateName}`}
                        className={isPinned ? 'text-indigo-600 hover:text-indigo-700' : 'text-gray-500 hover:text-gray-700'}
                        onClick={(event) => {
                          event.stopPropagation();
                          togglePinnedTemplate(templateName);
                        }}
                      >
                        <Pin className={`w-4 h-4 ${isPinned ? 'fill-current' : ''}`} />
                      </Button>
                      <Button size="sm" variant={isSelected ? 'default' : 'outline'} onClick={(event) => {
                        event.stopPropagation();
                        const effectiveMergeMode = isSelected ? mergeMode : getTemplateMergePreference(templateName);
                        onLoadTemplate(templateName, effectiveMergeMode);
                      }}>
                        Apply
                      </Button>
                    </div>
                  </div>
                );
              })}

              {selectedTemplate && impactPreview && (
                <div className="rounded-lg border bg-gray-50 p-3 space-y-3">
                  <p className="text-sm font-medium text-gray-900">Impact preview for "{selectedTemplate}"</p>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Merge mode</p>
                    <div className="mt-2 inline-flex rounded-md border border-gray-200 bg-white p-1">
                      <button
                        type="button"
                        className={`px-3 py-1 text-xs font-medium rounded ${mergeMode === 'replace' ? 'bg-blue-100 text-blue-800' : 'text-gray-600'}`}
                        onClick={() => {
                          setMergeMode('replace');
                          setTemplateMergePreference(selectedTemplate, 'replace');
                        }}
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        className={`px-3 py-1 text-xs font-medium rounded ${mergeMode === 'append' ? 'bg-blue-100 text-blue-800' : 'text-gray-600'}`}
                        onClick={() => {
                          setMergeMode('append');
                          setTemplateMergePreference(selectedTemplate, 'append');
                        }}
                      >
                        Append
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>Target week meals: <span className="font-semibold text-gray-900">{impactPreview.currentMealItems}</span></div>
                    <div>Template meals: <span className="font-semibold text-gray-900">{impactPreview.templateMealItems}</span></div>
                    <div>Filled slots: <span className="font-semibold text-gray-900">{impactPreview.filledSlots}</span></div>
                    {mergeMode === 'append' ? (
                      <div>Estimated added: <span className="font-semibold text-emerald-700">{impactPreview.appendAddedMealItems}</span></div>
                    ) : (
                      <div>Will overwrite: <span className="font-semibold text-amber-700">{impactPreview.overwriteSlots}</span></div>
                    )}
                    <div>Unchanged slots: <span className="font-semibold text-emerald-700">{impactPreview.noChangeSlots}</span></div>
                  </div>
                  {mergeMode === 'replace' ? (
                    <p className="text-xs text-amber-700">Replace mode overwrites existing meals in slots populated by the template.</p>
                  ) : (
                    <p className="text-xs text-emerald-700">Append mode keeps existing meals and only fills empty slots.</p>
                  )}
                  {slotDiffPreview.length > 0 ? (
                    <div className="rounded-md border border-gray-200 bg-white p-2">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Slot-level pre-apply diff</p>
                      <div className="space-y-1">
                        {slotDiffPreview.slice(0, 8).map((slot) => (
                          <div key={slot.key} className="flex items-center justify-between text-xs">
                            <span className="text-gray-700">
                              {slot.day} • {slot.mealType}
                            </span>
                            <span
                              className={`font-medium ${
                                slot.status === 'replace'
                                  ? 'text-amber-700'
                                  : slot.status === 'add'
                                    ? 'text-emerald-700'
                                    : slot.status === 'skip-existing'
                                      ? 'text-sky-700'
                                      : 'text-gray-500'
                              }`}
                            >
                              {slot.status === 'replace'
                                ? `Replace ${slot.currentCount} → ${slot.templateCount}`
                                : slot.status === 'add'
                                  ? `Add ${slot.templateCount}`
                                  : slot.status === 'skip-existing'
                                    ? `Keep current (${slot.currentCount})`
                                    : 'No change'}
                            </span>
                          </div>
                        ))}
                      </div>
                      {slotDiffPreview.length > 8 ? (
                        <p className="text-[11px] text-gray-500 mt-2">Showing 8 of {slotDiffPreview.length} impacted slots.</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>

        <Button variant="outline" className="w-full mt-6" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default LoadTemplateModal;
