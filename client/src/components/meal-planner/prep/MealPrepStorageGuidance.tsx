import React from 'react';
import { Refrigerator } from 'lucide-react';
import type { PrepOrchestration } from '@/components/meal-planner/prepOrchestrationUtils';
import { formatStorageRecommendation } from './prepUiUtils';

type MealPrepStorageGuidanceProps = {
  storageGuidance: PrepOrchestration['storageGuidance'];
};

const MealPrepStorageGuidance = ({ storageGuidance }: MealPrepStorageGuidanceProps) => (
  <div className="rounded-lg border bg-white p-3">
    <p className="mb-2 text-sm font-semibold text-gray-900 flex items-center gap-2"><Refrigerator className="h-4 w-4 text-indigo-500" />Storage Guidance</p>
    <div className="space-y-2">
      {storageGuidance.slice(0, 4).map((item) => (
        <div key={item.id} className="rounded-md bg-indigo-50 p-2 text-xs text-indigo-900">
          <p className="font-medium">{item.title}</p>
          <p>{formatStorageRecommendation(item.guidance)}</p>
        </div>
      ))}
    </div>
  </div>
);

export default MealPrepStorageGuidance;
