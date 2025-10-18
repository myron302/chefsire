// client/src/mobile/MobileKit.tsx
import React from "react";
import { Link, useLocation } from "wouter";
import {
  Home,
  MapPin,      // safe alternative to Map
  Wine,         // safe alternative to Martini across versions
  BookOpen,
  User,         // safe alternative to User2
} from "lucide-react";

type ProviderProps = { children?: React.ReactNode };

/**
 * MobileKitProvider
 * - Route-scoped mobile fixes (currently only applies to /drinks* pages)
 * - Non-invasive: does not touch header/nav elements
 */
export function MobileKitProvider({ children }: ProviderProps) {
  const [pathname] = useLocation();

  React.useEffect(() => {
    if (pathname) document.body.setAttribute("data-route", pathname);

    // Only touch Drinks pages
    if (!pathname?.startsWith("/drinks")) return;

    // Scope to page main (avoid header/nav)
    const mainEl =
      (document.querySelector("main") as HTMLElement | null) ||
      (document.querySelector('main[role="main"]') as HTMLElement | null) ||
      document.body;

    // Locate gradient hero and make the title row wrap sanely on mobile
    const heroContainers = Array.from(
      mainEl.querySelectorAll<HTMLElement>(
        [
          ".bg-gradient-to-r.text-white",
          ".bg-gradient-to-r .text-white",
          ".bg-gradient-to-r",
        ].join(",")
      )
    );

    const applied: Array<{ row: HTMLElement; h1?: HTMLElement }> = [];

    heroContainers.some((hero) => {
      const rows = Array.from(
        hero.querySelectorAll<HTMLElement>("div.flex.items-center, div.flex")
      );

      for (const row of rows) {
        const h1 = row.querySelector<HTMLElement>("h1");
        if (h1) {
          row.style.flexWrap = "wrap";
          row.style.rowGap = "0.5rem";
          row.style.columnGap = "0.5rem";

          h1.style.flexBasis = "100%";
          h1.style.minWidth = "0";
          h1.style.whiteSpace = "normal";
          h1.style.overflow = "hidden";
          h1.style.textOverflow = "ellipsis";

          applied.push({ row, h1 });
          return true;
        }
      }
      return false;
    });

    // Cleanup on route change
    return () => {
      applied.forEach(({ row, h1 }) => {
        row.style.flexWrap = "";
        row.style.rowGap = "";
        row.style.columnGap = "";
        if (h1) {
          h1.style.flexBasis = "";
          h1.style.minWidth = "";
          h1.style.whiteSpace = "";
          h1.style.overflow = "";
          h1.style.textOverflow = "";
        }
      });
    };
  }, [pathname]);

  return <>{children}</>;
}

/**
 * SafeArea
 * Simple wrapper to provide safe-area insets (iOS notches etc.)
 * Use <SafeArea top />, <SafeArea bottom />, or wrap content.
 */
type SafeAreaProps = {
  top?: boolean;
  bottom?: boolean;
  className?: string;
  children?: React.ReactNode;
};
export const SafeArea: React.FC<SafeAreaProps> = ({
  top = false,
  bottom = false,
  className = "",
  children,
}) => {
  const style: React.CSSProperties = {
    paddingTop: top ? "env(safe-area-inset-top)" : undefined,
    paddingBottom: bottom ? "env(safe-area-inset-bottom)" : undefined,
  };
  return (
    <div style={style} className={className}>
      {children}
    </div>
  );
};

/**
 * BottomTabBar
 * Mobile-only fixed bottom tab bar.
 */
type TabItem = { href: string; label: string; icon: React.ComponentType<any> };

type BottomTabBarProps = {
  items?: TabItem[];
  className?: string;
};

const defaultItems: TabItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/bitemap", label: "BiteMap", icon: MapPin },
  { href: "/drinks", label: "Drinks", icon: Wine },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
  { href: "/profile", label: "Profile", icon: User },
];

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  items = defaultItems,
  className = "",
}) => {
  // Mobile only; hide on md+
  return (
    <nav
      className={[
        "fixed bottom-0 left-0 right-0 z-40 block md:hidden",
        "bg-white/95 dark:bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/75",
        "border-t border-gray-200/60 dark:border-gray-800",
        className,
      ].join(" ")}
      role="navigation"
      aria-label="Bottom navigation"
    >
      <SafeArea bottom>
        <ul className="grid grid-cols-5 gap-1 px-2 py-1.5">
          {items.map(({ href, label, icon: Icon }) => (
            <li key={href} className="flex">
              {/* Correct wouter usage: no nested <a> */}
              <Link
                href={href}
                className={[
                  "w-full flex flex-col items-center justify-center rounded-md",
                  "px-2 py-2 text-xs font-medium text-gray-700 dark:text-gray-200",
                  "hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
                ].join(" ")}
              >
                <Icon className="h-5 w-5 mb-0.5" />
                <span className="leading-none">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </SafeArea>
    </nav>
  );
};
