// client/src/App.tsx
import * as React from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/layout";
import ErrorBoundary from "@/components/ErrorBoundary";
import DebugConsole, { shouldShowDebugConsole } from "@/components/DebugConsole";

// ---- Lazy pages (code-splitting) ----
const Feed = React.lazy(() => import("@/pages/feed"));
const ExplorePage = React.lazy(() => import("@/pages/explore/ExplorePage"));
const RecipesListPage = React.lazy(() => import("@/pages/recipes/RecipesListPage"));
const RecipesFiltersPage = React.lazy(() => import("@/pages/recipes/RecipesFiltersPage"));
const Profile = React.lazy(() => import("@/pages/profile"));
const CreatePost = React.lazy(() => import("@/pages/create-post"));
const Pantry = React.lazy(() => import("@/components/Pantry"));
const IngredientSubstitutions = React.lazy(() => import("@/components/IngredientSubstitutions"));
const AISubstitutionPage = React.lazy(() => import("@/pages/ai-substitution"));
const Marketplace = React.lazy(() => import("@/components/Marketplace"));
const NutritionMealPlanner = React.lazy(() => import("@/components/NutritionMealPlanner"));
const CateringMarketplace = React.lazy(() => import("@/pages/catering"));
const PotentPotables = React.lazy(() => import("@/pages/potent-potables"));
const WeddingPlanning = React.lazy(() => import("@/pages/wedding-planning"));
const NotFound = React.lazy(() => import("@/pages/not-found"));

// ✅ Recipes filters provider (moved to app-wide scope)
import { RecipesFiltersProvider } from "@/pages/recipes/useRecipesFilters";

// Small redirect helper for Wouter
function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  React.useEffect(() => setLocation(to), [to, setLocation]);
  return null;
}

// Suspense + ErrorBoundary shell for each lazy page
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <React.Suspense
        fallback={
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            Loading…
          </div>
        }
      >
        {children}
      </React.Suspense>
    </ErrorBoundary>
  );
}

function Router() {
  return (
    <Layout>
      {shouldShowDebugConsole() && <DebugConsole />}

      <Switch>
        {/* Most specific routes first */}
        <Route path="/profile/:userId?">
          <PageShell>
            <Profile />
          </PageShell>
        </Route>

        {/* Main navigation */}
        <Route path="/">
          <PageShell>
            <Feed />
          </PageShell>
        </Route>
        <Route path="/feed">
          <PageShell>
            <Feed />
          </PageShell>
        </Route>

        {/* Explore (discovery feed) */}
        <Route path="/explore">
          <PageShell>
            <ExplorePage />
          </PageShell>
        </Route>

        {/* Backward-compat: old explore/filters -> recipes/filters */}
        <Route path="/explore/filters">
          <Redirect to="/recipes/filters" />
        </Route>

        {/* Recipes */}
        <Route path="/recipes">
          <PageShell>
            <RecipesListPage />
          </PageShell>
        </Route>

        <Route path="/recipes/filters">
          <PageShell>
            <RecipesFiltersPage />
          </PageShell>
        </Route>

        {/* Create */}
        <Route path="/create">
          <PageShell>
            <CreatePost />
          </PageShell>
        </Route>

        {/* Pantry / Subs / AI Subs */}
        <Route path="/pantry">
          <PageShell>
            <Pantry />
          </PageShell>
        </Route>

        <Route path="/substitutions">
          <PageShell>
            <IngredientSubstitutions />
          </PageShell>
        </Route>

        <Route path="/ai-substitution">
          <PageShell>
            <AISubstitutionPage />
          </PageShell>
        </Route>

        {/* Marketplace & others */}
        <Route path="/store">
          <PageShell>
            <Marketplace />
          </PageShell>
        </Route>

        <Route path="/marketplace">
          <PageShell>
            <Marketplace />
          </PageShell>
        </Route>

        <Route path="/catering">
          <PageShell>
            <CateringMarketplace />
          </PageShell>
        </Route>

        <Route path="/catering/wedding-planning">
          <PageShell>
            <WeddingPlanning />
          </PageShell>
        </Route>

        <Route path="/potent-potables">
          <PageShell>
            <PotentPotables />
          </PageShell>
        </Route>

        <Route path="/nutrition">
          <PageShell>
            <NutritionMealPlanner />
          </PageShell>
        </Route>

        {/* Placeholders */}
        <Route path="/saved">
          <PageShell>
            <NotFound />
          </PageShell>
        </Route>
        <Route path="/following">
          <PageShell>
            <NotFound />
          </PageShell>
        </Route>
        <Route path="/settings">
          <PageShell>
            <NotFound />
          </PageShell>
        </Route>

        {/* Catch-all */}
        <Route>
          <PageShell>
            <NotFound />
          </PageShell>
        </Route>
      </Switch>
    </Layout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {/* ⬇️ Make the filters context available app-wide */}
        <RecipesFiltersProvider>
          <Router />
        </RecipesFiltersProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
