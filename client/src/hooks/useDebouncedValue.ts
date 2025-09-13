import { useEffect, useState } from "react";

/**
 * Debounce any changing value.
 * Example:
 *   const [q, setQ] = useState("");
 *   const debouncedQ = useDebouncedValue(q, 300);
 *   // use debouncedQ in fetch calls so you don’t refetch on every keystroke
 */
export default function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
