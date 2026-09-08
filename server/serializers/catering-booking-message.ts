import type { CateringBookingMessageView } from "@shared/catering-booking-communication";

/**
 * `orderToken` is the row's authoritative place in the list query's own ordering, produced in SQL at full
 * `timestamptz` precision. The paginated list supplies it; the single-message send responses do not, because
 * nothing reconciles history from them. It is opaque and for comparison only -- `createdAt` remains the display
 * value, and the two are deliberately separate concerns.
 */
export type SerializableBookingMessage = { id: string; senderId: string; body: string; createdAt: Date; orderToken?: string };
export type BookingMessageContext = { providerId: string; customerId: string; actorId: string; names: ReadonlyMap<string, string | null> };

/**
 * Serializes one booking message. The sender's role is derived from the persisted booking participants rather than
 * from anything stored on the message, so a role can never disagree with the booking it belongs to. Nothing about
 * the thread travels to the client: there is no threadId here, because a thread id is never booking authority.
 */
export function serializeBookingMessage(row: SerializableBookingMessage, context: BookingMessageContext): CateringBookingMessageView {
  const senderRole = row.senderId === context.providerId ? "provider" as const : "customer" as const;
  return {
    id: row.id,
    senderId: row.senderId,
    senderRole,
    senderName: context.names.get(row.senderId) ?? null,
    text: row.body,
    createdAt: row.createdAt.toISOString(),
    ...(row.orderToken === undefined ? {} : { orderToken: row.orderToken }),
    mine: row.senderId === context.actorId,
  };
}
