import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";


import { users } from "./schema/domains/users-auth";
import {
  posts,
  recipes,
  recipeReviews,
  recipeReviewPhotos,
  reviewHelpful,
  stories,
  likes,
  comments,
  commentLikes,
  follows,
  followRequests,
  cateringInquiries,
} from "./schema/domains/social-content";
import {
  products,
  orders,
  subscriptionHistory,
} from "./schema/domains/commerce-billing";

export { users } from "./schema/domains/users-auth";
export {
  posts,
  recipes,
  recipeReviews,
  recipeReviewPhotos,
  reviewHelpful,
  stories,
  likes,
  comments,
  commentLikes,
  follows,
  followRequests,
  cateringInquiries,
} from "./schema/domains/social-content";
export {
  products,
  orders,
  subscriptionHistory,
} from "./schema/domains/commerce-billing";

import {
  mealPlans,
  mealPlanEntries,
  mealStreaks,
  bodyMetrics,
  mealFavorites,
  waterLogs,
  mealPlanBlueprints,
  blueprintVersions,
  mealPlanPurchases,
  mealPlanReviews,
  creatorAnalytics,
} from "./schema/domains/meal-planning";
import {
  pantryHouseholds,
  pantryHouseholdMembers,
  pantryItems,
  nutritionLogs,
  familyMembers,
  allergenProfiles,
  recipeAllergens,
  userSubstitutionPreferences,
  productAllergens,
  clubs,
  clubMemberships,
  clubJoinRequests,
  clubPosts,
  clubPostLikes,
  challenges,
  challengeProgress,
  badges,
  userBadges,
} from "./schema/domains/pantry-allergens-community";
import {
  substitutionIngredients,
  substitutions,
  customDrinks,
  drinkPhotos,
  drinkLikes,
  drinkSaves,
  drinkEvents,
  petFoodEvents,
  drinkRecipes,
  DRINK_COLLECTION_ACCESS_TYPE_VALUES,
  DRINK_COLLECTION_PURCHASE_STATUS_VALUES,
  DRINK_COLLECTION_CHECKOUT_STATUS_VALUES,
  DRINK_COLLECTION_SALES_LEDGER_STATUS_VALUES,
  DRINK_PURCHASE_TYPE_VALUES,
  DRINK_COLLECTION_PROMOTION_DISCOUNT_TYPE_VALUES,
  CREATOR_DROP_VISIBILITY_VALUES,
  CREATOR_POST_VISIBILITY_VALUES,
  CREATOR_ROADMAP_VISIBILITY_VALUES,
  CREATOR_CAMPAIGN_ROLLOUT_TIMELINE_AUDIENCE_VALUES,
  CREATOR_CAMPAIGN_PLAYBOOK_PREFERRED_AUDIENCE_FIT_VALUES,
  drinkCollections,
  drinkCollectionItems,
  drinkCollectionPurchases,
  drinkCollectionWishlists,
  drinkCollectionReviews,
  drinkCollectionCheckoutSessions,
  drinkCollectionSquareWebhookEvents,
  drinkGifts,
  drinkCollectionSalesLedger,
  drinkCollectionPromotions,
  drinkCollectionEvents,
  creatorMembershipPlans,
  creatorMemberships,
  creatorPosts,
  creatorDrops,
  creatorDropRsvps,
  creatorRoadmapItems,
  creatorCampaigns,
  creatorCampaignRolloutTimelineEvents,
  creatorCampaignTemplates,
  creatorCampaignPlaybookProfiles,
  creatorCampaignLinks,
  creatorCampaignFollows,
  creatorCampaignGoals,
  creatorCampaignActionStates,
  creatorCampaignExperiments,
  creatorCampaignCtaVariants,
  creatorCampaignVariantEvents,
  creatorCampaignSpotlightEvents,
  creatorCampaignSurfaceEvents,
  creatorDropEvents,
  creatorCollaborations,
  creatorMembershipCheckoutSessions,
  creatorMembershipSalesLedger,
  drinkBundles,
  drinkBundleItems,
  drinkBundlePurchases,
  drinkBundleCheckoutSessions,
  drinkBundleSquareWebhookEvents,
  drinkChallenges,
  drinkChallengeSubmissions,
  recipeSaves,
  userDrinkStats,
} from "./schema/domains/drinks-creator";
import {
  stores,
  paymentMethods,
  commissions,
  payouts,
  payoutSchedules,
  emailVerificationTokens,
  weddingRsvpInvitations,
  weddingEventDetails,
  weddingCalendarEvents,
} from "./schema/domains/ops-wedding";

