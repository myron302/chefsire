import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, Compass, Plus, User } from "lucide-react";
import { cn } from "@/lib/utils";

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
                className="flex flex-col items-center p-2 text-muted-foreground h-auto"
                data-testid={`mobile-nav-${item.name.toLowerCase()}`}
              >
                <item.icon className="h-6 w-6" />
                <span className="text-xs mt-1">{item.name}</span>
              </Button>
            );
          }

          return (
            <Link key={item.name} href={item.href!}>
              <Button
                variant="ghost"
                className={cn(
                  "flex flex-col items-center p-2 h-auto",
                  location === item.href ? "text-primary" : "text-muted-foreground"
                )}
                data-testid={`mobile-nav-${item.name.toLowerCase()}`}
              >
                <item.icon className="h-6 w-6" />
                <span className="text-xs mt-1">{item.name}</span>
              </Button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
