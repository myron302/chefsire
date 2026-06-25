import * as React from "react";
import { Route, Switch, useLocation } from "wouter";

import RequireAgeGate from "@/components/RequireAgeGate";

// ── Caffeinated sub-pages ────────────────────────────────────────────────────
const CaffeinatedDrinksHub = React.lazy(() => import("@/pages/drinks/caffeinated"));
const EspressoDrinks = React.lazy(() => import("@/pages/drinks/caffeinated/espresso"));
const ColdBrewDrinks = React.lazy(() => import("@/pages/drinks/caffeinated/cold-brew"));
const TeaDrinks = React.lazy(() => import("@/pages/drinks/caffeinated/tea"));
const MatchaDrinks = React.lazy(() => import("@/pages/drinks/caffeinated/matcha"));
const EnergyDrinks = React.lazy(() => import("@/pages/drinks/caffeinated/energy"));
const SpecialtyCoffee = React.lazy(() => import("@/pages/drinks/caffeinated/specialty"));
const LattesDrinks = React.lazy(() => import("@/pages/drinks/caffeinated/lattes"));
const IcedCoffeeDrinks = React.lazy(() => import("@/pages/drinks/caffeinated/iced"));

// ── Smoothies sub-pages ──────────────────────────────────────────────────────
const SmoothiesHub = React.lazy(() => import("@/pages/drinks/smoothies"));
const BreakfastSmoothies = React.lazy(() => import("@/pages/drinks/smoothies/breakfast"));
const DessertSmoothies = React.lazy(() => import("@/pages/drinks/smoothies/dessert"));
const GreenSmoothies = React.lazy(() => import("@/pages/drinks/smoothies/green"));
const ProteinSmoothies = React.lazy(() => import("@/pages/drinks/smoothies/protein"));
const WorkoutSmoothies = React.lazy(() => import("@/pages/drinks/smoothies/workout"));
const TropicalSmoothies = React.lazy(() => import("@/pages/drinks/smoothies/tropical"));
const BerrySmoothies = React.lazy(() => import("@/pages/drinks/smoothies/berry"));
const DetoxSmoothies = React.lazy(() => import("@/pages/drinks/smoothies/detox"));

// ── Protein shakes sub-pages ─────────────────────────────────────────────────
const ProteinShakesHub = React.lazy(() => import("@/pages/drinks/protein-shakes"));
const CaseinProtein = React.lazy(() => import("@/pages/drinks/protein-shakes/casein"));
const CollagenProtein = React.lazy(() => import("@/pages/drinks/protein-shakes/collagen"));
const PlantBasedProtein = React.lazy(() => import("@/pages/drinks/protein-shakes/plant-based"));
const WheyProtein = React.lazy(() => import("@/pages/drinks/protein-shakes/whey"));
const EggProtein = React.lazy(() => import("@/pages/drinks/protein-shakes/egg"));
const BeefProtein = React.lazy(() => import("@/pages/drinks/protein-shakes/beef"));

// ── Detoxes sub-pages ────────────────────────────────────────────────────────
const DetoxesHub = React.lazy(() => import("@/pages/drinks/detoxes"));
const DetoxJuices = React.lazy(() => import("@/pages/drinks/detoxes/juice"));
const DetoxTeas = React.lazy(() => import("@/pages/drinks/detoxes/tea"));
const DetoxWaters = React.lazy(() => import("@/pages/drinks/detoxes/water"));

// ── Workout drinks sub-pages ─────────────────────────────────────────────────
const WorkoutDrinksHub = React.lazy(() => import("@/pages/drinks/workout-drinks"));
const PreWorkoutDrinks = React.lazy(() => import("@/pages/drinks/workout-drinks/pre-workout"));
const PostWorkoutDrinks = React.lazy(() => import("@/pages/drinks/workout-drinks/post-workout"));
const HydrationDrinks = React.lazy(() => import("@/pages/drinks/workout-drinks/hydration"));
const EnergyBoosterDrinks = React.lazy(() => import("@/pages/drinks/workout-drinks/energy-boosters"));

