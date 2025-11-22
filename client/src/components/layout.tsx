import { useEffect, useState, FormEvent } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@/contexts/UserContext";
import {
  Search,
  Bell,
  MessageCircle,
  User,
  ChevronDown,
  ChevronRight,
  Settings,
  LogOut,
  Plus,
} from "lucide-react";
import Sidebar from "@/components/sidebar";
import MobileNav from "@/components/mobile-nav";
import NotificationBell from "@/components/NotificationBell";
import chefLogo from "../asset/logo.jpg";

interface LayoutProps {
  children: ReactNode;
}

type NavSection = {
  title: string;
  items: { href: string; label: string; description?: string }[];
};

type QuickLink = {
  href: string;
  label: string;
};

const navSections: NavSection[] = [
  {
    title: "Your Daily Flow",
    items: [
      {
        href: "/",
        label: "Home Feed",
        description: "See what your favorite chefs & friends are cooking.",
      },
      {
        href: "/explore",
        label: "Explore",
        description: "Discover trending recipes, creators, and collections.",
      },
      {
        href: "/bitemap",
        label: "BiteMap",
        description: "Find local eats, food trucks, and pop-ups near you.",
      },
    ],
  },
  {
    title: "Planning & Tools",
    items: [
      {
        href: "/meal-planner",
        label: "Meal Planner",
        description: "Plan your week with recipes & smart suggestions.",
      },
      {
        href: "/substitutions",
        label: "Substitutions",
        description: "Swap ingredients using your pantry & diet filters.",
      },
      {
        href: "/nutrition",
        label: "Nutrition",
        description: "Track macros, goals, and nutrition logs.",
      },
    ],
  },
  {
    title: "Specialty Hubs",
    items: [
      {
        href: "/drinks",
        label: "Drinks Hub",
        description: "Smoothies, shakes, detox drinks, coffee & cocktails.",
      },
      {
        href: "/baby-food",
        label: "Baby Food",
        description: "Stage-based feeding, purees, and toddler plates.",
      },
      {
        href: "/pet-food",
        label: "Pet Food",
        description: "Homemade treats & balanced bowls for pets.",
      },
    ],
  },
  {
    title: "Events & Services",
    items: [
      {
        href: "/catering",
        label: "Catering Marketplace",
        description: "Book caterers, private chefs & event menus.",
      },
      {
        href: "/catering/wedding-planning",
        label: "Wedding Planning",
        description: "Find venues, tastings, and wedding vendors.",
      },
      {
        href: "/competitions",
        label: "Competitions",
        description: "Join cook-offs, challenges & live events.",
      },
    ],
  },
  {
    title: "Progress & Rewards",
    items: [
      {
        href: "/leaderboard",
        label: "Leaderboard",
        description: "See top chefs, streaks & points.",
      },
      {
        href: "/achievements",
        label: "Achievements",
        description: "Track crowns, badges & milestones.",
      },
    ],
  },
  {
    title: "Commerce & Creator Tools",
    items: [
      {
        href: "/marketplace",
        label: "Marketplace",
        description: "Buy tools, kits, and digital products.",
      },
      {
        href: "/store-builder",
        label: "Store Builder",
        description: "Design your own shop & sell to your audience.",
      },
    ],
  },
];

const quickLinks: QuickLink[] = [
  { href: "/meal-planner", label: "Meal Planner" },
  { href: "/catering", label: "Catering" },
  { href: "/catering/wedding-planning", label: "Wedding Planning" },
  { href: "/baby-food", label: "Baby Food" },
  { href: "/pet-food", label: "Pet Food" },
  { href: "/drinks", label: "Drinks Hub" },
  { href: "/bitemap", label: "BiteMap" },
];

const secondaryLinks: QuickLink[] = [
  { href: "/", label: "Home" },
  { href: "/bitemap", label: "BiteMap" },
  { href: "/competitions/library", label: "Competitions" },
  { href: "/leaderboard", label: "Leaderboard" },   // NEW
  { href: "/achievements", label: "Achievements" }, // NEW
  { href: "/recipes", label: "Recipes" },
  { href: "/drinks", label: "Drinks" },
  { href: "/pet-food", label: "Pet Food" },
  { href: "/catering", label: "Catering" },
  { href: "/store", label: "Store" },
];

const trendingSearches = [
  "High-protein smoothies",
  "Wedding tasting menus",
  "Baby-led weaning ideas",
  "Local taco trucks",
  "Vegan comfort food",
  "Pet-friendly treats",
];

