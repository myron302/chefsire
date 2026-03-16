import { Link } from "wouter";

import { Button } from "@/components/ui/button";

type DrinksPlatformNavProps = {
  current?: "hub" | "submit" | "dashboard" | "following" | "creator" | "remixes" | "most-remixed" | "trending-creators" | "whats-new" | "recipe" | "collections" | "challenges";
};

const NAV_ITEMS = [
  { key: "hub", href: "/drinks", label: "Drinks Hub" },
  { key: "whats-new", href: "/drinks/whats-new", label: "What's New" },
  { key: "remixes", href: "/drinks/remixes", label: "Discover Remixes" },
  { key: "most-remixed", href: "/drinks/most-remixed", label: "Most Remixed" },
  { key: "trending-creators", href: "/drinks/creators/trending", label: "Trending Creators" },
  { key: "following", href: "/drinks/following", label: "Following Feed" },
  { key: "collections", href: "/drinks/collections", label: "Collections" },
  { key: "challenges", href: "/drinks/challenges", label: "Challenges" },
  { key: "dashboard", href: "/drinks/creator-dashboard", label: "Creator Dashboard" },
  { key: "submit", href: "/drinks/submit", label: "Submit a Drink Recipe" },
] as const;

export default function DrinksPlatformNav({ current }: DrinksPlatformNavProps) {
  return (
    <div className="rounded-xl border bg-white/70 p-3 shadow-sm backdrop-blur-sm">
      <p className="mb-3 text-sm font-medium text-muted-foreground">Explore drinks platform</p>
      <div className="flex flex-wrap gap-2">
        {NAV_ITEMS.map((item) => (
          <Link key={item.key} href={item.href}>
            <Button variant={current === item.key ? "default" : "outline"} size="sm">
              {item.label}
            </Button>
          </Link>
        ))}
      </div>
    </div>
  );
}
