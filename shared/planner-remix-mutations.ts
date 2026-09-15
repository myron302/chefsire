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
 * WHAT THESE SCHEMAS DELIBERATELY DO NOT DO is narrow the value domain. The question they answer is
 * "may this column be written by a client?", not "is this a tidy value?". That boundary matters,
 * because an update contract stricter than the creation contract makes existing rows uneditable: the
 * grocery edit flow in `client/src/pages/pantry/shopping-list.tsx` resends `ingredientName` verbatim
 * on every edit, so a length cap here would reject a quantity change on any row whose name is longer
 * than the cap -- a row `POST /grocery-list` accepted, since it validates only `if (!ingredientName)`,
 * and one the week generator creates by itself from raw recipe ingredient strings. Nothing bounds
 * those columns: `ingredient_name` is `TEXT NOT NULL` in the drizzle schema, in
 * `server/drizzle/20251225_advanced_meal_planning.sql` and in `ensureAdvancedMealPlanningSchema`,
 * with no `varchar(n)` and no CHECK, and no client input carries a `maxLength`. So the text fields
 * below are unbounded here too, matching creation exactly. This costs nothing in exposure: an
 * authenticated caller can already store unbounded text through `POST /grocery-list`, so a cap on
 * PATCH alone would deter no one while breaking real edits.
 *
 * The limits that DO appear are the ones the database really imposes -- `decimal(8, 2)` and
 * `decimal(3, 2)` precision, and int32 -- where validating turns a Postgres range error into a 400
 * instead of a 500. The one value-domain narrowing is `remixType`, and only because this change
 * enforces the same enum on creation too, so create and update agree.
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

/**
 * A `notNull` text column: settable, never clearable. `min(1)` is not a new rule -- it is exactly the
 * `if (!ingredientName)` check `POST /grocery-list` already applies -- and there is no maximum,
 * because neither the column nor creation nor any client input has one.
 */
const requiredText = () => z.string().min(1).optional();
/** A nullable text column: any string creation would accept, and `null` clears it. */
const nullableText = () => z.string().nullable().optional();

/**
 * A `decimal(precision, scale)` column. Postgres numerics arrive over JSON as either a number or a
 * numeric string; drizzle wants the string form, so both are accepted and normalized to a
 * fixed-scale string here rather than in a route.
 *
 * The bound is the column's own precision, not a product rule: a value outside it is a Postgres
 * range error, so rejecting it with a 400 is strictly better than the 500 it would otherwise become.
 * It is symmetric because `numeric(p, s)` itself is -- creation never restricted the sign, so
 * neither does editing.
 */
