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

// Pages
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

// ✅ BiteMap page (fixed import)
import BiteMapPage from "@/pages/bitemap/index";

// Baby food
import BabyFoodHub from "@/pages/recipes/baby-food";
import BabyFoodPurees from "@/pages/recipes/baby-food/purees";
import BabyFoodMashed from "@/pages/recipes/baby-food/mashed";
import BabyFoodFingerFoods from "@/pages/recipes/baby-food/finger-foods";
import BabyFoodToddler from "@/pages/recipes/baby-food/toddler";

// Drinks
import DrinksHubPage from "@/pages/drinks";
import SmoothiesHub from "@/pages/drinks/smoothies";
import ProteinShakesHub from "@/pages/drinks/protein-shakes";
import DetoxesHub from "@/pages/drinks/detoxes";
import PotentPotablesHub from "@/pages/drinks/potent-potables";

// Smoothies
import BreakfastSmoothies from "@/pages/drinks/smoothies/breakfast";
import DessertSmoothies from "@/pages/drinks/smoothies/dessert";
import GreenSmoothies from "@/pages/drinks/smoothies/green";
import ProteinSmoothies from "@/pages/drinks/smoothies/protein";
import WorkoutSmoothies from "@/pages/drinks/smoothies/workout";

// Protein shakes
import CaseinProtein from "@/pages/drinks/protein-shakes/casein";
import CollagenProtein from "@/pages/drinks/protein-shakes/collagen";
import PlantBasedProtein from "@/pages/drinks/protein-shakes/plant-based";
import WheyProtein from "@/pages/drinks/protein-shakes/whey";

// Detoxes
import DetoxJuices from "@/pages/drinks/detoxes/juice";
import DetoxTeas from "@/pages/drinks/detoxes/tea";
import DetoxWaters from "@/pages/drinks/detoxes/water";

// Potent potables
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

// Recipes grouped routes
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

// Drinks grouped routes
function PotentPotablesSection() {
  return (
    <RequireAgeGate>
      <Switch>
        <Route path="/drinks/potent-potables/cocktails" component={CocktailsPage} />
        <Route path="/drinks/potent-potables/cognac-brandy" component={CognacBrandyPage} />
        <Route path="/drinks/potent-potables/martinis" component={MartinisPage} />
        <Route path="/drinks/potent-potables/mocktails" component={MocktailsPage} />
        <Route path="/drinks/potent-potables/rum" component={RumPage} />
        <Route path="/drinks/potent-potables/scotch-irish-whiskey" component={ScotchIrishWhiskeyPage} />
        <Route path="/drinks/potent-potables/seasonal" component={SeasonalPage} />
        <Route path="/drinks/potent-potables/tequila-mezcal" component={TequilaMezcalPage} />
        <Route path="/drinks/potent-potables/virgin" component={VirginCocktailsPage} />
        <Route path="/drinks/potent-potables/virgin-cocktails" component={VirginCocktailsPage} />
        <Route path="/drinks/potent-potables/vodka" component={VodkaPage} />
        <Route path="/drinks/potent-potables/whiskey-bourbon" component={WhiskeyBourbonPage} />
        <Route path="/drinks/potent-potables" component={PotentPotablesHub} />
        <Route>
          <Redirect to="/drinks/potent-potables" />
        </Route>
      </Switch>
    </RequireAgeGate>
  );
}

// Drinks hub section
function DrinksSection() {
  return (
    <Switch>
      <Route path="/drinks/smoothies/breakfast" component={BreakfastSmoothies} />
      <Route path="/drinks/smoothies/dessert" component={DessertSmoothies} />
      <Route path="/drinks/smoothies/green" component={GreenSmoothies} />
      <Route path="/drinks/smoothies/protein" component={ProteinSmoothies} />
      <Route path="/drinks/smoothies/workout" component={WorkoutSmoothies} />
      <Route path="/drinks/smoothies" component={SmoothiesHub} />
      <Route path="/drinks/protein-shakes/casein" component={CaseinProtein} />
      <Route path="/drinks/protein-shakes/collagen" component={CollagenProtein} />
      <Route path="/drinks/protein-shakes/plant-based" component={PlantBasedProtein} />
      <Route path="/drinks/protein-shakes/whey" component={WheyProtein} />
      <Route path="/drinks/protein-shakes" component={ProteinShakesHub} />
      <Route path="/drinks/detoxes/juice" component={DetoxJuices} />
      <Route path="/drinks/detoxes/tea" component={DetoxTeas} />
      <Route path="/drinks/detoxes/water" component={DetoxWaters} />
      <Route path="/drinks/detoxes" component={DetoxesHub} />
      <Route path="/drinks/potent-potables/:rest*">
        {(params) => <PotentPotablesSection />}
      </Route>
      <Route path="/drinks/potent-potables" component={PotentPotablesSection} />
      <Route path="/drinks" component={DrinksHubPage} />
      <Route>
        <Redirect to="/drinks" />
      </Route>
    </Switch>
  );
}

// Main Router
function Router() {
  return (
    <Layout>
      {shouldShowDebugConsole() && <DebugConsole />}
      <Switch>
        <Route path="/profile/:userId?" component={Profile} />
        <Route path="/" component={Feed} />
        <Route path="/feed" component={Feed} />
        <Route path="/explore" component={ExplorePage} />

        {/* ✅ BiteMap Route */}
        <Route path="/bitemap" component={BiteMapPage} />
        <Route path="/restaurants">
          <Redirect to="/bitemap" />
        </Route>

        <Route path="/recipes/baby-food/:rest*">
          {(params) => <RecipesSection />}
        </Route>
        <Route path="/recipes/filters" component={RecipesFiltersPage} />
        <Route path="/recipes/:rest*">
          {(params) => <RecipesSection />}
        </Route>
        <Route path="/recipes" component={RecipesSection} />

        <Route path="/explore/filters">
          <Redirect to="/recipes/filters" />
        </Route>

        <Route path="/create" component={CreatePost} />
        <Route path="/pantry">
          <ErrorBoundary>
            <Pantry />
          </ErrorBoundary>
        </Route>

        <Route path="/store" component={Marketplace} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/catering" component={CateringMarketplace} />
        <Route path="/catering/wedding-planning" component={WeddingPlanning} />
        <Route path="/potent-potables">
          <Redirect to="/drinks/potent-potables" />
        </Route>

        <Route path="/nutrition" component={NutritionMealPlanner} />
        <Route path="/substitutions" component={SubstitutionsPage} />

        <Route path="/drinks/smoothies/:rest*">
          {(params) => <DrinksSection />}
        </Route>
        <Route path="/drinks/protein-shakes/:rest*">
          {(params) => <DrinksSection />}
        </Route>
        <Route path="/drinks/detoxes/:rest*">
          {(params) => <DrinksSection />}
        </Route>
        <Route path="/drinks/potent-potables/:rest*">
          {(params) => <DrinksSection />}
        </Route>
        <Route path="/drinks/:rest*">
          {(params) => <DrinksSection />}
        </Route>
        <Route path="/drinks" component={DrinksSection} />
        <Route path="/saved" component={NotFound} />
        <Route path="/following" component={NotFound} />
        <Route path="/settings" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

// App wrapper
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
