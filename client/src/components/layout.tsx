import { useEffect, useState, FormEvent } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@/contexts/UserContext";
import {
  Search, Bell, MessageCircle, User, ChevronDown, ChevronRight,
  Settings, LogOut, Plus,
} from "lucide-react";
import Sidebar from "@/components/sidebar";
import MobileNav from "@/components/mobile-nav";
import chefLogo from "../asset/logo.jpg";

interface LayoutProps {
  children: ReactNode;
}

// Top rail quick links
const secondaryLinks = [
  { href: "/", label: "Home" },
  { href: "/bitemap", label: "BiteMap" },
  { href: "/competitions/library", label: "Competitions" },
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
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
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

  const handleCreatePost = () => {
    setLocation("/create");
  };

  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = searchText.trim();
    setIsDropdownOpen(false);
    if (q) setLocation(`/recipes?q=${encodeURIComponent(q)}`);
    else setLocation("/recipes");
  };

  const handleTrendingClick = (term: string) => {
    setSearchText(term);
    setLocation(`/recipes?q=${encodeURIComponent(term)}`);
    setIsDropdownOpen(false);
  };

  const toggleSubmenu = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogout = () => {
    logout();
    setIsDropdownOpen(false);
    setLocation('/');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
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

            {/* Search */}
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
                  <Link href="/competitions/new">
                    <Button
                      size="sm"
                      className="hidden md:inline-flex bg-gradient-to-r from-fuchsia-600 to-rose-600 hover:from-fuchsia-700 hover:to-rose-700 text-white"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Create Cookoff
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
                      aria-label="Royal Table Talk"
                    >
                      <MessageCircle className="h-5 w-5 text-muted-foreground" />
                    </Button>
                  </Link>

                  {/* User menu - UPDATED DESIGN */}
                  <div className="relative">
                    <button
                      onClick={() => setIsDropdownOpen(prev => !prev)}
                      className="flex items-center gap-2 rounded-full border-2 border-border bg-background px-3 py-1.5 hover:bg-muted transition shadow-sm"
                      aria-haspopup="menu"
                      aria-expanded={isDropdownOpen}
                      aria-label="User menu"
                    >
                      <Avatar className="h-8 w-8 border border-orange-500 shadow-sm">
                        <AvatarImage src={user?.avatar || "https://images.unsplash.com/photo-1566554273541-37a9ca77b91f"} />
                        <AvatarFallback>{user?.displayName?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="hidden sm:flex flex-col items-start">
                        <span className="text-xs font-semibold leading-tight text-foreground">
                          {user?.displayName || user?.username}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          View kingdom
                        </span>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>

                    {isDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            setExpandedMenus({});
                          }}
                        />
                        <div className="absolute right-0 mt-2 w-[360px] sm:w-[420px] bg-popover border border-border rounded-xl shadow-xl z-20 overflow-hidden max-h-[calc(100vh-5rem)] overflow-y-auto">
                          {/* Hero Header with Gradient */}
                          <div className="bg-gradient-to-r from-orange-500 via-red-500 to-rose-500 px-4 py-3 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 border-2 border-white shadow-md">
                                <AvatarImage src={user?.avatar || "https://images.unsplash.com/photo-1566554273541-37a9ca77b91f"} />
                                <AvatarFallback>{user?.displayName?.[0] || 'U'}</AvatarFallback>
                              </Avatar>
                              <div>
                                <span className="font-bold text-sm">
                                  {user?.displayName || user?.username}
                                </span>
                                <div className="text-xs text-orange-50">
                                  @{user?.username}
                                </div>
                                <div className="mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-[10px]">
                                  <span>👑</span>
                                  <span>Your kitchen, your kingdom</span>
                                </div>
                              </div>
                            </div>
                            <Link href={`/profile/${user?.id}`}>
                              <Button
                                size="sm"
                                className="border-2 border-white bg-transparent text-white hover:bg-white/20 text-xs rounded-full font-semibold shadow-sm px-4"
                                onClick={() => setIsDropdownOpen(false)}
                              >
                                View profile
                              </Button>
                            </Link>
                          </div>

                          {/* Body */}
                          <div className="py-2">
                            {/* Quick Navigation Cards */}
                            <div className="px-4 py-2">
                              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                                Quick navigation
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <Link
                                  href="/feed"
                                  onClick={() => setIsDropdownOpen(false)}
                                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
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
                                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
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
                                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
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
                                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
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

                            {/* Main Navigation */}
                            <div className="px-4 py-2">
                              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                                Navigation
                              </div>

                              <div className="space-y-1 ml-2">
                                <Link
                                  href="/messages"
                                  onClick={() => setIsDropdownOpen(false)}
                                  className="flex items-center px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                >
                                  💬 Royal Table Talk
                                </Link>

                                <Link
                                  href="/clubs"
                                  onClick={() => setIsDropdownOpen(false)}
                                  className="flex items-center px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                >
                                  🏛️ Royal Clubs
                                </Link>

                                {/* NEW: Achievements */}
                                <Link
                                  href="/achievements"
                                  onClick={() => setIsDropdownOpen(false)}
                                  className="flex items-center px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                >
                                  🏅 Achievements
                                </Link>

                                {/* NEW: Leaderboard */}
                                <Link
                                  href="/leaderboard"
                                  onClick={() => setIsDropdownOpen(false)}
                                  className="flex items-center px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                >
                                  📊 Leaderboard
                                </Link>

                                {/* Competitions */}
                                <div>
                                  <div className="flex items-center justify-between px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                    <Link
                                      href="/competitions/library"
                                      onClick={() => setIsDropdownOpen(false)}
                                      className="flex items-center flex-1 font-semibold"
                                    >
                                      🏆 Competitions
                                    </Link>
                                    <button
                                      onClick={(e) => toggleSubmenu("competitions", e)}
                                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                                    >
                                      <ChevronRight
                                        className={`w-3 h-3 transition-transform ${expandedMenus.competitions ? "rotate-90" : ""}`}
                                      />
                                    </button>
                                  </div>
                                  {expandedMenus.competitions && (
                                    <div className="ml-6 space-y-1">
                                      <Link
                                        href="/competitions/library"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                                      >
                                        📚 Cookoff Library
                                      </Link>
                                      <Link
                                        href="/competitions/live"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                                      >
                                        🔥 Live Battles
                                      </Link>
                                      <Link
                                        href="/competitions/new"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                                      >
                                        ➕ Create Cookoff
                                      </Link>
                                    </div>
                                  )}
                                </div>

                                {/* Recipes */}
                                <div>
                                  <div className="flex items-center justify-between px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                    <Link
                                      href="/recipes"
                                      onClick={() => setIsDropdownOpen(false)}
                                      className="flex items-center flex-1 font-semibold"
                                    >
                                      📖 Recipes
                                    </Link>
                                    <button
                                      onClick={(e) => toggleSubmenu("recipes", e)}
                                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                                    >
                                      <ChevronRight
                                        className={`w-3 h-3 transition-transform ${expandedMenus.recipes ? "rotate-90" : ""}`}
                                      />
                                    </button>
                                  </div>
                                  {expandedMenus.recipes && (
                                    <div className="ml-6 space-y-1">
                                      <Link
                                        href="/recipes"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                                      >
                                        📚 Browse Recipes
                                      </Link>
                                      <Link
                                        href="/recipes/baby-food"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                                      >
                                        👶 Baby Food
                                      </Link>
                                      <Link
                                        href="/pantry"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                                      >
                                        🥘 My Pantry
                                      </Link>
                                      <Link
                                        href="/substitutions"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                                      >
                                        🪄 Substitutions
                                      </Link>
                                    </div>
                                  )}
                                </div>

                                {/* Drinks */}
                                <div>
                                  <div className="flex items-center justify-between px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                    <Link
                                      href="/drinks"
                                      onClick={() => setIsDropdownOpen(false)}
                                      className="flex items-center flex-1 font-semibold"
                                    >
                                      🥤 Drinks
                                    </Link>
                                    <button
                                      onClick={(e) => toggleSubmenu("drinks", e)}
                                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                                    >
                                      <ChevronRight
                                        className={`w-3 h-3 transition-transform ${expandedMenus.drinks ? "rotate-90" : ""}`}
                                      />
                                    </button>
                                  </div>
                                  {expandedMenus.drinks && (
                                    <div className="ml-6 space-y-1">
                                      <Link
                                        href="/drinks/smoothies"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm font-medium"
                                      >
                                        🍎 Smoothies & Bowls
                                      </Link>
                                      <Link
                                        href="/drinks/protein-shakes"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm font-medium"
                                      >
                                        🧪 Protein Shakes
                                      </Link>
                                      <Link
                                        href="/drinks/detoxes"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm font-medium"
                                      >
                                        🍃 Detoxes & Cleanses
                                      </Link>
                                      <Link
                                        href="/drinks/caffeinated"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm font-medium"
                                      >
                                        ☕ Caffeinated Drinks
                                      </Link>
                                      <Link
                                        href="/drinks/potent-potables"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm font-medium"
                                      >
                                        🍷 Potent Potables{" "}
                                        <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-red-100 text-red-700">
                                          21+
                                        </span>
                                      </Link>
                                    </div>
                                  )}
                                </div>

                                {/* Pet Food */}
                                <div>
                                  <div className="flex items-center justify-between px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                    <Link
                                      href="/pet-food"
                                      onClick={() => setIsDropdownOpen(false)}
                                      className="flex items-center flex-1 font-semibold"
                                    >
                                      🐾 Pet Food
                                    </Link>
                                    <button
                                      onClick={(e) => toggleSubmenu("petfood", e)}
                                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                                    >
                                      <ChevronRight
                                        className={`w-3 h-3 transition-transform ${expandedMenus.petfood ? "rotate-90" : ""}`}
                                      />
                                    </button>
                                  </div>
                                  {expandedMenus.petfood && (
                                    <div className="ml-6 space-y-1">
                                      <Link
                                        href="/pet-food/dogs"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                                      >
                                        🐶 Dogs
                                      </Link>
                                      <Link
                                        href="/pet-food/cats"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                                      >
                                        🐱 Cats
                                      </Link>
                                      <Link
                                        href="/pet-food/birds"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                                      >
                                        🦜 Birds
                                      </Link>
                                      <Link
                                        href="/pet-food/small-pets"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                                      >
                                        🐹 Small Pets
                                      </Link>
                                    </div>
                                  )}
                                </div>

                                {/* Catering */}
                                <Link
                                  href="/catering"
                                  onClick={() => setIsDropdownOpen(false)}
                                  className="flex items-center px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                >
                                  🍽️ Catering
                                </Link>

                                {/* Wedding Planning */}
                                <div>
                                  <div className="flex items-center justify-between px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                    <Link
                                      href="/catering/wedding-planning"
                                      onClick={() => setIsDropdownOpen(false)}
                                      className="flex items-center flex-1 font-semibold"
                                    >
                                      💒 Wedding Planning
                                    </Link>
                                    <button
                                      onClick={(e) => toggleSubmenu("wedding", e)}
                                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                                    >
                                      <ChevronRight
                                        className={`w-3 h-3 transition-transform ${expandedMenus.wedding ? "rotate-90" : ""}`}
                                      />
                                    </button>
                                  </div>
                                  {expandedMenus.wedding && (
                                    <div className="ml-6 space-y-1">
                                      <Link
                                        href="/catering/wedding-planning"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                                      >
                                        📋 Planning Hub
                                      </Link>
                                      <Link
                                        href="/catering/wedding-map"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                                      >
                                        🗺️ Vendor Map
                                      </Link>
                                    </div>
                                  )}
                                </div>

                                {/* Marketplace */}
                                <Link
                                  href="/marketplace"
                                  onClick={() => setIsDropdownOpen(false)}
                                  className="flex items-center px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                >
                                  🛒 Marketplace
                                </Link>

                                {/* Nutrition */}
                                <Link
                                  href="/nutrition"
                                  onClick={() => setIsDropdownOpen(false)}
                                  className="flex items-center px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                >
                                  💪 Nutrition
                                </Link>

                                {/* Allergies */}
                                <Link
                                  href="/allergies"
                                  onClick={() => setIsDropdownOpen(false)}
                                  className="flex items-center px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                >
                                  ❤️ Allergies
                                </Link>
                              </div>
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
                                    className="px-2 py-1 rounded-full border border-border text-[11px] hover:bg-muted transition"
                                  >
                                    {term}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Footer with Settings & Logout */}
                          <div className="border-t border-border bg-muted/60 px-4 py-2 flex items-center justify-between text-xs">
                            <Link
                              href="/settings"
                              onClick={() => setIsDropdownOpen(false)}
                              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition"
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
                      </>
                    )}
                  </div>
                </>
              ) : (
                /* Show login/signup buttons when not logged in */
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation('/login')}
                  >
                    Log In
                  </Button>
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => setLocation('/signup')}
                  >
                    Sign Up
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Sub-rail */}
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
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1">
        {user && <Sidebar onCreatePost={handleCreatePost} />}
        <main className={`flex-1 ${user ? 'lg:ml-64' : ''} pb-16 lg:pb-0`}>{children}</main>
      </div>

      {/* Mobile search */}
      <div className="md:hidden px-4 py-2 bg-background border-t border-border">
        <form onSubmit={onSearchSubmit} className="flex gap-2">
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
          <Button type="submit" size="sm" className="shrink-0 rounded-full px-3">
            Go
          </Button>
        </form>
      </div>

      {user && <MobileNav onCreatePost={handleCreatePost} />}
    </div>
  );
}
