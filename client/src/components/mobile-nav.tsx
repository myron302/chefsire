import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, Compass, Plus, User } from "lucide-react";
// import { cn } from "@/lib/utils";

interface MobileNavProps {
  onCreatePost: () => void;
}

export default function MobileNav({ onCreatePost }: MobileNavProps) {
  const [location] = useLocation();
  
  const navigation = [
    { name: "Feed", href: "/feed", icon: Home },
    { name: "Explore", href: "/explore", icon: Compass },
    { name: "Create", action: onCreatePost, icon: Plus },
    { name: "Profile", href: "/profile", icon: User },
  ];
  
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40">
      <div className="flex items-center justify-around py-2">
        {navigation.map((item) => {
          if (item.action) {
            return (
              <Button
                key={item.name}
                variant="ghost"
                onClick={item.action}
                className="flex flex-col items-center p-2 text-muted-foreground h-auto min-w-0"
                data-testid={`mobile-nav-${item.name.toLowerCase()}`}
              >
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center mb-1">
                  <item.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-xs">{item.name}</span>
              </Button>
            );
          }
          return (
            <Link key={item.name} href={item.href!}>
              <Button
                variant="ghost"
                className={`flex flex-col items-center p-2 h-auto min-w-0 ${
                  location === item.href ? "text-primary" : "text-muted-foreground"
                }`}
                data-testid={`mobile-nav-${item.name.toLowerCase()}`}
              >
                <item.icon className="h-6 w-6 mb-1" />
                <span className="text-xs">{item.name}</span>
              </Button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
