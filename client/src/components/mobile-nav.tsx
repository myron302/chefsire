import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Compass, Plus, User, Activity, Shuffle, BookOpen } from "lucide-react";

interface MobileNavProps {
  onCreatePost?: () => void;
}

type NavLink =
  | { name: string; href: string; icon: React.ComponentType<any> }
  | { name: string; action: () => void; icon: React.ComponentType<any> };

export default function MobileNav({ onCreatePost }: MobileNavProps) {
  const [location] = useLocation();
  const handleCreate = onCreatePost ?? (() => {});

  const nav: NavLink[] = [
    { name: "Explore", href: "/explore", icon: Compass },
    { name: "Recipes", href: "/recipes", icon: BookOpen }, // added
    { name: "Create", action: handleCreate, icon: Plus },   // center FAB
    { name: "Subs", href: "/substitutions", icon: Shuffle },
    { name: "Nutrition", href: "/nutrition", icon: Activity },
    { name: "Profile", href: "/profile", icon: User },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="relative flex items-center justify-around py-2">
        {nav.map((item) => {
          if ("action" in item) {
            // Center FAB — hover/press feedback only
            return (
              <div
                key={item.name}
                className="absolute -top-7 left-1/2 -translate-x-1/2 pointer-events-none z-50"
              >
                <button
                  onClick={item.action}
                  aria-label="Create"
                  className={[
                    "w-16 h-16 rounded-full text-white pointer-events-auto",
                    "bg-gradient-to-br from-orange-500 to-red-500 ring-4 ring-orange-500/20",
                    "flex items-center justify-center",
                    "shadow-xl transition-transform duration-200 hover:scale-105 active:scale-95",
                  ].join(" ")}
                  data-testid="mobile-nav-create"
                >
                  <item.icon className="h-7 w-7" />
                </button>
              </div>
            );
          }

          const isActive = location === item.href || location.startsWith(item.href + "/");

          return (
            <Link key={item.name} href={item.href}>
              <Button
                variant="ghost"
                className={[
                  "flex flex-col items-center p-2 h-auto min-w-0",
                  isActive ? "text-primary" : "text-muted-foreground",
                ].join(" ")}
                aria-current={isActive ? "page" : undefined}
                data-testid={`mobile-nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <item.icon className="h-6 w-6 mb-1" />
                <span className="text-[11px] leading-none">{item.name}</span>
              </Button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
