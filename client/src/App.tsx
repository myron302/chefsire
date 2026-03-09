// client/src/App.tsx
import * as React from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@/lib/queryClient";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/layout";

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
import ReviewsPage from "@/pages/social/reviews";

// 🔔 DMs (NEW)
import DMInboxPage from "@/pages/dm/InboxPage";
import DMThreadPage from "@/pages/dm/ThreadPage";

// Service Pages
import CateringMarketplace from "@/pages/services/catering";
import WeddingPlanning from "@/pages/services/wedding-planning";
import WeddingPlanningBudgetPage from "@/pages/services/wedding-planning/budget";
import WeddingPlanningCalendarPage from "@/pages/services/wedding-planning/calendar";
import WeddingPlanningChecklistPage from "@/pages/services/wedding-planning/checklist";
import WeddingPlanningInvitationsPage from "@/pages/services/wedding-planning/invitations";
import WeddingPlanningRegistryPage from "@/pages/services/wedding-planning/registry";
import WeddingPlanningVendorsPage from "@/pages/services/wedding-planning/vendors";
import WeddingVendorMap from "@/pages/services/wedding-map";
import PublicRegistryPage from "@/pages/services/public-registry";
import VendorListingPage from "@/pages/services/vendor-listing";

// Other Pages
import ExplorePage from "@/pages/explore/ExplorePage";
import RecipesListPage from "@/pages/recipes/RecipesListPage";
import RecipesFiltersPage from "@/pages/recipes/RecipesFiltersPage";
import { RecipesFiltersProvider } from "@/pages/recipes/useRecipesFilters";
import ImportPaprikaPage from "@/pages/ImportPaprikaPage";
import Pantry from "@/pages/pantry";
import RecipeMatches from "@/pages/pantry/recipe-matches";
import HouseholdPantry from "@/pages/pantry/household";
import PantryScanner from "@/pages/pantry/scanner";
import ShoppingListPage from "@/pages/pantry/shopping-list";
import AllergiesDashboard from "@/pages/allergies";
import NutritionPage from "@/pages/nutrition";
import MealPlanCreator from "@/pages/nutrition/MealPlanCreator";
import MealPlanMarketplace from "@/pages/nutrition/MealPlanMarketplace";
import CreatorAnalytics from "@/pages/nutrition/CreatorAnalytics";
import MealPlanDetailsPage from "@/pages/nutrition/MealPlanDetailsPage";
import MyPurchasesPage from "@/pages/nutrition/MyPurchasesPage";
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

const DrinksRoutes = React.lazy(() => import("@/pages/drinks/DrinksRoutes"));

