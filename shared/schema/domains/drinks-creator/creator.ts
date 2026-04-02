export {
  DRINK_COLLECTION_ACCESS_TYPE_VALUES,
  DRINK_COLLECTION_PURCHASE_STATUS_VALUES,
  DRINK_COLLECTION_CHECKOUT_STATUS_VALUES,
  DRINK_COLLECTION_SALES_LEDGER_STATUS_VALUES,
  DRINK_PURCHASE_TYPE_VALUES,
  DRINK_COLLECTION_PROMOTION_DISCOUNT_TYPE_VALUES,
  CREATOR_POST_VISIBILITY_VALUES,
  CREATOR_DROP_VISIBILITY_VALUES,
  CREATOR_ROADMAP_VISIBILITY_VALUES,
  CREATOR_CAMPAIGN_ROLLOUT_TIMELINE_AUDIENCE_VALUES,
  CREATOR_CAMPAIGN_STARTS_WITH_AUDIENCE_VALUES,
  CREATOR_CAMPAIGN_PLAYBOOK_PROFILE_STARTS_WITH_AUDIENCE_VALUES,
  CREATOR_CAMPAIGN_PLAYBOOK_PREFERRED_AUDIENCE_FIT_VALUES,
} from "./creator-constants";

export type {
  DrinkCollectionAccessType,
  DrinkCollectionPurchaseStatus,
  DrinkCollectionCheckoutStatus,
  DrinkCollectionSalesLedgerStatus,
  DrinkPurchaseType,
  DrinkCollectionPromotionDiscountType,
  CreatorPostVisibility,
  CreatorDropVisibility,
  CreatorRoadmapVisibility,
  CreatorCampaignRolloutTimelineAudience,
  CreatorCampaignStartsWithAudience,
  CreatorCampaignPlaybookProfileStartsWithAudience,
  CreatorCampaignPlaybookPreferredAudienceFit,
  CreatorCampaignRolloutTimelineMetadata,
  CreatorCampaignEventMetadata,
} from "./creator-constants";

import { defineCreatorCommerceSchema } from "./creator-commerce";
import { defineCreatorSocialSchema } from "./creator-social";
import { defineCreatorCampaignSchema } from "./creator-campaigns";
import { defineCreatorMembershipSchema } from "./creator-memberships";

export const defineCreatorSchema = ({
  users,
  drinkChallenges,
}: {
  users: any;
  drinkChallenges: any;
}) => {
  const commerceSchema = defineCreatorCommerceSchema({ users });
  const socialSchema = defineCreatorSocialSchema({
    users,
    drinkChallenges,
    drinkCollections: commerceSchema.drinkCollections,
    drinkCollectionPromotions: commerceSchema.drinkCollectionPromotions,
  });
  const campaignSchema = defineCreatorCampaignSchema({ users });
  const membershipSchema = defineCreatorMembershipSchema({ users });

  return {
    ...commerceSchema,
    ...membershipSchema,
    ...socialSchema,
    ...campaignSchema,
  };
};
