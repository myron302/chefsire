import * as React from "react";
import { Route, Switch, useLocation } from "wouter";

import RequireAgeGate from "@/components/RequireAgeGate";
import { DrinksProvider } from "@/contexts/DrinksContext";

import DrinksHubPage from "@/pages/drinks";
import SmoothiesHub from "@/pages/drinks/smoothies";
import ProteinShakesHub from "@/pages/drinks/protein-shakes";
import DetoxesHub from "@/pages/drinks/detoxes";
import PotentPotablesHub from "@/pages/drinks/potent-potables";
import CaffeinatedDrinksHub from "@/pages/drinks/caffeinated";
import CanonicalDrinkRecipePage from "@/pages/drinks/recipe";
import SubmitDrinkRecipePage from "@/pages/drinks/submit";
import CreatorDashboardPage from "@/pages/drinks/creator-dashboard";
import PublicDrinkCreatorPage from "@/pages/drinks/creator-public";
import FollowingDrinksFeedPage from "@/pages/drinks/following";
import DrinkCreatorPostsFeedPage from "@/pages/drinks/feed";
import DrinkDropsPage from "@/pages/drinks/drops";
import DrinkRoadmapPage from "@/pages/drinks/roadmap";
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

import EspressoDrinks from "@/pages/drinks/caffeinated/espresso";
import ColdBrewDrinks from "@/pages/drinks/caffeinated/cold-brew";
import TeaDrinks from "@/pages/drinks/caffeinated/tea";
import MatchaDrinks from "@/pages/drinks/caffeinated/matcha";
import EnergyDrinks from "@/pages/drinks/caffeinated/energy";
import SpecialtyCoffee from "@/pages/drinks/caffeinated/specialty";
import LattesDrinks from "@/pages/drinks/caffeinated/lattes";
import IcedCoffeeDrinks from "@/pages/drinks/caffeinated/iced";

import BreakfastSmoothies from "@/pages/drinks/smoothies/breakfast";
import DessertSmoothies from "@/pages/drinks/smoothies/dessert";
import GreenSmoothies from "@/pages/drinks/smoothies/green";
import ProteinSmoothies from "@/pages/drinks/smoothies/protein";
import WorkoutSmoothies from "@/pages/drinks/smoothies/workout";
import TropicalSmoothies from "@/pages/drinks/smoothies/tropical";
import BerrySmoothies from "@/pages/drinks/smoothies/berry";
import DetoxSmoothies from "@/pages/drinks/smoothies/detox";

import CaseinProtein from "@/pages/drinks/protein-shakes/casein";
import CollagenProtein from "@/pages/drinks/protein-shakes/collagen";
import PlantBasedProtein from "@/pages/drinks/protein-shakes/plant-based";
import WheyProtein from "@/pages/drinks/protein-shakes/whey";
import EggProtein from "@/pages/drinks/protein-shakes/egg";
import BeefProtein from "@/pages/drinks/protein-shakes/beef";

import DetoxJuices from "@/pages/drinks/detoxes/juice";
import DetoxTeas from "@/pages/drinks/detoxes/tea";
import DetoxWaters from "@/pages/drinks/detoxes/water";

import CocktailsPage from "@/pages/drinks/potent-potables/cocktails";
import CognacBrandyPage from "@/pages/drinks/potent-potables/cognac-brandy";
import MartinisPage from "@/pages/drinks/potent-potables/martinis";
import MocktailsPage from "@/pages/drinks/potent-potables/mocktails";
import RumPage from "@/pages/drinks/potent-potables/rum";
import ScotchIrishWhiskeyPage from "@/pages/drinks/potent-potables/scotch-irish-whiskey";
import SeasonalPage from "@/pages/drinks/potent-potables/seasonal";
import TequilaMezcalPage from "@/pages/drinks/potent-potables/tequila-mezcal";
import VodkaPage from "@/pages/drinks/potent-potables/vodka";
import WhiskeyBourbonPage from "@/pages/drinks/potent-potables/whiskey-bourbon";
import DaiquiriPage from "@/pages/drinks/potent-potables/daiquiri";
import GinPage from "@/pages/drinks/potent-potables/gin";
import LiqueursPage from "@/pages/drinks/potent-potables/liqueurs";
import SpritzPage from "@/pages/drinks/potent-potables/spritz";
import HotDrinksPage from "@/pages/drinks/potent-potables/hot-drinks";

function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();

  React.useEffect(() => setLocation(to), [to, setLocation]);

  return null;
}

