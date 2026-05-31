import { useMemo, useState } from 'react';
import { formatLocalDate } from '@/components/meal-planner/nutritionMealPlannerUtils';

type ToastFn = (props: { variant?: 'default' | 'destructive'; title?: string; description?: string }) => void;

export type PlannerBodyFormState = {
  date: string;
  weight: string;
  bodyFatPct: string;
  waistIn: string;
  hipIn: string;
  unit: 'lbs' | 'kg';
};

const createDefaultBodyForm = (): PlannerBodyFormState => ({
  date: formatLocalDate(new Date()),
  weight: '',
  bodyFatPct: '',
  waistIn: '',
  hipIn: '',
  unit: 'lbs',
});

export const usePlannerBodyMetrics = (toast: ToastFn) => {
  const [bodyMetricsLog, setBodyMetricsLog] = useState<any[]>([]);
  const [bodyForm, setBodyForm] = useState<PlannerBodyFormState>(() => createDefaultBodyForm());

  const bodyMetricSummary = useMemo(() => {
    const latestBodyMetric = bodyMetricsLog.length > 0 ? bodyMetricsLog[bodyMetricsLog.length - 1] : null;
    const firstBodyMetric = bodyMetricsLog.length > 0 ? bodyMetricsLog[0] : null;
    const bodyWeightDelta = latestBodyMetric && firstBodyMetric
      ? Number(latestBodyMetric.weightLbs || 0) - Number(firstBodyMetric.weightLbs || 0)
      : 0;

    return {
      latestBodyMetric,
      firstBodyMetric,
      bodyWeightDelta,
    };
  }, [bodyMetricsLog]);

  const fetchBodyMetrics = async () => {
    try {
      const response = await fetch('/api/meal-planner/body-metrics?limit=30', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setBodyMetricsLog((data.metrics || []).slice().reverse());
      }
    } catch (error) {
      console.error('Error fetching body metrics:', error);
    }
  };

  const saveBodyMetric = async () => {
    if (!bodyForm.weight) return;
    const weightLbs = bodyForm.unit === 'kg' ? Number(bodyForm.weight) * 2.20462 : Number(bodyForm.weight);
    try {
      const response = await fetch('/api/meal-planner/body-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          date: bodyForm.date,
          weightLbs,
          bodyFatPct: bodyForm.bodyFatPct ? Number(bodyForm.bodyFatPct) : null,
          waistIn: bodyForm.waistIn ? Number(bodyForm.waistIn) : null,
          hipIn: bodyForm.hipIn ? Number(bodyForm.hipIn) : null,
        }),
      });
      if (!response.ok) throw new Error('Failed to save metric');
      await fetchBodyMetrics();
      toast({ description: '✅ Body metrics logged' });
    } catch (error) {
      toast({ variant: 'destructive', description: 'Failed to save body metrics' });
    }
  };

  return {
    bodyMetricsLog,
    setBodyMetricsLog,
    bodyForm,
    setBodyForm,
    bodyMetricSummary,
    fetchBodyMetrics,
    saveBodyMetric,
  };
};