const decimalField = (precision: number, scale: number) => {
  const limit = Number(`${"9".repeat(precision - scale)}.${"9".repeat(scale)}`);
  return z
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
      if (Math.abs(numeric) > limit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Expected a number between -${limit} and ${limit}`,
        });
      }
    })
    .transform((value) => {
      if (value === undefined || value === null) return value;
      const numeric = typeof value === "number" ? value : Number(value);
      return numeric.toFixed(scale);
    });
};

/** The range a Postgres `integer` column accepts; outside it is a range error, not a product rule. */
const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;

// ------------------------------------------------------------------------------------------------
// PATCH /api/meal-planner/grocery-list/:id
// ------------------------------------------------------------------------------------------------

/**
 * The shopping list as the user edits it: what the item is, how much of it, where it sits in a store,
 * what it costs, and whether it has been bought. `purchasedAt` is deliberately not here -- the route
 * derives it from `purchased` so the audit timestamp cannot be backdated by a caller.
 *
 * `priority` is a plain string rather than an enum. The column comments `// high, normal, low`, but
 * `POST /grocery-list` stores `priority || "normal"` without checking it, so a stored row may hold
 * any string and constraining it only on the update path would be the same create/update mismatch
 * this contract exists to avoid.
 */
export const groceryListItemPatchSchema = z
  .object({
    listName: nullableText(),
    ingredientName: requiredText(),
    quantity: nullableText(),
    unit: nullableText(),
    location: nullableText(),
    category: nullableText(),
    store: nullableText(),
    aisle: nullableText(),
    priority: nullableText(),
    estimatedPrice: decimalField(8, 2),
    actualPrice: decimalField(8, 2),
    isPantryItem: z.boolean().optional(),
    isRunningLow: z.boolean().optional(),
    purchased: z.boolean().optional(),
    notes: nullableText(),
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

/**
 * A household member's eating profile. `familyMemberId` is absent on purpose: which member a profile
 * describes is set once at creation, and a `family_members` row id is not scoped to the caller, so
 * letting a patch repoint it would let one account attach its profile to another household's member.
 *
 * `macroGoals`, `preferences` and `dislikes` are jsonb columns with no database constraint, and
 * `POST /family-profiles` writes them through unvalidated, so only their SHAPE is checked here --
 * enough to keep the typed column typed, without narrowing values creation already accepts.
 */
export const familyMealProfilePatchSchema = z
  .object({
    name: requiredText(),
    calorieTarget: z.number().int().min(INT32_MIN).max(INT32_MAX).nullable().optional(),
    macroGoals: z
      .object({
        protein: z.number().finite(),
        carbs: z.number().finite(),
        fat: z.number().finite(),
      })
      .strict()
      .nullable()
      .optional(),
    preferences: z.array(z.string()).optional(),
    dislikes: z.array(z.string()).optional(),
    portionMultiplier: decimalField(3, 2),
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

/** The remix kinds the product offers, as listed by `RecipeRemixButton` and the column's comment. */
export const REMIX_TYPES = [
  "variation",
  "dietary_conversion",
  "portion_adjustment",
  "ingredient_swap",
] as const;

/**
 * The `changes` jsonb, matching the shape `recipeRemixes.changes` declares. It is `.strict()` too:
 * the column is typed, and an untyped bag of client keys inside it is the same mass-assignment
 * problem one level down -- it is where a forged `userId` or counter would go next. Only the KEY SET
 * and the types are constrained; the strings and numbers inside are as unbounded as creation left
 * them, and `remixCreateSchema` applies this same definition so the two paths agree.
 */
export const remixChangesSchema = z
  .object({
    addedIngredients: z.array(z.string()).optional(),
    removedIngredients: z.array(z.string()).optional(),
    modifiedIngredients: z
      .array(
        z
          .object({
            original: z.string(),
            new: z.string(),
            reason: z.string().optional(),
          })
          .strict()
      )
      .optional(),
    nutritionChanges: z.record(z.string(), z.number().finite()).optional(),
    prepTimeChange: z.number().finite().optional(),
    difficultyChange: z.string().optional(),
    notes: z.string().optional(),
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
 * `changes` went to the database unchecked, so this shares the same validated definitions -- which is
 * what lets `remixPatchSchema` constrain `remixType` to the product's four kinds without making a
 * newly created remix uneditable: both paths now accept exactly the same set.
 *
 * The recipe ids stay here because creation is where lineage is legitimately established. `min(1)`
 * reproduces the handler's original required-field check and nothing more; the ids are looked up
 * before insert, so a value that matches no recipe is already a 404. Whether that lineage is
 * correctly attributed -- and whether the counters it drives are right -- is a separate, deeper
 * finding (P2-03) and is deliberately untouched by this schema.
 */
export const remixCreateSchema = z
  .object({
    originalRecipeId: z
      .string({ required_error: "originalRecipeId and remixedRecipeId are required" })
      .min(1, "originalRecipeId and remixedRecipeId are required"),
    remixedRecipeId: z
      .string({ required_error: "originalRecipeId and remixedRecipeId are required" })
      .min(1, "originalRecipeId and remixedRecipeId are required"),
    remixType: z.enum(REMIX_TYPES).default("variation"),
    changes: remixChangesSchema.default({}),
    isPublic: z.boolean().default(true),
  })
  .strict();

export type RemixCreate = z.infer<typeof remixCreateSchema>;
