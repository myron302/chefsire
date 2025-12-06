import * as React from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@/lib/queryClient";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/layout";
import RequireAgeGate from "@/components/RequireAgeGate";

import { DrinksProvider } from "@/contexts/DrinksContext";
import { UserProvider } from "@/contexts/UserContext";

// Auth Pages
import Signup from "@/pages/auth/signup";
import Login from "@/pages/auth/login";
import VerifyEmailPage from "@/pages/auth/verify-email";
import VerifySuccessPage from "@/pages/auth/verify-success";

// Social Pages
import Feed from "@/pages/social/feed";
import Profile from "@/pages/social/profile";
import CreatePost from "@/pages/social/create-post";

// 🔔 DMs (NEW)
import DMInboxPage from "@/pages/dm/InboxPage";
import DMThreadPage from "@/pages/dm/ThreadPage";

// Service Pages
import CateringMarketplace from "@/pages/services/catering";
import WeddingPlanning from "@/pages/services/wedding-planning";
import WeddingVendorMap from "@/pages/services/wedding-map";

// Other Pages
import ExplorePage from "@/pages/explore/ExplorePage";
import RecipesListPage from "@/pages/recipes/RecipesListPage";
import RecipesFiltersPage from "@/pages/recipes/RecipesFiltersPage";
import { RecipesFiltersProvider } from "@/pages/recipes/useRecipesFilters";
import Pantry from "@/pages/pantry";
import RecipeMatches from "@/pages/pantry/recipe-matches";
import HouseholdPantry from "@/pages/pantry/household";
import AllergiesDashboard from "@/pages/allergies";
import NutritionMealPlanner from "@/components/NutritionMealPlanner";
import MealPlanCreator from "@/pages/nutrition/MealPlanCreator";
import MealPlanMarketplace from "@/pages/nutrition/MealPlanMarketplace";
import CreatorAnalytics from "@/pages/nutrition/CreatorAnalytics";
import ClubsPage from "@/pages/clubs";
import ClubDetailPage from "@/pages/clubs/[id]";
import NotFound from "@/pages/not-found";
import SubstitutionsPage from "@/pages/substitutions/SubstitutionsPage";

// Store pages - ALL IN pages/store/
import Marketplace from "@/pages/store/Marketplace";
import StoreViewer from "@/pages/store/StoreViewer";
import StoreDashboard from "@/pages/store/StoreDashboard";
import SellerDashboard from "@/pages/store/SellerDashboard";
import StoreCreatePage from "@/pages/store/StoreCreatePage";
import ProductFormPage from "@/pages/store/ProductFormPage";

// Checkout & Products
import CheckoutPage from "@/pages/checkout/CheckoutPage";
import ProductPage from "@/pages/marketplace/ProductPage";

// Settings page
import Settings from "@/pages/settings";

// BiteMap page
import BiteMapPage from "@/pages/bitemap/index.tsx";

// ========== BABY FOOD PAGES ==========
import BabyFoodHub from "@/pages/recipes/baby-food";
import BabyFoodPurees from "@/pages/recipes/baby-food/purees";
import BabyFoodMashed from "@/pages/recipes/baby-food/mashed";
import BabyFoodFingerFoods from "@/pages/recipes/baby-food/finger-foods";
import BabyFoodToddler from "@/pages/recipes/baby-food/toddler";

// ========== DRINKS HUB PAGES ==========
import DrinksHubPage from "@/pages/drinks";
import SmoothiesHub from "@/pages/drinks/smoothies";
import ProteinShakesHub from "@/pages/drinks/protein-shakes";
import DetoxesHub from "@/pages/drinks/detoxes";
import PotentPotablesHub from "@/pages/drinks/potent-potables";
import CaffeinatedDrinksHub from "@/pages/drinks/caffeinated";

// ========== CAFFEINATED DRINKS SUBCATEGORY PAGES ==========
import EspressoDrinks from "@/pages/drinks/caffeinated/espresso";
import ColdBrewDrinks from "@/pages/drinks/caffeinated/cold-brew";
import TeaDrinks from "@/pages/drinks/caffeinated/tea";
import MatchaDrinks from "@/pages/drinks/caffeinated/matcha";
import EnergyDrinks from "@/pages/drinks/caffeinated/energy";
import SpecialtyCoffee from "@/pages/drinks/caffeinated/specialty";
import LattesDrinks from "@/pages/drinks/caffeinated/lattes";
import IcedCoffeeDrinks from "@/pages/drinks/caffeinated/iced";

