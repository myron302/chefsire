// client/src/App.tsx
import * as React from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/layout";

// Pages
import Feed from "@/pages/feed";
import ExplorePage from "@/pages/explore/ExplorePage";

import RecipesListPage from "@/pages/recipes/RecipesListPage";
import RecipesFiltersPage from "@/pages/recipes/RecipesFiltersPage";
import { RecipesFiltersProvider } from "@/pages/recipes/useRecipesFilters";

import Profile from "@/pages/profile";
import CreatePost from "@/pages/create-post";
import Pantry from "@/components/Pantry";
import IngredientSubstitutions from "@/components/IngredientSubstitutions";
import Marketplace from "@/components/Marketplace";
import NutritionMealPlanner from "@/components/NutritionMealPlanner";
import CateringMarketplace from "@/pages/catering";
import PotentPotables from "@/pages/potent-potables";
import WeddingPlanning from "@/pages/wedding-planning";
import NotFound from "@/pages/not-found";
import RecipesTestPage from "@/pages/recipes-test";

// NEW: AI Substitution page
import AISubstitutionPage from "@/pages/ai-substitution";

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
        {/* If you add more recipe subroutes later, keep them here under the provider */}
      </Switch>
    </RecipesFiltersProvider>
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

        {/* Recipes test page */}
        <Route path="/recipes-test" component={RecipesTestPage} />

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

        <Route path="/substitutions">
          <ErrorBoundary>
            <IngredientSubstitutions />
          </ErrorBoundary>
        </Route>

        {/* NEW: /ai-substitution route */}
        <Route path="/ai-substitution">
          <ErrorBoundary>
            <AISubstitutionPage />
          </ErrorBoundary>
        </Route>

        {/* Store alias so header link "/store" works */}
        <Route path="/store" component={Marketplace} />

        {/* Others */}
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/catering" component={CateringMarketplace} />
        <Route path="/catering/wedding-planning" component={WeddingPlanning} />
        <Route path="/potent-potables" component={PotentPotables} />
        <Route path="/nutrition" component={NutritionMealPlanner} />

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
