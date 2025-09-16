import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely renders a value as text, handling cases where the value might be a function
 * (like a translation function) or other non-string types.
 */
export function safeRenderText(value: any, fallback: string = ""): string {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'function') {
    // If it's a function, try calling it with no args (common for translation functions)
    try {
      const result = value();
      return typeof result === 'string' ? result : fallback;
    } catch {
      return fallback;
    }
  }
  // For objects, arrays, etc., convert to string safely
  try {
    return String(value);
  } catch {
    return fallback;
  }
}

/**
 * Safely filters an array to only include valid string values,
 * excluding functions, null, undefined, and other non-string types.
 */
export function safeStringArray(arr: any[]): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((item) => item != null && typeof item === 'string' && typeof item !== 'function')
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0);
}
