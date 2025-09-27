// client/src/App.tsx
import * as React from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";

// ✅ keep using your existing client
import { queryClient } from "@/lib/query-client";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/layout";
import RequireAgeGate from "@/components/RequireAgeGate";

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
import PotentPotables from "@/pages/potent-potables"; // /drinks/potent-potables subtree
import WeddingPlanning from "@/pages/wedding-planning";
import NotFound from "@/pages/not-found";
import SubstitutionsPage from "@/pages/substitutions/SubstitutionsPage";

// NEW: hook up real Drinks section pages
import SmoothiesPage from "@/pages/drinks/smoothies";
import ProteinShakesPage from "@/pages/drinks/protein-shakes";
import DetoxesPage from "@/pages/drinks/detoxes";
import DrinksHubPage from "@/pages/drinks"; // ✅ ADDED: Your interactive hub page

// Utilities
import ErrorBoundary from "@/components/ErrorBoundary";
import DebugConsole, { shouldShowDebugConsole } from "@/components/DebugConsole";

/** Simple redirect helper for Wouter */
function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  React.useEffect(() => setLocation(to), [to, setLocation]);
  return null;
}

/** Wrap ALL /recipes* routes under ONE provider */
function RecipesSection() {
  return (
    <RecipesFiltersProvider>
      <Switch>
        {/* Put the more specific path FIRST so it matches before /recipes */}
        <Route path="/recipes/filters" component={RecipesFiltersPage} />
        <Route path="/recipes" component={RecipesListPage} />
        {/* Add future /recipes/... pages here to inherit the provider */}
      </Switch>
    </RecipesFiltersProvider>
  );
}

/** Potent Potables wrapper (21+ gate) */
function PotentPotablesSection() {
  // Any path under /drinks/potent-potables/* is age-gated
  return (
    <RequireAgeGate>
      <PotentPotables />
    </RequireAgeGate>
  );
}

/** Group all /drinks routes here */
function DrinksSection() {
  return (
    <Switch>
      {/* ✅ UPDATED: Now using your interactive hub instead of basic landing */}
      <Route path="/drinks" component={DrinksHubPage} />

      {/* Smoothies */}
      <Route path="/drinks/smoothies/:type" component={SmoothiesPage} />
      <Route path="/drinks/smoothies" component={SmoothiesPage} />

      {/* Protein Shakes */}
      <Route path="/drinks/protein-shakes/:type" component={ProteinShakesPage} />
      <Route path="/drinks/protein-shakes" component={ProteinShakesPage} />

      {/* Detoxes & Cleanses */}
      <Route path="/drinks/detoxes/:type" component={DetoxesPage} />
      <Route path="/drinks/detoxes" component={DetoxesPage} />

      {/* Potent Potables (21+) — entire subtree gated */}
      <Route path="/drinks/potent-potables/:rest*" component={PotentPotablesSection} />
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

        {/* Explore (no recipes filters context needed) */}
        <Route path="/explore" component={ExplorePage} />

        {/* ✅ All recipes routes live under one provider */}
        <Route path="/recipes/:rest*" component={RecipesSection} />
        <Route path="/recipes" component={RecipesSection} />

        {/* Backward-compat (old explore/filters -> recipes/filters) */}
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

        {/* Store alias so header link "/store" works */}
        <Route path="/store" component={Marketplace} />

        {/* Others */}
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/catering" component={CateringMarketplace} />
        <Route path="/catering/wedding-planning" component={WeddingPlanning} />

        {/* Old standalone route kept for compatibility */}
        <Route path="/potent-potables" component={PotentPotablesSection} />

        <Route path="/nutrition" component={NutritionMealPlanner} />

        {/* NEW: Substitutions UI */}
        <Route path="/substitutions" component={SubstitutionsPage} />

        {/* ✅ NEW: Drinks tree with your interactive hub */}
        <Route path="/drinks/:rest*" component={DrinksSection} />
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
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
