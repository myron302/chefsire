/**
 * Explicit mutation contracts for planner, grocery, family-profile and remix updates.
 *
 * These endpoints used to read `const updates = req.body` and hand that object straight to drizzle's
 * `.set(...)`. Drizzle maps every key it is given to that table's column, so the request body WAS the
 * update statement: a caller could set `userId`, `id`, `createdAt`, `originalRecipeId`, `likesCount` --
 * anything the table has a column for -- simply by naming it. Ownership, resource identity, remix
 * lineage and counters were all client-writable through a routine edit.
 *
 * The repair is an allowlist, in two halves that have to stay together:
 *
 *   1. A `.strict()` zod schema per endpoint, so a body carrying ANY field outside the contract is
 *      rejected as a whole (400) rather than having the offending key quietly stripped. A mixed
 *      payload -- one legitimate field plus a forged `userId` -- therefore mutates nothing at all,
 *      so an attacker never gets a 200 that hides what was refused.
 *   2. A `to*Patch` builder that names every column it writes. The DB object is constructed from the
 *      parsed value, field by field; it is never the request body and never a spread of one. Even if
 *      a schema later grew a field, nothing reaches `.set(...)` unless a builder here spells it out.
 *
 * PATCH semantics are preserved by omission, not by defaults: an absent field parses to `undefined`,
 * and drizzle's `mapUpdateSet` drops `undefined` entries before building the statement, so the column
 * keeps its stored value. `null` is a DIFFERENT, explicit request to clear a nullable column, and is
 * only accepted where the column really is nullable. Because an all-omitted body would leave drizzle
 * with nothing to set (which throws), each schema also requires at least one field -- turning an empty
 * patch into a 400 instead of a 500.
 *
 * Server-controlled columns are absent from every schema below, which is what makes them unwritable:
 *   grocery_list_items    id, user_id, meal_plan_id, purchased_at, created_at
 *   family_meal_profiles  id, user_id, family_member_id, created_at
 *   recipe_remixes        id, user_id, original_recipe_id, remixed_recipe_id,
 *                         likes_count, saves_count, remix_count, created_at
 * `purchased_at` is the one server-derived value these endpoints still write, and the route computes
 * it from the validated `purchased` flag -- it is never read from the request.
 */
import { z } from "zod";

/** Every column name the planner/remix contracts must never accept from a client. */
export const PLANNER_REMIX_FORBIDDEN_FIELDS = [
  "id",
  "userId",
  "ownerId",
  "creatorId",
  "authorId",
  "householdId",
  "mealPlanId",
  "familyMemberId",
  "recipeId",
  "originalRecipeId",
  "remixedRecipeId",
  "sourceRecipeId",
  "parentRecipeId",
  "likesCount",
  "savesCount",
  "remixCount",
  "likes",
  "views",
  "viewCount",
  "commentCount",
  "purchasedAt",
  "createdAt",
  "updatedAt",
  "publishedAt",
  "deletedAt",
] as const;

const atLeastOneField = (value: object) => Object.keys(value).length > 0;
const ONE_FIELD_REQUIRED = "Provide at least one field to update";

/** A text column that is `notNull`: settable, never clearable. */
const requiredText = (max: number) => z.string().trim().min(1).max(max).optional();
/** A nullable text column: settable, and `null` clears it. */
const nullableText = (max: number) =>
  z.string().trim().max(max).nullable().optional().transform((value) =>
    value === undefined || value === null ? value : value || null
  );

/**
 * A `decimal` column. Postgres numerics arrive over JSON as either a number or a numeric string;
 * drizzle wants the string form, so both are accepted and normalized to a fixed-scale string here
 * rather than in a route. A non-finite or non-numeric value is a 400, not a database error.
 */
