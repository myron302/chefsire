import type { LeftoverFormState } from '../types';

export const getDaysUntilExpiry = (expiryDate: string) =>
  Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

export const buildLeftoverSubmitPayload = (leftoverForm: LeftoverFormState) => ({
  ...leftoverForm,
  storedDate: new Date().toISOString().split('T')[0],
  expiryDate: leftoverForm.expiryDate || undefined,
});
