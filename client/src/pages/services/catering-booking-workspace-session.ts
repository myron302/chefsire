import { EMPTY_CATERING_COMPOSERS, type CateringComposers } from "./catering-booking-communication-state";
import { EMPTY_CATERING_FILE_DRAFTS, type CateringFileDrafts } from "./catering-booking-files-state";
import { EMPTY_CATERING_IN_FLIGHT, EMPTY_CATERING_MUTATION_OUTCOMES, EMPTY_CATERING_UNSENT_MESSAGES, type CateringInFlight, type CateringMutationOutcomes, type CateringUnsentMessages } from "./catering-booking-mutation-origin";
import { createCateringSessionStore, type CateringSessionStore } from "./catering-booking-session-store";

/**
 * The pending-mutation state of the booking workspace, held for the browser session rather than for the lifetime of
 * a mounted section.
 *
 * Only state a request can outlive lives here. Anything re-derived from a query -- loaded history, the presence
 * ledger, read markers, scroll position -- is deliberately left in the component, because it is rebuilt correctly
 * on the next fetch and holding a stale copy of it across an unmount would be worse than not holding it.
 *
 * Everything below is keyed by the same actor-and-booking identity the rest of Phase 2I uses, so surviving a route
 * change changes nothing about isolation: booking A's attempt is not reachable from booking B, and one actor's
 * state is not reachable from another's, exactly as before.
 *
 * PRUNING is a property of the values, not of a timer. Each of these maps already drops an entry the moment it
 * holds nothing worth holding -- a composer with no text and no attempt, a draft back at its role's empty state, an
 * outcome that has been cleared, an in-flight count back at zero -- so a settled upload releases its `File` as part
 * of settling, and a pending or retryable attempt is never a candidate for removal. There is no age-based sweep,
 * because no elapsed time makes an in-flight request safe to forget.
 */
export type CateringCommunicationSession = {
  /** Per booking: the live draft text, and the immutable submitted attempt with its `clientRequestId`. */
  composers: CateringComposers;
  /** Per booking: the last send's outcome, so a completion off screen is still reported when the section returns. */
  sendOutcomes: CateringMutationOutcomes;
  /** Per booking: text that was submitted and refused, so a booking closing mid-send keeps the participant's words. */
  unsent: CateringUnsentMessages;
};
export const EMPTY_CATERING_COMMUNICATION_SESSION: CateringCommunicationSession = {
  composers: EMPTY_CATERING_COMPOSERS,
  sendOutcomes: EMPTY_CATERING_MUTATION_OUTCOMES,
  unsent: EMPTY_CATERING_UNSENT_MESSAGES,
};
export const createCateringCommunicationSession = (): CateringSessionStore<CateringCommunicationSession> =>
  createCateringSessionStore(EMPTY_CATERING_COMMUNICATION_SESSION);

export type CateringFileSession = {
  /** Per booking: the retained `File`, the chosen visibility, and the upload's `clientRequestId`. */
  drafts: CateringFileDrafts;
  /** Per booking: whether a request of each kind is outstanding, which is what refuses a duplicate submission. */
  uploadInFlight: CateringInFlight;
  removeInFlight: CateringInFlight;
  /** Per booking: what each kind of request last answered. */
  uploadOutcomes: CateringMutationOutcomes;
  removeOutcomes: CateringMutationOutcomes;
};
export const EMPTY_CATERING_FILE_SESSION: CateringFileSession = {
  drafts: EMPTY_CATERING_FILE_DRAFTS,
  uploadInFlight: EMPTY_CATERING_IN_FLIGHT,
  removeInFlight: EMPTY_CATERING_IN_FLIGHT,
  uploadOutcomes: EMPTY_CATERING_MUTATION_OUTCOMES,
  removeOutcomes: EMPTY_CATERING_MUTATION_OUTCOMES,
};
export const createCateringFileSession = (): CateringSessionStore<CateringFileSession> =>
  createCateringSessionStore(EMPTY_CATERING_FILE_SESSION);

/**
 * The two live stores. Module scope IS the lifetime: they are created once when the bundle loads and are not
 * touched by mounting, unmounting, or navigating, which is precisely the property the fix needs.
 */
export const cateringCommunicationSession = createCateringCommunicationSession();
export const cateringFileSession = createCateringFileSession();
