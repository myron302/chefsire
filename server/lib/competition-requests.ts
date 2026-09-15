// server/lib/competition-requests.ts
/**
 * Request shapes for the competitions router.
 *
 * These schemas exist because of a specific defect class, not for tidiness. The vote route used to
 * validate a participant with `String(participantId ?? "")` and then persist the ORIGINAL value:
 *
 *     eq(competitionParticipants.id, String(participantId ?? ""))   // validated "valid-id"
 *     ...
 *     .values({ participantId })                                    // persisted ["valid-id"]
 *
 * `String(["valid-id"])` is `"valid-id"`, so a JSON array passed the lookup against a real
 * participant; the driver then serialised the array itself as the Postgres array literal
 * `{"valid-id"}`. `[["valid-id"]]` stringifies identically and serialises to `{{"valid-id"}}`.
 * Each alternate representation is a DIFFERENT stored value, so each one slips past
 * `uniq_vote_per_voter_participant` and lands a ballot pointing at no participant row at all --
 * unbounded vote stuffing by one voter, and a phantom id that `POST /:id/complete` can hand back
 * as `winnerParticipantId`.
 *
 * Two rules follow, and both are enforced here rather than at each call site:
 *
 *   1. A client-supplied identifier is a STRING or it is rejected. Arrays, nested arrays, objects,
 *      numbers, booleans, null and blank strings are refused outright -- never coerced into one.
 *   2. Coercion is never a substitute for validation. Where a value is normalised (a numeric string
 *      to a number, say), it is the NORMALISED value that is validated and the normalised value
 *      that is used, so the checked value and the stored value can never diverge.
 *
 * Rule 2 is why `timeLimitMinutes` is here too: `if (timeLimitMinutes < 15 || ...)` coerced for the
 * comparison and then stored the raw field, the same shape of mistake one field over.
 */
import { z } from "zod";

/**
 * An identifier that arrived from a client. `varchar` id columns will accept whatever the driver
 * hands them, so the type check has to happen before the query, not at the database.
 */
const requestId = z
  .string({ invalid_type_error: "must be a string", required_error: "is required" })
  .trim()
  .min(1, "must not be empty")
  .max(128, "is too long");

/** Free text from a client: a string, explicitly null, or absent. Never an array or an object. */
const optionalText = (max: number) =>
  z
    .string({ invalid_type_error: "must be a string" })
    .trim()
    .max(max, "is too long")
    .nullish()
    .transform((value) => (value == null || value === "" ? null : value));

/**
 * An integer from a client. A numeric string is normalised first and it is the NUMBER that is
 * validated and returned; everything else (arrays, booleans, objects, null, blank, `"12abc"`)
 * is rejected rather than coerced.
 */
const requestInt = z.preprocess((value) => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return value;
}, z.number({ invalid_type_error: "must be a number" }).int("must be a whole number"));

/** `POST /competitions` */
export const createCompetitionBody = z.object({
  title: optionalText(200),
  themeName: optionalText(120),
  recipeId: requestId.nullish().transform((value) => value ?? null),
  // Preserves the previous `!!isPrivate`: any value is accepted, and the BOOLEAN is what is stored.
  isPrivate: z
    .unknown()
    .optional()
    .transform((value) => !!value),
  timeLimitMinutes: requestInt
    .refine((n) => n >= 15 && n <= 120, "timeLimitMinutes must be between 15 and 120")
    .default(60),
  minOfficialVoters: requestInt
    .refine((n) => n >= 1 && n <= 10_000, "minOfficialVoters must be between 1 and 10000")
    .default(3),
});

/** `POST /competitions/:id/submit` */
export const submitCompetitionEntryBody = z.object({
  dishTitle: optionalText(200),
  dishDescription: optionalText(4000),
  finalDishPhotoUrl: optionalText(2048),
});

/**
 * `POST /competitions/:id/votes`
 *
 * The scores stay deliberately permissive: the route clamps them to 1-10 and stores the CLAMPED
 * number, so an odd value is already incapable of reaching the database unchanged.
 */
export const castCompetitionVoteBody = z.object({
  participantId: requestId,
  presentation: z.unknown().optional(),
  creativity: z.unknown().optional(),
  technique: z.unknown().optional(),
});

/**
 * `GET /competitions/library`
 *
 * Express hands back an array for a repeated query parameter (`?theme=a&theme=b`) and an object
 * for a bracketed one, so even a read route cannot assume `string`. An unparseable date previously
 * reached `timestamp.toISOString()` and threw a RangeError, answering an unauthenticated request
 * with a 500.
 */
export const competitionLibraryQuery = z.object({
  q: optionalText(200),
  theme: optionalText(120),
  creator: requestId.nullish().transform((value) => value ?? null),
  dateFrom: z
    .string({ invalid_type_error: "must be a string" })
    .trim()
    .nullish()
    .transform((value) => (value ? new Date(value) : null))
    .refine((date) => date === null || !Number.isNaN(date.getTime()), "dateFrom is not a valid date"),
  dateTo: z
    .string({ invalid_type_error: "must be a string" })
    .trim()
    .nullish()
    .transform((value) => (value ? new Date(value) : null))
    .refine((date) => date === null || !Number.isNaN(date.getTime()), "dateTo is not a valid date"),
  limit: requestInt
    .refine((n) => n >= 1 && n <= 100, "limit must be between 1 and 100")
    .default(30),
  offset: requestInt.refine((n) => n >= 0, "offset must not be negative").default(0),
});

/**
 * The first problem in a `ZodError`, rendered as the single `{ error }` string these routes have
 * always answered with. Keeping the response shape means existing clients keep reading `data.error`.
 */
export function firstIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid request";
  const field = issue.path.join(".");
  // A refinement already words its own message in full ("timeLimitMinutes must be ...").
  if (!field || issue.message.startsWith(field)) return issue.message;
  return `${field} ${issue.message}`;
}
