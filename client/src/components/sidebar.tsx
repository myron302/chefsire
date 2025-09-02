import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Home, 
  Compass, 
  BookOpen, 
  User, 
  Plus,
  Bookmark,
  Users,
  Settings,
  ChefHat,
  Shuffle,
  ShoppingCart,
  Activity,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface SidebarProps {
  onCreatePost: () => void;
}

export default function Sidebar({ onCreatePost }: SidebarProps) {
  const [location] = useLocation();
  const [isRecipesExpanded, setIsRecipesExpanded] = useState(true);
  
  const navigation = [
    { name: "Feed", href: "/feed", icon: Home },
    { name: "Explore", href: "/explore", icon: Compass },
    { 
      name: "Recipes", 
      href: "/recipes", 
      icon: BookOpen,
      hasSubmenu: true,
      submenu: [
        { name: "Browse Recipes", href: "/recipes", icon: BookOpen },
        { name: "My Pantry", href: "/pantry", icon: ChefHat },
        { name: "Substitutions", href: "/substitutions", icon: Shuffle },
      ]
    },
    { name: "Marketplace", href: "/marketplace", icon: ShoppingCart },
    { name: "Nutrition", href: "/nutrition", icon: Activity, isPremium: true },
    { name: "Profile", href: "/profile", icon: User },
  ];
  
  const quickActions = [
    { name: "Saved Recipes", href: "/saved", icon: Bookmark },
    { name: "Following", href: "/following", icon: Users },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  const isRecipeRoute = location?.includes('/recipe') || location === '/pantry' || location === '/substitutions';
  
  return (
    <nav className="hidden lg:flex fixed left-0 top-16 h-full w-64 bg-card border-r border-border p-6 overflow-y-auto">
      <div className="space-y-6 w-full">
        {/* Navigation Items */}
        <div className="space-y-2">
          {navigation.map((item) => (
            <div key={item.name}>
              {item.hasSubmenu ? (
                <>
                  {/* Parent Recipe Item */}
                  <div className="flex items-center">
                    <Link href={item.href} className="flex-1">
                      <Button
                        variant={location === item.href ? "default" : "ghost"}
                        className={cn(
                          "w-full justify-start space-x-3 h-12",
                          (location === item.href || isRecipeRoute) && "bg-primary text-primary-foreground"
                        )}
                        data-testid={`nav-${item.name.toLowerCase()}`}
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="font-medium">{item.name}</span>
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsRecipesExpanded(!isRecipesExpanded)}
                      className="p-2 ml-1"
                    >
                      {isRecipeRoute || isRecipesExpanded ? 
                        <ChevronDown className="h-4 w-4" /> : 
                        <ChevronRight className="h-4 w-4" />
                      }
                    </Button>
                  </div>
                  
                  {/* Submenu Items */}
                  {(isRecipesExpanded || isRecipeRoute) && (
                    <div className="ml-4 space-y-1 border-l-2 border-gray-200 dark:border-gray-700 pl-4 mt-2">
                      {item.submenu?.map((subItem) => (
                        <Link key={subItem.name} href={subItem.href}>
                          <Button
                            variant={location === subItem.href ? "default" : "ghost"}
                            className={cn(
                              "w-full justify-start space-x-3 h-10 text-sm",
                              location === subItem.href && "bg-primary text-primary-foreground"
                            )}
                            data-testid={`nav-${subItem.name.toLowerCase().replace(' ', '-')}`}
                          >
                            <subItem.icon className="h-4 w-4" />
                            <span className="font-medium">{subItem.name}</span>
                          </Button>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link key={item.name} href={item.href}>
                  <Button
                    variant={location === item.href ? "default" : "ghost"}
                    className={cn(
                      "w-full justify-start space-x-3 h-12",
                      location === item.href && "bg-primary text-primary-foreground"
                    )}
                    data-testid={`nav-${item.name.toLowerCase()}`}
                  >
                    <item.icon className="h-5 w-5" />
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium">{item.name}</span>
                      {item.isPremium && (
                        <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                          Pro
                        </span>
                      )}
                    </div>
                  </Button>
                </Link>
              )}
            </div>
          ))}
        </div>
        
        {/* Create Button */}
        <Button 
          onClick={onCreatePost}
          className="w-full bg-primary text-primary-foreground h-12 font-medium hover:bg-primary/90"
          data-testid="button-create-post"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Post
        </Button>
        
        {/* Quick Actions */}
        <div className="space-y-2 pt-4 border-t border-border">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-2">
            Quick Actions
          </div>
          {quickActions.map((item) => (
            <Link key={item.name} href={item.href}>
              <Button
                variant="ghost"
                className="w-full justify-start space-x-3 h-10 text-sm"
                data-testid={`quick-${item.name.toLowerCase().replace(' ', '-')}`}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.name}</span>
              </Button>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
