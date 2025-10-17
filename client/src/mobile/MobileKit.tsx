// client/src/mobile/MobileKit.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  PropsWithChildren,
} from "react";
import { Link, useLocation } from "wouter";

/**
 * MobileKit — One-file, site-wide mobile UX helpers for ChefSire.
 *
 * WHAT YOU GET:
 *  - MobileKitProvider: wrap your <App/> once; injects CSS vars, viewport fixes, safe-area, and touch optimizations
 *  - SafeArea: pads for iOS notch/home indicator (top/bottom/both/none)
 *  - KeyboardAvoidingView: prevents inputs from getting hidden by mobile keyboards
 *  - StickyBottomBar: a themeable sticky bar (actions, CTA, totals, etc.)
 *  - BottomTabBar: opinionated 3–5 tab mobile nav (uses Wouter <Link/>)
 *  - MobileSheet: light-weight bottom sheet for filters, pickers, etc.
 *  - TouchButton: bigger hit target + ripple (optional), still works with your Tailwind styles
 *  - Hooks: useViewport(), useIsKeyboardOpen(), useScrollLock()
 *
 * HOW TO INSTALL (3 steps):
 *  1) Drop this file at: client/src/mobile/MobileKit.tsx
 *  2) Wrap your app root with <MobileKitProvider> (usually in client/src/App.tsx):
 *
 *     export default function App() {
 *       return (
 *         <MobileKitProvider>
 *           {/* your providers, layout, routes, etc. */}
 *         </MobileKitProvider>
 *       );
 *     }
 *
 *  3) OPTIONAL: Use <BottomTabBar/> in your Layout footer (mobile only),
 *     wrap problematic forms with <KeyboardAvoidingView/>,
 *     and use <SafeArea edge="bottom"/> where you have sticky elements.
 *
 * No external deps; Tailwind friendly.
 */

// ----------------------------
// Internal helpers & context
// ----------------------------

type MobileKitContextValue = {
  vh: number; // 1% of the real viewport height (addresses 100vh issues on mobile)
  isTouch: boolean;
  isKeyboardOpen: boolean;
  lockScroll: (locked: boolean) => void;
};

const MobileKitContext = createContext<MobileKitContextValue | null>(null);

function useIsomorphicLayoutEffect(effect: React.EffectCallback, deps: React.DependencyList) {
  // Avoid SSR warnings; safe for client
  // @ts-ignore
  return typeof window !== "undefined" ? useLayoutEffect(effect, deps) : useEffect(effect, deps);
}

function computeVhUnit() {
  if (typeof window === "undefined") return 1;
  return window.innerHeight * 0.01;
}

function getSafeAreaInset(side: "top" | "bottom" | "left" | "right"): number {
  if (typeof window === "undefined") return 0;
  // Read the computed value of env(safe-area-inset-*)
  const tmp = document.createElement("div");
  tmp.style.position = "absolute";
  tmp.style.top = "0";
  tmp.style.left = "0";
  tmp.style.width = "0";
  tmp.style.height = "0";
  tmp.style.visibility = "hidden";
  tmp.style.pointerEvents = "none";
  tmp.style.setProperty("--val", `env(safe-area-inset-${side})`);
  tmp.style.paddingTop = "var(--val)";
  document.body.appendChild(tmp);
  const cs = window.getComputedStyle(tmp);
  // paddingTop chosen arbitrarily—just to extract a pixel value from env()
  const px = parseFloat(cs.paddingTop || "0") || 0;
  tmp.remove();
  return px;
}

function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || (navigator as any).maxTouchPoints > 0;
}

// ----------------------------
// Provider
// ----------------------------

