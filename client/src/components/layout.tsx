import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Search, 
  Bell, 
  MessageCircle, 
  Home, 
  Compass, 
  BookOpen, 
  User, 
  Plus,
  Bookmark,
  Users,
  Settings,
  ChevronDown,
  LogOut,
  Activity,
  Shuffle,
  ShoppingCart,
  ChefHat
} from "lucide-react";
import Sidebar from "@/components/sidebar";
import MobileNav from "@/components/mobile-nav";
// Import logo from the current location
import chefLogo from "../asset/logo.jpg";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Load Google Fonts
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Temporary create post handler - just show alert instead of modal
  const handleCreatePost = () => {
    alert('Create post functionality temporarily disabled - modal component has issues');
    setIsCreateModalOpen(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full overflow-hidden shadow-lg flex items-center justify-center bg-white">
                <img 
                  src={chefLogo} 
                  alt="ChefSire Logo" 
                  className="object-cover w-full h-full"
                  style={{ display: 'block' }}
                />
              </div>
              <h1 
                className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent"
                style={{ 
                  fontFamily: "'Playfair Display', serif",
                  fontWeight: 700,
                  letterSpacing: '-0.5px'
                }}
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
                  data-testid="search-input"
                />
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm" 
                className="p-2 hover:bg-muted rounded-full"
                data-testid="button-notifications"
              >
                <Bell className="h-5 w-5 text-muted-foreground" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="p-2 hover:bg-muted rounded-full"
                data-testid="button-messages"
              >
                <MessageCircle className="h-5 w-5 text-muted-foreground" />
              </Button>
              
              {/* User Dropdown */}
              <div className="relative">
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
                
                {/* Dropdown Menu - Improved styling */}
                {isDropdownOpen && (
                  <>
                    {/* Backdrop to close dropdown */}
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsDropdownOpen(false)}
                    />
                    
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border-2 border-gray-200 dark:border-gray-700 z-20 overflow-hidden">
                      {/* Chef's Corner Section */}
                      <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-b-2 border-orange-200 dark:border-orange-800 px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-md">
                            <img 
                              src={chefLogo} 
                              alt="ChefSire Logo" 
                              className="object-cover w-full h-full"
                              style={{ width: '100%', height: '100%', borderRadius: '50%' }}
                            />
                          </div>
                          <div>
                            <span 
                              className="font-bold text-orange-900 dark:text-orange-100 text-base"
                              style={{ fontFamily: "'Playfair Display', serif" }}
                            >
                              Chef's Corner
                            </span>
                            <div className="text-xs text-orange-700 dark:text-orange-300">
                              Your culinary kingdom awaits
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Navigation Links */}
                      <div className="py-2">
                        <Link href="/profile" onClick={() => setIsDropdownOpen(false)}>
                          <div className="flex items-center px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                            <User className="w-5 h-5 mr-3 text-gray-600 dark:text-gray-400" />
                            My Profile
                          </div>
                        </Link>
                        
                        {/* Recipe Tools Submenu */}
                        <div className="px-4 py-2">
                          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                            Recipe Tools
                          </div>
                          <div className="space-y-1 ml-2">
                            <Link href="/pantry" onClick={() => setIsDropdownOpen(false)}>
                              <div className="flex items-center px-2 py-2 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors">
                                <ChefHat className="w-4 h-4 mr-3 text-gray-600 dark:text-gray-400" />
                                My Pantry
                              </div>
                            </Link>
                            
                            <Link href="/substitutions" onClick={() => setIsDropdownOpen(false)}>
                              <div className="flex items-center px-2 py-2 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors">
                                <Shuffle className="w-4 h-4 mr-3 text-gray-600 dark:text-gray-400" />
                                Ingredient Substitutions
                              </div>
                            </Link>
                          </div>
                        </div>
                        
                        <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
                        
                        <Link href="/nutrition" onClick={() => setIsDropdownOpen(false)}>
                          <div className="flex items-center px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                            <Activity className="w-5 h-5 mr-3 text-gray-600 dark:text-gray-400" />
                            <div>
                              <div>Nutrition & Meal Plans</div>
                              <div className="text-xs text-orange-600 dark:text-orange-400 font-medium">Premium</div>
                            </div>
                          </div>
                        </Link>
                        
                        <Link href="/marketplace" onClick={() => setIsDropdownOpen(false)}>
                          <div className="flex items-center px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                            <ShoppingCart className="w-5 h-5 mr-3 text-gray-600 dark:text-gray-400" />
                            Marketplace
                          </div>
                        </Link>
                        
                        <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
                        
                        <Link href="/settings" onClick={() => setIsDropdownOpen(false)}>
                          <div className="flex items-center px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                            <Settings className="w-5 h-5 mr-3 text-gray-600 dark:text-gray-400" />
                            Settings
                          </div>
                        </Link>
                        
                        <button 
                          onClick={() => {
                            setIsDropdownOpen(false);
                            // Add logout logic here
                            console.log('Logging out...');
                          }}
                          className="flex items-center w-full px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-left transition-colors"
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
        {/* Desktop Sidebar */}
        <Sidebar onCreatePost={handleCreatePost} />
        
        {/* Main Content */}
        <main className="flex-1 lg:ml-64 pb-16 lg:pb-0">
          {children}
        </main>
      </div>
      
      {/* Mobile Navigation */}
      <MobileNav onCreatePost={handleCreatePost} />
      
      {/* Create Post Modal - TEMPORARILY COMMENTED OUT */}
      {/* 
      <CreatePostModal 
        open={isCreateModalOpen} 
        onOpenChange={setIsCreateModalOpen}
      />
      */}
    </div>
  );
}
