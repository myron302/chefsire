import { useState } from "react";
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
import CreatePostModal from "@/components/create-post-modal";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground text-sm font-bold">🍳</span>
              </div>
              <h1 className="text-xl font-bold text-primary">Chefsire</h1>
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
                
                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <>
                    {/* Backdrop to close dropdown */}
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsDropdownOpen(false)}
                    />
                    
                    <div className="absolute right-0 top-full mt-2 w-56 bg-background rounded-lg shadow-lg border border-border z-20">
                      <div className="py-2">
                        <Link href="/profile" onClick={() => setIsDropdownOpen(false)}>
                          <div className="flex items-center px-4 py-2 text-sm text-foreground hover:bg-muted cursor-pointer">
                            <User className="w-4 h-4 mr-3" />
                            Profile
                          </div>
                        </Link>
                        
                        <Link href="/pantry" onClick={() => setIsDropdownOpen(false)}>
                          <div className="flex items-center px-4 py-2 text-sm text-foreground hover:bg-muted cursor-pointer">
                            <ChefHat className="w-4 h-4 mr-3" />
                            My Pantry
                          </div>
                        </Link>
                        
                        <Link href="/nutrition" onClick={() => setIsDropdownOpen(false)}>
                          <div className="flex items-center px-4 py-2 text-sm text-foreground hover:bg-muted cursor-pointer">
                            <Activity className="w-4 h-4 mr-3" />
                            Nutrition & Meal Plans
                          </div>
                        </Link>
                        
                        <Link href="/marketplace" onClick={() => setIsDropdownOpen(false)}>
                          <div className="flex items-center px-4 py-2 text-sm text-foreground hover:bg-muted cursor-pointer">
                            <ShoppingCart className="w-4 h-4 mr-3" />
                            Marketplace
                          </div>
                        </Link>
                        
                        <Link href="/substitutions" onClick={() => setIsDropdownOpen(false)}>
                          <div className="flex items-center px-4 py-2 text-sm text-foreground hover:bg-muted cursor-pointer">
                            <Shuffle className="w-4 h-4 mr-3" />
                            Substitutions
                          </div>
                        </Link>
                        
                        <div className="border-t border-border my-2"></div>
                        
                        <Link href="/settings" onClick={() => setIsDropdownOpen(false)}>
                          <div className="flex items-center px-4 py-2 text-sm text-foreground hover:bg-muted cursor-pointer">
                            <Settings className="w-4 h-4 mr-3" />
                            Settings
                          </div>
                        </Link>
                        
                        <button 
                          onClick={() => {
                            setIsDropdownOpen(false);
                            // Add logout logic here
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-foreground hover:bg-muted text-left"
                        >
                          <LogOut className="w-4 h-4 mr-3" />
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
        <Sidebar onCreatePost={() => setIsCreateModalOpen(true)} />
        
        {/* Main Content */}
        <main className="flex-1 lg:ml-64 pb-16 lg:pb-0">
          {children}
        </main>
      </div>
      
      {/* Mobile Navigation */}
      <MobileNav onCreatePost={() => setIsCreateModalOpen(true)} />
      
      {/* Create Post Modal */}
      <CreatePostModal 
        open={isCreateModalOpen} 
        onOpenChange={setIsCreateModalOpen}
      />
    </div>
  );
}
