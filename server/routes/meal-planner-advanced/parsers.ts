export function hasDefinedQueryValue(value: unknown) {
  return value !== undefined;
}

export function parseQueryBoolean(value: unknown) {
  return value === "true";
}

export function parseOptionalDate(value: unknown) {
  return value ? new Date(value as string) : null;
}

export function parseDate(value: unknown) {
  return new Date(value as string);
}

export function parseClampedNumber(value: unknown, fallback: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number(value) || fallback));
}

export function parseDayStartDate(value: unknown) {
  const dateRaw = String(value || "");
  const date = new Date(dateRaw);
  if (!dateRaw || Number.isNaN(date.getTime())) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

export function parseTrimmedString(value: unknown) {
  return String(value || "").trim();
}

export function parseBodyBoolean(value: unknown) {
  return Boolean(value);
}

export function parseString(value: unknown, fallback = "") {
  return String(value || fallback);
}

export function parseNumber(value: unknown, fallback = 0) {
  return Number(value || fallback);
}

export function parseMinimumNumber(value: unknown, fallback: number, min: number) {
  return Math.max(min, Number(value || fallback));
}

export function parseBodyMetricInput(body: any) {
  const date = body?.date;
  const weight = Number(body?.weightLbs);

  return {
    date,
    weight,
    bodyFatPct: body?.bodyFatPct != null ? String(Number(body.bodyFatPct)) : null,
    waistIn: body?.waistIn != null ? String(Number(body.waistIn)) : null,
    hipIn: body?.hipIn != null ? String(Number(body.hipIn)) : null,
  };
}
