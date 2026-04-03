import { z } from "zod";

export const pantryItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  quantity: z.union([z.string(), z.number()]).optional(),
  unit: z.string().optional(),
  expirationDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  imageUrl: z.string().optional(),
});

export const legacyPantryItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  quantity: z.number().min(0).optional(),
  unit: z.string().optional(),
  expirationDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const pantryItemUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  quantity: z.union([z.number(), z.string()]).optional(),
  unit: z.string().optional(),
  location: z.string().optional(),
  expirationDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  isRunningLow: z.boolean().optional(),
});

export const pantrySuggestionsQuerySchema = z.object({
  requireAllIngredients: z.coerce.boolean().default(false),
  maxMissingIngredients: z.coerce.number().min(0).max(10).default(3),
  includeExpiringSoon: z.coerce.boolean().default(true),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export const householdCreateSchema = z.object({ name: z.string().min(2).max(80) });
export const householdJoinSchema = z.object({ inviteCode: z.string().min(4) });
export const householdLeaveSchema = z.object({ householdId: z.string().optional() }).optional();
export const householdInviteSchema = z.object({ emailOrUserId: z.string().min(1) });

export const householdResolveDuplicatesSchema = z.object({
  decisions: z.array(
    z.object({
      incomingId: z.string(),
      existingId: z.string(),
      action: z.enum(["merge", "keepBoth", "discardIncoming"]),
    })
  ),
});
