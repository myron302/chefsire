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
  | (NavItemBase & { hasSubmenu?: false })
  | (NavItemBase & { hasSubmenu: true; submenu: NavItem[] });

const NAV: NavItem[] = [
  { name: "🏠 Feed", href: "/feed" },
  { name: "🧭 Explore", href: "/explore" },
  { name: "🗺️ BiteMap", href: "/bitemap" },
  { name: "💬 Royal Table Talk", href: "/messages" },

  {
    name: "🏆 Cookoff Arena",
    href: "/competitions/library",
    hasSubmenu: true,
    submenu: [
      { name: "📚 Browse All Cookoffs", href: "/competitions/library" },
      { name: "🔥 Live Battles", href: "/competitions/live" },
      { name: "➕ Create Cookoff", href: "/competitions/new" },
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
          { name: "🍓 Berry", href: "/drinks/smoothies/berry" },       // ✅ added
          { name: "🏝️ Tropical", href: "/drinks/smoothies/tropical" }, // ✅ added
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
          { name: "🥚 Egg", href: "/drinks/protein-shakes/egg" },       // ✅ added
          { name: "🐄 Beef", href: "/drinks/protein-shakes/beef" },     // ✅ added
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
        name: "☕ Caffeinated Drinks",
        href: "/drinks/caffeinated",
        hasSubmenu: true,
        submenu: [
          { name: "☕ Espresso Drinks", href: "/drinks/caffeinated/espresso" },
          { name: "🧊 Cold Brew", href: "/drinks/caffeinated/cold-brew" },
          { name: "🍵 Tea", href: "/drinks/caffeinated/tea" },
          { name: "🍃 Matcha", href: "/drinks/caffeinated/matcha" },
          { name: "⚡ Energy Drinks", href: "/drinks/caffeinated/energy" },
          { name: "⭐ Specialty Coffee", href: "/drinks/caffeinated/specialty" },
          { name: "☕ Lattes & Cappuccinos", href: "/drinks/caffeinated/lattes" },
          { name: "💧 Iced Coffee", href: "/drinks/caffeinated/iced" },
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
          { name: "🍓 Daiquiri", href: "/drinks/potent-potables/daiquiri" }, // ✅ added earlier
          { name: "🍸 Martinis", href: "/drinks/potent-potables/martinis" },
          { name: "🍹 Cocktails", href: "/drinks/potent-potables/cocktails" },
          { name: "🍸 Gin", href: "/drinks/potent-potables/gin" },           // ✅ new
          { name: "🔥 Hot Drinks", href: "/drinks/potent-potables/hot-drinks" }, // ✅ new
          { name: "🥃 Liqueurs", href: "/drinks/potent-potables/liqueurs" }, // ✅ new
          { name: "🥂 Spritz", href: "/drinks/potent-potables/spritz" },     // ✅ new
          { name: "🍾 Cognac & Brandy", href: "/drinks/potent-potables/cognac-brandy" },
          { name: "🏴 Scotch & Irish", href: "/drinks/potent-potables/scotch-irish-whiskey" },
          { name: "🗓️ Seasonal", href: "/drinks/potent-potables/seasonal" },
          // ❌ Virgin Cocktails removed (merged into Mocktails)
          { name: "🧃 Mocktails (Zero-Proof)", href: "/drinks/potent-potables/mocktails" }, // zero-proof, not age-gated
        ],
      },
    ],
  },

  // ✅ New top-level Pet Food section
  {
    name: "🐾 Pet Food",
    href: "/pet-food",
    hasSubmenu: true,
    submenu: [
      { name: "🐶 Dogs", href: "/pet-food/dogs" },
      { name: "🐱 Cats", href: "/pet-food/cats" },
      { name: "🦜 Birds", href: "/pet-food/birds" },
      { name: "🐹 Small Pets", href: "/pet-food/small-pets" },
    ],
  },

  { name: "🍽️ Catering", href: "/catering", hasSubmenu: true, submenu: [
    { name: "👨‍🍳 Browse Caterers", href: "/catering" },
  ]},

  { name: "💒 Wedding Planning", href: "/catering/wedding-planning", hasSubmenu: true, submenu: [
    { name: "📋 Planning Hub", href: "/catering/wedding-planning" },
    { name: "🗺️ Vendor Map", href: "/catering/wedding-map" },
  ]},

  { name: "🛒 Marketplace", href: "/marketplace" },
  { name: "💪 Nutrition", href: "/nutrition", isPremium: true },
  { name: "❤️ Allergies", href: "/allergies" },
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
                return isActive(s.href) || s.submenu.some((n) => isActive(n.href));
              }
              return isActive(s.href);
            });
          if (anyActive) map[[...parentTrail, item.name].join(" / ")] = true;
          walk(item.submenu, [...parentTrail, item.name]);
        }
      });
    };
    walk(NAV);
    return map;
  }, [location]);

  const keyFor = (trail: string[]) => trail.join(" / ");
  const isOpen = (trail: string[]) => openSections[keyFor(trail)] ?? autoOpen[keyFor(trail)] ?? false;
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
              className={["ml-2 p-1 rounded hover:bg-muted transition-transform", isOpen(currentTrail) ? "rotate-90" : ""].join(" ")}
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
      if (item.href.includes("?")) {
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
