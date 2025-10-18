// client/src/mobile/MobileKit.tsx
import React from "react";
import { useLocation } from "wouter";

type Props = { children?: React.ReactNode };

export function MobileKitProvider({ children }: Props) {
  const [pathname] = useLocation();

  React.useEffect(() => {
    // Tag body with the current route (harmless + useful for future)
    if (pathname) document.body.setAttribute("data-route", pathname);

    // Only touch Drinks pages
    if (!pathname?.startsWith("/drinks")) return;

    // Keep scope away from header/nav; look inside main content only
    const mainEl =
      (document.querySelector("main") as HTMLElement | null) ||
      (document.querySelector('main[role="main"]') as HTMLElement | null) ||
      document.body;

    // Find the gradient hero (present on drink pages) and fix its title row wrap
    const heroContainers = Array.from(
      mainEl.querySelectorAll<HTMLElement>(
        [
          // common hero containers used across your drink pages
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
          // Minimal, inline-only fix to prevent smashing on mobile
          row.style.flexWrap = "wrap";
          row.style.rowGap = "0.5rem";
          row.style.columnGap = "0.5rem";

          h1.style.flexBasis = "100%";
          h1.style.minWidth = "0";
          h1.style.whiteSpace = "normal";
          h1.style.overflow = "hidden";
          h1.style.textOverflow = "ellipsis";

          applied.push({ row, h1 });
          return true; // stop after first matching hero row
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
