import * as React from "react";

import { DASHBOARD_TAB_SECTION_MAP, tabForHash, type DashboardTabValue } from "@/pages/drinks/creator-dashboard/utils";

export function useDashboardHashSync(activeTab: DashboardTabValue, setActiveTab: React.Dispatch<React.SetStateAction<DashboardTabValue>>) {
  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncTabFromHash = () => {
      setActiveTab(tabForHash(window.location.hash));
    };

    syncTabFromHash();
    window.addEventListener("hashchange", syncTabFromHash);
    return () => window.removeEventListener("hashchange", syncTabFromHash);
  }, [setActiveTab]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;

    window.requestAnimationFrame(() => {
      const target = document.getElementById(hash);
      if (target) {
        target.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    });
  }, [activeTab]);

  return React.useCallback((value: string) => {
    const nextTab = value as DashboardTabValue;
    setActiveTab(nextTab);

    if (typeof window === "undefined") return;
    const firstSectionId = DASHBOARD_TAB_SECTION_MAP[nextTab][0];
    if (!firstSectionId) return;
    window.history.replaceState(null, "", `#${firstSectionId}`);
  }, [setActiveTab]);
}
