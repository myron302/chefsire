// client/src/components/layout.tsx
import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Home,
  Search,
  PlusSquare,
  User,
  Menu,
  X,
  Crown,
  GlassWater,
  UtensilsCrossed,
  Baby,
  Dog,
  ShoppingBag,
  Calendar,
  MapPin,
  Dumbbell,
  MessageCircle,
  ChefHat,
  Heart,
  Flame,
  BookOpen,
  Gift,
  BarChart3,
  ClipboardList,
  Star,
  Coffee,
  Wine,
  Leaf,
  Martini,
  Milk,
  Wheat,
  Popcorn,
  CakeSlice,
  IceCream,
  Pizza,
  Sandwich,
  Cookie,
  Donut,
  Fish,
  Apple,
  Carrot,
  Egg,
  Drumstick,
  Soup,
  Salad,
  Candy,
  Beer,
  Utensils,
  BabyCarriage,
  PawPrint,
  Map,
  ShoppingCart,
  Store,
  PartyPopper,
  PartyPopperIcon,
  HandPlatter,
  Users,
  Sprout,
  Sparkles,
  LucideIcon,
  ChevronRight,
  Shield,
  Bell,
  Compass,
  CrownIcon,
  Bookmark,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ModeToggle } from "@/components/ModeToggle";
import { useUser } from "@/contexts/UserContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAgeGateStore } from "@/stores/ageGateStore";

type NavLink = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
};

type DrinksNavItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  highlight?: boolean;
  badge?: string;
};

type DrinksSubsection = {
  title: string;
  href: string;
  items: DrinksNavItem[];
};

type DrinksSection = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  items: DrinksSubsection[];
};

type ExploreNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  description?: string;
};

const MAIN_NAV_LINKS: NavLink[] = [
  { label: "Feed", icon: Home, href: "/feed" },
  { label: "Explore", icon: Search, href: "/explore" },
  { label: "Create", icon: PlusSquare, href: "/create-post" },
  { label: "Profile", icon: User, href: "/profile" },
];