// ========== SMOOTHIES SUBCATEGORY PAGES ==========
import BreakfastSmoothies from "@/pages/drinks/smoothies/breakfast";
import DessertSmoothies from "@/pages/drinks/smoothies/dessert";
import GreenSmoothies from "@/pages/drinks/smoothies/green";
import ProteinSmoothies from "@/pages/drinks/smoothies/protein";
import WorkoutSmoothies from "@/pages/drinks/smoothies/workout";
import TropicalSmoothies from "@/pages/drinks/smoothies/tropical";
import BerrySmoothies from "@/pages/drinks/smoothies/berry";
import DetoxSmoothies from "@/pages/drinks/smoothies/detox";

// ========== PROTEIN SHAKES SUBCATEGORY PAGES ==========
import CaseinProtein from "@/pages/drinks/protein-shakes/casein";
import CollagenProtein from "@/pages/drinks/protein-shakes/collagen";
import PlantBasedProtein from "@/pages/drinks/protein-shakes/plant-based";
import WheyProtein from "@/pages/drinks/protein-shakes/whey";
import EggProtein from "@/pages/drinks/protein-shakes/egg";
import BeefProtein from "@/pages/drinks/protein-shakes/beef";

// ========== DETOXES SUBCATEGORY PAGES ==========
import DetoxJuices from "@/pages/drinks/detoxes/juice";
import DetoxTeas from "@/pages/drinks/detoxes/tea";
import DetoxWaters from "@/pages/drinks/detoxes/water";

// ========== POTENT POTABLES SUBCATEGORY PAGES ==========
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

// ========== PET FOOD PAGES ==========
import PetFoodHub from "@/pages/pet-food";
import DogsPage from "@/pages/pet-food/dogs";
import CatsPage from "@/pages/pet-food/cats";
import BirdsPage from "@/pages/pet-food/birds";
import SmallPetsPage from "@/pages/pet-food/small-pets";

// Utilities
import ErrorBoundary from "@/components/ErrorBoundary";
import DebugConsole, { shouldShowDebugConsole } from "@/components/DebugConsole";

// Competitions
import CreateCompetitionPage from "@/pages/competitions/CreateCompetitionPage";
import CompetitionRoomPage from "@/pages/competitions/CompetitionRoomPage";
import CompetitionLibraryPage from "@/pages/competitions/CompetitionLibraryPage";

// Leaderboards
import LeaderboardPage from "@/pages/leaderboard/LeaderboardPage";

// ⚡ Phase 1: Daily Addiction Features
import QuestsPage from "@/pages/QuestsPage";
import RemixesPage from "@/pages/RemixesPage";
import SuggestionsPage from "@/pages/SuggestionsPage";

// ⚡ Phase 2: Social Explosion Features
import CookTogetherPage from "@/pages/social/cook-together";
import DuetsPage from "@/pages/social/duets";
import EventsPage from "@/pages/social/events";

// 📊 Phase 3: Power User Features
import AnalyticsPage from "@/pages/analytics/AnalyticsPage";

function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  React.useEffect(() => setLocation(to), [to, setLocation]);
  return null;
}

function RecipesSection() {
  return (
    <RecipesFiltersProvider>
      <Switch>
        <Route path="/recipes/baby-food/purees" component={BabyFoodPurees} />
        <Route path="/recipes/baby-food/mashed" component={BabyFoodMashed} />
        <Route path="/recipes/baby-food/finger-foods" component={BabyFoodFingerFoods} />
        <Route path="/recipes/baby-food/toddler" component={BabyFoodToddler} />
        <Route path="/recipes/baby-food" component={BabyFoodHub} />
        <Route path="/recipes/filters" component={RecipesFiltersPage} />
        <Route path="/recipes" component={RecipesListPage} />
        <Route>
          <Redirect to="/recipes" />
        </Route>
      </Switch>
    </RecipesFiltersProvider>
  );
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
        <Route path="/drinks/potent-potables" component={PotentPotablesHub} />
        <Route>
          <Redirect to="/drinks/potent-potables" />
        </Route>
      </Switch>
    </RequireAgeGate>
  );
}

