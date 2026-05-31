import { useState } from 'react';

export type PlannerMealSlot = { day: string; type: string };

export const usePlannerModalState = () => {
  const [showAddMealModal, setShowAddMealModal] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [selectedMealSlot, setSelectedMealSlot] = useState<PlannerMealSlot | null>(null);
  const [showAIRecipeModal, setShowAIRecipeModal] = useState(false);
  const [showPantryModal, setShowPantryModal] = useState(false);
  const [showLoadTemplateModal, setShowLoadTemplateModal] = useState(false);
  const [showPlannerShareDialog, setShowPlannerShareDialog] = useState(false);
  const [showAddGroceryModal, setShowAddGroceryModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showShareFamilyModal, setShowShareFamilyModal] = useState(false);
  const [showCalcModal, setShowCalcModal] = useState(false);

  return {
    showAddMealModal,
    setShowAddMealModal,
    showGoalsModal,
    setShowGoalsModal,
    selectedMealSlot,
    setSelectedMealSlot,
    showAIRecipeModal,
    setShowAIRecipeModal,
    showPantryModal,
    setShowPantryModal,
    showLoadTemplateModal,
    setShowLoadTemplateModal,
    showPlannerShareDialog,
    setShowPlannerShareDialog,
    showAddGroceryModal,
    setShowAddGroceryModal,
    showScanModal,
    setShowScanModal,
    showShareFamilyModal,
    setShowShareFamilyModal,
    showCalcModal,
    setShowCalcModal,
  };
};
