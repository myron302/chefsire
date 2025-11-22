import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useUser } from "@/contexts/UserContext";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  Search,
  Bell,
  MessageCircle,
  User,
  ChevronDown,
  ChevronRight,
  Settings,
  LogOut,
  Plus,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon?: React.ReactNode;
  badge?: string;
  external?: boolean;
};

const navItems: NavItem[] = [
  { label: "Feed", href: "/feed" },
  { label: "Explore", href: "/explore" },
  { label: "Recipes", href: "/recipes" },
  { label: "Drinks", href: "/drinks" },
  { label: "Baby Food", href: "/recipes/baby-food" },
  { label: "Pet Food", href: "/pet-food" },
  { label: "BiteMap", href: "/bitemap" },
  { label: "Pantry", href: "/pantry" },
  { label: "Catering", href: "/catering" },
  { label: "Wedding Planning", href: "/catering/wedding-planning" },
  { label: "Store", href: "/marketplace" },
];

function useClickOutside(handler: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler();
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [handler]);

  return ref;
}

function useScrollDirection() {
  const [scrollingUp, setScrollingUp] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    function handleScroll() {
      const currentScrollY = window.scrollY;
      if (currentScrollY < lastScrollY.current) {
        setScrollingUp(true);
      } else if (currentScrollY > lastScrollY.current + 10) {
        setScrollingUp(false);
      }
      lastScrollY.current = currentScrollY;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return scrollingUp;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isMobile;
}

function usePersistedLayoutState<T>(key: string, defaultValue: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [key, state]);

  return [state, setState] as const;
}

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useUser();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const scrollingUp = useScrollDirection();
  const isMobile = useIsMobile();

  const [isSidebarOpen, setIsSidebarOpen] = usePersistedLayoutState(
    "chefsire_sidebar_open",
    true
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const dropdownRef = useClickOutside(() => setIsDropdownOpen(false));
  const mobileNavRef = useClickOutside(() => setMobileNavOpen(false));

  // Close menus on route change
  useEffect(() => {
    setIsDropdownOpen(false);
    setMobileNavOpen(false);
  }, [location]);

  function handleLogout() {
    logout();
    queryClient.clear();
    setLocation("/login");
  }

  const showSidebar = !isMobile && isSidebarOpen;
  const showCompactSidebar = !isMobile && !isSidebarOpen;

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      {!isMobile && (
        <aside
          className={cn(
            "hidden md:flex flex-col border-r bg-card/80 backdrop-blur relative transition-all duration-200",
            showSidebar ? "w-64" : "w-16"
          )}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <button
              onClick={() => setLocation("/")}
              className="flex items-center gap-2"
            >
              <span className="text-lg font-bold">ChefSire</span>
            </button>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1 rounded hover:bg-accent"
              aria-label={showSidebar ? "Collapse sidebar" : "Expand sidebar"}
            >
              <ChevronLeftIcon
                className={cn(
                  "w-4 h-4 transition-transform",
                  showSidebar && "rotate-180"
                )}
              />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-2">
            <div className="px-2 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Main
            </div>
            {navItems.map((item) => {
              const isActive =
                location === item.href ||
                (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                    isActive ? "bg-accent text-accent-foreground" : ""
                  )}
                >
                  <span
                    className={cn(
                      "truncate",
                      showSidebar ? "block" : "hidden"
                    )}
                  >
                    {item.label}
                  </span>
                  <span
                    className={cn(
                      "truncate",
                      showSidebar ? "hidden" : "block"
                    )}
                  >
                    {item.label.charAt(0)}
                  </span>
                  {item.badge && (
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Community & Progress */}
            <div className="mt-4 px-2 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Community
            </div>
            <Link
              href="/clubs"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                location.startsWith("/clubs")
                  ? "bg-accent text-accent-foreground"
                  : ""
              )}
            >
              <span className={showSidebar ? "block" : "hidden"}>
                🍽️ Clubs
              </span>
              <span className={showSidebar ? "hidden" : "block"}>🍽️</span>
            </Link>
            <Link
              href="/competitions"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                location.startsWith("/competitions")
                  ? "bg-accent text-accent-foreground"
                  : ""
              )}
            >
              <span className={showSidebar ? "block" : "hidden"}>
                🏆 Competitions
              </span>
              <span className={showSidebar ? "hidden" : "block"}>🏆</span>
            </Link>

            <div className="mt-4 px-2 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Progress
            </div>
            <Link
              href="/leaderboard"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                location.startsWith("/leaderboard")
                  ? "bg-accent text-accent-foreground"
                  : ""
              )}
            >
              <span className={showSidebar ? "block" : "hidden"}>
                🏅 Leaderboard
              </span>
              <span className={showSidebar ? "hidden" : "block"}>🏅</span>
            </Link>
            <Link
              href="/achievements"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                location.startsWith("/achievements")
                  ? "bg-accent text-accent-foreground"
                  : ""
              )}
            >
              <span className={showSidebar ? "block" : "hidden"}>
                🎖️ Achievements
              </span>
              <span className={showSidebar ? "hidden" : "block"}>🎖️</span>
            </Link>
          </nav>

          {/* User mini section in sidebar */}
          <div className="border-t px-3 py-2 flex items-center gap-2 text-xs">
            {user ? (
              <>
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                  {user.username?.[0]?.toUpperCase() || "C"}
                </div>
                <div className={showSidebar ? "flex-1" : "hidden"}>
                  <div className="font-medium truncate">
                    {user.displayName || user.username}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    Log out
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex gap-2">
                <Link
                  href="/login"
                  className="flex-1 text-center text-xs border rounded py-1 hover:bg-accent"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="flex-1 text-center text-xs bg-primary text-primary-foreground rounded py-1 hover:bg-primary/90"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top nav / header */}
        <header
          className={cn(
            "sticky top-0 z-40 border-b bg-background/80 backdrop-blur transition-transform",
            scrollingUp ? "translate-y-0" : "-translate-y-full"
          )}
        >
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              {isMobile && (
                <button
                  onClick={() => setMobileNavOpen(!mobileNavOpen)}
                  className="p-2 rounded-lg hover:bg-accent"
                >
                  <ChevronRight
                    className={cn(
                      "w-5 h-5 transition-transform",
                      mobileNavOpen && "rotate-90"
                    )}
                  />
                </button>
              )}
              <button
                onClick={() => setLocation("/")}
                className="flex items-center gap-2"
              >
                <span className="text-base md:text-lg font-bold">
                  ChefSire
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              {/* Search / debug placeholder */}
              <button className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm rounded-full border bg-card hover:bg-accent">
                <Search className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Search recipes, drinks, chefs…
                </span>
              </button>

              {/* Actions */}
              <Link
                href="/create"
                className="hidden md:inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="w-3 h-3" />
                <span>Post</span>
              </Link>

              <Link
                href="/messages"
                className="p-2 rounded-full hover:bg-accent relative"
              >
                <MessageCircle className="w-4 h-4" />
              </Link>

              <button className="p-2 rounded-full hover:bg-accent relative">
                <Bell className="w-4 h-4" />
              </button>

              {/* User avatar + dropdown */}
              <div
                className="relative"
                ref={dropdownRef}
              >
                <button
                  onClick={() => setIsDropdownOpen((v) => !v)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-full hover:bg-accent"
                >
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                    {user?.username?.[0]?.toUpperCase() || "C"}
                  </div>
                  <span className="hidden md:inline text-xs max-w-[120px] truncate">
                    {user?.displayName || user?.username || "Guest"}
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-card border rounded-xl shadow-lg overflow-hidden z-50">
                    <div className="px-3 py-2 border-b">
                      {user ? (
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                            {user.username?.[0]?.toUpperCase() || "C"}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold truncate">
                              {user.displayName || user.username}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">
                            You&apos;re browsing as a guest.
                          </span>
                          <Link
                            href="/login"
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Log in
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* Quick nav inside dropdown */}
                    <div className="max-h-[380px] overflow-y-auto">
                      <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                        Core Navigation
                      </div>
                      <div className="px-2 pb-2 grid grid-cols-2 gap-1 text-sm">
                        <Link
                          href="/feed"
                          onClick={() => setIsDropdownOpen(false)}
                          className={cn(
                            "px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800",
                            location.startsWith("/feed") && "bg-gray-100"
                          )}
                        >
                          🏠 Feed
                        </Link>
                        <Link
                          href="/explore"
                          onClick={() => setIsDropdownOpen(false)}
                          className={cn(
                            "px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800",
                            location.startsWith("/explore") && "bg-gray-100"
                          )}
                        >
                          🔍 Explore
                        </Link>
                        <Link
                          href="/recipes"
                          onClick={() => setIsDropdownOpen(false)}
                          className={cn(
                            "px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800",
                            location.startsWith("/recipes") && "bg-gray-100"
                          )}
                        >
                          📖 Recipes
                        </Link>
                        <Link
                          href="/drinks"
                          onClick={() => setIsDropdownOpen(false)}
                          className={cn(
                            "px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800",
                            location.startsWith("/drinks") && "bg-gray-100"
                          )}
                        >
                          🥤 Drinks
                        </Link>
                        <Link
                          href="/bitemap"
                          onClick={() => setIsDropdownOpen(false)}
                          className={cn(
                            "px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800",
                            location.startsWith("/bitemap") && "bg-gray-100"
                          )}
                        >
                          🗺️ BiteMap
                        </Link>
                        <Link
                          href="/marketplace"
                          onClick={() => setIsDropdownOpen(false)}
                          className={cn(
                            "px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800",
                            location.startsWith("/marketplace") && "bg-gray-100"
                          )}
                        >
                          🏬 Marketplace
                        </Link>
                      </div>

                      <div className="px-3 pt-1 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                        Tools
                      </div>
                      <div className="px-2 pb-2 grid grid-cols-2 gap-1 text-sm">
                        <Link
                          href="/pantry"
                          onClick={() => setIsDropdownOpen(false)}
                          className={cn(
                            "px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800",
                            location.startsWith("/pantry") && "bg-gray-100"
                          )}
                        >
                          🍽️ Pantry
                        </Link>
                        <Link
                          href="/allergies"
                          onClick={() => setIsDropdownOpen(false)}
                          className={cn(
                            "px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800",
                            location.startsWith("/allergies") && "bg-gray-100"
                          )}
                        >
                          ❤️ Allergies
                        </Link>
                      </div>

                      {/* Progress & stats (NEW) */}
                      <div className="px-3 pt-1 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                        Progress
                      </div>
                      <div className="px-2 pb-2 flex flex-col gap-1 text-sm">
                        <Link
                          href="/leaderboard"
                          onClick={() => setIsDropdownOpen(false)}
                          className={cn(
                            "flex items-center px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800",
                            location.startsWith("/leaderboard") && "bg-gray-100"
                          )}
                        >
                          🏅 Leaderboard
                        </Link>
                        <Link
                          href="/achievements"
                          onClick={() => setIsDropdownOpen(false)}
                          className={cn(
                            "flex items-center px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800",
                            location.startsWith("/achievements") &&
                              "bg-gray-100"
                          )}
                        >
                          🎖️ Achievements
                        </Link>
                      </div>

                      <div className="border-t my-2" />

                      {/* Account links */}
                      <div className="text-sm">
                        <button
                          onClick={() => {
                            setIsDropdownOpen(false);
                            setLocation("/profile");
                          }}
                          className="w-full flex items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          <User className="w-4 h-4 mr-2" />
                          My Profile
                        </button>
                        <button
                          onClick={() => {
                            setIsDropdownOpen(false);
                            setLocation("/settings");
                          }}
                          className="w-full flex items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          Settings
                        </button>
                        {user && (
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950 text-red-600 dark:text-red-400"
                          >
                            <LogOut className="w-4 h-4 mr-2" />
                            Sign Out
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile nav dropdown */}
          {isMobile && mobileNavOpen && (
            <div
              ref={mobileNavRef}
              className="md:hidden border-t bg-card"
            >
              <div className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                Navigate
              </div>
              <div className="grid grid-cols-2 gap-1 px-2 pb-2 text-sm">
                {navItems.map((item) => {
                  const isActive =
                    location === item.href ||
                    (item.href !== "/" && location.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileNavOpen(false)}
                      className={cn(
                        "px-2 py-2 rounded hover:bg-accent",
                        isActive && "bg-accent"
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
                <Link
                  href="/leaderboard"
                  onClick={() => setMobileNavOpen(false)}
                  className={cn(
                    "px-2 py-2 rounded hover:bg-accent",
                    location.startsWith("/leaderboard") && "bg-accent"
                  )}
                >
                  🏅 Leaderboard
                </Link>
                <Link
                  href="/achievements"
                  onClick={() => setMobileNavOpen(false)}
                  className={cn(
                    "px-2 py-2 rounded hover:bg-accent",
                    location.startsWith("/achievements") && "bg-accent"
                  )}
                >
                  🎖️ Achievements
                </Link>
              </div>
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 px-2 md:px-4 py-3 md:py-4 max-w-6xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}

function ChevronLeftIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
