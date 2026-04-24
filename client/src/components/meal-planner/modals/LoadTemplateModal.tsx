import React from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';

type LoadTemplateModalProps = {
  open: boolean;
  onClose: () => void;
  onLoadTemplate: (templateName: string) => void;
  currentWeeklyMeals: Record<string, any>;
};

type TemplateImpactSummary = {
  filledSlots: number;
  overwriteSlots: number;
  noChangeSlots: number;
  templateMealItems: number;
};

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const toItems = (value: any): any[] => {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
};

const buildImpactSummary = (currentWeek: Record<string, any>, templateWeek: Record<string, any>): TemplateImpactSummary => {
  let filledSlots = 0;
  let overwriteSlots = 0;
  let noChangeSlots = 0;
  let templateMealItems = 0;

  for (const day of WEEK_DAYS) {
    for (const mealType of MEAL_TYPES) {
      const currentItems = toItems(currentWeek?.[day]?.[mealType]);
      const templateItems = toItems(templateWeek?.[day]?.[mealType]);
      if (templateItems.length === 0) continue;

      templateMealItems += templateItems.length;
      filledSlots += 1;
      if (currentItems.length === 0) {
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

  return { filledSlots, overwriteSlots, noChangeSlots, templateMealItems };
};

const LoadTemplateModal = ({ open, onClose, onLoadTemplate, currentWeeklyMeals }: LoadTemplateModalProps) => {
  const [selectedTemplate, setSelectedTemplate] = React.useState<string | null>(null);

  const templates = React.useMemo(() => {
    const savedTemplates: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('meal-template-')) {
        savedTemplates.push(key.replace('meal-template-', ''));
      }
    }
    return savedTemplates.sort((a, b) => a.localeCompare(b));
  }, [open]);

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

  React.useEffect(() => {
    if (!open) {
      setSelectedTemplate(null);
      return;
    }
    if (templates.length > 0) {
      setSelectedTemplate((prev) => (prev && templates.includes(prev) ? prev : templates[0]));
    } else {
      setSelectedTemplate(null);
    }
  }, [open, templates]);

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

        <p className="text-gray-600 mb-6">Select a saved meal plan template to load:</p>

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
                return (
                  <div
                    key={templateName}
                    className={`p-4 border rounded-lg cursor-pointer flex items-center justify-between ${isSelected ? 'border-blue-400 bg-blue-50' : 'hover:bg-gray-50'}`}
                    onClick={() => setSelectedTemplate(templateName)}
                  >
                    <div>
                      <h4 className="font-medium">{templateName}</h4>
                      <p className="text-xs text-gray-500">{isSelected ? 'Selected for preview' : 'Click to preview impact'}</p>
                    </div>
                    <Button size="sm" variant={isSelected ? 'default' : 'outline'} onClick={(event) => {
                      event.stopPropagation();
                      onLoadTemplate(templateName);
                    }}>
                      Apply
                    </Button>
                  </div>
                );
              })}

              {selectedTemplate && impactPreview && (
                <div className="rounded-lg border bg-gray-50 p-3">
                  <p className="text-sm font-medium text-gray-900">Impact preview for "{selectedTemplate}"</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>Filled slots: <span className="font-semibold text-gray-900">{impactPreview.filledSlots}</span></div>
                    <div>Total meals: <span className="font-semibold text-gray-900">{impactPreview.templateMealItems}</span></div>
                    <div>Will overwrite: <span className="font-semibold text-amber-700">{impactPreview.overwriteSlots}</span></div>
                    <div>Unchanged slots: <span className="font-semibold text-emerald-700">{impactPreview.noChangeSlots}</span></div>
                  </div>
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
