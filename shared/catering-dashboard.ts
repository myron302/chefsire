export type CateringDashboardFacts = {
  listingEnabled: boolean;
  acceptingInquiries: boolean;
  availabilityConfigured: boolean;
  profileComplete: boolean;
  inquiriesPending: number;
  packagesTotal: number;
  packagesActive: number;
  portfolioCount: number;
  reviewCount: number;
  averageRating: number | null;
  reviewsAwaitingResponse: number;
};

export type CateringDashboardSection = "profile" | "inquiries" | "packages" | "portfolio" | "availability" | "reviews";
export type CateringDashboardNavigationSection = "overview" | CateringDashboardSection;
export type CateringDashboardAction = { section: CateringDashboardSection; label: string; detail: string };

export function cateringDashboardSectionState(section: CateringDashboardNavigationSection, listingEnabled: boolean): "manager" | "listing-required" {
  return !listingEnabled && (["packages", "portfolio", "availability", "reviews"] as CateringDashboardNavigationSection[]).includes(section)
    ? "listing-required" : "manager";
}

/** Settings, weekly rules, and date exceptions are all meaningful persisted configuration. */
export function isCateringAvailabilityConfigured(input: { hasSettings: boolean; weeklyRuleCount: number; exceptionCount: number }): boolean {
  return input.hasSettings || input.weeklyRuleCount > 0 || input.exceptionCount > 0;
}

/** Actions are intentionally based only on persisted setup and attention signals. */
export function cateringDashboardActions(facts: CateringDashboardFacts): CateringDashboardAction[] {
  const actions: CateringDashboardAction[] = [];
  if (!facts.profileComplete) actions.push({ section: "profile", label: "Finish your catering profile", detail: "Add the required identity, specialty, location, and description details." });
  if (!facts.listingEnabled) actions.push({ section: "profile", label: "Enable your marketplace listing", detail: "Your catering service is currently hidden from customers." });
  // An unconfigured provider gets one availability setup task; once configured, pausing is a distinct state.
  if (facts.listingEnabled && facts.availabilityConfigured && !facts.acceptingInquiries) actions.push({ section: "availability", label: "Start accepting inquiries", detail: "Your listing is visible, but new quote requests are paused." });
  if (facts.listingEnabled && facts.packagesTotal === 0) actions.push({ section: "packages", label: "Add your first package", detail: "Give customers a concrete menu or service option." });
  else if (facts.listingEnabled && facts.packagesActive === 0) actions.push({ section: "packages", label: "Activate a package", detail: "You have saved packages, but none are currently visible to customers." });
  if (facts.listingEnabled && facts.portfolioCount === 0) actions.push({ section: "portfolio", label: "Add portfolio work", detail: "Show customers examples of your catering work." });
  if (facts.listingEnabled && !facts.availabilityConfigured) actions.push({ section: "availability", label: "Configure availability", detail: "Set your business timezone, inquiry window, or weekly schedule." });
  if (facts.inquiriesPending > 0) actions.push({ section: "inquiries", label: `Respond to ${facts.inquiriesPending} pending ${facts.inquiriesPending === 1 ? "inquiry" : "inquiries"}`, detail: "Review the request details and accept or decline when ready." });
  if (facts.listingEnabled && facts.reviewsAwaitingResponse > 0) actions.push({ section: "reviews", label: `Respond to ${facts.reviewsAwaitingResponse} customer ${facts.reviewsAwaitingResponse === 1 ? "review" : "reviews"}`, detail: "A public provider response has not been posted yet." });
  return actions;
}