function DrinksSection() {
  return (
    <Switch>
      {/* ---------- Smoothies ---------- */}
      <Route path="/drinks/smoothies/breakfast" component={BreakfastSmoothies} />
      <Route path="/drinks/smoothies/dessert" component={DessertSmoothies} />
      <Route path="/drinks/smoothies/green" component={GreenSmoothies} />
      <Route path="/drinks/smoothies/protein" component={ProteinSmoothies} />
      <Route path="/drinks/smoothies/workout" component={WorkoutSmoothies} />
      <Route path="/drinks/smoothies/tropical" component={TropicalSmoothies} />
      <Route path="/drinks/smoothies/berry" component={BerrySmoothies} />
      <Route path="/drinks/smoothies/detox" component={DetoxSmoothies} />
      <Route path="/drinks/smoothies" component={SmoothiesHub} />

      {/* ---------- Protein Shakes ---------- */}
      <Route path="/drinks/protein-shakes/casein" component={CaseinProtein} />
      <Route path="/drinks/protein-shakes/collagen" component={CollagenProtein} />
      <Route path="/drinks/protein-shakes/plant-based" component={PlantBasedProtein} />
      <Route path="/drinks/protein-shakes/whey" component={WheyProtein} />
      <Route path="/drinks/protein-shakes/egg" component={EggProtein} />
      <Route path="/drinks/protein-shakes/beef" component={BeefProtein} />
      <Route path="/drinks/protein-shakes" component={ProteinShakesHub} />

      {/* ---------- Detoxes ---------- */}
      <Route path="/drinks/detoxes/juice" component={DetoxJuices} />
      <Route path="/drinks/detoxes/tea" component={DetoxTeas} />
      <Route path="/drinks/detoxes/water" component={DetoxWaters} />
      <Route path="/drinks/detoxes" component={DetoxesHub} />

      {/* ---------- Caffeinated Drinks ---------- */}
      <Route path="/drinks/caffeinated/espresso" component={EspressoDrinks} />
      <Route path="/drinks/caffeinated/cold-brew" component={ColdBrewDrinks} />
      <Route path="/drinks/caffeinated/tea" component={TeaDrinks} />
      <Route path="/drinks/caffeinated/matcha" component={MatchaDrinks} />
      <Route path="/drinks/caffeinated/energy" component={EnergyDrinks} />
      <Route path="/drinks/caffeinated/specialty" component={SpecialtyCoffee} />
      <Route path="/drinks/caffeinated/lattes" component={LattesDrinks} />
      <Route path="/drinks/caffeinated/iced" component={IcedCoffeeDrinks} />
      <Route path="/drinks/caffeinated" component={CaffeinatedDrinksHub} />

      {/* ---------- Zero-proof (NOT age-gated) ---------- */}
      <Route path="/drinks/potent-potables/mocktails" component={MocktailsPage} />

      {/* ---------- Potent Potables (age-gated) ---------- */}
      <Route path="/drinks/potent-potables/:rest*">
        {() => <PotentPotablesSection />}
      </Route>
      <Route path="/drinks/potent-potables" component={PotentPotablesSection} />

      {/* ---------- Drinks hub fallback ---------- */}
      <Route path="/drinks" component={DrinksHubPage} />
      <Route>
        <Redirect to="/drinks" />
      </Route>
    </Switch>
  );
}

function PetFoodSection() {
  return (
    <Switch>
      <Route path="/pet-food/dogs" component={DogsPage} />
      <Route path="/pet-food/cats" component={CatsPage} />
      <Route path="/pet-food/birds" component={BirdsPage} />
      <Route path="/pet-food/small-pets" component={SmallPetsPage} />
      <Route path="/pet-food" component={PetFoodHub} />
      <Route>
        <Redirect to="/pet-food" />
      </Route>
    </Switch>
  );
}

