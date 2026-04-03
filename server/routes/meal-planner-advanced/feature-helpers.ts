export function filterExpiringLeftovers<T extends { expiryDate: Date | string | null; consumed: boolean | null }>(
  leftovers: T[],
  expiringSoon: unknown,
) {
  if (expiringSoon !== "true") {
    return leftovers;
  }

  const twoDaysFromNow = new Date();
  twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

  return leftovers.filter((leftover) =>
    leftover.expiryDate && new Date(leftover.expiryDate) <= twoDaysFromNow && !leftover.consumed,
  );
}

export function calculateUpdatedStreak(
  existing: { currentStreak: number | null; longestStreak: number | null; lastLoggedDate: string | null } | undefined,
  date: Date,
) {
  let currentStreak = 1;

  if (existing) {
    const last = existing.lastLoggedDate ? new Date(existing.lastLoggedDate) : null;
    if (last) {
      last.setHours(0, 0, 0, 0);
      const diff = Math.round((date.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
      if (diff === 0) currentStreak = existing.currentStreak || 0;
      else if (diff === 1) currentStreak = (existing.currentStreak || 0) + 1;
      else currentStreak = 1;
    }
  }

  const longestStreak = Math.max(existing?.longestStreak || 0, currentStreak);
  return { currentStreak, longestStreak };
}

export function serializeStreak(
  streak: { currentStreak: number | null; longestStreak: number | null; lastLoggedDate: string | null } | undefined,
) {
  return {
    currentStreak: streak?.currentStreak || 0,
    longestStreak: streak?.longestStreak || 0,
    lastLoggedDate: streak?.lastLoggedDate || null,
  };
}

export function serializeWaterLog(log: { date: string; glassesLogged: number; dailyTarget: number }) {
  return {
    date: log.date,
    glassesLogged: log.glassesLogged,
    dailyTarget: log.dailyTarget,
  };
}