export {
  mealPlans,
  mealPlanEntries,
  mealStreaks,
  bodyMetrics,
  mealFavorites,
  waterLogs,
  mealPlanBlueprints,
  blueprintVersions,
  mealPlanPurchases,
  mealPlanReviews,
  creatorAnalytics,
} from "./schema/domains/meal-planning";
export {
  pantryHouseholds,
  pantryHouseholdMembers,
  pantryItems,
  nutritionLogs,
  familyMembers,
  allergenProfiles,
  recipeAllergens,
  userSubstitutionPreferences,
  productAllergens,
  clubs,
  clubMemberships,
  clubJoinRequests,
  clubPosts,
  clubPostLikes,
  challenges,
  challengeProgress,
  badges,
  userBadges,
} from "./schema/domains/pantry-allergens-community";
export {
  substitutionIngredients,
  substitutions,
  customDrinks,
  drinkPhotos,
  drinkLikes,
  drinkSaves,
  drinkEvents,
  petFoodEvents,
  drinkRecipes,
  DRINK_COLLECTION_ACCESS_TYPE_VALUES,
  DRINK_COLLECTION_PURCHASE_STATUS_VALUES,
  DRINK_COLLECTION_CHECKOUT_STATUS_VALUES,
  DRINK_COLLECTION_SALES_LEDGER_STATUS_VALUES,
  DRINK_PURCHASE_TYPE_VALUES,
  DRINK_COLLECTION_PROMOTION_DISCOUNT_TYPE_VALUES,
  CREATOR_DROP_VISIBILITY_VALUES,
  CREATOR_POST_VISIBILITY_VALUES,
  CREATOR_ROADMAP_VISIBILITY_VALUES,
  CREATOR_CAMPAIGN_ROLLOUT_TIMELINE_AUDIENCE_VALUES,
  CREATOR_CAMPAIGN_PLAYBOOK_PREFERRED_AUDIENCE_FIT_VALUES,
  drinkCollections,
  drinkCollectionItems,
  drinkCollectionPurchases,
  drinkCollectionWishlists,
  drinkCollectionReviews,
  drinkCollectionCheckoutSessions,
  drinkCollectionSquareWebhookEvents,
  drinkGifts,
  drinkCollectionSalesLedger,
  drinkCollectionPromotions,
  drinkCollectionEvents,
  creatorMembershipPlans,
  creatorMemberships,
  creatorPosts,
  creatorDrops,
  creatorDropRsvps,
  creatorRoadmapItems,
  creatorCampaigns,
  creatorCampaignRolloutTimelineEvents,
  creatorCampaignTemplates,
  creatorCampaignPlaybookProfiles,
  creatorCampaignLinks,
  creatorCampaignFollows,
  creatorCampaignGoals,
  creatorCampaignActionStates,
  creatorCampaignExperiments,
  creatorCampaignCtaVariants,
  creatorCampaignVariantEvents,
  creatorCampaignSpotlightEvents,
  creatorCampaignSurfaceEvents,
  creatorDropEvents,
  creatorCollaborations,
  creatorMembershipCheckoutSessions,
  creatorMembershipSalesLedger,
  drinkBundles,
  drinkBundleItems,
  drinkBundlePurchases,
  drinkBundleCheckoutSessions,
  drinkBundleSquareWebhookEvents,
  drinkChallenges,
  drinkChallengeSubmissions,
  recipeSaves,
  userDrinkStats,
} from "./schema/domains/drinks-creator";
export type {
  DrinkCollectionAccessType,
  DrinkCollectionPurchaseStatus,
  DrinkCollectionCheckoutStatus,
  DrinkCollectionSalesLedgerStatus,
  DrinkPurchaseType,
  DrinkCollectionPromotionDiscountType,
  CreatorDropVisibility,
  CreatorPostVisibility,
  CreatorCampaignRolloutTimelineAudience,
  CreatorCampaignPlaybookPreferredAudienceFit,
} from "./schema/domains/drinks-creator";
export {
  stores,
  paymentMethods,
  commissions,
  payouts,
  payoutSchedules,
  emailVerificationTokens,
  weddingRsvpInvitations,
  weddingEventDetails,
  weddingCalendarEvents,
} from "./schema/domains/ops-wedding";

/* =========================================================================
   ===== INSERT SCHEMAS
   ========================================================================= */

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  followersCount: true,
  followingCount: true,
  postsCount: true,
  monthlyRevenue: true,
  createdAt: true,

  // ✅ Don’t require this on insert
  emailVerifiedAt: true,
});

export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
  likesCount: true,
  commentsCount: true,
  createdAt: true,
});

export const insertRecipeSchema = createInsertSchema(recipes).omit({
  id: true,
});

