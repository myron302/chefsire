// client/src/lib/ageGate.ts
const AGE_KEY = "cs_age_verified_at"; // timestamp ms

export function isAgeVerified(): boolean {
  try {
    const raw = localStorage.getItem(AGE_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    // 30 days validity
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    return Date.now() - ts < THIRTY_DAYS;
  } catch {
    return false;
  }
}

export function setAgeVerified(): void {
  try {
    localStorage.setItem(AGE_KEY, String(Date.now()));
    // cookie fallback (7 days) for older browsers if needed
    document.cookie = `cs_age_verified=1; Max-Age=${7 * 24 * 60 * 60}; Path=/; SameSite=Lax`;
  } catch {
    // no-op
  }
}

export function clearAgeVerified(): void {
  try {
    localStorage.removeItem(AGE_KEY);
    document.cookie = "cs_age_verified=; Max-Age=0; Path=/; SameSite=Lax";
  } catch {
    // no-op
  }
}

/**
 * Returns an optional header you can attach to API calls
 * if you proxy alcoholic content through your server.
 */
export function ageVerificationHeader(): Record<string, string> {
  return isAgeVerified() ? { "x-age-verified": "1" } : {};
}
