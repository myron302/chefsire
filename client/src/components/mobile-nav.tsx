import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Compass,
  Plus,
  User,
  Activity,
  Shuffle,
  Lightbulb,
} from "lucide-react";

interface MobileNavProps {
  onCreatePost?: () => void; // optional
}

export default function MobileNav({ onCreatePost }: MobileNavProps) {
  const [location] = useLocation();
  const handleCreate = onCreatePost ?? (() => {});

  // Order: left 2, center FAB, right 3
  const navigation: (
    | { name: string; href: string; icon: React.ComponentType<any> }
    | { name: string; action: () => void; icon: React.ComponentType<any> }
  )[] = [
    { name: "Explore", href: "/explore", icon: Compass },
    { name: "Subs", href: "/substitutions", icon: Shuffle },
    { name: "Create", action: handleCreate, icon: Plus }, // centered FAB
    { name: "AI Subs", href: "/ai-substitution", icon: Lightbulb },
    { name: "Nutrition", href: "/nutrition", icon: Activity },
    { name: "Profile", href: "/profile", icon: User },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="relative flex items-center justify-around py-2">
        {navigation.map((item, idx) => {
          // Center FAB
          if ("action" in item) {
            return (
              <div
                key={item.name}
                className="absolute -top-7 left-1/2 -translate-x-1/2"
              >
                <button
                  onClick={item.action}
                  aria-label="Create"
                  className={[
                    // size/shape
                    "w-16 h-16 rounded-full",
                    // gradient + ring
                    "bg-gradient-to-br from-orange-500 to-red-500 text-white ring-4 ring-orange-500/20",
                    // layout
                    "flex items-center justify-center",
                    // effects
                    "shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95",
                    // glow pulse (see CSS below)
                    "animate-glow",
                  ].join(" ")}
                  data-testid="mobile-nav-create"
                >
                  <item.icon className="h-7 w-7" />
                </button>
              </div>
            );
          }

          // Regular tabs
          const isActive = location === item.href;

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
