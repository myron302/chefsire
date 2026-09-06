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
 *
 * The remaining gap is what `removed` closes. A record preserved BELOW the window can be deleted, and no newer page
 * will ever mention it again, so the window alone can never establish that -- it would render forever. Removals
 * proved some other way, by a delete this client performed or by an authoritative presence check against the ids it
 * is holding, are carried separately and subtracted from every merge. They are permanent and per booking: a record
 * proved gone cannot come back from a stale refresh, and one booking's removals never touch another's.
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
  removed: ReadonlySet<string> = NO_REMOVALS,
): CateringLoadedHistory<T> {
  const mine = previous.identity === identity;
  // Returns the SAME array when nothing is dropped, so a merge that changes nothing allocates nothing.
  const drop = (items: readonly T[]) => (removed.size === 0 || !items.some((item) => removed.has(item.id)) ? items : items.filter((item) => !removed.has(item.id)));
  if (!mine && refreshed === null) return { identity, items: [] };
  if (refreshed === null) {
    const kept = drop(previous.items);
    return kept === previous.items ? previous : { identity, items: kept };
  }
  // Records proved gone leave immediately, including one the window still carries because its refetch has not
  // landed yet: this client already knows the server accepted the delete.
  const window = drop(refreshed);
  if (window.length === 0 || complete) return { identity, items: window };
  const floor = window[window.length - 1];
  const present = new Set(window.map((item) => item.id));
  // Deduplicated by stable server id, and kept only below the window, so a record the refreshed pages DO cover can
  // never be resurrected from here.
  const tail = mine ? drop(previous.items).filter((item) => !present.has(item.id) && cateringRecordIsOlder(item, floor)) : [];
  // The tail is a filtered subsequence of an already newest-first list and every one of its records is older than
  // the window's last, so concatenating is the correct order rather than a re-sort.
  return { identity, items: tail.length === 0 ? window : [...window, ...tail] };
}

/**
 * Records proved gone, per booking.
 *
 * Two things prove it, and both are authoritative in a way page absence is not: a delete this client performed and
 * the server accepted, and a presence check that asked about ids this client is holding and did not answer with
 * one. Both are permanent -- a removed record never comes back -- so this only ever grows within a booking, which
 * is what makes applying it idempotent and immune to an out-of-order refresh landing afterwards.
 *
 * Keyed by booking, so a completion or a reconciliation for one booking can never prune another's history, and
 * navigating between bookings carries nothing across.
 */
export type CateringRemovedRecords = ReadonlyMap<string, ReadonlySet<string>>;
export const EMPTY_CATERING_REMOVED_RECORDS: CateringRemovedRecords = new Map();
const NO_REMOVALS: ReadonlySet<string> = new Set();

export function cateringRemovedIds(removed: CateringRemovedRecords, identity: string): ReadonlySet<string> {
  return removed.get(identity) ?? NO_REMOVALS;
}
export function recordCateringRemovedRecords(removed: CateringRemovedRecords, identity: string, recordIds: readonly string[]): CateringRemovedRecords {
  const held = cateringRemovedIds(removed, identity);
  const added = recordIds.filter((id) => !held.has(id));
  if (added.length === 0) return removed;
  const next = new Map(removed);
  const ids = new Set(held);
  for (const id of added) ids.add(id);
  next.set(identity, ids);
  return next;
}

/**
 * The ids the refreshed window says nothing about: exactly the records only preserved history is holding, and
 * therefore exactly the question a presence check has to ask. A window that covers a record needs no check, because
 * the pages themselves already settled it.
 */
export function cateringPreservedTailIds<T extends { id: string }>(history: CateringLoadedHistory<T>, refreshed: readonly T[] | null): string[] {
  if (refreshed === null) return [];
  const covered = new Set(refreshed.map((item) => item.id));
  return history.items.map((item) => item.id).filter((id) => !covered.has(id));
}

/**
 * The ids a presence answer proved gone: asked about, and not answered with. Reading the request back from the
 * answer rather than from whatever the client is holding now is what makes this safe when an answer lands late --
 * every id it names is permanently removed whether or not the question would still be asked today.
 */
export function cateringReconciledRemovals(requested: readonly string[], active: readonly string[]): string[] {
  const visible = new Set(active);
  return requested.filter((id) => !visible.has(id));
}
