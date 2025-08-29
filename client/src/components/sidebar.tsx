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
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  onCreatePost: () => void;
}

export default function Sidebar({ onCreatePost }: SidebarProps) {
  const [location] = useLocation();

  const navigation = [
    { name: "Feed", href: "/feed", icon: Home },
    { name: "Explore", href: "/explore", icon: Compass },
    { name: "Recipes", href: "/recipes", icon: BookOpen },
    { name: "Profile", href: "/profile", icon: User },
  ];

  const quickActions = [
    { name: "Saved Recipes", href: "/saved", icon: Bookmark },
    { name: "Following", href: "/following", icon: Users },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <nav className="hidden lg:flex fixed left-0 top-16 h-full w-64 bg-card border-r border-border p-6">
      <div className="space-y-6 w-full">
        {/* Navigation Items */}
        <div className="space-y-2">
          {navigation.map((item) => (
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
                <span className="font-medium">{item.name}</span>
              </Button>
            </Link>
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