export const insertRecipeReviewSchema = createInsertSchema(recipeReviews).omit({
  id: true,
  helpfulCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRecipeReviewPhotoSchema = createInsertSchema(recipeReviewPhotos).omit({
  id: true,
  createdAt: true,
});

export const insertReviewHelpfulSchema = createInsertSchema(reviewHelpful).omit({
  id: true,
  createdAt: true,
});

export const insertStorySchema = createInsertSchema(stories).omit({
  id: true,
  createdAt: true,
});

export const insertLikeSchema = createInsertSchema(likes).omit({
  id: true,
  createdAt: true,
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
});

// Schema for inserting a like on a comment.  We omit the id and createdAt fields so they
// are automatically generated by the database.  The commentLikes table records which
// user liked which comment and is limited by a unique index.
export const insertCommentLikeSchema = createInsertSchema(commentLikes).omit({
  id: true,
  createdAt: true,
});

export const insertFollowSchema = createInsertSchema(follows).omit({
  id: true,
  createdAt: true,
});

export const insertCateringInquirySchema = createInsertSchema(cateringInquiries).omit({
  id: true,
  createdAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  salesCount: true,
  viewsCount: true,
  createdAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
});

export const insertSubscriptionHistorySchema = createInsertSchema(subscriptionHistory).omit({
  id: true,
  createdAt: true,
});

export const insertMealPlanSchema = createInsertSchema(mealPlans).omit({
  id: true,
  createdAt: true,
});

export const insertMealPlanEntrySchema = createInsertSchema(mealPlanEntries).omit({
  id: true,
});
export const insertMealStreakSchema = createInsertSchema(mealStreaks).omit({
  id: true,
});

export const insertBodyMetricSchema = createInsertSchema(bodyMetrics).omit({
  id: true,
  createdAt: true,
});

export const insertMealFavoriteSchema = createInsertSchema(mealFavorites).omit({
  id: true,
});

export const insertWaterLogSchema = createInsertSchema(waterLogs).omit({
  id: true,
});


export const insertPantryItemSchema = createInsertSchema(pantryItems).omit({
  id: true,
  createdAt: true,
});

export const insertNutritionLogSchema = createInsertSchema(nutritionLogs).omit({
  id: true,
  createdAt: true,
});

export const insertCustomDrinkSchema = createInsertSchema(customDrinks).omit({
  id: true,
  likesCount: true,
  savesCount: true,
  sharesCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDrinkPhotoSchema = createInsertSchema(drinkPhotos).omit({
  id: true,
  likesCount: true,
  createdAt: true,
});

export const insertDrinkLikeSchema = createInsertSchema(drinkLikes).omit({
  id: true,
  createdAt: true,
});

export const insertDrinkSaveSchema = createInsertSchema(drinkSaves).omit({
  id: true,
  createdAt: true,
});

export const insertDrinkEventSchema = createInsertSchema(drinkEvents).omit({
  id: true,
  createdAt: true,
});

export const insertPetFoodEventSchema = createInsertSchema(petFoodEvents).omit({
  id: true,
  createdAt: true,
});

export const insertDrinkRecipeSchema = createInsertSchema(drinkRecipes).omit({
  id: true,
  source: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDrinkCollectionSchema = createInsertSchema(drinkCollections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDrinkCollectionItemSchema = createInsertSchema(drinkCollectionItems).omit({
  addedAt: true,
});

export const insertDrinkCollectionPurchaseSchema = createInsertSchema(drinkCollectionPurchases).omit({
  id: true,
  createdAt: true,
});

export const insertDrinkCollectionWishlistSchema = createInsertSchema(drinkCollectionWishlists).omit({
  id: true,
  createdAt: true,
});

export const insertDrinkCollectionReviewSchema = createInsertSchema(drinkCollectionReviews).omit({
  id: true,
  isVerifiedPurchase: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDrinkCollectionPromotionSchema = createInsertSchema(drinkCollectionPromotions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  redemptionCount: true,
});

export const insertDrinkBundleSchema = createInsertSchema(drinkBundles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorMembershipPlanSchema = createInsertSchema(creatorMembershipPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorMembershipSchema = createInsertSchema(creatorMemberships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorPostSchema = createInsertSchema(creatorPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorDropSchema = createInsertSchema(creatorDrops).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorDropRsvpSchema = createInsertSchema(creatorDropRsvps).omit({
  id: true,
  createdAt: true,
});

export const insertCreatorRoadmapItemSchema = createInsertSchema(creatorRoadmapItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorCampaignSchema = createInsertSchema(creatorCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorCampaignRolloutTimelineEventSchema = createInsertSchema(creatorCampaignRolloutTimelineEvents).omit({
  id: true,
  createdAt: true,
});

export const insertCreatorCampaignTemplateSchema = createInsertSchema(creatorCampaignTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorCampaignPlaybookProfileSchema = createInsertSchema(creatorCampaignPlaybookProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorCampaignLinkSchema = createInsertSchema(creatorCampaignLinks).omit({
  id: true,
  createdAt: true,
});

export const insertCreatorCampaignFollowSchema = createInsertSchema(creatorCampaignFollows).omit({
  id: true,
  createdAt: true,
});

export const insertCreatorCampaignGoalSchema = createInsertSchema(creatorCampaignGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorCampaignActionStateSchema = createInsertSchema(creatorCampaignActionStates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorCampaignExperimentSchema = createInsertSchema(creatorCampaignExperiments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorCampaignCtaVariantSchema = createInsertSchema(creatorCampaignCtaVariants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorCampaignVariantEventSchema = createInsertSchema(creatorCampaignVariantEvents).omit({
  id: true,
  createdAt: true,
});

export const insertCreatorCampaignSpotlightEventSchema = createInsertSchema(creatorCampaignSpotlightEvents).omit({
  id: true,
  createdAt: true,
});

export const insertCreatorCampaignSurfaceEventSchema = createInsertSchema(creatorCampaignSurfaceEvents).omit({
  id: true,
  createdAt: true,
});

export const insertCreatorDropEventSchema = createInsertSchema(creatorDropEvents).omit({
  id: true,
  createdAt: true,
});

export const insertCreatorCollaborationSchema = createInsertSchema(creatorCollaborations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDrinkBundleItemSchema = createInsertSchema(drinkBundleItems).omit({
  addedAt: true,
});

export const insertDrinkBundlePurchaseSchema = createInsertSchema(drinkBundlePurchases).omit({
  id: true,
  createdAt: true,
});

export const insertDrinkChallengeSchema = createInsertSchema(drinkChallenges).omit({
  id: true,
  createdAt: true,
});

export const insertDrinkChallengeSubmissionSchema = createInsertSchema(drinkChallengeSubmissions).omit({
  id: true,
  createdAt: true,
});

export const insertRecipeSaveSchema = createInsertSchema(recipeSaves).omit({
  id: true,
  createdAt: true,
});

export const insertUserDrinkStatsSchema = createInsertSchema(userDrinkStats).omit({
  id: true,
  updatedAt: true,
});

export const insertStoreSchema = createInsertSchema(stores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommissionSchema = createInsertSchema(commissions).omit({
  id: true,
  createdAt: true,
});

export const insertPayoutSchema = createInsertSchema(payouts).omit({
  id: true,
  createdAt: true,
});

export const insertPayoutScheduleSchema = createInsertSchema(payoutSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFamilyMemberSchema = createInsertSchema(familyMembers).omit({
  id: true,
  createdAt: true,
});

export const insertAllergenProfileSchema = createInsertSchema(allergenProfiles).omit({
  id: true,
  createdAt: true,
});

export const insertRecipeAllergenSchema = createInsertSchema(recipeAllergens).omit({
  id: true,
  createdAt: true,
});

export const insertUserSubstitutionPreferenceSchema = createInsertSchema(userSubstitutionPreferences).omit({
  id: true,
  createdAt: true,
});

export const insertProductAllergenSchema = createInsertSchema(productAllergens).omit({
  id: true,
  createdAt: true,
});

export const insertClubSchema = createInsertSchema(clubs).omit({
  id: true,
  createdAt: true,
});

export const insertClubMembershipSchema = createInsertSchema(clubMemberships).omit({
  id: true,
  joinedAt: true,
});

export const insertClubPostSchema = createInsertSchema(clubPosts).omit({
  id: true,
  likesCount: true,
  commentsCount: true,
  createdAt: true,
});

export const insertChallengeSchema = createInsertSchema(challenges).omit({
  id: true,
  createdAt: true,
});

export const insertChallengeProgressSchema = createInsertSchema(challengeProgress).omit({
  id: true,
  createdAt: true,
});

export const insertBadgeSchema = createInsertSchema(badges).omit({
  id: true,
  createdAt: true,
});

export const insertUserBadgeSchema = createInsertSchema(userBadges).omit({
  id: true,
  earnedAt: true,
});

export const insertSubstitutionIngredientSchema = createInsertSchema(substitutionIngredients).omit({
  id: true,
  createdAt: true,
});

export const insertSubstitutionSchema = createInsertSchema(substitutions).omit({
  id: true,
  createdAt: true,
});

/* =========================================================================
   ===== TYPES
   ========================================================================= */
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Post = typeof posts.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Recipe = typeof recipes.$inferSelect;
export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type RecipeReview = typeof recipeReviews.$inferSelect;
export type InsertRecipeReview = z.infer<typeof insertRecipeReviewSchema>;
export type RecipeReviewPhoto = typeof recipeReviewPhotos.$inferSelect;
export type InsertRecipeReviewPhoto = z.infer<typeof insertRecipeReviewPhotoSchema>;
export type ReviewHelpful = typeof reviewHelpful.$inferSelect;
export type InsertReviewHelpful = z.infer<typeof insertReviewHelpfulSchema>;
export type Story = typeof stories.$inferSelect;
export type InsertStory = z.infer<typeof insertStorySchema>;
export type Like = typeof likes.$inferSelect;
export type InsertLike = z.infer<typeof insertLikeSchema>;
export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Follow = typeof follows.$inferSelect;
export type InsertFollow = z.infer<typeof insertFollowSchema>;
export type CateringInquiry = typeof cateringInquiries.$inferSelect;
export type InsertCateringInquiry = z.infer<typeof insertCateringInquirySchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type SubscriptionHistory = typeof subscriptionHistory.$inferSelect;
export type InsertSubscriptionHistory = z.infer<typeof insertSubscriptionHistorySchema>;
export type MealPlan = typeof mealPlans.$inferSelect;
export type InsertMealPlan = z.infer<typeof insertMealPlanSchema>;
export type MealPlanEntry = typeof mealPlanEntries.$inferSelect;
export type InsertMealPlanEntry = z.infer<typeof insertMealPlanEntrySchema>;
export type MealStreak = typeof mealStreaks.$inferSelect;
export type InsertMealStreak = z.infer<typeof insertMealStreakSchema>;
export type BodyMetric = typeof bodyMetrics.$inferSelect;
export type InsertBodyMetric = z.infer<typeof insertBodyMetricSchema>;
export type MealFavorite = typeof mealFavorites.$inferSelect;
export type InsertMealFavorite = z.infer<typeof insertMealFavoriteSchema>;
export type WaterLog = typeof waterLogs.$inferSelect;
export type InsertWaterLog = z.infer<typeof insertWaterLogSchema>;
export type MealPlanBlueprint = typeof mealPlanBlueprints.$inferSelect;
export type BlueprintVersion = typeof blueprintVersions.$inferSelect;
export type MealPlanPurchase = typeof mealPlanPurchases.$inferSelect;
export type MealPlanReview = typeof mealPlanReviews.$inferSelect;
export type CreatorAnalytics = typeof creatorAnalytics.$inferSelect;
export type PantryItem = typeof pantryItems.$inferSelect;
export type InsertPantryItem = z.infer<typeof insertPantryItemSchema>;
export type Household = typeof pantryHouseholds.$inferSelect;
export type HouseholdMember = typeof pantryHouseholdMembers.$inferSelect;
export type PantryItemEnhanced = PantryItem;
export type BarcodeLookup = Record<string, unknown>;
export type ExpiryReminder = Record<string, unknown>;
export type NutritionLog = typeof nutritionLogs.$inferSelect;
export type InsertNutritionLog = z.infer<typeof insertNutritionLogSchema>;
export type CustomDrink = typeof customDrinks.$inferSelect;
export type InsertCustomDrink = z.infer<typeof insertCustomDrinkSchema>;
export type DrinkPhoto = typeof drinkPhotos.$inferSelect;
export type InsertDrinkPhoto = z.infer<typeof insertDrinkPhotoSchema>;
export type DrinkLike = typeof drinkLikes.$inferSelect;
export type InsertDrinkLike = z.infer<typeof insertDrinkLikeSchema>;
export type DrinkSave = typeof drinkSaves.$inferSelect;
export type InsertDrinkSave = z.infer<typeof insertDrinkSaveSchema>;
export type DrinkEvent = typeof drinkEvents.$inferSelect;
export type InsertDrinkEvent = z.infer<typeof insertDrinkEventSchema>;
export type PetFoodEvent = typeof petFoodEvents.$inferSelect;
export type InsertPetFoodEvent = z.infer<typeof insertPetFoodEventSchema>;
export type DrinkRecipe = typeof drinkRecipes.$inferSelect;
export type InsertDrinkRecipe = z.infer<typeof insertDrinkRecipeSchema>;
export type DrinkCollection = typeof drinkCollections.$inferSelect;
export type InsertDrinkCollection = z.infer<typeof insertDrinkCollectionSchema>;
export type DrinkCollectionItem = typeof drinkCollectionItems.$inferSelect;
export type InsertDrinkCollectionItem = z.infer<typeof insertDrinkCollectionItemSchema>;
export type DrinkCollectionPurchase = typeof drinkCollectionPurchases.$inferSelect;
export type InsertDrinkCollectionPurchase = z.infer<typeof insertDrinkCollectionPurchaseSchema>;
export type DrinkCollectionWishlist = typeof drinkCollectionWishlists.$inferSelect;
export type InsertDrinkCollectionWishlist = z.infer<typeof insertDrinkCollectionWishlistSchema>;
export type DrinkCollectionReview = typeof drinkCollectionReviews.$inferSelect;
export type InsertDrinkCollectionReview = z.infer<typeof insertDrinkCollectionReviewSchema>;
export type DrinkCollectionPromotion = typeof drinkCollectionPromotions.$inferSelect;
export type InsertDrinkCollectionPromotion = z.infer<typeof insertDrinkCollectionPromotionSchema>;
export type CreatorMembershipPlan = typeof creatorMembershipPlans.$inferSelect;
export type InsertCreatorMembershipPlan = z.infer<typeof insertCreatorMembershipPlanSchema>;
export type CreatorMembership = typeof creatorMemberships.$inferSelect;
export type InsertCreatorMembership = z.infer<typeof insertCreatorMembershipSchema>;
export type CreatorPost = typeof creatorPosts.$inferSelect;
export type InsertCreatorPost = z.infer<typeof insertCreatorPostSchema>;
export type CreatorDrop = typeof creatorDrops.$inferSelect;
export type InsertCreatorDrop = z.infer<typeof insertCreatorDropSchema>;
export type CreatorDropRsvp = typeof creatorDropRsvps.$inferSelect;
export type InsertCreatorDropRsvp = z.infer<typeof insertCreatorDropRsvpSchema>;
export type CreatorRoadmapItem = typeof creatorRoadmapItems.$inferSelect;
export type InsertCreatorRoadmapItem = z.infer<typeof insertCreatorRoadmapItemSchema>;
export type CreatorCampaign = typeof creatorCampaigns.$inferSelect;
export type InsertCreatorCampaign = z.infer<typeof insertCreatorCampaignSchema>;
export type CreatorCampaignRolloutTimelineEvent = typeof creatorCampaignRolloutTimelineEvents.$inferSelect;
export type InsertCreatorCampaignRolloutTimelineEvent = z.infer<typeof insertCreatorCampaignRolloutTimelineEventSchema>;
export type CreatorCampaignTemplate = typeof creatorCampaignTemplates.$inferSelect;
export type InsertCreatorCampaignTemplate = z.infer<typeof insertCreatorCampaignTemplateSchema>;
export type CreatorCampaignPlaybookProfile = typeof creatorCampaignPlaybookProfiles.$inferSelect;
export type InsertCreatorCampaignPlaybookProfile = z.infer<typeof insertCreatorCampaignPlaybookProfileSchema>;
export type CreatorCampaignLink = typeof creatorCampaignLinks.$inferSelect;
export type InsertCreatorCampaignLink = z.infer<typeof insertCreatorCampaignLinkSchema>;
export type CreatorCampaignFollow = typeof creatorCampaignFollows.$inferSelect;
export type InsertCreatorCampaignFollow = z.infer<typeof insertCreatorCampaignFollowSchema>;
export type CreatorCampaignActionState = typeof creatorCampaignActionStates.$inferSelect;
export type InsertCreatorCampaignActionState = z.infer<typeof insertCreatorCampaignActionStateSchema>;
export type CreatorCampaignExperiment = typeof creatorCampaignExperiments.$inferSelect;
export type InsertCreatorCampaignExperiment = z.infer<typeof insertCreatorCampaignExperimentSchema>;
export type CreatorCampaignCtaVariant = typeof creatorCampaignCtaVariants.$inferSelect;
export type InsertCreatorCampaignCtaVariant = z.infer<typeof insertCreatorCampaignCtaVariantSchema>;
export type CreatorCampaignVariantEvent = typeof creatorCampaignVariantEvents.$inferSelect;
export type InsertCreatorCampaignVariantEvent = z.infer<typeof insertCreatorCampaignVariantEventSchema>;
export type CreatorCampaignSpotlightEvent = typeof creatorCampaignSpotlightEvents.$inferSelect;
export type InsertCreatorCampaignSpotlightEvent = z.infer<typeof insertCreatorCampaignSpotlightEventSchema>;
export type CreatorCampaignSurfaceEvent = typeof creatorCampaignSurfaceEvents.$inferSelect;
export type InsertCreatorCampaignSurfaceEvent = z.infer<typeof insertCreatorCampaignSurfaceEventSchema>;
export type CreatorDropEvent = typeof creatorDropEvents.$inferSelect;
export type InsertCreatorDropEvent = z.infer<typeof insertCreatorDropEventSchema>;
export type CreatorCollaboration = typeof creatorCollaborations.$inferSelect;
export type InsertCreatorCollaboration = z.infer<typeof insertCreatorCollaborationSchema>;
export type DrinkBundle = typeof drinkBundles.$inferSelect;
export type InsertDrinkBundle = z.infer<typeof insertDrinkBundleSchema>;
export type DrinkBundleItem = typeof drinkBundleItems.$inferSelect;
export type InsertDrinkBundleItem = z.infer<typeof insertDrinkBundleItemSchema>;
export type DrinkBundlePurchase = typeof drinkBundlePurchases.$inferSelect;
export type InsertDrinkBundlePurchase = z.infer<typeof insertDrinkBundlePurchaseSchema>;
export type DrinkChallenge = typeof drinkChallenges.$inferSelect;
export type InsertDrinkChallenge = z.infer<typeof insertDrinkChallengeSchema>;
export type DrinkChallengeSubmission = typeof drinkChallengeSubmissions.$inferSelect;
export type InsertDrinkChallengeSubmission = z.infer<typeof insertDrinkChallengeSubmissionSchema>;
export type RecipeSave = typeof recipeSaves.$inferSelect;
export type InsertRecipeSave = z.infer<typeof insertRecipeSaveSchema>;
export type UserDrinkStats = typeof userDrinkStats.$inferSelect;
export type InsertUserDrinkStats = z.infer<typeof insertUserDrinkStatsSchema>;
export type Store = typeof stores.$inferSelect;
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;
export type Commission = typeof commissions.$inferSelect;
export type InsertCommission = z.infer<typeof insertCommissionSchema>;
export type Payout = typeof payouts.$inferSelect;
export type InsertPayout = z.infer<typeof insertPayoutSchema>;
export type PayoutSchedule = typeof payoutSchedules.$inferSelect;
export type InsertPayoutSchedule = z.infer<typeof insertPayoutScheduleSchema>;
export type FamilyMember = typeof familyMembers.$inferSelect;
export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;
export type AllergenProfile = typeof allergenProfiles.$inferSelect;
export type InsertAllergenProfile = z.infer<typeof insertAllergenProfileSchema>;
export type RecipeAllergen = typeof recipeAllergens.$inferSelect;
export type InsertRecipeAllergen = z.infer<typeof insertRecipeAllergenSchema>;
export type UserSubstitutionPreference = typeof userSubstitutionPreferences.$inferSelect;
export type InsertUserSubstitutionPreference = z.infer<typeof insertUserSubstitutionPreferenceSchema>;
export type ProductAllergen = typeof productAllergens.$inferSelect;
export type InsertProductAllergen = z.infer<typeof insertProductAllergenSchema>;
export type Club = typeof clubs.$inferSelect;
export type InsertClub = z.infer<typeof insertClubSchema>;
export type ClubMembership = typeof clubMemberships.$inferSelect;
export type InsertClubMembership = z.infer<typeof insertClubMembershipSchema>;
export type ClubPost = typeof clubPosts.$inferSelect;
export type InsertClubPost = z.infer<typeof insertClubPostSchema>;
export type Challenge = typeof challenges.$inferSelect;
export type InsertChallenge = z.infer<typeof insertChallengeSchema>;
export type ChallengeProgress = typeof challengeProgress.$inferSelect;
export type InsertChallengeProgress = z.infer<typeof insertChallengeProgressSchema>;
export type Badge = typeof badges.$inferSelect;
export type InsertBadge = z.infer<typeof insertBadgeSchema>;
export type UserBadge = typeof userBadges.$inferSelect;
export type InsertUserBadge = z.infer<typeof insertUserBadgeSchema>;

// A like on a comment.  Contains the ids of the user and comment as well as a
// timestamp.  See the commentLikes table definition for details.
export type CommentLike = typeof commentLikes.$inferSelect;
export type InsertCommentLike = z.infer<typeof insertCommentLikeSchema>;

/* ===== NEW TYPE ===== */
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type WeddingRsvpInvitation = typeof weddingRsvpInvitations.$inferSelect;
export type WeddingEventDetails = typeof weddingEventDetails.$inferSelect;
export type WeddingCalendarEvent = typeof weddingCalendarEvents.$inferSelect;

/* =========================================================================
   ===== Extended types
   ========================================================================= */
export type PostWithUser = Post & { user: User; recipe?: Recipe; isLiked?: boolean; isSaved?: boolean };
export type StoryWithUser = Story & { user: User };
export type CommentWithUser = Comment & { user: User };
export type ProductWithSeller = Product & { seller: User };
export type OrderWithDetails = Order & { product: Product; seller: User; buyer: User };
export type MealPlanWithEntries = MealPlan & { entries: (MealPlanEntry & { recipe?: Recipe })[] };
export type ChefWithCatering = User & { availableForCatering: boolean; distance?: number };
export type SubstitutionIngredient = typeof substitutionIngredients.$inferSelect;
export type Substitution = typeof substitutions.$inferSelect;
export type InsertSubstitutionIngredient = z.infer<typeof insertSubstitutionIngredientSchema>;
export type InsertSubstitution = z.infer<typeof insertSubstitutionSchema>;
export type CustomDrinkWithUser = CustomDrink & {
  user: User;
  isLiked?: boolean;
  isSaved?: boolean;
  photos?: DrinkPhoto[];
};

/* ===== NEW EXTENDED TYPES ===== */
export type PantryItemWithDetails = PantryItemEnhanced & {
  barcodeData?: BarcodeLookup;
  reminders?: ExpiryReminder[];
};

export type HouseholdWithMembers = Household & {
  owner: User;
  members: (HouseholdMember & { user: User })[];
};

export type FamilyMemberWithAllergens = FamilyMember & {
  allergens: AllergenProfile[];
};

export type RecipeWithAllergens = Recipe & {
  allergens: RecipeAllergen[];
  isSafeFor?: { familyMemberId: string; memberName: string }[];
};

export type RecipeWithMatch = Recipe & {
  matchScore?: number;
  matchingIngredients?: string[];
  missingIngredients?: string[];
};

export type MealPlanBlueprintWithCreator = MealPlanBlueprint & {
  creator: User;
  currentVersionData?: BlueprintVersion;
  hasPurchased?: boolean;
};

export type MealPlanPurchaseWithDetails = MealPlanPurchase & {
  blueprint: MealPlanBlueprint;
  version: BlueprintVersion;
  buyer: User;
};

export type MealPlanReviewWithUser = MealPlanReview & {
  user: User;
};

export type ClubWithDetails = Club & {
  owner: User;
  isMember?: boolean;
  membershipStatus?: string;
};

export type ClubPostWithUser = ClubPost & {
  user: User;
  recipe?: Recipe;
  isLiked?: boolean;
};

export type ChallengeWithProgress = Challenge & {
  creator: User;
  userProgress?: ChallengeProgress;
  isJoined?: boolean;
};

export type ChallengeProgressWithDetails = ChallengeProgress & {
  challenge: Challenge;
  user: User;
};

export type BadgeWithEarnedInfo = Badge & {
  earnedAt?: string;
  source?: string;
};

import {
  notifications,
  dailyQuests,
  questProgress,
  recipeRemixes,
  aiSuggestions,
  mealRecommendations,
  mealPrepSchedules,
  leftovers,
  groceryListItems,
  userMealPlanProgress,
  mealPlanAchievements,
  userMealPlanAchievements,
  familyMealProfiles,
} from "./schema/domains/engagement-advanced";

export {
  notifications,
  dailyQuests,
  questProgress,
  recipeRemixes,
  aiSuggestions,
  mealRecommendations,
  mealPrepSchedules,
  leftovers,
  groceryListItems,
  userMealPlanProgress,
  mealPlanAchievements,
  userMealPlanAchievements,
  familyMealProfiles,
} from "./schema/domains/engagement-advanced";

/* =========================================================================
   ===== PHASE 1 INSERT SCHEMAS
   ========================================================================= */
export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertDailyQuestSchema = createInsertSchema(dailyQuests).omit({
  id: true,
  createdAt: true,
});

export const insertQuestProgressSchema = createInsertSchema(questProgress).omit({
  id: true,
  createdAt: true,
});

export const insertRecipeRemixSchema = createInsertSchema(recipeRemixes).omit({
  id: true,
  createdAt: true,
});

export const insertAiSuggestionSchema = createInsertSchema(aiSuggestions).omit({
  id: true,
  createdAt: true,
});

/* =========================================================================
   ===== PHASE 1 TYPES
   ========================================================================= */
export type Notification = typeof notifications.$inferSelect;
export type DailyQuest = typeof dailyQuests.$inferSelect;
export type QuestProgress = typeof questProgress.$inferSelect;
export type RecipeRemix = typeof recipeRemixes.$inferSelect;
export type AiSuggestion = typeof aiSuggestions.$inferSelect;

export type NotificationWithDetails = Notification & {
  relatedUser?: User;
  relatedRecipe?: Recipe;
};

export type QuestProgressWithQuest = QuestProgress & {
  quest: DailyQuest;
};

export type RecipeRemixWithDetails = RecipeRemix & {
  originalRecipe: Recipe;
  remixedRecipe: Recipe;
  user: User;
  isLiked?: boolean;
  isSaved?: boolean;
};

export type AiSuggestionWithRecipe = AiSuggestion & {
  recipe?: Recipe;
  customDrink?: CustomDrink;
};
