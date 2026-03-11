// client/src/App.tsx
import * as React from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@/lib/queryClient";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/layout";

import { UserProvider } from "@/contexts/UserContext";

// Other Pages
import { RecipesFiltersProvider } from "@/pages/recipes/useRecipesFilters";

// Utilities
import ErrorBoundary from "@/components/ErrorBoundary";
import DebugConsole, { shouldShowDebugConsole } from "@/components/DebugConsole";

const Signup = React.lazy(() => import("@/pages/auth/signup"));
const Login = React.lazy(() => import("@/pages/auth/login"));
const VerifyEmailPage = React.lazy(() => import("@/pages/auth/verify-email"));
const VerifySuccessPage = React.lazy(() => import("@/pages/auth/verify-success"));
const Feed = React.lazy(() => import("@/pages/social/feed"));
const Profile = React.lazy(() => import("@/pages/social/profile"));
const CreatePost = React.lazy(() => import("@/pages/social/create-post"));
const ReviewsPage = React.lazy(() => import("@/pages/social/reviews"));
const CookTogetherPage = React.lazy(() => import("@/pages/social/cook-together"));
const DuetsPage = React.lazy(() => import("@/pages/social/duets"));
const EventsPage = React.lazy(() => import("@/pages/social/events"));
const DMInboxPage = React.lazy(() => import("@/pages/dm/InboxPage"));
const DMThreadPage = React.lazy(() => import("@/pages/dm/ThreadPage"));
const ExplorePage = React.lazy(() => import("@/pages/explore/ExplorePage"));
const Pantry = React.lazy(() => import("@/pages/pantry"));
const RecipeMatches = React.lazy(() => import("@/pages/pantry/recipe-matches"));
const HouseholdPantry = React.lazy(() => import("@/pages/pantry/household"));
const PantryScanner = React.lazy(() => import("@/pages/pantry/scanner"));
const ShoppingListPage = React.lazy(() => import("@/pages/pantry/shopping-list"));
const AllergiesDashboard = React.lazy(() => import("@/pages/allergies"));
const NutritionPage = React.lazy(() => import("@/pages/nutrition"));
const MealPlanCreator = React.lazy(() => import("@/pages/nutrition/MealPlanCreator"));
const MealPlanMarketplace = React.lazy(() => import("@/pages/nutrition/MealPlanMarketplace"));
const CreatorAnalytics = React.lazy(() => import("@/pages/nutrition/CreatorAnalytics"));
const MealPlanDetailsPage = React.lazy(() => import("@/pages/nutrition/MealPlanDetailsPage"));
const MyPurchasesPage = React.lazy(() => import("@/pages/nutrition/MyPurchasesPage"));
const AnalyticsPage = React.lazy(() => import("@/pages/analytics/AnalyticsPage"));
const CateringMarketplace = React.lazy(() => import("@/pages/services/catering"));
const WeddingPlanning = React.lazy(() => import("@/pages/services/wedding-planning"));
const WeddingPlanningBudgetPage = React.lazy(() => import("@/pages/services/wedding-planning/budget"));
const WeddingPlanningCalendarPage = React.lazy(() => import("@/pages/services/wedding-planning/calendar"));
const WeddingPlanningChecklistPage = React.lazy(() => import("@/pages/services/wedding-planning/checklist"));
const WeddingPlanningInvitationsPage = React.lazy(() => import("@/pages/services/wedding-planning/invitations"));
const WeddingPlanningRegistryPage = React.lazy(() => import("@/pages/services/wedding-planning/registry"));
const WeddingPlanningVendorsPage = React.lazy(() => import("@/pages/services/wedding-planning/vendors"));
const WeddingVendorMap = React.lazy(() => import("@/pages/services/wedding-map"));
const PublicRegistryPage = React.lazy(() => import("@/pages/services/public-registry"));
const VendorListingPage = React.lazy(() => import("@/pages/services/vendor-listing"));
const Marketplace = React.lazy(() => import("@/pages/store/Marketplace"));
const StoreViewer = React.lazy(() => import("@/pages/store/StoreViewer"));
const StoreDashboard = React.lazy(() => import("@/pages/store/StoreDashboard"));
const SellerDashboard = React.lazy(() => import("@/pages/store/SellerDashboard"));
const StoreCreatePage = React.lazy(() => import("@/pages/store/StoreCreatePage"));
const ProductFormPage = React.lazy(() => import("@/pages/store/ProductFormPage"));
const CheckoutPage = React.lazy(() => import("@/pages/checkout/CheckoutPage"));
const ProductPage = React.lazy(() => import("@/pages/marketplace/ProductPage"));
const CreateCompetitionPage = React.lazy(() => import("@/pages/competitions/CreateCompetitionPage"));
const CompetitionRoomPage = React.lazy(() => import("@/pages/competitions/CompetitionRoomPage"));
const CompetitionLibraryPage = React.lazy(() => import("@/pages/competitions/CompetitionLibraryPage"));
const PetFoodHub = React.lazy(() => import("@/pages/pet-food"));
const DogsPage = React.lazy(() => import("@/pages/pet-food/dogs"));
const CatsPage = React.lazy(() => import("@/pages/pet-food/cats"));
const BirdsPage = React.lazy(() => import("@/pages/pet-food/birds"));
const SmallPetsPage = React.lazy(() => import("@/pages/pet-food/small-pets"));
const RecipesListPage = React.lazy(() => import("@/pages/recipes/RecipesListPage"));
const RecipesFiltersPage = React.lazy(() => import("@/pages/recipes/RecipesFiltersPage"));
const ImportPaprikaPage = React.lazy(() => import("@/pages/ImportPaprikaPage"));
const BabyFoodHub = React.lazy(() => import("@/pages/recipes/baby-food"));
const BabyFoodPurees = React.lazy(() => import("@/pages/recipes/baby-food/purees"));
const BabyFoodMashed = React.lazy(() => import("@/pages/recipes/baby-food/mashed"));
const BabyFoodFingerFoods = React.lazy(() => import("@/pages/recipes/baby-food/finger-foods"));
const BabyFoodToddler = React.lazy(() => import("@/pages/recipes/baby-food/toddler"));
const ClubsPage = React.lazy(() => import("@/pages/clubs"));
const ClubDetailPage = React.lazy(() => import("@/pages/clubs/[id]"));
const SubstitutionsPage = React.lazy(() => import("@/pages/substitutions/SubstitutionsPage"));
const Settings = React.lazy(() => import("@/pages/settings"));
const BiteMapPage = React.lazy(() => import("@/pages/bitemap/index.tsx"));
const LeaderboardPage = React.lazy(() => import("@/pages/leaderboard/LeaderboardPage"));
const QuestsPage = React.lazy(() => import("@/pages/QuestsPage"));
const RemixesPage = React.lazy(() => import("@/pages/RemixesPage"));
const SuggestionsPage = React.lazy(() => import("@/pages/SuggestionsPage"));
const NotFound = React.lazy(() => import("@/pages/not-found"));

const DrinksRoutes = React.lazy(() => import("@/pages/drinks/DrinksRoutes"));

function DrinksRoutesFallback() {
  return <div className="p-4 text-sm text-muted-foreground">Loading drink recipes...</div>;
}

function AppRouteFallback() {
  return <div className="p-4 text-sm text-muted-foreground">Loading page...</div>;
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
              <React.Suspense fallback={<AppRouteFallback />}>
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
              </React.Suspense>
            </ErrorBoundary>
            <Toaster />
            {shouldShowDebugConsole() && <DebugConsole />}
          </Layout>
        </UserProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