const DRINKS_SECTIONS: DrinksSection[] = [
  {
    title: "Smoothies",
    description: "Fruity, green, dessert & more.",
    href: "/drinks/smoothies",
    icon: GlassWater,
    items: [
      {
        title: "Smoothie Hubs",
        href: "/drinks/smoothies",
        items: [
          {
            id: "fruit-smoothies",
            label: "Fruit Smoothies",
            description: "Berry blasts, tropical blends, & citrus zings.",
            href: "/drinks/smoothies/fruit",
            icon: Apple,
            highlight: true,
          },
          {
            id: "green-smoothies",
            label: "Green Smoothies",
            description: "Leafy greens, detox blends, & nutrient powerhouses.",
            href: "/drinks/smoothies/green",
            icon: Leaf,
          },
          {
            id: "dessert-smoothies",
            label: "Dessert Smoothies",
            description: "Rich, indulgent blends that feel like dessert.",
            href: "/drinks/smoothies/dessert",
            icon: IceCream,
          },
        ],
      },
      {
        title: "Smoothie Goals",
        href: "/drinks/smoothies",
        items: [
          {
            id: "weight-loss",
            label: "Weight Loss",
            description: "Low-calorie blends to keep you full & focused.",
            href: "/drinks/smoothies/weight-loss",
            icon: Flame,
          },
          {
            id: "meal-replacement",
            label: "Meal Replacement",
            description: "Balanced smoothies with protein & fiber.",
            href: "/drinks/smoothies/meal",
            icon: Sandwich,
          },
          {
            id: "immune-support",
            label: "Immune Support",
            description: "Vitamin-packed blends for everyday defenses.",
            href: "/drinks/smoothies/immune",
            icon: Shield,
          },
        ],
      },
    ],
  },
  {
    title: "Protein Shakes",
    description: "Post-workout blends, muscle fuel & beyond.",
    href: "/drinks/protein-shakes",
    icon: Dumbbell,
    items: [
      {
        title: "Protein Types",
        href: "/drinks/protein-shakes",
        items: [
          {
            id: "whey",
            label: "Whey Protein",
            description: "Fast-absorbing shakes for before or after workouts.",
            href: "/drinks/protein-shakes/whey",
            icon: Milk,
          },
          {
            id: "casein",
            label: "Casein Protein",
            description: "Slow-digesting shakes ideal for overnight recovery.",
            href: "/drinks/protein-shakes/casein",
            icon: Moon,
          },
          {
            id: "plant-based",
            label: "Plant-Based Protein",
            description: "Dairy-free fuel from pea, hemp, soy & more.",
            href: "/drinks/protein-shakes/plant-based",
            icon: Sprout,
            highlight: true,
          },
          {
            id: "collagen",
            label: "Collagen Protein",
            description: "Beauty & joint support in one smooth sip.",
            href: "/drinks/protein-shakes/collagen",
            icon: Sparkles,
          },
        ],
      },
      {
        title: "Fitness Goals",
        href: "/drinks/protein-shakes",
        items: [
          {
            id: "muscle-gain",
            label: "Muscle Gain",
            description: "High-protein, calorie-smart shakes.",
            href: "/drinks/protein-shakes/muscle-gain",
            icon: Target,
          },
          {
            id: "fat-loss",
            label: "Fat Loss",
            description: "Lean blends with smart macros & hunger control.",
            href: "/drinks/protein-shakes/fat-loss",
            icon: Flame,
          },
          {
            id: "performance",
            label: "Performance Boost",
            description: "Targeted blends for endurance & strength.",
            href: "/drinks/protein-shakes/performance",
            icon: Activity,
          },
        ],
      },
    ],
  },
  {
    title: "Detox & Wellness",
    description: "Cleanses, glow tonics & hydration heroes.",
    href: "/drinks/detox",
    icon: Leaf,
    items: [
      {
        title: "Detox Drinks",
        href: "/drinks/detox",
        items: [
          {
            id: "detox-waters",
            label: "Detox Waters",
            description: "Infused waters with herbs, fruit & minerals.",
            href: "/drinks/detox/waters",
            icon: Droplets,
          },
          {
            id: "detox-teas",
            label: "Detox Teas",
            description: "Soothing, cleansing herbal tea blends.",
            href: "/drinks/detox/teas",
            icon: Tea,
          },
          {
            id: "detox-juices",
            label: "Detox Juices",
            description: "Cold-pressed juices for reset & refresh.",
            href: "/drinks/detox/juices",
            icon: Juice,
          },
        ],
      },
      {
        title: "Wellness Goals",
        href: "/drinks/detox",
        items: [
          {
            id: "gut-health",
            label: "Gut Health",
            description: "Probiotic & fiber-rich drinks.",
            href: "/drinks/detox/gut-health",
            icon: Soup,
          },
          {
            id: "skin-glow",
            label: "Skin Glow",
            description: "Antioxidant blends for radiance.",
            href: "/drinks/detox/skin-glow",
            icon: Sparkles,
          },
          {
            id: "energy-reset",
            label: "Energy Reset",
            description: "Clean energy without the crash.",
            href: "/drinks/detox/energy",
            icon: Zap,
          },
        ],
      },
    ],
  },
  {
    title: "Caffeinated Drinks",
    description: "Coffee, matcha, energy drinks & more.",
    href: "/drinks/caffeinated",
    icon: Coffee,
    items: [
      {
        title: "Coffee & Espresso",
        href: "/drinks/caffeinated/coffee",
        items: [
          {
            id: "espresso",
            label: "Espresso Creations",
            description: "Shots, lattes, macchiatos & more.",
            href: "/drinks/caffeinated/espresso",
            icon: Coffee,
          },
          {
            id: "cold-brew",
            label: "Cold Brew & Iced",
            description: "Chilled, smooth caffeinated pleasures.",
            href: "/drinks/caffeinated/cold-brew",
            icon: IceCream,
          },
        ],
      },
      {
        title: "Tea & Energy",
        href: "/drinks/caffeinated",
        items: [
          {
            id: "matcha",
            label: "Matcha & Green Tea",
            description: "Earthy, bright, antioxidant-rich drinks.",
            href: "/drinks/caffeinated/matcha",
            icon: Leaf,
          },
          {
            id: "energy-drinks",
            label: "Energy Drinks",
            description: "High-octane blends & energized mocktails.",
            href: "/drinks/caffeinated/energy-drinks",
            icon: Zap,
          },
        ],
      },
    ],
  },
];