function AppRouter() {
  return (
    <Layout>
      {shouldShowDebugConsole() && <DebugConsole />}

      <Switch>
        {/* Shortlinks (optional nice-to-have) */}
        <Route path="/daiquiri"><Redirect to="/drinks/potent-potables/daiquiri" /></Route>
        <Route path="/daquiri"><Redirect to="/drinks/potent-potables/daiquiri" /></Route>

        {/* Legacy redirects: Virgin → Mocktails */}
        <Route path="/drinks/potent-potables/virgin">
          <Redirect to="/drinks/potent-potables/mocktails" />
        </Route>
        <Route path="/drinks/potent-potables/virgin-cocktails">
          <Redirect to="/drinks/potent-potables/mocktails" />
        </Route>

        {/* Auth - ADDED VERIFY ROUTES */}
        <Route path="/signup" component={Signup} />
        <Route path="/login" component={Login} />
        <Route path="/verify-email" component={VerifyEmailPage} />
        <Route path="/verify/success" component={VerifySuccessPage} />

        <Route path="/profile/:userId?" component={Profile} />
        <Route path="/settings" component={Settings} />
        <Route path="/" component={Feed} />
        <Route path="/feed" component={Feed} />
        <Route path="/explore" component={ExplorePage} />

        {/* 🔔 DMs (NEW) */}
        <Route path="/messages" component={DMInboxPage} />
        <Route path="/messages/:threadId" component={DMThreadPage} />

        {/* BiteMap */}
        <Route path="/bitemap" component={BiteMapPage} />
        <Route path="/restaurants">
          <Redirect to="/bitemap" />
        </Route>

        {/* Competitions */}
        <Route path="/competitions/new" component={CreateCompetitionPage} />
        <Route path="/competitions/library" component={CompetitionLibraryPage} />
        <Route path="/competitions/:id" component={CompetitionRoomPage} />
        <Route path="/competitions" component={CompetitionLibraryPage} />

        {/* Leaderboards */}
        <Route path="/leaderboard" component={LeaderboardPage} />

        {/* ⚡ Phase 1: Daily Addiction Features */}
        <Route path="/quests" component={QuestsPage} />
        <Route path="/remixes" component={RemixesPage} />
        <Route path="/suggestions" component={SuggestionsPage} />

        {/* ⚡ Phase 2: Social Explosion Features */}
        <Route path="/cook-together" component={CookTogetherPage} />
        <Route path="/duets" component={DuetsPage} />
        <Route path="/events" component={EventsPage} />

        {/* 📊 Phase 3: Power User Features */}
        <Route path="/analytics" component={AnalyticsPage} />

        {/* Recipes */}
        <Route path="/recipes/baby-food/:rest*">
          {() => <RecipesSection />}
        </Route>
        <Route path="/recipes/filters" component={RecipesFiltersPage} />
        <Route path="/recipes/:rest*">
          {() => <RecipesSection />}
        </Route>
        <Route path="/recipes" component={RecipesSection} />
        <Route path="/explore/filters">
          <Redirect to="/recipes/filters" />
        </Route>

        {/* Misc */}
        <Route path="/create" component={CreatePost} />

        {/* Pantry Routes */}
        <Route path="/pantry/recipe-matches" component={RecipeMatches} />
        <Route path="/pantry/household" component={HouseholdPantry} />
        <Route path="/pantry">
          <ErrorBoundary>
            <Pantry />
          </ErrorBoundary>
        </Route>

        {/* Allergies Routes */}
        <Route path="/allergies" component={AllergiesDashboard} />

        {/* Clubs Routes */}
        <Route path="/clubs/:id" component={ClubDetailPage} />
        <Route path="/clubs" component={ClubsPage} />

        {/* Marketplace & Store Routes */}
        <Route path="/checkout" component={CheckoutPage} />
        <Route path="/marketplace/product/:id" component={ProductPage} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/store/create" component={StoreCreatePage} />
        <Route path="/store/setup" component={StoreCreatePage} />
        <Route path="/store/products/new" component={ProductFormPage} />
        <Route path="/store/products/edit/:id" component={ProductFormPage} />
        <Route path="/store/dashboard" component={StoreDashboard} />
        <Route path="/store/settings" component={SellerDashboard} />
        <Route path="/store/:username" component={StoreViewer} />
        <Route path="/store" component={Marketplace} />

        <Route path="/catering" component={CateringMarketplace} />
        <Route path="/catering/wedding-planning" component={WeddingPlanning} />
        <Route path="/catering/wedding-map" component={WeddingVendorMap} />
        <Route path="/potent-potables">
          <Redirect to="/drinks/potent-potables" />
        </Route>

        {/* Nutrition & Meal Planning Routes */}
        <Route path="/nutrition/meal-plans/create" component={MealPlanCreator} />
        <Route path="/nutrition/meal-plans" component={MealPlanCreator} />
        <Route path="/nutrition/marketplace" component={MealPlanMarketplace} />
        <Route path="/nutrition/analytics" component={CreatorAnalytics} />
        <Route path="/nutrition" component={NutritionMealPlanner} />

        <Route path="/substitutions" component={SubstitutionsPage} />

        {/* Drinks branches */}
        <Route path="/drinks/smoothies/:rest*">
          {() => <DrinksSection />}
        </Route>
        <Route path="/drinks/protein-shakes/:rest*">
          {() => <DrinksSection />}
        </Route>
        <Route path="/drinks/detoxes/:rest*">
          {() => <DrinksSection />}
        </Route>
        <Route path="/drinks/caffeinated/:rest*">
          {() => <DrinksSection />}
        </Route>
        <Route path="/drinks/potent-potables/:rest*">
          {() => <DrinksSection />}
        </Route>
        <Route path="/drinks/:rest*">
          {() => <DrinksSection />}
        </Route>
        <Route path="/drinks" component={DrinksSection} />

        {/* Pet Food branches */}
        <Route path="/pet-food/:rest*">
          {() => <PetFoodSection />}
        </Route>
        <Route path="/pet-food" component={PetFoodSection} />

        {/* 404 fallback */}
        <Route path="/saved" component={NotFound} />
        <Route path="/following" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <DrinksProvider>
          <TooltipProvider>
            <Toaster />
            <AppRouter />
          </TooltipProvider>
        </DrinksProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}