// ── Potent potables sub-pages ────────────────────────────────────────────────
const PotentPotablesHub = React.lazy(() => import("@/pages/drinks/potent-potables"));
const CocktailsPage = React.lazy(() => import("@/pages/drinks/potent-potables/cocktails"));
const CognacBrandyPage = React.lazy(() => import("@/pages/drinks/potent-potables/cognac-brandy"));
const MartinisPage = React.lazy(() => import("@/pages/drinks/potent-potables/martinis"));
const MocktailsPage = React.lazy(() => import("@/pages/drinks/potent-potables/mocktails"));
const RumPage = React.lazy(() => import("@/pages/drinks/potent-potables/rum"));
const ScotchIrishWhiskeyPage = React.lazy(() => import("@/pages/drinks/potent-potables/scotch-irish-whiskey"));
const SeasonalPage = React.lazy(() => import("@/pages/drinks/potent-potables/seasonal"));
const TequilaMezcalPage = React.lazy(() => import("@/pages/drinks/potent-potables/tequila-mezcal"));
const VodkaPage = React.lazy(() => import("@/pages/drinks/potent-potables/vodka"));
const WhiskeyBourbonPage = React.lazy(() => import("@/pages/drinks/potent-potables/whiskey-bourbon"));
const DaiquiriPage = React.lazy(() => import("@/pages/drinks/potent-potables/daiquiri"));
const GinPage = React.lazy(() => import("@/pages/drinks/potent-potables/gin"));
const LiqueursPage = React.lazy(() => import("@/pages/drinks/potent-potables/liqueurs"));
const SpritzPage = React.lazy(() => import("@/pages/drinks/potent-potables/spritz"));
const HotDrinksPage = React.lazy(() => import("@/pages/drinks/potent-potables/hot-drinks"));

// Shared fallback used by every section's Suspense boundary.
function SectionFallback() {
  return <div className="p-4 text-sm text-muted-foreground">Loading drink recipes...</div>;
}

export function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();

  React.useEffect(() => setLocation(to), [to, setLocation]);

  return null;
}

export function PotentPotablesSection() {
  return (
    <RequireAgeGate>
      <React.Suspense fallback={<SectionFallback />}>
        <Switch>
          <Route path="/drinks/potent-potables/cockta">
            <Redirect to="/drinks/potent-potables/cocktails" />
          </Route>
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
      </React.Suspense>
    </RequireAgeGate>
  );
}

export function CaffeinatedSection() {
  return (
    <React.Suspense fallback={<SectionFallback />}>
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
    </React.Suspense>
  );
}

export function SmoothiesSection() {
  return (
    <React.Suspense fallback={<SectionFallback />}>
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
    </React.Suspense>
  );
}

export function ProteinShakesSection() {
  return (
    <React.Suspense fallback={<SectionFallback />}>
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
    </React.Suspense>
  );
}

export function WorkoutDrinksSection() {
  return (
    <React.Suspense fallback={<SectionFallback />}>
      <Switch>
        <Route path="/drinks/workout-drinks/pre-workout" component={PreWorkoutDrinks} />
        <Route path="/drinks/workout-drinks/post-workout" component={PostWorkoutDrinks} />
        <Route path="/drinks/workout-drinks/hydration" component={HydrationDrinks} />
        <Route path="/drinks/workout-drinks/energy-boosters" component={EnergyBoosterDrinks} />
        <Route path="/drinks/workout-drinks" component={WorkoutDrinksHub} />
        <Route>
          <Redirect to="/drinks/workout-drinks" />
        </Route>
      </Switch>
    </React.Suspense>
  );
}

export function DetoxesSection() {
  return (
    <React.Suspense fallback={<SectionFallback />}>
      <Switch>
        <Route path="/drinks/detoxes/juice" component={DetoxJuices} />
        <Route path="/drinks/detoxes/tea" component={DetoxTeas} />
        <Route path="/drinks/detoxes/water" component={DetoxWaters} />
        <Route path="/drinks/detoxes" component={DetoxesHub} />
        <Route>
          <Redirect to="/drinks/detoxes" />
        </Route>
      </Switch>
    </React.Suspense>
  );
}
