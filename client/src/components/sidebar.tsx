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
  {
    name: "Recipes",
    href: "/recipes",
    icon: BookOpen,
    hasSubmenu: true,
    submenu: [
      { name: "Browse Recipes", href: "/recipes", icon: BookOpen },
      { name: "My Pantry", href: "/pantry", icon: ChefHat },
      {
        name: "Substitutions",
        href: "/substitutions",
        icon: Shuffle,
      },
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

  // Utility to know if path is active
  const isActive = (href: string) =>
    location === href || location.startsWith(href + "/");

  // Compute which parent sections should be auto-open based on current route
  const autoOpen = useMemo(() => {
    const map: Record<string, boolean> = {};
    const walk = (items: NavItem[], parentTrail: string[] = []) => {
      items.forEach((item) => {
        if ("hasSubmenu" in item && item.hasSubmenu) {
          const anyActive =
            isActive(item.href) ||
            item.submenu.some(
              (s) =>
                isActive(s.href) ||
                ("hasSubmenu" in s && s.hasSubmenu && s.submenu.some((t) => isActive(t.href)))
            );
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
                <div key={sub.name}>
                  {"hasSubmenu" in sub && sub.hasSubmenu ? (
                    <div className="select-none">
                      <div className="flex items-center mb-1 rounded px-2 py-1">
                        <Link href={sub.href}>
                          <div
                            className={[
                              "flex items-center flex-1 hover:bg-muted rounded px-2 py-1 cursor-pointer",
                              isActive(sub.href) ? "bg-muted" : "",
                            ].join(" ")}
                            aria-current={isActive(sub.href) ? "page" : undefined}
                          >
                            <sub.icon className="w-4 h-4 mr-2" />
                            <span className="text-sm font-semibold">{sub.name}</span>
                          </div>
                        </Link>
                        <button
                          aria-label={`Toggle ${sub.name} submenu`}
                          aria-expanded={isOpen([...currentTrail, sub.name])}
                          onClick={() => toggle([...currentTrail, sub.name])}
                          className={[
                            "ml-2 p-1 rounded hover:bg-muted transition-colors",
                            isOpen([...currentTrail, sub.name]) ? "rotate-90" : "",
                          ].join(" ")}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      {isOpen([...currentTrail, sub.name]) && (
                        <div className="ml-6 space-y-1">
                          {sub.submenu.map((leaf) => {
                            const subActive = isActive(leaf.href);
                            return (
                              <Link key={leaf.name} href={leaf.href}>
                                <div
                                  className={[
                                    "flex items-center py-1 hover:bg-muted rounded px-2 cursor-pointer",
                                    subActive ? "bg-muted" : "",
                                  ].join(" ")}
                                  aria-current={subActive ? "page" : undefined}
                                >
                                  <leaf.icon className="w-4 h-4 mr-2" />
                                  <span className="text-sm">{leaf.name}</span>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Link href={sub.href}>
                      <div
                        className={[
                          "flex items-center py-1 hover:bg-muted rounded px-2 cursor-pointer",
                          isActive(sub.href) ? "bg-muted" : "",
                        ].join(" ")}
                        aria-current={isActive(sub.href) ? "page" : undefined}
                      >
                        <sub.icon className="w-4 h-4 mr-2" />
                        <span className="text-sm">{sub.name}</span>
                      </div>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // leaf
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
      <nav className="flex-1 py-6 px-4 space-y-2">
        {NAV.map((item) => (
          <Row key={item.name} item={item} />
        ))}

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
