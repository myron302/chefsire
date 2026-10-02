import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { cateringBookings, cateringInquiries, type CateringInquiry } from "@shared/schema";
import { canCustomerWithdrawCateringInquiry } from "@shared/catering-inquiries";
import type { db } from "../db";

type Executor = typeof db;

/**
 * Takes the inquiry row's lock. Every path that decides whether an inquiry may become a booking, or stop being one,
 * asks its question under this lock, so the two decisions are serialized on the row they are both about: whichever
 * commits first is the state the other one then reads.
 */
export async function lockCateringInquiry(tx: Executor, inquiryId: string): Promise<CateringInquiry | undefined> {
  const [row] = await tx.select().from(cateringInquiries).where(eq(cateringInquiries.id, inquiryId)).limit(1).for("update");
  return row;
}

export type CateringInquiryWithdrawal =
  | { kind: "withdrawn"; inquiry: CateringInquiry }
  | { kind: "already_withdrawn"; inquiry: CateringInquiry }
  | { kind: "not_found" }
  | { kind: "has_booking" }
  | { kind: "not_withdrawable" };

/**
 * A customer withdraws their own inquiry, and nothing else. It writes the inquiry's `cancelled` status and no other
 * row: no booking is read for update, cancelled or created, and no billing or payment table is touched.
 *
 * Ownership is part of the lookup, so another customer's inquiry is indistinguishable from one that does not exist.
 * The lock is taken before the booking is looked for, and the provider's offer takes the same lock before it inserts
 * one, so a withdrawal can never be written beside a booking that was created from the same inquiry.
 */
export async function withdrawCateringInquiry(tx: Executor, input: { inquiryId: string; customerId: string }): Promise<CateringInquiryWithdrawal> {
  const locked = await lockCateringInquiry(tx, input.inquiryId);
  if (!locked || locked.customerId !== input.customerId) return { kind: "not_found" };
  const [booking] = await tx.select({ id: cateringBookings.id }).from(cateringBookings).where(eq(cateringBookings.inquiryId, locked.id)).limit(1);
  if (booking) return { kind: "has_booking" };
  if (locked.status === "cancelled") return { kind: "already_withdrawn", inquiry: locked };
  if (!canCustomerWithdrawCateringInquiry(locked.status, false)) return { kind: "not_withdrawable" };
  const [updated] = await tx.update(cateringInquiries).set({ status: "cancelled" })
    .where(and(eq(cateringInquiries.id, locked.id), eq(cateringInquiries.customerId, input.customerId), or(inArray(cateringInquiries.status, ["pending", "accepted"]), isNull(cateringInquiries.status))))
    .returning();
  return updated ? { kind: "withdrawn", inquiry: updated } : { kind: "not_withdrawable" };
}
