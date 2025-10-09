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
  Baby,
  Map,
  Layers,
  Trophy,
  Swords, // ✅ for live battles
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

const NAV: NavItem[] = [
  { name: "Feed", href: "/feed", icon: Home },
  { name: "Explore", href: "/explore", icon: Compass },
  { name: "BiteMap", href: "/bitemap", icon: Map },

  // ✅ Competitions - with colored icons
  {
    name: "Cookoff Arena",
    href: "/competitions",
    icon: Trophy,
    hasSubmenu: true,
    submenu: [
      { name: "Browse All Cookoffs", href: "/competitions", icon: Layers },
      { name: "Live Battles", href: "/competitions?status=live", icon: Swords },
      { name: "Create Cookoff", href: "/competitions/new", icon: Plus },
      { name: "My Competitions", href: "/profile?tab=cookoffs", icon: Trophy },
    ],
  },

  {
    name: "Recipes",
    href: "/recipes",
    icon: BookOpen,
    hasSubmenu: true,
    submenu: [
      { name: "Browse Recipes", href: "/recipes", icon: BookOpen },
      { name: "Baby Food", href: "/recipes/baby-food", icon: Baby },
      { name: "My Pantry", href: "/pantry", icon: ChefHat },
      { name: "Ingredient Substitutions", href: "/substitutions", icon: Wand2 },
    ],
  },

  {
    name: "Drinks",
    href: "/drinks",
    icon: GlassWater,
    hasSubmenu: true,
    submenu: [
      { name: "Drinks Hub", href: "/drinks", icon: GlassWater },
      {
        name: "Smoothies & Bowls",
        href: "/drinks/smoothies",
        icon: Apple,
        hasSubmenu: true,
        submenu: [
          { name: "Breakfast", href: "/drinks/smoothies/breakfast", icon: Apple },
          { name: "Green", href: "/drinks/smoothies/green", icon: Leaf },
          { name: "Protein", href: "/drinks/smoothies/protein", icon: FlaskConical },
          { name: "Dessert", href: "/drinks/smoothies/dessert", icon: Sparkles },
          { name: "Workout", href: "/drinks/smoothies/workout", icon: Activity },
        ],
      },
      {
        name: "Protein Shakes",
        href: "/drinks/protein-shakes",
        icon: FlaskConical,
        hasSubmenu: true,
        submenu: [
          { name: "Whey", href: "/drinks/protein-shakes/whey", icon: FlaskConical },
          { name: "Plant-Based", href: "/drinks/protein-shakes/plant-based", icon: Leaf },
          { name: "Casein", href: "/drinks/protein-shakes/casein", icon: FlaskConical },
          { name: "Collagen", href: "/drinks/protein-shakes/collagen", icon: Sparkles },
        ],
      },
      {
        name: "Detoxes & Cleanses",
        href: "/drinks/detoxes",
        icon: Leaf,
        hasSubmenu: true,
        submenu: [
          { name: "Detox Juices", href: "/drinks/detoxes/juice", icon: Apple },
          { name: "Detox Teas", href: "/drinks/detoxes/tea", icon: Leaf },
          { name: "Infused Waters", href: "/drinks/detoxes/water", icon: GlassWater },
        ],
      },
      {
        name: "Potent Potables (21+)",
        href: "/drinks/potent-potables",
        icon: Wine,
        hasSubmenu: true,
        submenu: [
          { name: "Vodka", href: "/drinks/potent-potables/vodka", icon: Wine },
          { name: "Whiskey & Bourbon", href: "/drinks/potent-potables/whiskey-bourbon", icon: Wine },
          { name: "Tequila & Mezcal", href: "/drinks/potent-potables/tequila-mezcal", icon: Wine },
          { name: "Rum", href: "/drinks/potent-potables/rum", icon: Wine },
          { name: "Cognac & Brandy", href: "/drinks/potent-potables/cognac-brandy", icon: Wine },
          { name: "Scotch & Irish", href: "/drinks/potent-potables/scotch-irish-whiskey", icon: Wine },
          { name: "Martinis", href: "/drinks/potent-potables/martinis", icon: Wine },
          { name: "Cocktails", href: "/drinks/potent-potables/cocktails", icon: Wine },
          { name: "Virgin Cocktails", href: "/drinks/potent-potables/virgin-cocktails", icon: Sparkles },
        ],
      },
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
            item.submenu.some((s) => {
              if ("hasSubmenu" in s && s.hasSubmenu) {
                return isActive(s.href) || s.submenu.some((nested) => isActive(nested.href));
              }
              return isActive(s.href);
            });
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

  const Row = ({ item, trail = [] as string[], depth = 0 }) => {
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
                  depth > 0 ? "text-sm" : "font-bold",
                ].join(" ")}
                style={{ paddingLeft: `${depth * 0.5}rem` }}
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                <item.icon className={depth > 0 ? "w-4 h-4 mr-2 text-purple-600" : "w-5 h-5 mr-2 text-orange-600"} />
                <span>{item.name}</span>
              </div>
            </Link>

            <button
              aria-label={`Toggle ${item.name} submenu`}
              aria-expanded={isOpen(currentTrail)}
              onClick={() => toggle(currentTrail)}
              className={[
                "ml-2 p-1 rounded hover:bg-muted transition-transform",
                isOpen(currentTrail) ? "rotate-90" : "",
              ].join(" ")}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {isOpen(currentTrail) && (
            <div className="ml-4 space-y-1">
              {item.submenu.map((sub) => (
                <Row key={sub.name} item={sub} trail={currentTrail} depth={depth + 1} />
              ))}
            </div>
          )}
        </div>
      );
    }

    // leaf item - handle query params properly
    const handleClick = (e: React.MouseEvent) => {
      if (item.href.includes('?')) {
        e.preventDefault();
        window.location.href = item.href;
      }
    };

    // Special icon colors based on item name
    const getIconColor = () => {
      if (item.name.includes('Live Battles')) return 'text-red-600';
      if (item.name.includes('Create')) return 'text-green-600';
      if (item.name.includes('My Competition')) return 'text-yellow-600';
      if (depth > 0) return 'text-purple-600';
      return 'text-orange-600';
    };

    return (
      <Link href={item.href}>
        <div
          onClick={handleClick}
          className={[
            "flex items-center py-2 hover:bg-muted rounded px-2 cursor-pointer",
            isActive(item.href) ? "bg-muted" : "",
            depth > 0 ? "text-sm" : "",
          ].join(" ")}
          style={{ paddingLeft: `${depth * 0.75}rem` }}
          aria-current={isActive(item.href) ? "page" : undefined}
        >
          <item.icon className={`${depth > 0 ? "w-4 h-4" : "w-5 h-5"} mr-2 ${getIconColor()}`} />
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
          <Row key={item.name} item={item} depth={0} />
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
