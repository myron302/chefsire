import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Home,
  Compass,
  BookOpen,
  User,
  Plus,
  ChefHat,
  Shuffle,
  ShoppingCart,
  Activity,
  ChevronRight,
  Utensils,
  GlassWater,
  Heart,
  Lightbulb,
} from "lucide-react";

interface SidebarProps {
  onCreatePost?: () => void;
}

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  isPremium?: boolean;
  hasSubmenu?: boolean;
  submenu?: { name: string; href: string; icon: React.ComponentType<any> }[];
};

const NAV: NavItem[] = [
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
      { name: "AI Substitution", href: "/ai-substitution", icon: Lightbulb },
    ],
  },
  { name: "Potent Potables", href: "/potent-potables", icon: GlassWater },
  {
    name: "Catering",
    href: "/catering",
    icon: Utensils,
    hasSubmenu: true,
    submenu: [
      { name: "Browse Caterers", href: "/catering", icon: Utensils },
      { name: "Wedding Planning", href: "/catering/wedding-planning", icon: Heart },
    ],
  },
  { name: "Marketplace", href: "/marketplace", icon: ShoppingCart },
  { name: "Nutrition", href: "/nutrition", icon: Activity, isPremium: true },
  { name: "Profile", href: "/profile", icon: User },
];

export default function Sidebar({ onCreatePost }: SidebarProps) {
  const [location] = useLocation();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  // Auto-open the section that contains the current path
  const autoOpen = useMemo(() => {
    const map: Record<string, boolean> = {};
    NAV.forEach((item) => {
      if (item.hasSubmenu && item.submenu) {
        const activeInSub = item.submenu.some((s) =>
          location === s.href || location.startsWith(s.href + "/")
        );
        if (activeInSub) map[item.name] = true;
      }
    });
    return map;
  }, [location]);

  // Merge auto-open with manual toggles (manual wins after first render)
  const isOpen = (name: string) =>
    openSections[name] ?? autoOpen[name] ?? false;

  const toggle = (name: string) =>
    setOpenSections((prev) => ({ ...prev, [name]: !isOpen(name) }));

  const isActive = (href: string) =>
    location === href || location.startsWith(href + "/");

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen bg-card border-r border-border fixed">
      <nav className="flex-1 py-6 px-4 space-y-2">
        {NAV.map((item) =>
          item.hasSubmenu && item.submenu ? (
            <div key={item.name} className="select-none">
              {/* Parent row behaves as a toggle and link */}
              <div className="flex items-center mb-1 rounded px-2 py-1">
                <Link href={item.href}>
                  <div
                    className={[
                      "flex items-center flex-1 hover:bg-muted rounded px-2 py-1 cursor-pointer",
                      isActive(item.href) ? "bg-muted" : "",
                    ].join(" ")}
                    aria-current={isActive(item.href) ? "page" : undefined}
                  >
                    <item.icon className="w-5 h-5 mr-2" />
                    <span className="font-bold">{item.name}</span>
                  </div>
                </Link>

                <button
                  aria-label={`Toggle ${item.name} submenu`}
                  aria-expanded={isOpen(item.name)}
                  onClick={() => toggle(item.name)}
                  className={[
                    "ml-2 p-1 rounded hover:bg-muted transition-colors",
                    isOpen(item.name) ? "rotate-90" : "",
                  ].join(" ")}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {isOpen(item.name) && (
                <div className="ml-6 space-y-1">
                  {item.submenu.map((sub) => {
                    const subActive = isActive(sub.href);
                    return (
                      <Link key={sub.name} href={sub.href}>
                        <div
                          className={[
                            "flex items-center py-1 hover:bg-muted rounded px-2 cursor-pointer",
                            subActive ? "bg-muted" : "",
                          ].join(" ")}
                          aria-current={subActive ? "page" : undefined}
                        >
                          <sub.icon className="w-4 h-4 mr-2" />
                          <span className="text-sm">{sub.name}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <Link key={item.name} href={item.href}>
              <div
                className={[
                  "flex items-center py-2 hover:bg-muted rounded px-2 cursor-pointer",
                  isActive(item.href) ? "bg-muted" : "",
                ].join(" ")}
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                <item.icon className="w-5 h-5 mr-2" />
                <span>{item.name}</span>
                {item.isPremium && (
                  <span className="ml-2 px-2 py-0.5 bg-yellow-300 text-xs rounded">
                    Premium
                  </span>
                )}
              </div>
            </Link>
          )
        )}

        <button
          onClick={onCreatePost}
          className="mt-8 flex items-center py-2 px-2 bg-primary text-white rounded hover:bg-primary/80 font-semibold"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Post
        </button>
      </nav>
    </aside>
  );
}
