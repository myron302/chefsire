import type { PlannerTemplate } from './plannerTemplateUtils';

export type PlannerFeedItem = {
  id: string;
  type: 'featured' | 'trending' | 'recent' | 'creator' | 'challenge' | 'streak';
  title: string;
  subtitle: string;
  cta: string;
};

export const buildPlannerFeed = (templates: PlannerTemplate[]): PlannerFeedItem[] => {
  const featured = templates.slice(0, 2).map((t) => ({ id: `featured-${t.id}`, type: 'featured' as const, title: t.title, subtitle: `${t.creator} • ${t.nutritionFocus}`, cta: 'Use This Week' }));
  const trending = templates.slice(2, 4).map((t) => ({ id: `trending-${t.id}`, type: 'trending' as const, title: `Trending: ${t.theme}`, subtitle: t.prepStyle, cta: 'Preview Plan' }));
  return [
    ...featured,
    ...trending,
    { id: 'recent-share', type: 'recent', title: 'Recently Shared Plans', subtitle: 'Fresh weekly plans from the community', cta: 'Explore' },
    { id: 'creator-spotlight', type: 'creator', title: 'Creator Spotlight', subtitle: 'Macro-forward creators this week', cta: 'View Profile' },
    { id: 'prep-challenge', type: 'challenge', title: 'Prep Challenge', subtitle: '3-day minimal prep sprint', cta: 'Join Challenge' },
    { id: 'streak-highlight', type: 'streak', title: 'Nutrition Streak Highlights', subtitle: 'Community hydration and consistency streaks', cta: 'See Highlights' },
  ];
};
