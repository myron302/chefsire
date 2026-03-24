import { Route, Switch } from "wouter";

import { DrinksProvider } from "@/contexts/DrinksContext";

import DrinksHubPage from "@/pages/drinks";
import CanonicalDrinkRecipePage from "@/pages/drinks/recipe";
import SubmitDrinkRecipePage from "@/pages/drinks/submit";
import CreatorDashboardPage from "@/pages/drinks/creator-dashboard";
import PublicDrinkCreatorPage from "@/pages/drinks/creator-public";
import FollowingDrinksFeedPage from "@/pages/drinks/following";
import DrinkCreatorPostsFeedPage from "@/pages/drinks/feed";
import DrinkDropsPage from "@/pages/drinks/drops";
import DrinkDropDetailPage from "@/pages/drinks/drop-detail";
import DrinkRoadmapPage from "@/pages/drinks/roadmap";
import DrinkCampaignsPage from "@/pages/drinks/campaigns";
import DrinkCampaignDetailPage from "@/pages/drinks/campaign-detail";
import DrinkCampaignFollowingPage from "@/pages/drinks/campaign-following";
import DrinksRemixDiscoveryPage from "@/pages/drinks/remixes";
import MostRemixedDrinksPage from "@/pages/drinks/most-remixed";
import TrendingCreatorsPage from "@/pages/drinks/creators-trending";
import DrinksWhatsNewPage from "@/pages/drinks/whats-new";
import DrinkCollectionsPage from "@/pages/drinks/collections";
import DrinkCollectionsExplorePage from "@/pages/drinks/collections-explore";
import DrinkOrdersPage from "@/pages/drinks/orders";
import DrinkGiftsPage from "@/pages/drinks/gifts";
import PurchasedCollectionsPage from "@/pages/drinks/purchased-collections";
import DrinkMembershipsPage from "@/pages/drinks/memberships";
import DrinkCollectionsWishlistPage from "@/pages/drinks/wishlist";
import DrinkCollectionDetailPage from "@/pages/drinks/collection-detail";
import DrinkBundleDetailPage from "@/pages/drinks/bundle-detail";
import DrinkGiftClaimPage from "@/pages/drinks/gift-claim";
import DrinkChallengesPage from "@/pages/drinks/challenges";
import DrinkChallengeDetailPage from "@/pages/drinks/challenge-detail";
import DrinksDiscoverPage from "@/pages/drinks/discover";
import DrinksCommunitySearchPage from "@/pages/drinks/search";
import DrinksNotificationsPage from "@/pages/drinks/notifications";
import {
  CaffeinatedSection,
  DetoxesSection,
  PotentPotablesSection,
  ProteinShakesSection,
  Redirect,
  SmoothiesSection,
  WorkoutDrinksSection,
} from "@/pages/drinks/routes/DrinksCategorySections";

export default function DrinksRoutes() {
  return (
    <DrinksProvider>
      <Switch>
        <Route path="/drinks/discover" component={DrinksDiscoverPage} />
        <Route path="/drinks/search" component={DrinksCommunitySearchPage} />
        <Route path="/drinks/alerts" component={DrinksNotificationsPage} />
        <Route path="/drinks/notifications" component={DrinksNotificationsPage} />
        <Route path="/drinks/recipe/:slug" component={CanonicalDrinkRecipePage} />
        <Route path="/drinks/submit" component={SubmitDrinkRecipePage} />
        <Route path="/drinks/creator/:userId" component={PublicDrinkCreatorPage} />
        <Route path="/drinks/creator-dashboard" component={CreatorDashboardPage} />
        <Route path="/drinks/following" component={FollowingDrinksFeedPage} />
        <Route path="/drinks/feed" component={DrinkCreatorPostsFeedPage} />
        <Route path="/drinks/drops/:id" component={DrinkDropDetailPage} />
        <Route path="/drinks/drops" component={DrinkDropsPage} />
        <Route path="/drinks/campaigns/following" component={DrinkCampaignFollowingPage} />
        <Route path="/drinks/campaigns/:slug" component={DrinkCampaignDetailPage} />
        <Route path="/drinks/campaigns" component={DrinkCampaignsPage} />
        <Route path="/drinks/roadmap" component={DrinkRoadmapPage} />
        <Route path="/drinks/remixes" component={DrinksRemixDiscoveryPage} />
        <Route path="/drinks/most-remixed" component={MostRemixedDrinksPage} />
        <Route path="/drinks/creators/trending" component={TrendingCreatorsPage} />
        <Route path="/drinks/whats-new" component={DrinksWhatsNewPage} />
        <Route path="/drinks/collections/explore" component={DrinkCollectionsExplorePage} />
        <Route path="/drinks/orders" component={DrinkOrdersPage} />
        <Route path="/drinks/gifts/:token" component={DrinkGiftClaimPage} />
        <Route path="/drinks/gifts" component={DrinkGiftsPage} />
        <Route path="/drinks/collections/purchased" component={PurchasedCollectionsPage} />
        <Route path="/drinks/memberships" component={DrinkMembershipsPage} />
        <Route path="/drinks/collections/wishlist" component={DrinkCollectionsWishlistPage} />
        <Route path="/drinks/collections" component={DrinkCollectionsPage} />
        <Route path="/drinks/collections/:id" component={DrinkCollectionDetailPage} />
        <Route path="/drinks/bundles/:id" component={DrinkBundleDetailPage} />
        <Route path="/drinks/challenges" component={DrinkChallengesPage} />
        <Route path="/drinks/challenges/:slug" component={DrinkChallengeDetailPage} />
        <Route path="/drinks/seasonal">
          <Redirect to="/drinks/potent-potables/seasonal" />
        </Route>

        <Route path="/drinks/caffeinated">{() => <CaffeinatedSection />}</Route>
        <Route path="/drinks/caffeinated/:subcategory">{() => <CaffeinatedSection />}</Route>

        <Route path="/drinks/smoothies">{() => <SmoothiesSection />}</Route>
        <Route path="/drinks/smoothies/:subcategory">{() => <SmoothiesSection />}</Route>

        <Route path="/drinks/protein-shakes">{() => <ProteinShakesSection />}</Route>
        <Route path="/drinks/protein-shakes/:subcategory">{() => <ProteinShakesSection />}</Route>

        <Route path="/drinks/detoxes">{() => <DetoxesSection />}</Route>
        <Route path="/drinks/detoxes/:subcategory">{() => <DetoxesSection />}</Route>

        <Route path="/drinks/workout-drinks">{() => <WorkoutDrinksSection />}</Route>
        <Route path="/drinks/workout-drinks/:subcategory">{() => <WorkoutDrinksSection />}</Route>

        <Route path="/drinks/potent-potables">{() => <PotentPotablesSection />}</Route>
        <Route path="/drinks/potent-potables/:subcategory">{() => <PotentPotablesSection />}</Route>

        <Route path="/drinks" component={DrinksHubPage} />
        <Route>
          <Redirect to="/drinks" />
        </Route>
      </Switch>
    </DrinksProvider>
  );
}
