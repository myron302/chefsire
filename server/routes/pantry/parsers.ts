export function parseOptionalQuantity(value: string | number | undefined) {
  if (value === undefined) return undefined;

  const quantityNum = typeof value === "string" ? parseFloat(value) : value;
  return Number.isNaN(quantityNum) ? undefined : quantityNum;
}

export function parseOptionalDateTime(value: string | undefined) {
  return value ? new Date(value) : undefined;
}

export function parseDaysWithDefault(value: unknown, fallback = 7) {
  const days = Number(value ?? fallback);
  return Number.isNaN(days) ? fallback : days;
}
