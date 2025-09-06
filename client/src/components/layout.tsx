import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Search, Bell, MessageCircle, User, ChevronDown,
  ChefHat, Shuffle, Activity, ShoppingCart, Settings, LogOut,
  Home, Compass, BookOpen, GlassWater, Utensils, Heart, Lightbulb
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
                      {/* Dropdown content (unchanged) */}
                      {/* ... */}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ✅ Secondary Navigation (scrollable, mobile-friendly) */}
        <nav className="border-t border-border bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <ul className="flex items-center space-x-4 overflow-x-auto no-scrollbar py-2">
              {[
                { href: "/", label: "Home" },
                { href: "/substitutions", label: "Substitutions" },
                { href: "/ai-substitution", label: "AI Substitution" },
                { href: "/potent-potables", label: "Potent Potables" },
                { href: "/catering", label: "Catering" },
                { href: "/store", label: "Store" },
              ].map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>
                    <a
                      className={`text-sm font-medium whitespace-nowrap px-2 py-1 rounded hover:text-orange-600 transition-colors ${
                        location === item.href
                          ? "text-orange-600 underline decoration-2 underline-offset-4"
                          : "text-muted-foreground"
                      }`}
                      aria-current={location === item.href ? "page" : undefined}
                    >
                      {item.label}
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </header>

      {/* Main layout */}
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 lg:ml-64 pb-16 lg:pb-0">{children}</main>
      </div>

      <MobileNav />
    </div>
  );
}

export default Layout;
