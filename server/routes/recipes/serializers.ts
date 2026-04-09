export type IngredientRow = {
  amount?: string | number;
  unit?: string;
  ingredient?: string;
  name?: string;
};

export type InstructionRow = { step?: string; text?: string };

export function normalizeIngredients(input: unknown): string[] {
  if (!input) return [];

  if (Array.isArray(input)) {
    if (input.every((value) => typeof value === "string")) {
      return (input as string[]).map((value) => value.trim()).filter(Boolean);
    }

    return (input as IngredientRow[])
      .map((row) => {
        const amount = row.amount ?? "";
        const unit = row.unit ?? "";
        const name = row.ingredient ?? row.name ?? "";

        return [amount, unit, name]
          .map((value) => String(value ?? "").trim())
          .filter(Boolean)
          .join(" ")
          .trim();
      })
      .filter(Boolean);
  }

  return [];
}

export function normalizeInstructions(input: unknown): string[] {
  if (!input) return [];

  if (Array.isArray(input)) {
    if (input.every((value) => typeof value === "string")) {
      return (input as string[]).map((value) => value.trim()).filter(Boolean);
    }

    return (input as InstructionRow[])
      .map((row) => String(row.step ?? row.text ?? "").trim())
      .filter(Boolean);
  }

  return [];
}

export function withItemsFromResults<T extends { results: unknown }>(result: T) {
  const { results, ...rest } = result;
  return { ...rest, items: results };
}