export default function Layout({ children }: LayoutProps) {
  const [pathname, setLocation] = useLocation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>(
    {}
  );
  const { user, logout } = useUser();

  useEffect(() => {
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setIsDropdownOpen(false);
  }, [pathname]);

  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = searchText.trim();
    if (!trimmed) return;
    setLocation(`/explore?search=${encodeURIComponent(trimmed)}`);
  };

  const handleTrendingClick = (term: string) => {
    setSearchText(term);
    setLocation(`/explore?search=${encodeURIComponent(term)}`);
    setIsDropdownOpen(false);
  };

  const handleCreatePost = () => {
    setLocation("/create");
  };

  const toggleSubmenu = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogout = () => {
    logout();
    setIsDropdownOpen(false);
    setLocation("/");
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 supports-[backdrop-filter]:backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand */}
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full overflow-hidden shadow-lg flex items-center justify-center bg-white">
                <img
                  src={chefLogo}
                  alt="ChefSire Logo"
                  className="object-cover w-full h-full"
                />
              </div>
              <h1
                className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                ChefSire
              </h1>
            </Link>

            {/* Desktop Search (center) */}
            <div className="hidden md:flex flex-1 max-w-lg mx-8">
              <form className="relative w-full" onSubmit={onSearchSubmit}>
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search recipes, chefs, or ingredients..."
                  className="w-full pl-10 bg-muted border-border rounded-full"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  aria-label="Search site"
                />
              </form>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <Link href="/create">
                    <Button
                      size="sm"
                      className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-4 bg-orange-600 hover:bg-orange-700 text-white shadow-sm"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Share a dish</span>
                    </Button>
                  </Link>

                  {/* TEMPORARILY DISABLED - NotificationBell causing 502 on refresh */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-2 hover:bg-muted rounded-full"
                    aria-label="Notifications"
                  >
                    <Bell className="h-5 w-5 text-muted-foreground" />
                  </Button>
                  <Link href="/messages">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-2 hover:bg-muted rounded-full"
                      aria-label="Messages"
                    >
                      <MessageCircle className="h-5 w-5 text-muted-foreground" />
                    </Button>
                  </Link>

                  {/* Profile Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setIsDropdownOpen((prev) => !prev)}
                      className="flex items-center gap-2 rounded-full border border-border bg-card px-2 py-1 hover:bg-muted transition"
                    >
                      <Avatar className="h-8 w-8 border border-orange-500 shadow-sm">
                        {user.avatarUrl ? (
                          <AvatarImage
                            src={user.avatarUrl}
                            alt={user.username}
                          />
                        ) : (
                          <AvatarFallback>
                            {user.displayName?.[0]?.toUpperCase() ?? "C"}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="hidden sm:flex flex-col items-start">
                        <span className="text-xs font-semibold leading-tight">
                          {user.displayName || user.username}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          View kingdom
                        </span>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>

                    {isDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-[360px] sm:w-[420px] bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                        {/* Header with colored profile block */}
                        <div className="bg-gradient-to-r from-orange-500 via-red-500 to-rose-500 px-4 py-3 text-white flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border border-white">
                              {user.avatarUrl ? (
                                <AvatarImage
                                  src={user.avatarUrl}
                                  alt={user.username}
                                />
                              ) : (
                                <AvatarFallback>
                                  {user.displayName?.[0]?.toUpperCase() ?? "C"}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div>
                              <span className="font-bold text-sm">
                                {user.displayName || user.username}
                              </span>
                              <div className="text-xs text-orange-50">
                                @{user.username}
                              </div>
                              <div className="mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-[10px]">
                                <span>👑</span>
                                <span>Your kitchen, your kingdom</span>
                              </div>
                            </div>
                          </div>
                          <Link href="/profile">
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-white/70 text-white hover:bg-white/10 text-xs rounded-full"
                            >
                              View profile
                            </Button>
                          </Link>
                        </div>

                        {/* Body */}
                        <div className="py-2">
                          {/* Quick nav tiles */}
                          <div className="px-4 py-2">
                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                              Quick navigation
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <Link
                                href="/"
                                onClick={() => setIsDropdownOpen(false)}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                              >
                                <span className="text-lg">🏠</span>
                                <div>
                                  <div className="font-semibold">Home Feed</div>
                                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                    Latest dishes & stories
                                  </div>
                                </div>
                              </Link>
                              <Link
                                href="/explore"
                                onClick={() => setIsDropdownOpen(false)}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                              >
                                <span className="text-lg">🧭</span>
                                <div>
                                  <div className="font-semibold">Explore</div>
                                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                    Discover new creators
                                  </div>
                                </div>
                              </Link>
                              <Link
                                href="/drinks"
                                onClick={() => setIsDropdownOpen(false)}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                              >
                                <span className="text-lg">🥤</span>
                                <div>
                                  <div className="font-semibold">Drinks Hub</div>
                                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                    Smoothies, shakes & more
                                  </div>
                                </div>
                              </Link>
                              <Link
                                href="/bitemap"
                                onClick={() => setIsDropdownOpen(false)}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                              >
                                <span className="text-lg">📍</span>
                                <div>
                                  <div className="font-semibold">BiteMap</div>
                                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                    Local eats & maps
                                  </div>
                                </div>
                              </Link>
                            </div>
                          </div>

                          <div className="border-t border-border my-2" />

                          {/* Sections from navSections (includes Progress & Rewards) */}
                          <div className="px-4 space-y-2 text-sm">
                            {navSections.map((section) => (
                              <div key={section.title}>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                                    {section.title}
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  {section.items.map((item) => (
                                    <Link
                                      key={item.href}
                                      href={item.href}
                                      onClick={() => setIsDropdownOpen(false)}
                                      className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted transition"
                                    >
                                      <div>
                                        <div className="font-medium text-xs">
                                          {item.label}
                                        </div>
                                        {item.description && (
                                          <div className="text-[11px] text-muted-foreground">
                                            {item.description}
                                          </div>
                                        )}
                                      </div>
                                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="border-t border-border my-2" />

                          {/* Trending Searches */}
                          <div className="px-4 pb-2">
                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                              Trending searches
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {trendingSearches.map((term) => (
                                <button
                                  key={term}
                                  onClick={() => handleTrendingClick(term)}
                                  className="px-2 py-1 rounded-full border border-border text-[11px] hover:bg-muted"
                                >
                                  {term}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="border-t border-border bg-muted/60 px-4 py-2 flex items-center justify-between text-xs">
                          <Link
                            href="/settings"
                            onClick={() => setIsDropdownOpen(false)}
                            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                          >
                            <Settings className="h-3.5 w-3.5" />
                            <span>Settings</span>
                          </Link>
                          <button
                            onClick={handleLogout}
                            className="inline-flex items-center gap-1 text-destructive hover:underline"
                          >
                            <LogOut className="h-3.5 w-3.5" />
                            <span>Log out</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                  >
                    <Link href="/login">
                      <User className="h-4 w-4 mr-1" />
                      Log in
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    className="rounded-full bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <Link href="/signup">Join ChefSire</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1">
        {/* Sidebar (Desktop) */}
        <aside className="hidden lg:block w-72 border-r border-border bg-card/40">
          <Sidebar />
        </aside>

        {/* Main Content with profile hero */}
        <main
          className={`flex-1 ${
            user ? "lg:ml-0" : ""
          } pb-16 lg:pb-0 bg-muted/20`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
            {user && (
              <section className="rounded-2xl border border-orange-100 bg-gradient-to-r from-orange-50 via-rose-50 to-red-50 dark:from-orange-900/40 dark:via-rose-900/30 dark:to-red-900/40 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border border-white/70 shadow">
                    {user.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt={user.username} />
                    ) : (
                      <AvatarFallback>
                        {user.displayName?.[0]?.toUpperCase() ?? "C"}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {user.displayName || user.username}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/40 text-orange-900 dark:bg-black/30 dark:text-orange-100">
                        Royal Chef
                      </span>
                    </div>
                    <div className="text-xs text-orange-900/80 dark:text-orange-50/80">
                      @{user.username} · Your kitchen, your kingdom
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3 justify-start sm:justify-end">
                  <Link href="/leaderboard">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full border-orange-300 bg-white/70 hover:bg-white"
                    >
                      🏆 Leaderboard
                    </Button>
                  </Link>
                  <Link href="/achievements">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full border-orange-300 bg-white/70 hover:bg-white"
                    >
                      ⭐ Achievements
                    </Button>
                  </Link>
                  <Link href={`/profile/${user.id ?? ""}`}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-full text-orange-900 dark:text-orange-100 hover:bg-white/40"
                    >
                      View profile →
                    </Button>
                  </Link>
                </div>
              </section>
            )}

            {children}
          </div>
        </main>
      </div>

      {/* Secondary Nav (Desktop & Tablet) */}
      <nav className="border-t border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ul className="flex flex-nowrap gap-4 overflow-x-auto no-scrollbar py-2 px-1 touch-pan-x">
            {secondaryLinks.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href} className="flex-none">
                  <Link
                    href={item.href}
                    className={[
                      "inline-block text-sm font-medium whitespace-nowrap px-2 py-1 rounded transition-colors",
                      active
                        ? "text-orange-600 underline decoration-2 underline-offset-4"
                        : "text-muted-foreground hover:text-orange-600",
                    ].join(" ")}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Mobile Bottom Sheet & Quick Links */}
      <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden bg-gradient-to-t from-background via-background/95 to-background/70 border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.1)]">
        <div className="max-w-md mx-auto px-3 py-2 space-y-2">
          {/* Mobile search */}
          <form onSubmit={onSearchSubmit} className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Search recipes..."
                className="w-full pl-10 bg-muted border-border rounded-full"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                aria-label="Search site (mobile)"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              className="shrink-0 rounded-full px-3"
            >
              Go
            </Button>
          </form>

          {/* Quick links */}
          <div className="flex gap-1 overflow-x-auto no-scrollbar text-xs py-1">
            {quickLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => setLocation(link.href)}
                className="px-2 py-1 rounded-full bg-muted text-muted-foreground hover:bg-orange-600 hover:text-white whitespace-nowrap"
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Mobile nav icons row */}
          {user && <MobileNav onCreatePost={handleCreatePost} />}
        </div>
      </div>
    </div>
  );
}
