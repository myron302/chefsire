import type { PrepStorageRecommendation, PrepSessionType } from '@/components/meal-planner/prepOrchestrationUtils';

export const formatPrepTypeLabel = (prepType: PrepSessionType) => prepType;

export const formatStorageRecommendation = (guidance: PrepStorageRecommendation) =>
  `Recommended: ${guidance.primary.replace('-', ' ')} • best within about ${guidance.bestWithinDays} day${guidance.bestWithinDays === 1 ? '' : 's'} • ${guidance.containerCount} container${guidance.containerCount === 1 ? '' : 's'}`;
