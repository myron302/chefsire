type ActivityState = {
  streakDays: number;
  lastActiveDate: string | null;
  recentViewedSlugs: string[];
  recentViewedCategories: string[];
  recentViewedCreators: string[];
  recentRemixedSlugs: string[];
};

const STORAGE_KEY = "chefsire:drinks:activity";
const MAX_SIGNAL_ITEMS = 20;
const ACTIVE_WINDOW_DAYS = 14;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const fromDate = new Date(`${from}T00:00:00Z`);
  const toDate = new Date(`${to}T00:00:00Z`);
  return Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
}

function dedupeRecent(list: string[], value: string): string[] {
  const normalized = String(value || "").trim();
  if (!normalized) return list;
  return [normalized, ...list.filter((item) => item !== normalized)].slice(0, MAX_SIGNAL_ITEMS);
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, MAX_SIGNAL_ITEMS);
}

function emptyState(): ActivityState {
  return {
    streakDays: 0,
    lastActiveDate: null,
    recentViewedSlugs: [],
    recentViewedCategories: [],
    recentViewedCreators: [],
    recentRemixedSlugs: [],
  };
}

function parseState(raw: unknown): ActivityState {
  if (!raw || typeof raw !== "object") return emptyState();
  const payload = raw as Partial<ActivityState>;
  return {
    streakDays: Math.max(0, Number(payload.streakDays ?? 0)),
    lastActiveDate: typeof payload.lastActiveDate === "string" ? payload.lastActiveDate : null,
    recentViewedSlugs: readStringList(payload.recentViewedSlugs),
    recentViewedCategories: readStringList(payload.recentViewedCategories),
    recentViewedCreators: readStringList(payload.recentViewedCreators),
    recentRemixedSlugs: readStringList(payload.recentRemixedSlugs),
  };
}

function readState(): ActivityState {
  if (typeof window === "undefined") return emptyState();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return parseState(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

function writeState(state: ActivityState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage write failures.
  }
}

function touchStreak(state: ActivityState): ActivityState {
  const today = todayKey();
  if (!state.lastActiveDate) return { ...state, streakDays: 1, lastActiveDate: today };

  const gap = daysBetween(state.lastActiveDate, today);
  if (gap <= 0) return state;
  if (gap === 1) return { ...state, streakDays: Math.max(1, state.streakDays + 1), lastActiveDate: today };
  return { ...state, streakDays: 1, lastActiveDate: today };
}

export function readDrinkActivityState(): ActivityState {
  const state = readState();
  if (!state.lastActiveDate) return state;

  const inactivityDays = daysBetween(state.lastActiveDate, todayKey());
  if (inactivityDays <= 1) return state;

  const reset = { ...state, streakDays: 0 };
  writeState(reset);
  return reset;
}

export function recordDrinkViewActivity(params: {
  slug?: string | null;
  sourceRoute?: string | null;
  creatorUsername?: string | null;
}) {
  const current = touchStreak(readState());
  const next: ActivityState = { ...current };

  if (params.slug) next.recentViewedSlugs = dedupeRecent(current.recentViewedSlugs, params.slug);

  const category = String(params.sourceRoute ?? "").replace(/^\/drinks\/?/, "").split("/")[0]?.trim();
  if (category) next.recentViewedCategories = dedupeRecent(current.recentViewedCategories, category);

  if (params.creatorUsername) {
    next.recentViewedCreators = dedupeRecent(current.recentViewedCreators, params.creatorUsername);
  }

  writeState(next);
}

export function recordDrinkRemixActivity(params: {
  slug?: string | null;
  remixedFromSlug?: string | null;
  category?: string | null;
}) {
  const current = touchStreak(readState());
  const next: ActivityState = { ...current };

  if (params.slug) next.recentViewedSlugs = dedupeRecent(current.recentViewedSlugs, params.slug);
  if (params.remixedFromSlug) next.recentRemixedSlugs = dedupeRecent(current.recentRemixedSlugs, params.remixedFromSlug);
  if (params.category) next.recentViewedCategories = dedupeRecent(current.recentViewedCategories, params.category);

  writeState(next);
}

export function getRemixStreakDays(): number {
  return readDrinkActivityState().streakDays;
}

export function hasRecentDrinkActivity(): boolean {
  const state = readDrinkActivityState();
  if (!state.lastActiveDate) return false;
  return daysBetween(state.lastActiveDate, todayKey()) <= ACTIVE_WINDOW_DAYS;
}