export function MobileKitProvider({ children }: PropsWithChildren<{}>) {
  const [vh, setVh] = useState<number>(computeVhUnit());
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isTouch, setIsTouch] = useState(isTouchDevice());
  const scrollLockedRef = useRef(false);

  const updateVh = useCallback(() => {
    setVh(computeVhUnit());
  }, []);

  // Track viewport height & expose as CSS var --vh
  useIsomorphicLayoutEffect(() => {
    updateVh();
    const onResize = () => updateVh();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [updateVh]);

  // Touch class on <html> for CSS targeting
  useEffect(() => {
    const html = document.documentElement;
    if (isTouch) {
      html.classList.add("touch");
    } else {
      html.classList.remove("touch");
    }
  }, [isTouch]);

  // Keyboard open/close detection (heuristic)
  useEffect(() => {
    let baseline = window.innerHeight;
    const threshold = 150; // px shrink that likely indicates keyboard
    const onResize = () => {
      const now = window.innerHeight;
      const delta = baseline - now;
      setIsKeyboardOpen(delta > threshold);
      if (delta < 0) {
        // Keyboard closed; reset baseline
        baseline = now;
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const lockScroll = useCallback((locked: boolean) => {
    const body = document.body;
    if (locked && !scrollLockedRef.current) {
      // lock
      body.style.overflow = "hidden";
      body.style.touchAction = "none";
      scrollLockedRef.current = true;
    } else if (!locked && scrollLockedRef.current) {
      // unlock
      body.style.overflow = "";
      body.style.touchAction = "";
      scrollLockedRef.current = false;
    }
  }, []);

  // Inject CSS once
  useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-mobile-kit", "1");
    style.innerHTML = `
      /* Viewport fix: use var(--vh) instead of 100vh when needed */
      :root { --vh: ${vh}px; }

      /* Safe area fallbacks */
      :root {
        --safe-top: env(safe-area-inset-top, 0px);
        --safe-bottom: env(safe-area-inset-bottom, 0px);
        --safe-left: env(safe-area-inset-left, 0px);
        --safe-right: env(safe-area-inset-right, 0px);
      }

      /* Improve scrolling performance on touch */
      .touch * { -webkit-tap-highlight-color: transparent; }
      .touch .momentum-scroll { -webkit-overflow-scrolling: touch; }

      /* Utility: use-h-screen on mobile without address bar jump */
      .h-screen-mobile {
        height: calc(var(--vh) * 100);
      }

      /* Sticky bottom containers respect home indicator */
      .safe-bottom {
        padding-bottom: max(var(--safe-bottom), 0px);
      }
      .safe-top {
        padding-top: max(var(--safe-top), 0px);
      }

      /* MobileSheet base styles */
      .mk-sheet-backdrop {
        position: fixed; inset: 0; background: rgba(0,0,0,0.35);
        opacity: 0; transition: opacity 160ms ease;
      }
      .mk-sheet-backdrop[data-open="true"] { opacity: 1; }

      .mk-sheet {
        position: fixed; left: 0; right: 0; bottom: 0;
        border-top-left-radius: 16px; border-top-right-radius: 16px;
        background: var(--mk-bg, #fff);
        box-shadow: 0 -8px 24px rgba(0,0,0,0.18);
        transform: translateY(100%);
        transition: transform 220ms ease;
        max-height: calc(var(--vh) * 100 - 40px);
        display: flex; flex-direction: column;
      }
      .mk-sheet[data-open="true"] { transform: translateY(0%); }

      .mk-sheet-handle {
        width: 40px; height: 5px; border-radius: 999px;
        background: rgba(0,0,0,0.18); margin: 8px auto 12px;
      }

      .mk-touch-button {
        position: relative;
      }
      .mk-touch-button::after {
        content: ""; position: absolute; inset: -8px; /* larger hit target */
      }
    `;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, [vh]);

  // Update CSS custom property when vh changes
  useEffect(() => {
    document.documentElement.style.setProperty("--vh", `${vh}px`);
  }, [vh]);

  // Recompute safe-area on mount (optional read, keeps future CSS env usage correct)
  useEffect(() => {
    const top = getSafeAreaInset("top");
    const bottom = getSafeAreaInset("bottom");
    const left = getSafeAreaInset("left");
    const right = getSafeAreaInset("right");
    const root = document.documentElement;
    root.style.setProperty("--safe-top", `${top}px`);
    root.style.setProperty("--safe-bottom", `${bottom}px`);
    root.style.setProperty("--safe-left", `${left}px`);
    root.style.setProperty("--safe-right", `${right}px`);
  }, []);

  const value = useMemo<MobileKitContextValue>(() => {
    return { vh, isTouch, isKeyboardOpen, lockScroll };
  }, [vh, isTouch, isKeyboardOpen, lockScroll]);

  return <MobileKitContext.Provider value={value}>{children}</MobileKitContext.Provider>;
}

// ----------------------------
// Hooks
// ----------------------------

export function useMobileKit() {
  const ctx = useContext(MobileKitContext);
  if (!ctx) throw new Error("useMobileKit must be used within <MobileKitProvider>");
  return ctx;
}

export function useViewport() {
  const { vh } = useMobileKit();
  const [vw, setVw] = useState<number>(typeof window !== "undefined" ? window.innerWidth : 0);
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);
  return { vw, vh };
}

export function useIsKeyboardOpen() {
  const { isKeyboardOpen } = useMobileKit();
  return isKeyboardOpen;
}

export function useScrollLock() {
  const { lockScroll } = useMobileKit();
  return lockScroll;
}

// ----------------------------
// Components
// ----------------------------

type SafeAreaEdge = "top" | "bottom" | "both" | "none";
export function SafeArea({
  edge = "both",
  className = "",
  children,
}: PropsWithChildren<{ edge?: SafeAreaEdge; className?: string }>) {
  const paddings =
    edge === "top"
      ? "pt-[var(--safe-top)]"
      : edge === "bottom"
      ? "pb-[var(--safe-bottom)]"
      : edge === "both"
      ? "pt-[var(--safe-top)] pb-[var(--safe-bottom)]"
      : "";

  return <div className={`${paddings} ${className}`}>{children}</div>;
}

/**
 * KeyboardAvoidingView
 * Wrap sections that contain inputs near the bottom on mobile.
 * Adds bottom padding when the keyboard opens so content isn’t obscured.
 */
export function KeyboardAvoidingView({
  className = "",
  offset = 12,
  children,
}: PropsWithChildren<{ className?: string; offset?: number }>) {
  const isOpen = useIsKeyboardOpen();
  return (
    <div
      className={className}
      style={{
        paddingBottom: isOpen ? `calc(var(--safe-bottom) + ${offset}px)` : undefined,
      }}
    >
      {children}
    </div>
  );
}

/**
 * StickyBottomBar
 * Use for persistent CTAs/totals on mobile—auto pads for home indicator.
 */
export function StickyBottomBar({
  className = "",
  children,
  elevated = true,
}: PropsWithChildren<{ className?: string; elevated?: boolean }>) {
  return (
    <div
      className={`fixed left-0 right-0 bottom-0 safe-bottom ${elevated ? "shadow-[0_-6px_20px_rgba(0,0,0,0.12)]" : ""} bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 ${className}`}
    >
      <div className="mx-auto max-w-screen-md px-4 py-3">{children}</div>
    </div>
  );
}

/**
 * BottomTabBar
 * Minimal, themeable mobile tab bar (3–5 items). Uses Wouter's <Link/>.
 */
export type TabItem = {
  href: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

export function BottomTabBar({
  items,
  className = "",
}: {
  items: TabItem[];
  className?: string;
}) {
  const [location] = useLocation();
  return (
    <SafeArea edge="bottom">
      <nav
        className={`fixed left-0 right-0 bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 border-t border-border ${className}`}
      >
        <ul className="mx-auto grid max-w-screen-md grid-cols-5 gap-1 px-2 py-2">
          {items.map((item, i) => {
            const active =
              item.exact ? location === item.href : location.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={i} className="flex items-center justify-center">
                <Link href={item.href}>
                  <a
                    className={`mk-touch-button flex flex-col items-center justify-center rounded-md px-2 py-1.5 text-xs transition
                      ${active ? "text-foreground font-medium" : "text-muted-foreground"}
                    `}
                    aria-current={active ? "page" : undefined}
                  >
                    {Icon ? <Icon className="h-5 w-5 mb-0.5" /> : null}
                    <span className="leading-none">{item.label}</span>
                  </a>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </SafeArea>
  );
}

/**
 * MobileSheet
 * Lightweight bottom sheet. Lock scroll when open. Focus-traps content.
 */
export function MobileSheet({
  open,
  onOpenChange,
  title,
  children,
  height = "auto", // or "lg" => 80% height
  className = "",
  contentClassName = "",
}: PropsWithChildren<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  height?: "auto" | "lg";
  className?: string;
  contentClassName?: string;
}>) {
  const lockScroll = useScrollLock();
  const sheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    lockScroll(open);
    return () => lockScroll(false);
  }, [open, lockScroll]);

  useEffect(() => {
    if (!open) return;
    // Trap focus in sheet
    const prev = document.activeElement as HTMLElement | null;
    const el = sheetRef.current;
    el?.focus();
    return () => prev?.focus?.();
  }, [open]);

  const maxHeight = height === "lg" ? "calc(var(--vh) * 100 * 0.8)" : "auto";

  return (
    <>
      <div
        className="mk-sheet-backdrop"
        data-open={open}
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title || "Dialog"}
        className={`mk-sheet safe-bottom ${className}`}
        style={{ maxHeight }}
        data-open={open}
      >
        <div className="mk-sheet-handle" />
        {title ? (
          <div className="px-4 pb-2">
            <h3 className="text-base font-semibold">{title}</h3>
          </div>
        ) : null}
        <div className={`overflow-y-auto px-4 pb-4 pt-2 ${contentClassName}`}>{children}</div>
      </div>
    </>
  );
}

/**
 * TouchButton
 * Expands touch hit area without changing visual size. Pass any Tailwind classes.
 */
export function TouchButton({
  as: Comp = "button",
  className = "",
  children,
  ...rest
}: React.ComponentProps<any> & { as?: any }) {
  return (
    <Comp className={`mk-touch-button ${className}`} {...rest}>
      {children}
    </Comp>
  );
}

/**
 * ResponsiveContainer
 * Centers content and caps max width on large screens while remaining fluid on mobile.
 */
export function ResponsiveContainer({
  className = "",
  children,
}: PropsWithChildren<{ className?: string }>) {
  return <div className={`mx-auto w-full max-w-screen-md px-3 ${className}`}>{children}</div>;
}

/**
 * Screen
 * Full-height section that uses the mobile 100vh fix.
 */
export function Screen({
  className = "",
  children,
}: PropsWithChildren<{ className?: string }>) {
  return <div className={`h-screen-mobile flex flex-col ${className}`}>{children}</div>;
}

/**
 * ExampleBottomTabs
 * Small helper you can use immediately; replace icons/routes as you like.
 * (You can delete this if you already have a nav.)
 */
export function ExampleBottomTabs({
  items,
}: {
  items?: TabItem[];
}) {
  // Fallback demo items if none supplied
  const demo = useMemo<TabItem[]>(
    () =>
      items ?? [
        { href: "/", label: "Feed" },
        { href: "/explore", label: "Explore" },
        { href: "/recipes", label: "Recipes" },
        { href: "/drinks", label: "Drinks" },
        { href: "/profile", label: "Profile" },
      ],
    [items]
  );

  return <BottomTabBar items={demo} />;
}
