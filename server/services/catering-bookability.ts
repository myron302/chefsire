/**
 * Listing visibility and inquiry acceptance are separate concerns. Once a Phase 2D
 * settings row exists it is authoritative; legacy providers fall back to the users
 * column until they save availability settings for the first time.
 */
export function isCateringProviderBookable(input: {
  cateringEnabled: boolean | null | undefined;
  cateringAvailable: boolean | null | undefined;
  acceptingBookings: boolean | null | undefined;
}): boolean {
  if (!input.cateringEnabled) return false;
  return input.acceptingBookings ?? Boolean(input.cateringAvailable);
}
