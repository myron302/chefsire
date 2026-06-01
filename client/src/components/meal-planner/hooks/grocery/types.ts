export type BlockerItemSuggestion = {
  id: string;
  name: string;
  category: string;
  reason: string;
  alreadyOnList: boolean;
};

export type AddGroceryListItemPayload = {
  ingredientName: string;
  quantity: string;
  unit: string;
  category: string;
  notes?: string;
};

export type AddGroceryListItem = (
  payload: AddGroceryListItemPayload,
) => Promise<Response>;

export type ToastFn = (options: {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}) => void;
