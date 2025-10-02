// client/src/App.tsx
import * as React from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@/lib/query-client";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/layout";
import RequireAgeGate from "@/components/RequireAgeGate";

import { DrinksProvider } from "@/contexts/DrinksContext";

// Pages (existing)
import Feed from "@/pages/feed";
import ExplorePage from "@/pages/explore/ExplorePage";
import RecipesListPage from "@/pages/recipes/RecipesListPage";
import RecipesFiltersPage from "@/pages/recipes/RecipesFiltersPage";
import { RecipesFiltersProvider } from "@/pages/recipes/useRecipesFilters";
import Profile from "@/pages/profile";
import CreatePost from "@/pages/create-post";
import Pantry from "@/components/Pantry";
import Marketplace from "@/components/Marketplace";
import NutritionMealPlanner from "@/components/NutritionMealPlanner";
import CateringMarketplace from "@/pages/catering";
import WeddingPlanning from "@/pages/wedding-planning";
import NotFound from "@/pages/not-found";
import SubstitutionsPage from "@/pages/substitutions/SubstitutionsPage";

// ========== DRINKS HUB PAGES ==========
import DrinksHubPage from "@/pages/drinks";
import SmoothiesHub from "@/pages/drinks/smoothies";
import ProteinShakesHub from "@/pages/drinks/protein-shakes";
import DetoxesHub from "@/pages/drinks/detoxes";
import PotentPotablesHub from "@/pages/drinks/potent-potables";

// ========== SMOOTHIES SUBCATEGORY PAGES ==========
import BreakfastSmoothies from "@/pages/drinks/smoothies/breakfast";
import DessertSmoothies from "@/pages/drinks/smoothies/dessert";
import GreenSmoothies from "@/pages/drinks/smoothies/green";
import ProteinSmoothies from "@/pages/drinks/smoothies/protein";
import WorkoutSmoothies from "@/pages/drinks/smoothies/workout";

// ========== PROTEIN SHAKES SUBCATEGORY PAGES ==========
import CaseinProtein from "@/pages/drinks/protein-shakes/casein";
import CollagenProtein from "@/pages/drinks/protein-shakes/collagen";
import PlantBasedProtein from "@/pages/drinks/protein-shakes/plant-based";
import WheyProtein from "@/pages/drinks/protein-shakes/whey";

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
import VirginCocktailsPage from "@/pages/drinks/potent-potables/virgin-cocktails";
import VodkaPage from "@/pages/drinks/potent-potables/vodka";
import WhiskeyBourbonPage from "@/pages/drinks/potent-potables/whiskey-bourbon";

// Utilities
import ErrorBoundary from "@/components/ErrorBoundary";
import DebugConsole, { shouldShowDebugConsole } from "@/components/DebugConsole";

function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  React.useEffect(() => setLocation(to), [to, setLocation]);
  return null;
}

function RecipesSection() {
  return (
    <RecipesFiltersProvider>
      <Switch>
        <Route path="/recipes/filters" component={RecipesFiltersPage} />
        <Route path="/recipes" component={RecipesListPage} />
      </Switch>
    </RecipesFiltersProvider>
  );
}

function PotentPotablesSection() {
  return (
    <RequireAgeGate>
      <Switch>
        {/* ✅ FIXED: Specific routes first */}
        <Route path="/drinks/potent-potables/cocktails" component={CocktailsPage} />
        <Route path="/drinks/potent-potables/cognac-brandy" component={CognacBrandyPage} />
        <Route path="/drinks/potent-potables/martinis" component={MartinisPage} />
        <Route path="/drinks/potent-potables/mocktails" component={MocktailsPage} />
        <Route path="/drinks/potent-potables/rum" component={RumPage} />
        <Route path="/drinks/potent-potables/scotch-irish-whiskey" component={ScotchIrishWhiskeyPage} />
        <Route path="/drinks/potent-potables/seasonal" component={SeasonalPage} />
        <Route path="/drinks/potent-potables/tequila-mezcal" component={TequilaMezcalPage} />
        <Route path="/drinks/potent-potables/virgin-cocktails" component={VirginCocktailsPage} />
        <Route path="/drinks/potent-potables/vodka" component={VodkaPage} />
        <Route path="/drinks/potent-potables/whiskey-bourbon" component={WhiskeyBourbonPage} />
        {/* ✅ FIXED: Hub last */}
        <Route path="/drinks/potent-potables" component={PotentPotablesHub} />
      </Switch>
    </RequireAgeGate>
  );
}