function DrinksRoutesFallback() {
  return <div className="p-4 text-sm text-muted-foreground">Loading drink recipes...</div>;
}

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

        {/* Recipe Import Routes */}
        <Route path="/recipes/import-paprika" component={ImportPaprikaPage} />
        <Route path="/recipes/import-anylist" component={ImportPaprikaPage} />
        <Route path="/recipes/import-plan-to-eat" component={ImportPaprikaPage} />
        <Route path="/recipes/import-url" component={ImportPaprikaPage} />
        <Route path="/recipes/import" component={ImportPaprikaPage} />

        <Route path="/recipes" component={RecipesListPage} />
        <Route>
          <Redirect to="/recipes" />
        </Route>
      </Switch>
    </RecipesFiltersProvider>
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <UserProvider>
          <Layout>
            <ErrorBoundary>
              <Switch>
                {/* Shortlinks (optional nice-to-have) */}
                <Route path="/daiquiri">
                  <Redirect to="/drinks/potent-potables/daiquiri" />
                </Route>
                <Route path="/daquiri">
                  <Redirect to="/drinks/potent-potables/daiquiri" />
                </Route>

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

                {/* ⭐ Reviews (searchable) */}
                <Route path="/reviews" component={ReviewsPage} />

                {/* 📝 SOCIAL POSTING: Add new route for "Create Post" button fix */}
                <Route path="/post/new" component={CreatePost} />

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
                <Route path="/recipes/baby-food/:rest*">{() => <RecipesSection />}</Route>
                <Route path="/recipes/filters" component={RecipesFiltersPage} />
                <Route path="/recipes/:rest*">{() => <RecipesSection />}</Route>
                <Route path="/recipes" component={RecipesSection} />
                <Route path="/explore/filters">
                  <Redirect to="/recipes/filters" />
                </Route>

                {/* Misc */}
                <Route path="/create" component={CreatePost} />

                {/* Pantry Routes */}
                <Route path="/pantry/scanner" component={PantryScanner} />
                <Route path="/pantry/recipe-matches" component={RecipeMatches} />
                <Route path="/pantry/household" component={HouseholdPantry} />
                <Route path="/pantry/shopping-list" component={ShoppingListPage} />
                <Route path="/pantry" component={Pantry} />

                {/* Substitutions */}
                <Route path="/substitutions" component={SubstitutionsPage} />

                {/* Allergies Dashboard */}
                <Route path="/allergies" component={AllergiesDashboard} />

                {/* =========================================================
                    Meal Planner aliases (✅ fixes 404 for meal-planner + subs)
                   ========================================================= */}
                <Route path="/meal-planner">
                  <Redirect to="/nutrition" />
                </Route>
                <Route path="/meal-planner/create">
                  <Redirect to="/nutrition/create" />
                </Route>
                <Route path="/meal-planner/marketplace">
                  <Redirect to="/nutrition/marketplace" />
                </Route>
                <Route path="/meal-planner/analytics">
                  <Redirect to="/nutrition/analytics" />
                </Route>
                <Route path="/meal-planner/my-purchases">
                  <Redirect to="/nutrition/my-purchases" />
                </Route>
                <Route path="/meal-planner/meal-plans/:id">
                  {(params: any) => <Redirect to={`/nutrition/meal-plans/${params.id}`} />}
                </Route>
                <Route path="/meal-planner/meal-plans">
                  <Redirect to="/nutrition/marketplace" />
                </Route>

                {/* Nutrition (Meal Planner + Marketplace) */}
                <Route path="/nutrition/create" component={MealPlanCreator} />
                <Route path="/nutrition/marketplace" component={MealPlanMarketplace} />
                <Route path="/nutrition/analytics" component={CreatorAnalytics} />
                <Route path="/nutrition/my-purchases" component={MyPurchasesPage} />

                {/* Legacy Nutrition Paths (redirects) */}
                <Route path="/nutrition/meal-plans/create">
                  <Redirect to="/nutrition/create" />
                </Route>
                <Route path="/nutrition/meal-plans/marketplace">
                  <Redirect to="/nutrition/marketplace" />
                </Route>
                <Route path="/nutrition/creator-analytics">
                  <Redirect to="/nutrition/analytics" />
                </Route>
                <Route path="/nutrition/meal-planner">
                  <Redirect to="/nutrition" />
                </Route>

                {/* Meal Plan Details */}
                <Route path="/nutrition/meal-plans/:id" component={MealPlanDetailsPage} />

                <Route path="/nutrition/meal-plans">
                  <Redirect to="/nutrition/marketplace" />
                </Route>

                {/* Main Nutrition landing (Meal Planner) */}
                <Route path="/nutrition" component={NutritionPage} />

                {/* Services */}
                {/* Aliases used by nav/sidebar */}
                <Route path="/catering/wedding-planning">
                  <Redirect to="/services/wedding-planning" />
                </Route>
                <Route path="/catering/wedding-map">
                  <Redirect to="/services/wedding-map" />
                </Route>
                <Route path="/catering">
                  <Redirect to="/services/catering" />
                </Route>

                <Route path="/services/catering" component={CateringMarketplace} />
                <Route path="/services/wedding-planning" component={WeddingPlanning} />
                <Route path="/services/wedding-planning/checklist" component={WeddingPlanningChecklistPage} />
                <Route path="/services/wedding-planning/budget" component={WeddingPlanningBudgetPage} />
                <Route path="/services/wedding-planning/vendors" component={WeddingPlanningVendorsPage} />
                <Route path="/services/wedding-planning/registry" component={WeddingPlanningRegistryPage} />
                <Route path="/services/wedding-planning/calendar" component={WeddingPlanningCalendarPage} />
                <Route path="/services/wedding-planning/invitations" component={WeddingPlanningInvitationsPage} />
                <Route path="/services/wedding-budget"><Redirect to="/services/wedding-planning/budget" /></Route>
                <Route path="/services/wedding-vendors"><Redirect to="/services/wedding-planning/vendors" /></Route>
                <Route path="/services/wedding-registry"><Redirect to="/services/wedding-planning/registry" /></Route>
                <Route path="/services/wedding-calendar"><Redirect to="/services/wedding-planning/calendar" /></Route>
                <Route path="/services/wedding-guests"><Redirect to="/services/wedding-planning/invitations" /></Route>
                <Route path="/services/wedding-map" component={WeddingVendorMap} />
                <Route path="/services/public-registry" component={PublicRegistryPage} />
                <Route path="/services/vendor-listing" component={VendorListingPage} />

                {/* Store / Marketplace */}
                {/* Alias used by nav/sidebar */}
                <Route path="/marketplace">
                  <Redirect to="/store" />
                </Route>

                <Route path="/store" component={Marketplace} />
                <Route path="/store/create" component={StoreCreatePage} />
                <Route path="/store/dashboard" component={StoreDashboard} />
                {/* /store/seller redirects to consolidated dashboard via shim */}
                <Route path="/store/seller" component={SellerDashboard} />
                {/* Product form routes — must come before the :handle catch-all */}
                <Route path="/store/products/new" component={ProductFormPage} />
                <Route path="/store/products/edit/:id" component={ProductFormPage} />
                {/* Public store viewer */}
                <Route path="/store/:handle" component={StoreViewer} />

                {/* Checkout */}
                <Route path="/checkout" component={CheckoutPage} />
                <Route path="/product/:id" component={ProductPage} />

                {/* Clubs */}
                <Route path="/clubs/:id" component={ClubDetailPage} />
                <Route path="/clubs" component={ClubsPage} />

                {/* Drinks (explicit category + subcategory match BEFORE NotFound) */}
                <Route path="/drinks/:category/:subcategory">
                  {() => (
                    <React.Suspense fallback={<DrinksRoutesFallback />}>
                      <DrinksRoutes />
                    </React.Suspense>
                  )}
                </Route>
                <Route path="/drinks/:category">
                  {() => (
                    <React.Suspense fallback={<DrinksRoutesFallback />}>
                      <DrinksRoutes />
                    </React.Suspense>
                  )}
                </Route>
                <Route path="/drinks">
                  {() => (
                    <React.Suspense fallback={<DrinksRoutesFallback />}>
                      <DrinksRoutes />
                    </React.Suspense>
                  )}
                </Route>

                {/* Pet Food (explicit subcategory match) */}
                <Route path="/pet-food/:subcategory">{() => <PetFoodSection />}</Route>
                <Route path="/pet-food" component={PetFoodHub} />

                <Route component={NotFound} />
              </Switch>
            </ErrorBoundary>
            <Toaster />
            {shouldShowDebugConsole() && <DebugConsole />}
          </Layout>
        </UserProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
