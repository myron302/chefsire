import * as React from "react";
import { useLocation } from "wouter";
import TitleRow from "@/components/drinks/TitleRow"; // if you prefer not to use this, see note below
import UniversalSearch from "@/components/UniversalSearch";
import { useDrinks } from "@/contexts/DrinksContext";

/**
 * Central “chrome” for all /drinks/* pages.
 * - Injects global CSS fix so title rows wrap on mobile (no per-page edits).
 * - Optionally shows a unified header based on route (can be disabled on /drinks root hub).
 */
export default function DrinksChrome({ children }: { children: React.ReactNode }) {
  const [path] = useLocation();
  const { userProgress } = useDrinks();

  // 1) Global CSS hotfix: make "title rows" wrap on small screens
  React.useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-drinks-mobile-fix", "1");
    style.innerHTML = `
      /* On small screens, any hero title row that looks like: 
         .bg-gradient-to-* .text-white ... (your heroes) won't smash */
      @media (max-width: 640px) {
        .bg-gradient-to-r.text-white .flex.items-center.gap-4.mb-6,
        .bg-gradient-to-br.text-white .flex.items-center.gap-4.mb-6,
        .bg-gradient-to-l.text-white .flex.items-center.gap-4.mb-6 {
          flex-wrap: wrap !important;
          row-gap: .5rem !important;
          column-gap: .75rem !important;
        }
        /* If a page uses a flex-1 spacer in the header row, hide it on mobile */
        .bg-gradient-to-r.text-white .flex.items-center.gap-4.mb-6 > .flex-1,
        .bg-gradient-to-br.text-white .flex.items-center.gap-4.mb-6 > .flex-1,
        .bg-gradient-to-l.text-white .flex.items-center.gap-4.mb-6 > .flex-1 {
          display: none !important;
        }
        /* Make any search block drop to its own line if it's near the title row */
        .bg-gradient-to-r.text-white .basis-full,
        .bg-gradient-to-br.text-white .basis-full,
        .bg-gradient-to-l.text-white .basis-full {
          width: 100%;
        }
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  // 2) Optional: show a shared header on subpages (NOT on the /drinks root hub)
  const showSharedHeader =
    path.startsWith("/drinks/") && path !== "/drinks" && !path.startsWith("/drinks/potent-potables/mocktails"); // example exclusion if you need

  // Route -> metadata
  const meta = routeMeta(path);

  return (
    <div className="w-full">
      {showSharedHeader && (
        <TitleRow
          backHref={meta.backHref}
          backLabel={meta.backLabel}
          title={meta.title}
          tierLabel={meta.tier}
          level={userProgress.level}
          xp={userProgress.totalPoints}
          gradient
          search={
            <div className="max-w-2xl w-full">
              <UniversalSearch
                onSelectDrink={() => {}}
                placeholder="Search all drinks..."
                className="w-full"
              />
            </div>
          }
        />
      )}

      {children}
    </div>
  );
}

/** Map current path to a clean title/back/tier. Extend as you add pages. */
function routeMeta(path: string) {
  // Defaults
  let title = "Drinks";
  let backHref = "/drinks";
  let backLabel = "Back to Drinks";
  let tier: string | undefined = "Premium";

  if (path.startsWith("/drinks/protein-shakes")) {
    title = "Protein Shakes";
    backLabel = "Back to Drinks Hub";
  }
  if (path.startsWith("/drinks/smoothies")) {
    title = "Smoothies";
  }
  if (path.startsWith("/drinks/detoxes")) {
    title = "Detoxes";
  }
  if (path.startsWith("/drinks/potent-potables")) {
    title = "Potent Potables";
    tier = "Premium";
  }

  // Subcategory niceties
  if (path.includes("/protein-shakes/whey")) title = "Whey Protein Shakes";
  if (path.includes("/protein-shakes/casein")) title = "Casein Protein Shakes";
  if (path.includes("/protein-shakes/plant-based")) title = "Plant Protein Shakes";
  if (path.includes("/protein-shakes/collagen")) title = "Collagen Protein Shakes";
  if (path.includes("/protein-shakes/egg")) title = "Egg Protein Shakes";
  if (path.includes("/protein-shakes/beef")) title = "Beef Protein Shakes";

  return { title, backHref, backLabel, tier };
}
