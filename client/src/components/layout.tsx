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

type QuickLink = {
  label: string;
  href: string;
};

const QUICK_LINKS: QuickLink[] = [
  { label: "Meal Planner", href: "/meal-planner" },
  { label: "Catering", href: "/catering" },
  { label: "Wedding Planning", href: "/wedding-planning" },
  { label: "Baby Food", href: "/baby-food" },
  { label: "Pet Food", href: "/pet-food" },
  { label: "Drinks Hub", href: "/drinks" },
  { label: "BiteMap", href: "/bitemap" },
];

// If you want suggested keywords matching your site:
const SUGGESTED_SEARCHES = [
  "High-protein smoothies",
  "Baby-led weaning ideas",
  "Wedding tasting menus",
  "Pet-friendly treats",
  "Local food trucks",
  "Vegan protein shakes",
];

function Layout({ children }: LayoutProps) {
  const { user, isLoading } = useUser();
  const [location, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    recipes: false,
    events: false,
    marketplace: false,
  });

  useEffect(() => {
    // Close dropdown when location changes
    setIsDropdownOpen(false);
  }, [location]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = searchTerm.trim();
    if (!trimmed) return;
    setLocation(`/explore?search=${encodeURIComponent(trimmed)}`);
  };

  const handleQuickLinkClick = (href: string) => {
    setLocation(href);
    setIsDropdownOpen(false);
  };

  const toggleMenu = (menu: string) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menu]: !prev[menu],
    }));
  };

  const handleSuggestedSearchClick = (term: string) => {
    setSearchTerm(term);
    setLocation(`/explore?search=${encodeURIComponent(term)}`);
    setIsSearchFocused(false);
  };

  const handleCreatePost = () => {
    setLocation("/create-post");
  };

  const initials =
    user?.displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("") || user?.username?.[0] || "C";

  const isOnFeed = location === "/feed";

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar (Desktop) */}
      <aside className="hidden w-64 border-r bg-card/40 lg:block">
        <Sidebar />
      </aside>

      {/* Main Content */}
      <div className="flex min-h-screen flex-1 flex-col">
        {/* Top Navigation */}
        <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-3 sm:px-4">
            {/* Logo + Brand */}
            <Link href="/feed">
              <button className="flex items-center gap-2">
                <img
                  src={chefLogo}
                  alt="ChefSire"
                  className="h-8 w-8 rounded-full border object-cover"
                />
                <div className="hidden flex-col leading-tight sm:flex">
                  <span className="text-sm font-semibold">ChefSire</span>
                  <span className="text-[11px] text-muted-foreground">
                    Rule your kitchen. Rule your feed.
                  </span>
                </div>
              </button>
            </Link>

            {/* Search Bar */}
            <form
              onSubmit={handleSearchSubmit}
              className="relative ml-1 flex flex-1 items-center gap-2"
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search recipes, creators, ingredients, or local bites..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => {
                    // Small delay so click events register
                    setTimeout(() => setIsSearchFocused(false), 100);
                  }}
                  className="h-9 w-full pl-8 pr-3 text-xs sm:text-sm"
                />
                {/* Suggested Searches Dropdown */}
                {isSearchFocused && SUGGESTED_SEARCHES.length > 0 && (
                  <div className="absolute left-0 right-0 top-10 z-30 rounded-md border bg-popover text-popover-foreground shadow-lg">
                    <div className="flex items-center justify-between px-3 py-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Suggested searches
                      </span>
                    </div>
                    <div className="border-t">
                      {SUGGESTED_SEARCHES.map((term) => (
                        <button
                          key={term}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSuggestedSearchClick(term)}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent sm:text-sm"
                        >
                          <Search className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="truncate">{term}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Post Button (Desktop) */}
              <div className="hidden items-center gap-2 md:flex">
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleCreatePost}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Create</span>
                  <span className="inline sm:hidden">Post</span>
                </Button>
              </div>
            </form>

            {/* Right-side icons */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Notifications */}
              <NotificationBell />

              {/* Messages */}
              <Button
                variant="ghost"
                size="icon"
                className="hidden sm:inline-flex"
                asChild
              >
                <Link href="/dm">
                  <MessageCircle className="h-4 w-4" />
                </Link>
              </Button>

              {/* Auth / User Dropdown */}
              {isLoading ? (
                <Avatar className="h-8 w-8 border">
                  <AvatarFallback>...</AvatarFallback>
                </Avatar>
              ) : user ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen((prev) => !prev)}
                    className="flex items-center gap-2 rounded-full border bg-card px-2 py-1 text-xs hover:bg-accent"
                  >
                    <Avatar className="h-7 w-7 border">
                      {user.avatarUrl ? (
                        <AvatarImage
                          src={user.avatarUrl}
                          alt={user.username}
                        />
                      ) : (
                        <AvatarFallback>{initials}</AvatarFallback>
                      )}
                    </Avatar>
                    <div className="hidden flex-col text-left sm:flex">
                      <span className="max-w-[120px] truncate text-xs font-medium">
                        {user.displayName || user.username}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        View profile
                      </span>
                    </div>
                    <ChevronDown className="hidden h-3 w-3 text-muted-foreground sm:block" />
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute right-0 z-30 mt-2 w-60 rounded-md border bg-popover text-popover-foreground shadow-lg">
                      <div className="flex items-center gap-2 border-b px-3 py-2">
                        <Avatar className="h-8 w-8 border">
                          {user.avatarUrl ? (
                            <AvatarImage
                              src={user.avatarUrl}
                              alt={user.username}
                            />
                          ) : (
                            <AvatarFallback>{initials}</AvatarFallback>
                          )}
                        </Avatar>
                        <div className="flex flex-col text-left">
                          <span className="text-xs font-semibold">
                            {user.displayName || user.username}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            @{user.username}
                          </span>
                        </div>
                      </div>

                      <div className="max-h-72 overflow-y-auto py-1 text-sm">
                        {/* Quick Navigation Sections */}
                        <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Jump to
                        </div>

                        {/* Recipes & Planning */}
                        <button
                          type="button"
                          onClick={() => toggleMenu("recipes")}
                          className="flex w-full items-center justify-between px-3 py-1.5 text-xs hover:bg-accent/60"
                        >
                          <span className="flex items-center gap-2">
                            <Search className="h-3.5 w-3.5" />
                            <span>Recipes & Planning</span>
                          </span>
                          <ChevronRight
                            className={`h-3 w-3 transition-transform ${
                              expandedMenus.recipes ? "rotate-90" : ""
                            }`}
                          />
                        </button>
                        {expandedMenus.recipes && (
                          <div className="space-y-0.5 px-4 pb-1 text-xs">
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickLinkClick("/recipes")
                              }
                              className="flex w-full items-center justify-between rounded-md px-2 py-1 hover:bg-accent/50"
                            >
                              <span>All Recipes</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickLinkClick("/meal-planner")
                              }
                              className="flex w-full items-center justify-between rounded-md px-2 py-1 hover:bg-accent/50"
                            >
                              <span>Meal Planner</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickLinkClick("/substitutions")
                              }
                              className="flex w-full items-center justify-between rounded-md px-2 py-1 hover:bg-accent/50"
                            >
                              <span>Substitutions</span>
                            </button>
                          </div>
                        )}

                        {/* Events & Services */}
                        <button
                          type="button"
                          onClick={() => toggleMenu("events")}
                          className="flex w-full items-center justify-between px-3 py-1.5 text-xs hover:bg-accent/60"
                        >
                          <span className="flex items-center gap-2">
                            <Bell className="h-3.5 w-3.5" />
                            <span>Events & Services</span>
                          </span>
                          <ChevronRight
                            className={`h-3 w-3 transition-transform ${
                              expandedMenus.events ? "rotate-90" : ""
                            }`}
                          />
                        </button>
                        {expandedMenus.events && (
                          <div className="space-y-0.5 px-4 pb-1 text-xs">
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickLinkClick("/catering")
                              }
                              className="flex w-full items-center justify-between rounded-md px-2 py-1 hover:bg-accent/50"
                            >
                              <span>Catering Marketplace</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickLinkClick("/wedding-planning")
                              }
                              className="flex w-full items-center justify-between rounded-md px-2 py-1 hover:bg-accent/50"
                            >
                              <span>Wedding Planning</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickLinkClick("/competitions")
                              }
                              className="flex w-full items-center justify-between rounded-md px-2 py-1 hover:bg-accent/50"
                            >
                              <span>Competitions</span>
                            </button>
                          </div>
                        )}

                        {/* Marketplace & Tools */}
                        <button
                          type="button"
                          onClick={() => toggleMenu("marketplace")}
                          className="flex w-full items-center justify-between px-3 py-1.5 text-xs hover:bg-accent/60"
                        >
                          <span className="flex items-center gap-2">
                            <Settings className="h-3.5 w-3.5" />
                            <span>Marketplace & Tools</span>
                          </span>
                          <ChevronRight
                            className={`h-3 w-3 transition-transform ${
                              expandedMenus.marketplace ? "rotate-90" : ""
                            }`}
                          />
                        </button>
                        {expandedMenus.marketplace && (
                          <div className="space-y-0.5 px-4 pb-1 text-xs">
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickLinkClick("/marketplace")
                              }
                              className="flex w-full items-center justify-between rounded-md px-2 py-1 hover:bg-accent/50"
                            >
                              <span>Marketplace</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickLinkClick("/store-builder")
                              }
                              className="flex w-full items-center justify-between rounded-md px-2 py-1 hover:bg-accent/50"
                            >
                              <span>Store Builder</span>
                            </button>
                          </div>
                        )}

                        {/* Simple quick links */}
                        <div className="mt-1 space-y-0.5 border-t px-3 py-2 text-xs">
                          {QUICK_LINKS.map((link) => (
                            <button
                              key={link.href}
                              type="button"
                              onClick={() => handleQuickLinkClick(link.href)}
                              className="flex w-full items-center justify-between rounded-md px-2 py-1 hover:bg-accent/50"
                            >
                              <span>{link.label}</span>
                              <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between rounded-md px-2 py-1 hover:bg-accent/50"
                          onClick={() => handleQuickLinkClick("/settings")}
                        >
                          <span className="flex items-center gap-2">
                            <Settings className="h-3.5 w-3.5" />
                            <span>Settings</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className="mt-1 flex w-full items-center justify-between rounded-md px-2 py-1 text-destructive hover:bg-destructive/10"
                          onClick={() => handleQuickLinkClick("/logout")}
                        >
                          <span className="flex items-center gap-2">
                            <LogOut className="h-3.5 w-3.5" />
                            <span>Log out</span>
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  <Link href="/signup">
                    <User className="mr-1 h-3.5 w-3.5" />
                    Join ChefSire
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Mobile Nav Bar */}
          <div className="flex items-center border-t bg-background/90 px-3 py-1.5 lg:hidden">
            <MobileNav onCreatePost={handleCreatePost} />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 bg-muted/20">
          {/* Optional hero for the feed */}
          {isOnFeed && (
            <div className="border-b bg-gradient-to-r from-primary/5 via-background to-secondary/10">
              <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2 sm:px-4 sm:py-3">
                <div className="flex flex-col gap-0.5 text-xs sm:text-sm">
                  <span className="font-semibold">
                    Welcome back to your kingdom,{" "}
                    {user?.displayName || user?.username || "Chef"}.
                  </span>
                  <span className="text-[11px] text-muted-foreground sm:text-xs">
                    Share a dish, join a cook-off, or discover something new in
                    your BiteMap.
                  </span>
                </div>
                <div className="hidden flex-col items-end gap-1 text-right text-[11px] sm:flex">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                    Tip: Use the search bar to find creators near you.
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="xs"
                      variant="outline"
                      asChild
                      className="h-6 px-2 text-[10px]"
                    >
                      <Link href="/bitemap">Explore BiteMap</Link>
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      asChild
                      className="h-6 px-2 text-[10px]"
                    >
                      <Link href="/competitions">Join a Cook-Off</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mx-auto flex max-w-6xl flex-1 flex-col px-2 pb-16 pt-3 sm:px-4 sm:pb-6 sm:pt-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default Layout;