function DrinksSection() {
  return (
    <Switch>
      {/* ========== SMOOTHIES ROUTES ========== */}
      <Route path="/drinks/smoothies/breakfast" component={BreakfastSmoothies} />
      <Route path="/drinks/smoothies/dessert" component={DessertSmoothies} />
      <Route path="/drinks/smoothies/green" component={GreenSmoothies} />
      <Route path="/drinks/smoothies/protein" component={ProteinSmoothies} />
      <Route path="/drinks/smoothies/workout" component={WorkoutSmoothies} />
      <Route path="/drinks/smoothies" component={SmoothiesHub} />

      {/* ========== PROTEIN SHAKES ROUTES ========== */}
      <Route path="/drinks/protein-shakes/casein" component={CaseinProtein} />
      <Route path="/drinks/protein-shakes/collagen" component={CollagenProtein} />
      <Route path="/drinks/protein-shakes/plant-based" component={PlantBasedProtein} />
      <Route path="/drinks/protein-shakes/whey" component={WheyProtein} />
      <Route path="/drinks/protein-shakes" component={ProteinShakesHub} />

      {/* ========== DETOXES ROUTES ========== */}
      {/* ✅ FIXED: Subpages BEFORE hub */}
      <Route path="/drinks/detoxes/juice" component={DetoxJuices} />
      <Route path="/drinks/detoxes/tea" component={DetoxTeas} />
      <Route path="/drinks/detoxes/water" component={DetoxWaters} />
      <Route path="/drinks/detoxes" component={DetoxesHub} />

      {/* ========== POTENT POTABLES ROUTES (AGE-GATED) ========== */}
      {/* ❌ REMOVED: This catch-all was intercepting all potent-potables routes */}
      {/* <Route path="/drinks/potent-potables/:rest*" component={PotentPotablesSection} /> */}
      
      {/* ✅ ADDED: Explicit potent-potables route */}
      <Route path="/drinks/potent-potables">
        <PotentPotablesSection />
      </Route>

      {/* ========== MAIN DRINKS HUB ========== */}
      <Route path="/drinks" component={DrinksHubPage} />
    </Switch>
  );
}

function Router() {
  return (
    <Layout>
      {shouldShowDebugConsole() && <DebugConsole />}

      <Switch>
        {/* Most specific routes first */}
        <Route path="/profile/:userId?" component={Profile} />

        {/* Main navigation routes */}
        <Route path="/" component={Feed} />
        <Route path="/feed" component={Feed} />

        {/* Explore */}
        <Route path="/explore" component={ExplorePage} />

        {/* Recipes routes */}
        <Route path="/recipes/:rest*" component={RecipesSection} />
        <Route path="/recipes" component={RecipesSection} />

        {/* Backward-compat */}
        <Route path="/explore/filters">
          <Redirect to="/recipes/filters" />
        </Route>

        <Route path="/create" component={CreatePost} />

        {/* Feature routes */}
        <Route path="/pantry">
          <ErrorBoundary>
            <Pantry />
          </ErrorBoundary>
        </Route>

        {/* Store alias */}
        <Route path="/store" component={Marketplace} />

        {/* Others */}
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/catering" component={CateringMarketplace} />
        <Route path="/catering/wedding-planning" component={WeddingPlanning} />

        {/* Backward compatibility */}
        <Route path="/potent-potables">
          <Redirect to="/drinks/potent-potables" />
        </Route>

        <Route path="/nutrition" component={NutritionMealPlanner} />

        {/* Substitutions */}
        <Route path="/substitutions" component={SubstitutionsPage} />

        {/* DRINKS TREE - ALL ROUTES */}
        {/* ✅ FIXED: Removed the problematic catch-all */}
        <Route path="/drinks/:rest*">
          {(params) => {
            // This allows proper nested routing within drinks
            return <DrinksSection />;
          }}
        </Route>
        <Route path="/drinks" component={DrinksSection} />

        {/* Placeholder routes */}
        <Route path="/saved" component={NotFound} />
        <Route path="/following" component={NotFound} />
        <Route path="/settings" component={NotFound} />

        {/* Catch-all route - must be last */}
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DrinksProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </DrinksProvider>
    </QueryClientProvider>
  );
}