const EXPLORE_NAV_ITEMS: ExploreNavItem[] = [
  {
    label: "All Recipes",
    href: "/recipes",
    icon: BookOpen,
    description: "Browse every recipe in ChefSire.",
  },
  {
    label: "Meal Planner",
    href: "/meal-planner",
    icon: Calendar,
    description: "Plan your week with smart suggestions.",
  },
  {
    label: "Catering Marketplace",
    href: "/catering",
    icon: HandPlatter,
    badge: "New",
    description: "Book chefs & catering pros for any event.",
  },
  {
    label: "Wedding Planning",
    href: "/wedding-planning",
    icon: PartyPopperIcon,
    description: "Vendors, tastings & venue-friendly menus.",
  },
  {
    label: "BiteMap Local Eats",
    href: "/bitemap",
    icon: Map,
    description: "Discover restaurants, food trucks & hidden gems.",
  },
  {
    label: "Drinks Hub",
    href: "/drinks",
    icon: GlassWater,
    badge: "Hub",
    description: "Smoothies, protein shakes, detox, coffee & more.",
  },
  {
    label: "Baby Food",
    href: "/baby-food",
    icon: BabyCarriage,
    description: "Stage-based purees, finger foods & toddler plates.",
  },
  {
    label: "Pet Food",
    href: "/pet-food",
    icon: PawPrint,
    description: "Homemade treats & vet-inspired bowls.",
  },
  {
    label: "Nutrition & Macros",
    href: "/nutrition",
    icon: BarChart3,
    description: "Track macros, goals & daily wins.",
  },
  {
    label: "Competitions",
    href: "/competitions",
    icon: Trophy,
    badge: "Live",
    description: "Cook-offs, challenges & live judging.",
  },
  {
    label: "Substitutions",
    href: "/substitutions",
    icon: Shuffle,
    description: "Ingredient swaps, allergen hacks & pantry saves.",
  },
  {
    label: "Marketplace",
    href: "/marketplace",
    icon: Store,
    description: "Shop tools, pantry bundles & chef services.",
  },
];

