import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/layout";
import Feed from "@/pages/feed";
import Explore from "@/pages/explore";
import Profile from "@/pages/profile";
import CreatePost from "@/pages/create-post";
import Pantry from "@/components/Pantry";
import IngredientSubstitutions from "@/components/IngredientSubstitutions";
import Marketplace from "@/components/Marketplace";
import NutritionMealPlanner from "@/components/NutritionMealPlanner";
import CateringMarketplace from "@/pages/catering"; // Add this import
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Layout>
      <Switch>
        {/* Most specific routes first */}
        <Route path="/profile/:userId?" component={Profile} />
        
        {/* Main navigation routes */}
        <Route path="/" component={Feed} />
        <Route path="/feed" component={Feed} />
        <Route path="/explore" component={Explore} />
        <Route path="/create" component={CreatePost} />
        
        {/* Feature routes */}
        <Route path="/pantry" component={Pantry} />
        <Route path="/substitutions" component={IngredientSubstitutions} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/catering" component={CateringMarketplace} /> {/* Add this route */}
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
