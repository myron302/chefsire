import { useEffect, useState, FormEvent } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Search, Bell, MessageCircle, User, ChevronDown,
  ChefHat, Activity, ShoppingCart, Settings, LogOut,
  Home, Compass, BookOpen, GlassWater, Utensils, Heart, Wand2
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

  const secondaryLinks = [
    { href: "/", label: "Home" },
    { href: "/recipes", label: "Recipes" },
    { href: "/potent-potables", label: "Potent Potables" },
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
    
    if (q) {
      setLocation(`/recipes?q=${encodeURIComponent(q)}`);
    } else {
      setLocation("/recipes");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
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

            <div className="flex items-center space-x-4">
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
                <MessageCircle className="h-5 w-5 text-muted-foreground" />
              </Button>

              <div
                className="relative"
                onMouseLeave={() => setIsDropdownOpen(false)}
              >
                <button
                  onClick={() => setIsDropdownOpen((v) => !v)}
                  className="flex items-center space-x-2 hover:bg-muted rounded-full p-1 transition-colors"
                  aria-haspopup="menu"
                  aria-expanded={isDropdownOpen}
                  aria-label="User menu"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src="https://images.unsplash.com/photo-1566554273541-37a9ca77b91f" />
                    <AvatarFallback>CA</AvatarFallback>
                  </Avatar>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>

                {isDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsDropdownOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-20 overflow-hidden">
                      <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-b px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-md">
                            <img src={chefLogo} alt="ChefSire Logo" />
                          </div>
                          <div>
                            <span className="font-bold text-orange-900 dark:text-orange-100 text-base">
                              Chef's Corner
                            </span>
                            <div className="text-xs text-orange-700 dark:text-orange-300">
                              Your culinary kingdom awaits
                            </div>
                          </div>
                        </div>
                      </div>

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
                              <Home className="w-4 h-4 mr-3" /> Feed
                            </Link>

                            <Link
                              href="/explore"
                              onClick={() => setIsDropdownOpen(false)}
                              className="flex items-center px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            >
                              <Compass className="w-4 h-4 mr-3" /> Explore
                            </Link>

                            <Link
                              href="/recipes"
                              onClick={() => setIsDropdownOpen(false)}
                              className="flex items-center px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded font-semibold"
                            >
                              <BookOpen className="w-4 h-4 mr-3" /> Recipes
                            </Link>
                            <Link
                              href="/recipes"
                              onClick={() => setIsDropdownOpen(false)}
                              className="flex items-center pl-9 pr-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                            >
                              <BookOpen className="w-3 h-3 mr-2" /> Browse Recipes
                            </Link>
                            <Link
                              href="/pantry"
                              onClick={() => setIsDropdownOpen(false)}
                              className="flex items-center pl-9 pr-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                            >
                              <ChefHat className="w-3 h-3 mr-2" /> My Pantry
                            </Link>
                            <Link
                              href="/substitutions"
                              onClick={() => setIsDropdownOpen(false)}
                              className="flex items-center pl-9 pr-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                            >
                              <Wand2 className="w-3 h-3 mr-2" /> Ingredient Substitutions
                            </Link>

                            <Link
                              href="/potent-potables"
                              onClick={() => setIsDropdownOpen(false)}
                              className="flex items-center px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            >
                              <GlassWater className="w-4 h-4 mr-3" /> Potent Potables
                            </Link>

                            <Link
                              href="/catering"
                              onClick={() => setIsDropdownOpen(false)}
                              className="flex items-center px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded font-semibold"
                            >
                              <Utensils className="w-4 h-4 mr-3" /> Catering
                            </Link>
                            <Link
                              href="/catering/wedding-planning"
                              onClick={() => setIsDropdownOpen(false)}
                              className="flex items-center pl-9 pr-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                            >
                              <Heart className="w-3 h-3 mr-2" /> Wedding Planning
                            </Link>

                            <Link
                              href="/marketplace"
                              onClick={() => setIsDropdownOpen(false)}
                              className="flex items-center px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            >
                              <ShoppingCart className="w-4 h-4 mr-3" /> Marketplace
                            </Link>

                            <Link
                              href="/nutrition"
                              onClick={() => setIsDropdownOpen(false)}
                              className="flex items-center px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            >
                              <Activity className="w-4 h-4 mr-3" /> Nutrition & Meal Plans
                              <span className="ml-auto px-2 py-0.5 bg-yellow-300 dark:bg-yellow-600 text-xs rounded">
                                Premium
                              </span>
                            </Link>
                          </div>
                        </div>

                        <div className="border-t my-2" />

                        <Link
                          href="/profile"
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
                          onClick={() => {
                            setIsDropdownOpen(false);
                            console.log("Logging out...");
                          }}
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
            </div>
          </div>

          <nav className="border-t border-border bg-background">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <ul className="flex flex-nowrap gap-4 overflow-x-auto no-scrollbar py-2 px-1 touch-pan-x">
                {secondaryLinks.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.href} className="flex-none">
                      <Link
                        href={item.href}
                        className={[
                          "inline-block text-sm font-medium whitespace-nowrap px-2 py-1 rounded transition-colors",
                          isActive
                            ? "text-orange-600 underline decoration-2 underline-offset-4"
                            : "text-muted-foreground hover:text-orange-600",
                          (item as any).indent ? "pl-6" : ""
                        ].join(" ")}
                        aria-current={isActive ? "page" : undefined}
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

      <div className="flex flex-1">
        <Sidebar onCreatePost={handleCreatePost} />
        <main className="flex-1 lg:ml-64 pb-16 lg:pb-0">{children}</main>
      </div>

      <div className="md:hidden px-4 py-3 bg-background border-t border-border sticky bottom-0">
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
          <Button type="submit" size="sm" className="shrink-0 rounded-full px-4">
            Go
          </Button>
        </form>
      </div>

      <MobileNav onCreatePost={handleCreatePost} />
    </div>
  );
}
