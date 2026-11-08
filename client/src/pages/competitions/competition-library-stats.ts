export type CompetitionStatusRow = { status: string };

export type CompetitionLibraryStats = {
  /** All competitions visible to the viewer, as reported by the server. */
  total: number;
  live: number;
  judging: number;
  champions: number;
  /** True when status counts cover only the loaded page, not every competition. */
  partial: boolean;
};

/**
 * Stats for the Cookoff Arena header. The total comes from the server (`total` in the library response), which can
 * exceed the rows actually loaded; status counts are derived from the loaded rows and flagged `partial` in that case
 * so the UI can label them instead of presenting them as global counts.
 */
export function competitionLibraryStats(
  items: readonly CompetitionStatusRow[],
  serverTotal: number | null | undefined,
): CompetitionLibraryStats {
  const known = typeof serverTotal === "number" && Number.isFinite(serverTotal) && serverTotal >= 0 ? serverTotal : null;
  const count = (status: string) => items.filter((item) => item.status === status).length;
  return {
    total: known ?? items.length,
    live: count("live"),
    judging: count("judging"),
    champions: count("completed"),
    partial: known !== null && known > items.length,
  };
}