const decimalField = (scale: number, min: number, max: number) =>
  z
    .union([z.number(), z.string().trim().min(1)])
    .nullable()
    .optional()
    .superRefine((value, ctx) => {
      if (value === undefined || value === null) return;
      const numeric = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(numeric)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expected a number" });
        return;
      }
      if (numeric < min || numeric > max) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Expected a number between ${min} and ${max}` });
      }
    })
    .transform((value) => {
      if (value === undefined || value === null) return value;
      const numeric = typeof value === "number" ? value : Number(value);
      return numeric.toFixed(scale);
    });

// ------------------------------------------------------------------------------------------------
// PATCH /api/meal-planner/grocery-list/:id
// ------------------------------------------------------------------------------------------------

/**
 * The shopping list as the user edits it: what the item is, how much of it, where it sits in a store,
 * what it costs, and whether it has been bought. `purchasedAt` is deliberately not here -- the route
 * derives it from `purchased` so the audit timestamp cannot be backdated by a caller.
 */
export const groceryListItemPatchSchema = z
  .object({
    listName: nullableText(120),
    ingredientName: requiredText(200),
    quantity: nullableText(60),
    unit: nullableText(40),
    location: nullableText(120),
    category: nullableText(60),
    store: nullableText(120),
    aisle: nullableText(60),
    priority: z.enum(["high", "normal", "low"]).optional(),
    estimatedPrice: decimalField(2, 0, 999999),
    actualPrice: decimalField(2, 0, 999999),
    isPantryItem: z.boolean().optional(),
    isRunningLow: z.boolean().optional(),
    purchased: z.boolean().optional(),
    notes: nullableText(2000),
  })
  .strict()
  .refine(atLeastOneField, ONE_FIELD_REQUIRED);

export type GroceryListItemPatch = z.infer<typeof groceryListItemPatchSchema>;

/**
 * Builds the grocery `.set(...)` object. `purchasedAt` is the server's own value: buying an item
 * stamps now, un-buying clears the stamp, and an edit that does not touch `purchased` leaves both
 * columns alone.
 */
export function toGroceryListItemPatch(parsed: GroceryListItemPatch, now: Date) {
  return {
    listName: parsed.listName,
    ingredientName: parsed.ingredientName,
    quantity: parsed.quantity,
    unit: parsed.unit,
    location: parsed.location,
    category: parsed.category,
    store: parsed.store,
    aisle: parsed.aisle,
    priority: parsed.priority,
    estimatedPrice: parsed.estimatedPrice,
    actualPrice: parsed.actualPrice,
    isPantryItem: parsed.isPantryItem,
    isRunningLow: parsed.isRunningLow,
    purchased: parsed.purchased,
    purchasedAt: parsed.purchased === undefined ? undefined : parsed.purchased ? now : null,
    notes: parsed.notes,
  };
}

// ------------------------------------------------------------------------------------------------
// PATCH /api/meal-planner/family-profiles/:id
// ------------------------------------------------------------------------------------------------

const macroGoalNumber = z.number().min(0).max(100000);

/**
 * A household member's eating profile. `familyMemberId` is absent on purpose: which member a profile
 * describes is set once at creation, and a `family_members` row id is not scoped to the caller, so
 * letting a patch repoint it would let one account attach its profile to another household's member.
 */
export const familyMealProfilePatchSchema = z
  .object({
    name: requiredText(120),
    calorieTarget: z.number().int().min(0).max(20000).nullable().optional(),
    macroGoals: z
      .object({ protein: macroGoalNumber, carbs: macroGoalNumber, fat: macroGoalNumber })
      .strict()
      .nullable()
      .optional(),
    preferences: z.array(z.string().trim().min(1).max(100)).max(200).optional(),
    dislikes: z.array(z.string().trim().min(1).max(100)).max(200).optional(),
    portionMultiplier: decimalField(2, 0.01, 9.99),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(atLeastOneField, ONE_FIELD_REQUIRED);

export type FamilyMealProfilePatch = z.infer<typeof familyMealProfilePatchSchema>;

export function toFamilyMealProfilePatch(parsed: FamilyMealProfilePatch) {
  return {
    name: parsed.name,
    calorieTarget: parsed.calorieTarget,
    macroGoals: parsed.macroGoals,
    preferences: parsed.preferences,
    dislikes: parsed.dislikes,
    portionMultiplier: parsed.portionMultiplier,
    isActive: parsed.isActive,
  };
}

// ------------------------------------------------------------------------------------------------
// Remixes
// ------------------------------------------------------------------------------------------------

/** The remix kinds the product offers, as listed by `RecipeRemixButton`. */
export const REMIX_TYPES = [
  "variation",
  "dietary_conversion",
  "portion_adjustment",
  "ingredient_swap",
] as const;

const ingredientName = z.string().trim().min(1).max(200);

/**
 * The `changes` jsonb, matching the shape `recipeRemixes.changes` declares. It is `.strict()` too:
 * the column is typed, and an untyped bag of client keys inside it is the same mass-assignment
 * problem one level down -- it is where a forged `userId` or counter would go next.
 */
export const remixChangesSchema = z
  .object({
    addedIngredients: z.array(ingredientName).max(200).optional(),
    removedIngredients: z.array(ingredientName).max(200).optional(),
    modifiedIngredients: z
      .array(
        z
          .object({
            original: ingredientName,
            new: ingredientName,
            reason: z.string().trim().max(500).optional(),
          })
          .strict()
      )
      .max(200)
      .optional(),
    nutritionChanges: z.record(z.string().trim().min(1).max(60), z.number().finite()).optional(),
    prepTimeChange: z.number().int().min(-10080).max(10080).optional(),
    difficultyChange: z.string().trim().max(60).optional(),
    notes: z.string().trim().max(4000).optional(),
  })
  .strict();

/**
 * PUT /api/remixes/:id -- the editable surface of a remix is the metadata its author wrote: what kind
 * of remix it is, the description of what changed, and whether it is listed publicly. Lineage
 * (`originalRecipeId`, `remixedRecipeId`), ownership (`userId`) and the engagement counters are all
 * absent, so a normal edit cannot repoint a remix at another recipe, hand it to another account, or
 * inflate its likes/saves/remix counts.
 *
 * `isPublic` is in the contract because it is the author's own listing choice and the read paths
 * already treat it as one: the public feeds filter on `isPublic = true`, while `/my-remixes` is scoped
 * to the authenticated author. Flipping it changes only whether the author's own row is listed.
 */
export const remixPatchSchema = z
  .object({
    remixType: z.enum(REMIX_TYPES).optional(),
    changes: remixChangesSchema.optional(),
    isPublic: z.boolean().optional(),
  })
  .strict()
  .refine(atLeastOneField, ONE_FIELD_REQUIRED);

export type RemixPatch = z.infer<typeof remixPatchSchema>;

export function toRemixPatch(parsed: RemixPatch) {
  return {
    remixType: parsed.remixType,
    changes: parsed.changes,
    isPublic: parsed.isPublic,
  };
}

/**
 * POST /api/remixes -- creation already named its fields rather than spreading the body, so it was
 * never mass-assignable; what it lacked was validation of the fields it did read. `remixType` and
 * `changes` went to the database unchecked, so this shares the same validated definitions.
 *
 * The recipe ids stay here because creation is where lineage is legitimately established. Whether
 * that lineage is correctly attributed -- and whether the counters it drives are right -- is a
 * separate, deeper finding (P2-03) and is deliberately untouched by this schema.
 */
export const remixCreateSchema = z
  .object({
    originalRecipeId: z
      .string({ required_error: "originalRecipeId and remixedRecipeId are required" })
      .trim()
      .min(1, "originalRecipeId and remixedRecipeId are required")
      .max(128),
    remixedRecipeId: z
      .string({ required_error: "originalRecipeId and remixedRecipeId are required" })
      .trim()
      .min(1, "originalRecipeId and remixedRecipeId are required")
      .max(128),
    remixType: z.enum(REMIX_TYPES).default("variation"),
    changes: remixChangesSchema.default({}),
    isPublic: z.boolean().default(true),
  })
  .strict();

export type RemixCreate = z.infer<typeof remixCreateSchema>;
