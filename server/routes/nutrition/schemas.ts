import { z } from "zod";

// The client selects only the desired presentation tier. Payment-related fields
// are deliberately rejected: they are not authoritative billing evidence.
export const nutritionSubscriptionChangeSchema = z.object({
  tier: z.enum(["free", "premium"]),
});
