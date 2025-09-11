import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/layout";

// Pages
import Feed from "@/pages/feed";
// ⬇️ Replace the single Explore import with the two-page setup
import ExploreListPage from "@/pages/explore/ExploreListPage";
import ExploreFiltersPage from "@/pages/explore/ExploreFiltersPage";

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

// NEW: AI Substitution page import (ensure this file exists)
import AISubstitutionPage from "@/pages/ai-substitution";

// Utilities
import ErrorBoundary from "@/components/ErrorBoundary";
import DebugConsole, { shouldShowDebugConsole } from "@/components/DebugConsole";

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

        {/* Explore split into two pages */}
        <Route path="/explore/filters" component={ExploreFiltersPage} />
        <Route path="/explore" component={ExploreListPage} />

        <Route path="/create" component={CreatePost} />

        {/* Feature routes (wrapped so errors show on-screen) */}
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
        <Route path="/recipes" component={NotFound} />
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
