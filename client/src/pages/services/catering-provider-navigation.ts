import { CATERING_DASHBOARD_SECTIONS, type CateringDashboardNavigationSection } from "@shared/catering-dashboard";

const supported = new Set<string>(CATERING_DASHBOARD_SECTIONS);

export function cateringProviderSectionFromHash(hash: string): CateringDashboardNavigationSection {
  const value = hash.startsWith("#") ? hash.slice(1) : hash;
  return supported.has(value) ? value as CateringDashboardNavigationSection : "overview";
}

export function cateringProviderSectionHash(section: CateringDashboardNavigationSection): `#${CateringDashboardNavigationSection}` {
  return `#${section}`;
}
