import type { ComponentType } from "react";
import { Link } from "wouter";
import { Compass, Flame, GitBranch, Repeat2, TrendingUp, Sparkles, Trophy, Layers, Users, ArrowRight, LayoutDashboard, Search, Bell, Gem, ShoppingBag, Newspaper, CalendarClock, Archive } from "lucide-react";

import { useUser } from "@/contexts/UserContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import BecauseOfYourActivity from "@/components/drinks/BecauseOfYourActivity";
import RemixStreakBadge from "@/components/drinks/RemixStreakBadge";

type DiscoverLink = {
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  activityHint: "Active now" | "Recently popular" | "New";
};

const discoverLinks: DiscoverLink[] = [
  {
    title: "Community Search",
    description: "Search drinks, remixes, creators, and challenges from one page.",
    href: "/drinks/search",
    icon: Search,
    activityHint: "Active now",
  },
  {
    title: "Trending Drinks",
    description: "What people are viewing and interacting with now.",
    href: "/drinks",
    icon: Flame,
    activityHint: "Active now",
  },
  {
    title: "Recent Remixes",
    description: "New twists and fresh takes on classic drinks.",
    href: "/drinks/remixes",
    icon: GitBranch,
    activityHint: "Recently popular",
  },
  {
    title: "Most Remixed Drinks",
    description: "Original drinks currently inspiring the most creativity.",
    href: "/drinks/most-remixed",
    icon: Repeat2,
    activityHint: "Recently popular",
  },
  {
    title: "Trending Creators",
    description: "Rising drink creators to follow this week.",
    href: "/drinks/creators/trending",
    icon: TrendingUp,
    activityHint: "Active now",
  },
  {
    title: "What's New",
    description: "Recent ecosystem activity, launches, and notable updates.",
    href: "/drinks/whats-new",
    icon: Sparkles,
    activityHint: "New",
  },
  {
    title: "Creator Feed",
    description: "Lightweight creator posts for updates, promos, launches, and member notes.",
    href: "/drinks/feed",
    icon: Newspaper,
    activityHint: "New",
  },
  {
    title: "Drops Calendar",
    description: "Upcoming collection launches, promos, challenge drops, and member release timing.",
    href: "/drinks/drops",
    icon: CalendarClock,
    activityHint: "New",
  },
  {
    title: "Roadmap + Archive",
    description: "See what creators have coming next, what is live now, and what already shipped.",
    href: "/drinks/roadmap",
    icon: Archive,
    activityHint: "New",
  },
  {
    title: "Challenges",
    description: "Active remix prompts, voting, and challenge winners.",
    href: "/drinks/challenges",
    icon: Trophy,
    activityHint: "Active now",
  },
  {
    title: "Public Collections",
    description: "Browse featured and public drink collections from the community.",
    href: "/drinks/collections/explore",
    icon: Layers,
    activityHint: "Recently popular",
  },
  {
    title: "Premium Collections",
    description: "Find creator premium collections and support makers without paywalls on recipes.",
    href: "/drinks/collections/explore",
    icon: Gem,
    activityHint: "New",
  },
  {
    title: "Bundle Offers",
    description: "Unlock multiple premium collections together in one Square checkout.",
    href: "/drinks/collections/explore",
    icon: Layers,
    activityHint: "New",
  },
  {
    title: "My Purchased Collections",
    description: "Jump back into premium collections you already own.",
    href: "/drinks/collections/purchased",
    icon: ShoppingBag,
    activityHint: "New",
  },
  {
    title: "Support Creators",
    description: "Discover creators, visit storefront collections, and follow makers you want to support.",
    href: "/drinks/creators/trending",
    icon: Users,
    activityHint: "New",
  },
];

export default function DrinksDiscoverPage() {
  const { user } = useUser();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 rounded-2xl border bg-white p-6 shadow-sm">
          <Badge variant="secondary" className="mb-3">Drinks Discover Hub</Badge>
          <h1 className="mb-2 flex items-center gap-2 text-3xl font-bold">
            <Compass className="h-8 w-8 text-blue-600" />
            Explore the Drinks Community
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Browse the top places across drinks discovery, creator discovery, remix discovery, and challenge discovery.
            This hub is intentionally lightweight: pick a surface below and jump straight in.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/drinks">
              <Button variant="outline">Back to Drinks Hub</Button>
            </Link>
            <Link href="/drinks/submit">
              <Button>Submit a Remix</Button>
            </Link>
          </div>
        </div>

        {user && (
          <>
            <div className="mb-4">
              <RemixStreakBadge />
            </div>
            <BecauseOfYourActivity />
            <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                  Following Feed
                </CardTitle>
                <CardDescription>See drink activity from creators you follow.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/drinks/following">
                  <Button variant="outline" className="w-full justify-between">
                    Open Following Feed
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Newspaper className="h-5 w-5 text-blue-600" />
                  Creator Feed
                </CardTitle>
                <CardDescription>See creator posts from updates, launches, promos, and memberships.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/drinks/feed">
                  <Button variant="outline" className="w-full justify-between">
                    Open Creator Feed
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarClock className="h-5 w-5 text-blue-600" />
                  Drops Calendar
                </CardTitle>
                <CardDescription>Browse upcoming creator drops grouped by date and filtered by your access.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/drinks/drops">
                  <Button variant="outline" className="w-full justify-between">
                    Open Drops Calendar
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <LayoutDashboard className="h-5 w-5 text-blue-600" />
                  Creator Dashboard
                </CardTitle>
                <CardDescription>Track your drinks performance and creator momentum.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/drinks/creator-dashboard#sales">
                  <Button variant="outline" className="w-full justify-between">
                    Open Creator Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bell className="h-5 w-5 text-blue-600" />
                  Alerts Center
                </CardTitle>
                <CardDescription>Review premium collection promos, price drops, and creator launches in one place.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/drinks/alerts">
                  <Button variant="outline" className="w-full justify-between">
                    Open Alerts
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShoppingBag className="h-5 w-5 text-blue-600" />
                  My Purchased Collections
                </CardTitle>
                <CardDescription>Open the premium collections you&apos;ve already unlocked.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/drinks/collections/purchased">
                  <Button variant="outline" className="w-full justify-between">
                    Open Purchased Collections
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
            </div>
          </>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {discoverLinks.map((item) => (
            <Card key={item.href} className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <item.icon className="h-5 w-5 text-blue-600" />
                  {item.title}
                  <Badge variant="outline" className="text-[10px]">{item.activityHint}</Badge>
                </CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={item.href}>
                  <Button variant="ghost" className="w-full justify-between">
                    Open
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