function useCurrentPath() {
  const [location] = useLocation();
  return location;
}

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const currentPath = useCurrentPath();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, isLoading } = useUser();
  const { isVerified } = useAgeGateStore();

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [currentPath]);

  const isActive = (href: string) =>
    currentPath === href ||
    (href !== "/feed" && currentPath?.startsWith(href));

  const renderUserAvatar = () => {
    if (isLoading) {
      return (
        <Avatar className="h-8 w-8 border">
          <AvatarFallback>...</AvatarFallback>
        </Avatar>
      );
    }

    if (!user) {
      return (
        <Button variant="outline" size="sm" asChild>
          <Link href="/signup">Join ChefSire</Link>
        </Button>
      );
    }

    const initials =
      user.displayName
        ?.split(" ")
        .map((n) => n[0])
        .join("") || user.username?.[0] || "C";

    return (
      <Link href="/profile">
        <Avatar className="h-9 w-9 border">
          {user.avatarUrl ? (
            <AvatarImage src={user.avatarUrl} alt={user.username} />
          ) : (
            <AvatarFallback>{initials}</AvatarFallback>
          )}
        </Avatar>
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden border-r bg-card/40 lg:flex lg:w-72 xl:w-80 flex-col">
        {/* Logo / Brand */}
        <div className="flex h-16 items-center gap-3 border-b px-4">
          <ChefHat className="h-7 w-7 text-primary" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-semibold tracking-tight">
                ChefSire
              </span>
              <Crown className="h-4 w-4 text-yellow-500" />
            </div>
            <p className="text-xs text-muted-foreground">
              Rule your kitchen. Rule your feed.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ModeToggle />
            {renderUserAvatar()}
          </div>
        </div>

        {/* Scrollable nav */}
        <ScrollArea className="flex-1">
          <nav className="space-y-6 px-3 py-4">
            {/* Main */}
            <div>
              <div className="mb-1 flex items-center justify-between px-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Main
                </h2>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  Live
                </span>
              </div>
              <ul className="space-y-1">
                {MAIN_NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>
                      <Button
                        variant={isActive(link.href) ? "default" : "ghost"}
                        size="sm"
                        className={cn(
                          "w-full justify-start gap-2",
                          isActive(link.href) &&
                            "bg-primary text-primary-foreground shadow-sm"
                        )}
                      >
                        <link.icon className="h-4 w-4" />
                        <span>{link.label}</span>
                      </Button>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Explore */}
            <div>
              <div className="mb-1 flex items-center justify-between px-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Explore
                </h2>
                <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                  New drops
                </span>
              </div>
              <div className="space-y-1">
                {EXPLORE_NAV_ITEMS.map((item) => (
                  <Link href={item.href} key={item.href}>
                    <Button
                      variant={isActive(item.href) ? "default" : "ghost"}
                      size="sm"
                      className={cn(
                        "w-full justify-start gap-2 text-left",
                        isActive(item.href) &&
                          "bg-secondary text-secondary-foreground shadow-sm"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <div className="flex flex-1 flex-col items-start">
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="truncate">{item.label}</span>
                          {item.badge && (
                            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <span className="line-clamp-1 text-[11px] text-muted-foreground">
                            {item.description}
                          </span>
                        )}
                      </div>
                    </Button>
                  </Link>
                ))}
              </div>
            </div>

            {/* Drinks Hub */}
            <div>
              <div className="mb-1 flex items-center justify-between px-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Drinks Hub
                </h2>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
                  Curated
                </span>
              </div>
              <div className="space-y-3 rounded-xl border bg-card/60 p-2">
                {DRINKS_SECTIONS.map((section) => (
                  <div key={section.title} className="space-y-1.5 rounded-lg">
                    <Link href={section.href}>
                      <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
                        <section.icon className="h-4 w-4 text-primary" />
                        <div className="flex flex-1 items-center justify-between gap-2">
                          <div className="flex flex-col items-start">
                            <span className="text-sm font-medium">
                              {section.title}
                            </span>
                            <span className="line-clamp-1 text-[11px] text-muted-foreground">
                              {section.description}
                            </span>
                          </div>
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </button>
                    </Link>
                    <div className="mt-1 grid grid-cols-1 gap-1 pl-2">
                      {section.items.map((sub) => (
                        <div key={sub.title} className="space-y-0.5">
                          <Link href={sub.href}>
                            <button className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent/70 hover:text-foreground">
                              <span className="font-medium uppercase tracking-wide">
                                {sub.title}
                              </span>
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </Link>
                          <div className="grid grid-cols-1 gap-1 pl-1">
                            {sub.items.map((item) => (
                              <Link href={item.href} key={item.id}>
                                <button className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent/60 hover:text-foreground">
                                  <item.icon className="h-3 w-3" />
                                  <span className="truncate">{item.label}</span>
                                  {item.badge && (
                                    <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                                      {item.badge}
                                    </span>
                                  )}
                                </button>
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Potent Potables - Age-gated */}
                <div className="mt-3 space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-2">
                  <div className="flex items-center gap-2">
                    <Wine className="h-4 w-4 text-destructive" />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold uppercase tracking-wide text-destructive">
                        Potent Potables
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        21+ cocktails, mocktails & party-ready pours.
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-1">
                    <Link href="/drinks/potent">
                      <button className="flex w-full items-center justify-between gap-2 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive hover:bg-destructive/20">
                        <span>Enter Potent Potables</span>
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </Link>
                    <p className="text-[10px] text-muted-foreground">
                      Age verification required. Please drink responsibly.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Creator & Store Tools */}
            <div>
              <div className="mb-1 flex items-center justify-between px-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Creator Tools
                </h2>
                <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-500">
                  Builder
                </span>
              </div>
              <div className="space-y-1">
                <Link href="/store-builder">
                  <Button
                    variant={isActive("/store-builder") ? "default" : "outline"}
                    size="sm"
                    className="w-full justify-start gap-2"
                  >
                    <Store className="h-4 w-4" />
                    <span>Store Builder</span>
                    <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Beta
                    </span>
                  </Button>
                </Link>
                <Link href="/marketplace">
                  <Button
                    variant={isActive("/marketplace") ? "default" : "outline"}
                    size="sm"
                    className="w-full justify-start gap-2"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    <span>Marketplace</span>
                  </Button>
                </Link>
                <Link href="/dm">
                  <Button
                    variant={isActive("/dm") ? "default" : "outline"}
                    size="sm"
                    className="w-full justify-start gap-2"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>Messages</span>
                  </Button>
                </Link>
              </div>
            </div>
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center justify-between gap-2">
            <span>© {new Date().getFullYear()} ChefSire</span>
            <div className="flex items-center gap-2">
              <Link href="/terms">Terms</Link>
              <span>•</span>
              <Link href="/privacy">Privacy</Link>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header & Drawer */}
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b bg-background/80 px-3 backdrop-blur lg:hidden">
          <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                {isSidebarOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
              <div className="flex h-14 items-center gap-2 border-b px-3">
                <ChefHat className="h-6 w-6 text-primary" />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">ChefSire</span>
                  <span className="text-[11px] text-muted-foreground">
                    Your kitchen, your kingdom.
                  </span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <ModeToggle />
                  {renderUserAvatar()}
                </div>
              </div>
              <ScrollArea className="h-[calc(100vh-3.5rem)]">
                <nav className="space-y-6 px-3 py-4">
                  {/* Main */}
                  <div>
                    <div className="mb-1 flex items-center justify-between px-1">
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Main
                      </h2>
                    </div>
                    <ul className="space-y-1">
                      {MAIN_NAV_LINKS.map((link) => (
                        <li key={link.href}>
                          <Link href={link.href}>
                            <Button
                              variant={
                                isActive(link.href) ? "default" : "ghost"
                              }
                              size="sm"
                              className={cn(
                                "w-full justify-start gap-2",
                                isActive(link.href) &&
                                  "bg-primary text-primary-foreground shadow-sm"
                              )}
                            >
                              <link.icon className="h-4 w-4" />
                              <span>{link.label}</span>
                            </Button>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Explore */}
                  <div>
                    <div className="mb-1 flex items-center justify-between px-1">
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Explore
                      </h2>
                    </div>
                    <div className="space-y-1">
                      {EXPLORE_NAV_ITEMS.map((item) => (
                        <Link href={item.href} key={item.href}>
                          <Button
                            variant={
                              isActive(item.href) ? "default" : "ghost"
                            }
                            size="sm"
                            className={cn(
                              "w-full justify-start gap-2 text-left",
                              isActive(item.href) &&
                                "bg-secondary text-secondary-foreground shadow-sm"
                            )}
                          >
                            <item.icon className="h-4 w-4" />
                            <div className="flex flex-1 flex-col items-start">
                              <div className="flex w-full items-center justify-between gap-2">
                                <span className="truncate">{item.label}</span>
                                {item.badge && (
                                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              {item.description && (
                                <span className="line-clamp-1 text-[11px] text-muted-foreground">
                                  {item.description}
                                </span>
                              )}
                            </div>
                          </Button>
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* Drinks Hub */}
                  <div>
                    <div className="mb-1 flex items-center justify-between px-1">
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Drinks Hub
                      </h2>
                    </div>
                    <div className="space-y-3 rounded-xl border bg-card/60 p-2">
                      {DRINKS_SECTIONS.map((section) => (
                        <div key={section.title} className="space-y-1.5">
                          <Link href={section.href}>
                            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
                              <section.icon className="h-4 w-4 text-primary" />
                              <div className="flex flex-1 items-center justify-between gap-2">
                                <div className="flex flex-col items-start">
                                  <span className="text-sm font-medium">
                                    {section.title}
                                  </span>
                                  <span className="line-clamp-1 text-[11px] text-muted-foreground">
                                    {section.description}
                                  </span>
                                </div>
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              </div>
                            </button>
                          </Link>
                          <div className="mt-1 grid grid-cols-1 gap-1 pl-2">
                            {section.items.map((sub) => (
                              <div key={sub.title} className="space-y-0.5">
                                <Link href={sub.href}>
                                  <button className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent/70 hover:text-foreground">
                                    <span className="font-medium uppercase tracking-wide">
                                      {sub.title}
                                    </span>
                                    <ChevronRight className="h-3 w-3" />
                                  </button>
                                </Link>
                                <div className="grid grid-cols-1 gap-1 pl-1">
                                  {sub.items.map((item) => (
                                    <Link href={item.href} key={item.id}>
                                      <button className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent/60 hover:text-foreground">
                                        <item.icon className="h-3 w-3" />
                                        <span className="truncate">
                                          {item.label}
                                        </span>
                                        {item.badge && (
                                          <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                                            {item.badge}
                                          </span>
                                        )}
                                      </button>
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      {/* Potent Potables - Age-gated */}
                      <div className="mt-3 space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-2">
                        <div className="flex items-center gap-2">
                          <Wine className="h-4 w-4 text-destructive" />
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold uppercase tracking-wide text-destructive">
                              Potent Potables
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              21+ cocktails, mocktails & party drinks.
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-1 gap-1">
                          <Link href="/drinks/potent">
                            <button className="flex w-full items-center justify-between gap-2 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive hover:bg-destructive/20">
                              <span>Enter Potent Potables</span>
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </Link>
                          <p className="text-[10px] text-muted-foreground">
                            Age verification required. Please drink responsibly.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Creator & Store Tools */}
                  <div>
                    <div className="mb-1 flex items-center justify-between px-1">
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Creator Tools
                      </h2>
                    </div>
                    <div className="space-y-1">
                      <Link href="/store-builder">
                        <Button
                          variant={
                            isActive("/store-builder") ? "default" : "outline"
                          }
                          size="sm"
                          className="w-full justify-start gap-2"
                        >
                          <Store className="h-4 w-4" />
                          <span>Store Builder</span>
                          <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            Beta
                          </span>
                        </Button>
                      </Link>
                      <Link href="/marketplace">
                        <Button
                          variant={
                            isActive("/marketplace") ? "default" : "outline"
                          }
                          size="sm"
                          className="w-full justify-start gap-2"
                        >
                          <ShoppingBag className="h-4 w-4" />
                          <span>Marketplace</span>
                        </Button>
                      </Link>
                      <Link href="/dm">
                        <Button
                          variant={isActive("/dm") ? "default" : "outline"}
                          size="sm"
                          className="w-full justify-start gap-2"
                        >
                          <MessageCircle className="h-4 w-4" />
                          <span>Messages</span>
                        </Button>
                      </Link>
                    </div>
                  </div>
                </nav>
              </ScrollArea>
            </SheetContent>
          </Sheet>

          <Link href="/feed">
            <button className="flex items-center gap-2">
              <ChefHat className="h-6 w-6 text-primary" />
              <span className="text-sm font-semibold">ChefSire</span>
            </button>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <ModeToggle />
            {renderUserAvatar()}
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 bg-muted/20">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="sticky bottom-0 z-20 border-t bg-background/95 px-2 py-1.5 lg:hidden">
          <div className="mx-auto flex max-w-md items-center justify-between gap-1">
            {MAIN_NAV_LINKS.map((link) => (
              <Link href={link.href} key={link.href}>
                <button
                  className={cn(
                    "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-[11px] text-muted-foreground",
                    isActive(link.href) &&
                      "bg-primary/10 text-primary font-medium"
                  )}
                >
                  <link.icon className="h-5 w-5" />
                  <span>{link.label}</span>
                </button>
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
};

export default Layout;
