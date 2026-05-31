import { useMemo, useState } from 'react';
import { formatLocalDate } from '@/components/meal-planner/nutritionMealPlannerUtils';

export type PlannerWaterState = {
  date: string;
  glassesLogged: number;
  dailyTarget: number;
};

const createDefaultWaterState = (): PlannerWaterState => ({
  date: formatLocalDate(new Date()),
  glassesLogged: 0,
  dailyTarget: 8,
});

export const calculateHydrationPct = (water: PlannerWaterState) => (
  Math.round(((water.glassesLogged || 0) / Math.max(1, water.dailyTarget || 8)) * 100)
);

export const usePlannerHydration = () => {
  const [water, setWater] = useState<PlannerWaterState>(() => createDefaultWaterState());

  const hydrationPct = useMemo(() => calculateHydrationPct(water), [water]);

  const fetchWater = async (date = formatLocalDate(new Date())) => {
    try {
      const response = await fetch(`/api/meal-planner/water?date=${date}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setWater(data);
      }
    } catch (error) {
      console.error('Error fetching water:', error);
    }
  };

  const saveWater = async (glassesLogged: number) => {
    const date = formatLocalDate(new Date());
    try {
      const response = await fetch('/api/meal-planner/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ date, glassesLogged }),
      });
      if (response.ok) {
        const data = await response.json();
        setWater(data);
      }
    } catch (error) {
      console.error('Error saving water:', error);
    }
  };

  const updateWaterTarget = async () => {
    const next = Number(prompt('Daily water target (glasses):', String(water.dailyTarget || 8)));
    if (!Number.isFinite(next) || next <= 0) return;
    try {
      const response = await fetch('/api/meal-planner/water/target', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dailyTarget: next }),
      });
      if (response.ok) {
        const data = await response.json();
        setWater((prev) => ({ ...prev, dailyTarget: data.dailyTarget }));
      }
    } catch (error) {
      console.error('Error updating water target:', error);
    }
  };

  return {
    water,
    setWater,
    hydrationPct,
    fetchWater,
    saveWater,
    updateWaterTarget,
  };
};
