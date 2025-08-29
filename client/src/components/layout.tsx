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
  Settings
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
              <Avatar className="w-8 h-8">
                <AvatarImage src="https://images.unsplash.com/photo-1566554273541-37a9ca77b91f" />
                <AvatarFallback>CA</AvatarFallback>
              </Avatar>
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
