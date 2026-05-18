import React from 'react';
import { ChefHat } from 'lucide-react';

const MealPrepEmptyState = () => (
  <div className="rounded-lg border border-dashed bg-white p-5 text-center">
    <ChefHat className="mx-auto mb-2 h-8 w-8 text-violet-400" />
    <p className="text-sm font-medium text-gray-900">No batch-prep overlaps detected yet.</p>
    <p className="mt-1 text-xs text-gray-600">Add structured meal items or recipe-linked meals with repeated ingredients to unlock intelligent sessions.</p>
  </div>
);

export default MealPrepEmptyState;
