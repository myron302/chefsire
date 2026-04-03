import type { BudgetSummary, LeftoverFormState } from './types';

export const DEFAULT_BUDGET_SUMMARY: BudgetSummary = {
  estimated: 0,
  actual: 0,
  difference: 0,
};

export const DEFAULT_LEFTOVER_FORM: LeftoverFormState = {
  recipeName: '',
  quantity: '',
  storageLocation: 'fridge',
  expiryDate: '',
};
