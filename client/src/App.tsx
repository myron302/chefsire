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
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Feed} />
        <Route path="/feed" component={Feed} />
        <Route path="/explore" component={Explore} />
        <Route path="/recipes" component={NotFound} /> {/* Placeholder */}
        <Route path="/pantry" component={Pantry} />
        <Route path="/substitutions" component={IngredientSubstitutions} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/nutrition" component={NotFound} /> {/* Placeholder */}
        <Route path="/profile/:userId?" component={Profile} />
        <Route path="/create" component={CreatePost} />
        <Route path="/saved" component={NotFound} /> {/* Placeholder */}
        <Route path="/following" component={NotFound} /> {/* Placeholder */}
        <Route path="/settings" component={NotFound} /> {/* Placeholder */}
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
