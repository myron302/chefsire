import type { NutritionCampaignProgress } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';

export type AdaptiveStrategySignal = {
  id: string;
  label: string;
  confidence: number;
  reason: string;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const deriveSuccessfulAdaptiveStrategies = (progress: NutritionCampaignProgress | null): AdaptiveStrategySignal[] => {
  if (!progress) return [];
  const momentum = clamp01(progress.momentum ?? 0.5);
  const stability = clamp01(progress.journeyStability ?? 0.5);
  const sustainability = progress.completionSemantics?.sustainabilityCompletion ? 0.2 : 0;
  const recovery = progress.completionSemantics?.recoveryCompletion ? 0.15 : 0;
  const continuity = progress.completionSemantics?.continuityCompletion ? 0.15 : 0;

  const score = clamp01(momentum * 0.4 + stability * 0.4 + sustainability + recovery + continuity);

  const strategies: AdaptiveStrategySignal[] = [];
  if (recovery > 0 || momentum > 0.62) {
    strategies.push({
      id: 'recovery-pacing',
      label: 'Recovery pacing',
      confidence: clamp01(momentum * 0.65 + stability * 0.35),
      reason: 'Momentum held through recovery-aware pacing.',
    });
  }
  if (continuity > 0 || stability > 0.62) {
    strategies.push({
      id: 'continuity-anchors',
      label: 'Continuity anchors',
      confidence: clamp01(stability * 0.8 + momentum * 0.2),
      reason: 'Continuity stayed stable across campaign missions.',
    });
  }
  if (sustainability > 0 || score > 0.66) {
    strategies.push({
      id: 'prep-scope-reduction',
      label: 'Prep scope reduction',
      confidence: score,
      reason: 'Sustainability semantics suggest prep scope is balanced.',
    });
  }

  return strategies.slice(0, 5);
};

export const deriveFailedAdaptiveStrategies = (progress: NutritionCampaignProgress | null): AdaptiveStrategySignal[] => {
  if (!progress) return [];
  const momentum = clamp01(progress.momentum ?? 0.5);
  const stability = clamp01(progress.journeyStability ?? 0.5);
  const completion = clamp01(progress.completionPct / 100);
  const failed: AdaptiveStrategySignal[] = [];

  if (momentum < 0.4) {
    failed.push({
      id: 'high-intensity-cadence',
      label: 'High-intensity cadence',
      confidence: clamp01(1 - momentum),
      reason: 'Momentum dropped when pacing was likely too aggressive.',
    });
  }
  if (stability < 0.42) {
    failed.push({
      id: 'novelty-heavy-rotation',
      label: 'Novelty-heavy rotation',
      confidence: clamp01(1 - stability),
      reason: 'Stability softened, indicating cadence fatigue risk.',
    });
  }
  if (completion < 0.35) {
    failed.push({
      id: 'prep-load-overreach',
      label: 'Prep load overreach',
      confidence: clamp01(1 - completion),
      reason: 'Completion pace indicates prep demand may be too high.',
    });
  }

  return failed.slice(0, 5);
};

export const deriveAdaptiveStabilizationSignals = (progress: NutritionCampaignProgress | null): string[] => {
  if (!progress) return [];
  const signals: string[] = [];
  if ((progress.journeyStability ?? 0) >= 0.65) signals.push('continuity-stabilized');
  if ((progress.momentum ?? 0) >= 0.65) signals.push('momentum-recovered');
  if (progress.completionSemantics?.semanticResetCompletion) signals.push('semantic-reset-effective');
  if (progress.completionSemantics?.stabilizationCompletion) signals.push('sustainability-stabilized');
  return signals.slice(0, 6);
};
