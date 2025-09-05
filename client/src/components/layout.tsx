import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Search, Bell, MessageCircle, User, ChevronDown,
  ChefHat, Shuffle, Activity, ShoppingCart, Settings, LogOut,
  Home, Compass, BookOpen, GlassWater, Utensils, Heart
} from "lucide-react";
import Sidebar from "@/components/sidebar";
import MobileNav from "@/components/mobile-nav";
import chefLogo from "../asset/logo.jpg";

interface LayoutProps {
  children: React.ReactNode;
}

function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full overflow-hidden shadow-lg flex items-center justify-center bg-white">
                <img src={chefLogo} alt="ChefSire Logo" className="object-cover w-full h-full" />
              </div>
              <h1
                className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                ChefSire
              </h1>
            </Link>

            {/* Search Bar */}
            <div className="hidden md:flex flex-1 max-w-lg mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search recipes, chefs, or ingredients..."
                  className="w-full pl-10 bg-muted border-border rounded-full"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" className="p-2 hover:bg-muted rounded-full">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="sm" className="p-2 hover:bg-muted rounded-full">
                <MessageCircle className="h-5 w-5 text-muted-foreground" />
              </Button>

              {/* User Dropdown */}
              <div
                className="relative"
                onMouseLeave={() => setIsDropdownOpen(false)}
              >
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center space-x-2 hover:bg-muted rounded-full p-1 transition-colors"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src="https://images.unsplash.com/photo-1566554273541-37a9ca77b91f" />
                    <AvatarFallback>CA</AvatarFallback>
                  </Avatar>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>

                {isDropdownOpen && (
                  <>
                    {/* Backdrop */}
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsDropdownOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-20 overflow-hidden">
                      {/* Header */}
                      <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-b px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-md">
                            <img src={chefLogo} alt="ChefSire Logo" />
                          </div>
                          <div>
                            <span className="font-bold text-orange-900 dark:text-orange-100 text-base">
                              Chef&apos;s Corner
                            </span>
                            <div className="text-xs text-orange-700 dark:text-orange-300">
                              Your culinary kingdom awaits
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Links */}
                      <div className="py-2">
                        {/* Navigation Links */}
                        <div className="px-4 py-2">
                          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                            Navigation
                          </div>
                          <div className="space-y-1 ml-2">
                            <Link href="/feed" onClick={() => setIsDropdownOpen(false)}>
                              <div className="flex items-center px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                <Home className="w-4 h-4 mr-3" />
                                Feed
                              </div>
                            </Link>
                            <Link href="/explore" onClick={() => setIsDropdownOpen(false)}>
                              <div className="flex items-center px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                <Compass className="w-4 h-4 mr-3" />
                                Explore
                              </div>
                            </Link>
                            <Link href="/recipes" onClick={() => setIsDropdownOpen(false)}>
                              <div className="flex items-center px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                <BookOpen className="w-4 h-4 mr-3" />
                                Browse Recipes
                              </div>
                            </Link>
                            <Link href="/potent-potables" onClick={() => setIsDropdownOpen(false)}>
                              <div className="flex items-center px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                <GlassWater className="w-4 h-4 mr-3" />
                                Potent Potables
                              </div>
                            </Link>
                            
                            {/* Catering with submenu */}
                            <div className="space-y-1">
                              <Link href="/catering" onClick={() => setIsDropdownOpen(false)}>
                                <div className="flex items-center px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                  <Utensils className="w-4 h-4 mr-3" />
                                  Catering
                                </div>
                              </Link>
                              <Link href="/catering/wedding-planning" onClick={() => setIsDropdownOpen(false)}>
                                <div className="flex items-center pl-9 pr-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm">
                                  <Heart className="w-3 h-3 mr-2" />
                                  Wedding Planning
                                </div>
                              </Link>
                            </div>
                          </div>
                        </div>
                        
                        <div className="border-t my-2" />
                        
                        <Link href="/profile" onClick={() => setIsDropdownOpen(false)}>
                          <div className="flex items-center px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                            <User className="w-5 h-5 mr-3" />
                            My Profile
                          </div>
                        </Link>
                        
                        <div className="px-4 py-2">
                          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                            Recipe Tools
                          </div>
                          <div className="space-y-1 ml-2">
                            <Link href="/pantry" onClick={() => setIsDropdownOpen(false)}>
                              <div className="flex items-center px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                <ChefHat className="w-4 h-4 mr-3" />
                                My Pantry
                              </div>
                            </Link>
                            <Link href="/substitutions" onClick={() => setIsDropdownOpen(false)}>
                              <div className="flex items-center px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                <Shuffle className="w-4 h-4 mr-3" />
                                Ingredient Substitutions
                              </div>
                            </Link>
                          </div>
                        </div>
                        
                        <div className="border-t my-2" />
                        
                        <Link href="/marketplace" onClick={() => setIsDropdownOpen(false)}>
                          <div className="flex items-center px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                            <ShoppingCart className="w-5 h-5 mr-3" />
                            Marketplace
                          </div>
                        </Link>
                        
                        <Link href="/nutrition" onClick={() => setIsDropdownOpen(false)}>
                          <div className="flex items-center px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                            <Activity className="w-5 h-5 mr-3" />
                            Nutrition & Meal Plans
                            <span className="ml-auto px-2 py-0.5 bg-yellow-300 dark:bg-yellow-600 text-xs rounded">Premium</span>
                          </div>
                        </Link>
                        
                        <div className="border-t my-2" />
                        
                        <Link href="/settings" onClick={() => setIsDropdownOpen(false)}>
                          <div className="flex items-center px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                            <Settings className="w-5 h-5 mr-3" />
                            Settings
                          </div>
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
        </div>
      </header>

      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 lg:ml-64 pb-16 lg:pb-0">{children}</main>
      </div>

      <MobileNav />
    </div>
  );
}

export default Layout;
