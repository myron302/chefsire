// client/src/components/sidebar.tsx
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Home,
  Compass,
  BookOpen,
  User,
  Plus,
  ChefHat,
  ShoppingCart,
  Activity,
  ChevronRight,
  Utensils,
  GlassWater,
  Heart,
  Wand2,
  Apple,
  FlaskConical,
  Leaf,
  Wine,
  Sparkles,
} from "lucide-react";

interface SidebarProps {
  onCreatePost?: () => void;
}

type NavItemBase = {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  isPremium?: boolean;
};

type NavItem =
  | (NavItemBase & {
      hasSubmenu?: false;
    })
  | (NavItemBase & {
      hasSubmenu: true;
      submenu: NavItem[];
    });

/**
 * ✅ UPDATED NAV - includes all spirit pages
 */
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
      { name: "Ingredient Substitutions", href: "/substitutions", icon: Wand2 },
    ],
  },

  // ✅ DRINKS - with all spirit pages
  {
    name: "Drinks",
    href: "/drinks",
    icon: GlassWater,
    hasSubmenu: true,
    submenu: [
      { name: "Drinks Hub", href: "/drinks", icon: GlassWater },
      { name: "Smoothies & Bowls", href: "/drinks/smoothies", icon: Apple },
      { name: "Protein Shakes", href: "/drinks/protein-shakes", icon: FlaskConical },
      { name: "Detoxes & Cleanses", href: "/drinks/detoxes", icon: Leaf },
      { name: "Potent Potables (21+)", href: "/drinks/potent-potables", icon: Wine },
      // Spirit pages - indented with arrows for visual hierarchy
      { name: "  → Vodka", href: "/drinks/potent-potables/vodka", icon: Wine },
      { name: "  → Whiskey & Bourbon", href: "/drinks/potent-potables/whiskey-bourbon", icon: Wine },
      { name: "  → Tequila & Mezcal", href: "/drinks/potent-potables/tequila-mezcal", icon: Wine },
      { name: "  → Rum", href: "/drinks/potent-potables/rum", icon: Wine },
      { name: "  → Cognac & Brandy", href: "/drinks/potent-potables/cognac-brandy", icon: Wine },
      { name: "  → Scotch & Irish", href: "/drinks/potent-potables/scotch-irish-whiskey", icon: Wine },
      { name: "  → Virgin Cocktails", href: "/drinks/virgin-cocktails", icon: Sparkles },
    ],
  },

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

  const isActive = (href: string) =>
    location === href || location.startsWith(href + "/");

  const autoOpen = useMemo(() => {
    const map: Record<string, boolean> = {};
    const walk = (items: NavItem[], parentTrail: string[] = []) => {
      items.forEach((item) => {
        if ("hasSubmenu" in item && item.hasSubmenu) {
          const anyActive =
            isActive(item.href) ||
            item.submenu.some((s) => isActive(s.href));
          if (anyActive) {
            map[[...parentTrail, item.name].join(" / ")] = true;
          }
          walk(item.submenu, [...parentTrail, item.name]);
        }
      });
    };
    walk(NAV);
    return map;
  }, [location]);

  const keyFor = (trail: string[]) => trail.join(" / ");

  const isOpen = (trail: string[]) =>
    openSections[keyFor(trail)] ?? autoOpen[keyFor(trail)] ?? false;

  const toggle = (trail: string[]) =>
    setOpenSections((prev) => {
      const k = keyFor(trail);
      return { ...prev, [k]: !(prev[k] ?? autoOpen[k] ?? false) };
    });

  const Row = ({ item, trail = [] as string[] }) => {
    const currentTrail = [...trail, item.name];

    if ("hasSubmenu" in item && item.hasSubmenu) {
      return (
        <div className="select-none">
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
              aria-expanded={isOpen(currentTrail)}
              onClick={() => toggle(currentTrail)}
              className={[
                "ml-2 p-1 rounded hover:bg-muted transition-colors",
                isOpen(currentTrail) ? "rotate-90" : "",
              ].join(" ")}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {isOpen(currentTrail) && (
            <div className="ml-6 space-y-1">
              {item.submenu.map((sub) => (
                <Link key={sub.name} href={sub.href}>
                  <div
                    className={[
                      "flex items-center py-1 hover:bg-muted rounded px-2 cursor-pointer",
                      isActive(sub.href) ? "bg-muted" : "",
                    ].join(" ")}
                    aria-current={isActive(sub.href) ? "page" : undefined}
                  >
                    <sub.icon className="w-4 h-4 mr-2" />
                    <span className="text-sm">{sub.name}</span>
                    {"isPremium" in sub && sub.isPremium && (
                      <span className="ml-2 px-2 py-0.5 bg-yellow-300 text-xs rounded">Premium</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    // leaf item
    return (
      <Link href={item.href}>
        <div
          className={[
            "flex items-center py-2 hover:bg-muted rounded px-2 cursor-pointer",
            isActive(item.href) ? "bg-muted" : "",
          ].join(" ")}
          aria-current={isActive(item.href) ? "page" : undefined}
        >
          <item.icon className="w-5 h-5 mr-2" />
          <span>{item.name}</span>
          {"isPremium" in item && item.isPremium && (
            <span className="ml-2 px-2 py-0.5 bg-yellow-300 text-xs rounded">Premium</span>
          )}
        </div>
      </Link>
    );
  };

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen bg-card border-r border-border fixed">
      <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
        {NAV.map((item) => (
          <Row key={item.name} item={item} />
        ))}

        <button
          onClick={onCreatePost}
          className="mt-8 flex items-center py-2 px-2 bg-primary text-white rounded hover:bg-primary/80 font-semibold w-full"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Post
        </button>
      </nav>
    </aside>
  );
}
