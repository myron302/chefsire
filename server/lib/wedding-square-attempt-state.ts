/**
 * Pure durable enrollment-attempt state policy.
 * This does not contact Square, write to Neon or activate entitlements.
 */
export type WeddingAttemptStatus =
  | "reserved" | "submitting" | "needs_reconciliation" | "confirmed" | "aborted";
export type WeddingAttemptEvent =
  | "start_submission" | "unknown_outcome" | "provider_created" | "provider_found" | "provider_absent";
const transitions: Readonly<Record<WeddingAttemptStatus, Partial<Record<WeddingAttemptEvent, WeddingAttemptStatus>>>> = {
  reserved: { start_submission: "submitting" },
  submitting: { unknown_outcome: "needs_reconciliation", provider_created: "confirmed" },
  needs_reconciliation: { provider_found: "confirmed", provider_absent: "aborted" },
  confirmed: {},
  aborted: {},
};
export function transitionWeddingEnrollmentAttempt(status: WeddingAttemptStatus, event: WeddingAttemptEvent): WeddingAttemptStatus {
  const next = transitions[status]?.[event];
  if (!next) throw new Error("Unsafe Square enrollment attempt transition");
  return next;
}
