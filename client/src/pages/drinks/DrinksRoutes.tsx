import React, { Suspense } from "react";
import { Route, Switch, useLocation } from "wouter";

import { DrinksProvider } from "@/contexts/DrinksContext";

// Inline Redirect — keeps DrinksCategorySections fully lazy (no static import of that module).
function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  React.useEffect(() => setLocation(to), [to, setLocation]);
  return null;
}

// ── Top-level drink pages ────────────────────────────────────────────────────
const DrinksHubPage = React.lazy(() => import("@/pages/drinks"));
const CanonicalDrinkRecipePage = React.lazy(() => import("@/pages/drinks/recipe"));
const SubmitDrinkRecipePage = React.lazy(() => import("@/pages/drinks/submit"));
const CreatorDashboardPage = React.lazy(() => import("@/pages/drinks/creator-dashboard"));
const PublicDrinkCreatorPage = React.lazy(() => import("@/pages/drinks/creator-public"));
const FollowingDrinksFeedPage = React.lazy(() => import("@/pages/drinks/following"));
const DrinkCreatorPostsFeedPage = React.lazy(() => import("@/pages/drinks/feed"));
const DrinkDropsPage = React.lazy(() => import("@/pages/drinks/drops"));
const DrinkDropDetailPage = React.lazy(() => import("@/pages/drinks/drop-detail"));
const DrinkRoadmapPage = React.lazy(() => import("@/pages/drinks/roadmap"));
const DrinkCampaignsPage = React.lazy(() => import("@/pages/drinks/campaigns"));
const DrinkCampaignDetailPage = React.lazy(() => import("@/pages/drinks/campaign-detail"));
const DrinkCampaignFollowingPage = React.lazy(() => import("@/pages/drinks/campaign-following"));
const DrinksRemixDiscoveryPage = React.lazy(() => import("@/pages/drinks/remixes"));
const MostRemixedDrinksPage = React.lazy(() => import("@/pages/drinks/most-remixed"));
const TrendingCreatorsPage = React.lazy(() => import("@/pages/drinks/creators-trending"));
const DrinksWhatsNewPage = React.lazy(() => import("@/pages/drinks/whats-new"));
const DrinkCollectionsPage = React.lazy(() => import("@/pages/drinks/collections"));
const DrinkCollectionsExplorePage = React.lazy(() => import("@/pages/drinks/collections-explore"));
const DrinkOrdersPage = React.lazy(() => import("@/pages/drinks/orders"));
const DrinkGiftsPage = React.lazy(() => import("@/pages/drinks/gifts"));
const PurchasedCollectionsPage = React.lazy(() => import("@/pages/drinks/purchased-collections"));
const DrinkMembershipsPage = React.lazy(() => import("@/pages/drinks/memberships"));
const DrinkCollectionsWishlistPage = React.lazy(() => import("@/pages/drinks/wishlist"));
const DrinkCollectionDetailPage = React.lazy(() => import("@/pages/drinks/collection-detail"));
const DrinkBundleDetailPage = React.lazy(() => import("@/pages/drinks/bundle-detail"));
const DrinkGiftClaimPage = React.lazy(() => import("@/pages/drinks/gift-claim"));
const DrinkChallengesPage = React.lazy(() => import("@/pages/drinks/challenges"));
const DrinkChallengeDetailPage = React.lazy(() => import("@/pages/drinks/challenge-detail"));
const DrinksDiscoverPage = React.lazy(() => import("@/pages/drinks/discover"));
const DrinksCommunitySearchPage = React.lazy(() => import("@/pages/drinks/search"));
const DrinksNotificationsPage = React.lazy(() => import("@/pages/drinks/notifications"));

// ── Category section wrappers (named exports → .then() adapter) ──────────────
// All six point to the same module so Vite emits a single shared chunk for the
// section wrapper code; sub-pages within each section are further split there.
const CaffeinatedSection = React.lazy(() =>
  import("@/pages/drinks/routes/DrinksCategorySections").then(m => ({ default: m.CaffeinatedSection }))
);
const DetoxesSection = React.lazy(() =>
  import("@/pages/drinks/routes/DrinksCategorySections").then(m => ({ default: m.DetoxesSection }))
);
const PotentPotablesSection = React.lazy(() =>
  import("@/pages/drinks/routes/DrinksCategorySections").then(m => ({ default: m.PotentPotablesSection }))
);
const ProteinShakesSection = React.lazy(() =>
  import("@/pages/drinks/routes/DrinksCategorySections").then(m => ({ default: m.ProteinShakesSection }))
);
const SmoothiesSection = React.lazy(() =>
  import("@/pages/drinks/routes/DrinksCategorySections").then(m => ({ default: m.SmoothiesSection }))
);
const WorkoutDrinksSection = React.lazy(() =>
  import("@/pages/drinks/routes/DrinksCategorySections").then(m => ({ default: m.WorkoutDrinksSection }))
);

// Shared loading state shown while any lazy drink page is resolving.
function DrinkPageFallback() {
  return <div className="p-4 text-sm text-muted-foreground">Loading drink recipes...</div>;
}

export default function DrinksRoutes() {
  return (
    <DrinksProvider>
      <Suspense fallback={<DrinkPageFallback />}>
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
      </Suspense>
    </DrinksProvider>
  );
}
