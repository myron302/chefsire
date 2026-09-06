/**
 * History a participant has already loaded, kept across background refreshes.
 *
 * An infinite query refetches every page it holds, and it derives each page's cursor from the page before it in
 * that same refetch. The page size is fixed, so a single new record at the head shifts every boundary down by one
 * and the last page comes back one record short at its tail. With two full pages of five loaded, one new message
 * turns `[m10..m6] [m5..m1]` into `[m11..m7] [m6..m2]`: m1 has quietly left the rendering. It was not deleted --
 * it is exactly where it always was -- but the participant who deliberately loaded it watches it vanish on a
 * fifteen-second timer and has to press "Load older" again to get it back, over and over.
 *
 * So the refreshed pages are treated as what they actually are: an authoritative WINDOW over the newest end of the
 * collection, not the whole of it. The window is refreshed, and history the client has already loaded below it is
 * preserved.
 *
 * WHAT MAY BE PRESERVED, AND WHAT MAY NOT. The refetched pages are contiguous from the newest record down, so
 * everything they cover is authoritative: a previously loaded record inside that range which the server no longer
 * returns has been deleted, and it disappears. Only records strictly OLDER than the window's last record are kept,
 * because those the refreshed pages say nothing about at all. That is the difference between a record displaced by
 * a moving page boundary and a record the server has actually removed, and it is decided by the same keyset the
 * endpoints sort by rather than by position in a page.
 *
 * Two cases end preservation outright. A window that reaches the beginning of the collection -- no older cursor --
 * covers everything, so nothing may be held behind it. And an empty first page means the collection is empty.
 */
export type CateringLoadedHistory<T> = { identity: string; items: readonly T[] };
export function emptyCateringLoadedHistory<T>(): CateringLoadedHistory<T> {
  return { identity: "", items: [] };
}

/**
 * The endpoints' own ordering: newest first, by `(created_at, id)` descending, with the id as the tie-break for
 * records sharing an instant. Comparing the pair rather than the timestamp alone is what keeps a record that ties
 * with the window's last one from being judged "outside the window" and preserved after it was deleted.
 */
export function cateringRecordIsOlder(candidate: { id: string; createdAt: string }, boundary: { id: string; createdAt: string }): boolean {
  if (candidate.createdAt !== boundary.createdAt) return candidate.createdAt < boundary.createdAt;
  return candidate.id < boundary.id;
}

/**
 * Merges one refreshed window with the history already loaded for this booking.
 *
 * `refreshed` is the loaded pages combined newest-first and deduplicated; `complete` says the window reaches the
 * beginning of the collection. `null` means nothing is loaded yet, which is not the same as an empty collection:
 * it preserves what is already on screen rather than blanking it.
 *
 * Identity is the actor and booking the history belongs to. A different one discards it entirely, so navigating
 * between bookings can never render one booking's records inside another.
 */
export function cateringPreservedHistory<T extends { id: string; createdAt: string }>(
  previous: CateringLoadedHistory<T>,
  identity: string,
  refreshed: readonly T[] | null,
  complete: boolean,
): CateringLoadedHistory<T> {
  const mine = previous.identity === identity;
  if (refreshed === null) return mine ? previous : { identity, items: [] };
  if (refreshed.length === 0 || complete) return { identity, items: refreshed };
  const floor = refreshed[refreshed.length - 1];
  const present = new Set(refreshed.map((item) => item.id));
  // Deduplicated by stable server id, and kept only below the window, so a record the refreshed pages DO cover can
  // never be resurrected from here.
  const tail = mine ? previous.items.filter((item) => !present.has(item.id) && cateringRecordIsOlder(item, floor)) : [];
  // The tail is a filtered subsequence of an already newest-first list and every one of its records is older than
  // the window's last, so concatenating is the correct order rather than a re-sort.
  return { identity, items: tail.length === 0 ? refreshed : [...refreshed, ...tail] };
}

/**
 * Drops one record from preserved history.
 *
 * A mutation this client performed and the server accepted is authoritative about that record, including one below
 * the refreshed window where the list endpoint alone could not prove the removal. Without this, deleting a file
 * from the preserved tail would see it reappear on the next merge.
 */
export function forgetCateringHistoryRecord<T extends { id: string }>(history: CateringLoadedHistory<T>, identity: string, recordId: string): CateringLoadedHistory<T> {
  if (history.identity !== identity) return history;
  if (!history.items.some((item) => item.id === recordId)) return history;
  return { identity, items: history.items.filter((item) => item.id !== recordId) };
}
