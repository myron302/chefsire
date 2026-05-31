/**
 * Shared types and pure helpers for storefront social-proof signals.
 * No React — safe to import from both server and client.
 */

import type { StoreSocialProofConfig } from "./storeLayout";

export type StoreSocialProof = {
  reviewRating?: { average: number; count: number } | null;
  cookoffWins?: number;
  followerCount?: number;
  chefClubs?: { id: string; name: string }[];
  memberSince?: string; // ISO date string of owner createdAt
};

export function humanizeFollowerCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

export function formatMemberSince(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `Member since ${d.toLocaleString("en-US", { month: "short", year: "numeric" })}`;
}

export const DEFAULT_SOCIAL_PROOF_VISIBILITY: Required<StoreSocialProofConfig> = {
  showReviewRating: true,
  showCookoffWins: true,
  showFollowerCount: true,
  showChefClubs: true,
  showMemberSince: true,
};
