import { useState } from 'react';

export const usePlannerHistory = () => {
  const [mealHistory, setMealHistory] = useState<any[]>([]);
  const [showRecentMeals, setShowRecentMeals] = useState(true);

  const fetchMealHistory = async () => {
    try {
      const response = await fetch('/api/meal-planner/history', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setMealHistory(data.meals || []);
      }
    } catch (error) {
      console.error('Error fetching meal history:', error);
    }
  };

  const toggleRecentMeals = () => setShowRecentMeals((value) => !value);

  return {
    mealHistory,
    setMealHistory,
    showRecentMeals,
    setShowRecentMeals,
    fetchMealHistory,
    toggleRecentMeals,
  };
};
