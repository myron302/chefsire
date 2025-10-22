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

  const handleCreatePost = () => {
    console.log("Create post clicked");
  };

  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = searchText.trim();
    setIsDropdownOpen(false);
    if (q) setLocation(`/recipes?q=${encodeURIComponent(q)}`);
    else setLocation("/recipes");
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

                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-2 hover:bg-muted rounded-full"
                    aria-label="Notifications"
                  >
                    <Bell className="h-5 w-5 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-2 hover:bg-muted rounded-full"
                    aria-label="Messages"
                  >
                    <MessageCircle className="h-5 h-5 text-muted-foreground" />
                  </Button>

                  {/* User menu */}
                  <div
                    className="relative"
                    onMouseLeave={() => {
                      setIsDropdownOpen(false);
                      setExpandedMenus({});
                    }}
                  >
                    <button
                      onClick={() => setIsDropdownOpen((v) => !v)}
                      className="flex items-center space-x-2 hover:bg-muted rounded-full p-1 transition-colors"
                      aria-haspopup="menu"
                      aria-expanded={isDropdownOpen}
                      aria-label="User menu"
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={user?.avatar || "https://images.unsplash.com/photo-1566554273541-37a9ca77b91f"} />
                        <AvatarFallback>{user?.displayName?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
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
                        <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-20 overflow-hidden max-h-[calc(100vh-5rem)] overflow-y-auto">
                          {/* Header */}
                          <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-b px-4 py-3">
                            <div className="flex items-center space-x-3">
                              <Avatar className="w-7 h-7">
                                <AvatarImage src={user?.avatar} />
                                <AvatarFallback>{user?.displayName?.[0] || 'U'}</AvatarFallback>
                              </Avatar>
                              <div>
                                <span className="font-bold text-orange-900 dark:text-orange-100 text-base">
                                  {user?.displayName || 'User'}
                                </span>
                                <div className="text-xs text-orange-700 dark:text-orange-300">
                                  @{user?.username}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Body */}
                          <div className="py-2">
                            <div className="px-4 py-2">
                              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                                Navigation
                              </div>

                              <div className="space-y-1 ml-2">
                                <Link
                                  href="/feed"
                                  onClick={() => setIsDropdownOpen(false)}
                                  className="flex items-center px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                >
                                  🏠 Feed
                                </Link>

                                <Link
                                  href="/explore"
                                  onClick={() => setIsDropdownOpen(false)}
                                  className="flex items-center px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                >
                                  🧭 Explore
                                </Link>

                                <Link
                                  href="/bitemap"
                                  onClick={() => setIsDropdownOpen(false)}
                                  className="flex items-center px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                >
                                  🗺️ BiteMap
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
                                        className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                                      >
                                        🍎 Smoothies
                                      </Link>
                                      <Link
                                        href="/drinks/protein-shakes"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                                      >
                                        🧪 Protein Shakes
                                      </Link>
                                      <Link
                                        href="/drinks/detoxes"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                                      >
                                        🍃 Detoxes
                                      </Link>
                                      <Link
                                        href="/drinks/potent-potables"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                                      >
                                        🍷 Potent Potables{" "}
                                        <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-red-100 text-red-700">
                                          21+
                                        </span>
                                      </Link>

                                      {/* Zero-proof now lives here */}
                                      <Link
                                        href="/drinks/potent-potables/mocktails"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                                      >
                                        🧃 Mocktails (Zero-Proof)
                                      </Link>

                                      {/* Quick link to Daiquiri page */}
                                      <Link
                                        href="/drinks/potent-potables/daiquiri"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                                      >
                                        🍓 Daiquiri
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
                              </div>
                            </div>

                            <div className="border-t my-2" />

                            {/* Profile / Settings / Sign out */}
                            <Link
                              href={`/profile/${user?.id}`}
                              onClick={() => setIsDropdownOpen(false)}
                              className="flex items-center px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                            >
                              <User className="w-5 h-5 mr-3" /> My Profile
                            </Link>

                            <Link
                              href="/settings"
                              onClick={() => setIsDropdownOpen(false)}
                              className="flex items-center px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                            >
                              <Settings className="w-5 h-5 mr-3" /> Settings
                            </Link>

                            <button
                              onClick={handleLogout}
                              className="flex items-center w-full px-4 py-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-left"
                            >
                              <LogOut className="w-5 h-5 mr-3" />
                              Sign Out
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
