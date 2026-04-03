import { z } from "zod";

export const nutritionSubscriptionChangeSchema = z.object({
  tier: z.enum(["free", "premium"]),
  paymentMethod: z.string().optional(),
});