function PotentPotablesSection() {
  return (
    <RequireAgeGate>
      <Switch>
        <Route path="/drinks/potent-potables/cocktails" component={CocktailsPage} />
        <Route path="/drinks/potent-potables/cognac-brandy" component={CognacBrandyPage} />
        <Route path="/drinks/potent-potables/martinis" component={MartinisPage} />
        <Route path="/drinks/potent-potables/rum" component={RumPage} />
        <Route path="/drinks/potent-potables/scotch-irish-whiskey" component={ScotchIrishWhiskeyPage} />
        <Route path="/drinks/potent-potables/seasonal" component={SeasonalPage} />
        <Route path="/drinks/potent-potables/tequila-mezcal" component={TequilaMezcalPage} />
        <Route path="/drinks/potent-potables/daiquiri" component={DaiquiriPage} />
        <Route path="/drinks/potent-potables/vodka" component={VodkaPage} />
        <Route path="/drinks/potent-potables/whiskey-bourbon" component={WhiskeyBourbonPage} />
        <Route path="/drinks/potent-potables/gin" component={GinPage} />
        <Route path="/drinks/potent-potables/liqueurs" component={LiqueursPage} />
        <Route path="/drinks/potent-potables/spritz" component={SpritzPage} />
        <Route path="/drinks/potent-potables/hot-drinks" component={HotDrinksPage} />
        <Route path="/drinks/potent-potables/mocktails" component={MocktailsPage} />
        <Route path="/drinks/potent-potables" component={PotentPotablesHub} />
        <Route>
          <Redirect to="/drinks/potent-potables" />
        </Route>
      </Switch>
    </RequireAgeGate>
  );
}

function CaffeinatedSection() {
  return (
    <Switch>
      <Route path="/drinks/caffeinated/espresso" component={EspressoDrinks} />
      <Route path="/drinks/caffeinated/cold-brew" component={ColdBrewDrinks} />
      <Route path="/drinks/caffeinated/tea" component={TeaDrinks} />
      <Route path="/drinks/caffeinated/matcha" component={MatchaDrinks} />
      <Route path="/drinks/caffeinated/energy" component={EnergyDrinks} />
      <Route path="/drinks/caffeinated/specialty" component={SpecialtyCoffee} />
      <Route path="/drinks/caffeinated/lattes" component={LattesDrinks} />
      <Route path="/drinks/caffeinated/iced" component={IcedCoffeeDrinks} />
      <Route path="/drinks/caffeinated" component={CaffeinatedDrinksHub} />
      <Route>
        <Redirect to="/drinks/caffeinated" />
      </Route>
    </Switch>
  );
}

function SmoothiesSection() {
  return (
    <Switch>
      <Route path="/drinks/smoothies/breakfast" component={BreakfastSmoothies} />
      <Route path="/drinks/smoothies/dessert" component={DessertSmoothies} />
      <Route path="/drinks/smoothies/green" component={GreenSmoothies} />
      <Route path="/drinks/smoothies/protein" component={ProteinSmoothies} />
      <Route path="/drinks/smoothies/workout" component={WorkoutSmoothies} />
      <Route path="/drinks/smoothies/tropical" component={TropicalSmoothies} />
      <Route path="/drinks/smoothies/berry" component={BerrySmoothies} />
      <Route path="/drinks/smoothies/detox" component={DetoxSmoothies} />
      <Route path="/drinks/smoothies" component={SmoothiesHub} />
      <Route>
        <Redirect to="/drinks/smoothies" />
      </Route>
    </Switch>
  );
}

function ProteinShakesSection() {
  return (
    <Switch>
      <Route path="/drinks/protein-shakes/casein" component={CaseinProtein} />
      <Route path="/drinks/protein-shakes/collagen" component={CollagenProtein} />
      <Route path="/drinks/protein-shakes/plant-based" component={PlantBasedProtein} />
      <Route path="/drinks/protein-shakes/whey" component={WheyProtein} />
      <Route path="/drinks/protein-shakes/egg" component={EggProtein} />
      <Route path="/drinks/protein-shakes/beef" component={BeefProtein} />
      <Route path="/drinks/protein-shakes" component={ProteinShakesHub} />
      <Route>
        <Redirect to="/drinks/protein-shakes" />
      </Route>
    </Switch>
  );
}

function DetoxesSection() {
  return (
    <Switch>
      <Route path="/drinks/detoxes/juice" component={DetoxJuices} />
      <Route path="/drinks/detoxes/tea" component={DetoxTeas} />
      <Route path="/drinks/detoxes/water" component={DetoxWaters} />
      <Route path="/drinks/detoxes" component={DetoxesHub} />
      <Route>
        <Redirect to="/drinks/detoxes" />
      </Route>
    </Switch>
  );
}

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
        <Route path="/drinks/drops" component={DrinkDropsPage} />
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

        <Route path="/drinks/caffeinated">{() => <CaffeinatedSection />}</Route>
        <Route path="/drinks/caffeinated/:subcategory">{() => <CaffeinatedSection />}</Route>

        <Route path="/drinks/smoothies">{() => <SmoothiesSection />}</Route>
        <Route path="/drinks/smoothies/:subcategory">{() => <SmoothiesSection />}</Route>

        <Route path="/drinks/protein-shakes">{() => <ProteinShakesSection />}</Route>
        <Route path="/drinks/protein-shakes/:subcategory">{() => <ProteinShakesSection />}</Route>

        <Route path="/drinks/detoxes">{() => <DetoxesSection />}</Route>
        <Route path="/drinks/detoxes/:subcategory">{() => <DetoxesSection />}</Route>

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
