import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronRight, Plus } from "lucide-react";

interface SidebarProps {
  onCreatePost?: () => void;
}

type NavItemBase = {
  name: string;
  href: string;
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
  { name: "🏠 Feed", href: "/feed" },
  { name: "🧭 Explore", href: "/explore" },
  { name: "🗺️ BiteMap", href: "/bitemap" },

  {
    name: "🏆 Cookoff Arena",
    href: "/competitions/library", // 🔧 point parent to Library
    hasSubmenu: true,
    submenu: [
      { name: "📚 Browse All Cookoffs", href: "/competitions/library" }, // 🔧 library
      { name: "🔥 Live Battles", href: "/competitions/live" },
      { name: "➕ Create Cookoff", href: "/competitions/new" }, // 🔧 create
    ],
  },

  {
    name: "📖 Recipes",
    href: "/recipes",
    hasSubmenu: true,
    submenu: [
      { name: "📚 Browse Recipes", href: "/recipes" },
      { name: "👶 Baby Food", href: "/recipes/baby-food" },
      { name: "🥘 My Pantry", href: "/pantry" },
      { name: "🪄 Ingredient Substitutions", href: "/substitutions" },
    ],
  },

  {
    name: "🥤 Drinks",
    href: "/drinks",
    hasSubmenu: true,
    submenu: [
      { name: "🥤 Drinks Hub", href: "/drinks" },
      {
        name: "🍎 Smoothies & Bowls",
        href: "/drinks/smoothies",
        hasSubmenu: true,
        submenu: [
          { name: "🍳 Breakfast", href: "/drinks/smoothies/breakfast" },
          { name: "🥬 Green", href: "/drinks/smoothies/green" },
          { name: "💪 Protein", href: "/drinks/smoothies/protein" },
          { name: "🍨 Dessert", href: "/drinks/smoothies/dessert" },
          { name: "🏋️ Workout", href: "/drinks/smoothies/workout" },
        ],
      },
      {
        name: "🧪 Protein Shakes",
        href: "/drinks/protein-shakes",
        hasSubmenu: true,
        submenu: [
          { name: "🥛 Whey", href: "/drinks/protein-shakes/whey" },
          { name: "🌱 Plant-Based", href: "/drinks/protein-shakes/plant-based" },
          { name: "🧀 Casein", href: "/drinks/protein-shakes/casein" },
          { name: "✨ Collagen", href: "/drinks/protein-shakes/collagen" },
        ],
      },
      {
        name: "🍃 Detoxes & Cleanses",
        href: "/drinks/detoxes",
        hasSubmenu: true,
        submenu: [
          { name: "🧃 Detox Juices", href: "/drinks/detoxes/juice" },
          { name: "🍵 Detox Teas", href: "/drinks/detoxes/tea" },
          { name: "💧 Infused Waters", href: "/drinks/detoxes/water" },
        ],
      },
      {
        name: "🍷 Potent Potables (21+)",
        href: "/drinks/potent-potables",
        hasSubmenu: true,
        submenu: [
          { name: "🍸 Vodka", href: "/drinks/potent-potables/vodka" },
          { name: "🥃 Whiskey & Bourbon", href: "/drinks/potent-potables/whiskey-bourbon" },
          { name: "🌵 Tequila & Mezcal", href: "/drinks/potent-potables/tequila-mezcal" },
          { name: "🏝️ Rum", href: "/drinks/potent-potables/rum" },
          { name: "🍾 Cognac & Brandy", href: "/drinks/potent-potables/cognac-brandy" },
          { name: "🏴 Scotch & Irish", href: "/drinks/potent-potables/scotch-irish-whiskey" },
          { name: "🍸 Martinis", href: "/drinks/potent-potables/martinis" },
          { name: "🍹 Cocktails", href: "/drinks/potent-potables/cocktails" },
          { name: "🧃 Virgin Cocktails", href: "/drinks/potent-potables/virgin-cocktails" },
        ],
      },
    ],
  },

  {
    name: "🍽️ Catering",
    href: "/catering",
    hasSubmenu: true,
    submenu: [
      { name: "👨‍🍳 Browse Caterers", href: "/catering" },
      { name: "💒 Wedding Planning", href: "/catering/wedding-planning" },
    ],
  },
  { name: "🛒 Marketplace", href: "/marketplace" },
  { name: "💪 Nutrition", href: "/nutrition", isPremium: true },
  { name: "👤 Profile", href: "/profile" },
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

    const handleClick = (e: React.MouseEvent) => {
      if (item.href.includes('?')) {
        e.preventDefault();
        (window as any).location.href = item.href;
      }
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
