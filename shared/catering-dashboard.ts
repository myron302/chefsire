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
export type CateringDashboardAction = { section: CateringDashboardSection; label: string; detail: string };

/** Actions are intentionally based only on persisted setup and attention signals. */
export function cateringDashboardActions(facts: CateringDashboardFacts): CateringDashboardAction[] {
  const actions: CateringDashboardAction[] = [];
  if (!facts.profileComplete) actions.push({ section: "profile", label: "Finish your catering profile", detail: "Add the required identity, specialty, location, and description details." });
  if (!facts.listingEnabled) actions.push({ section: "profile", label: "Enable your marketplace listing", detail: "Your catering service is currently hidden from customers." });
  if (facts.listingEnabled && !facts.acceptingInquiries) actions.push({ section: "availability", label: "Start accepting inquiries", detail: "Your listing is visible, but new quote requests are paused." });
  if (facts.packagesTotal === 0) actions.push({ section: "packages", label: "Add your first package", detail: "Give customers a concrete menu or service option." });
  if (facts.portfolioCount === 0) actions.push({ section: "portfolio", label: "Add portfolio work", detail: "Show customers examples of your catering work." });
  if (!facts.availabilityConfigured) actions.push({ section: "availability", label: "Configure availability", detail: "Set your business timezone, inquiry window, or weekly schedule." });
  if (facts.inquiriesPending > 0) actions.push({ section: "inquiries", label: `Respond to ${facts.inquiriesPending} pending ${facts.inquiriesPending === 1 ? "inquiry" : "inquiries"}`, detail: "Review the request details and accept or decline when ready." });
  if (facts.reviewsAwaitingResponse > 0) actions.push({ section: "reviews", label: `Respond to ${facts.reviewsAwaitingResponse} customer ${facts.reviewsAwaitingResponse === 1 ? "review" : "reviews"}`, detail: "A public provider response has not been posted yet." });
  return actions;
}

