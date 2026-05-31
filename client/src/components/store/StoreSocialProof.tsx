import * as React from "react";
import { Star, Trophy, Users, Award, Calendar } from "lucide-react";
import type { StoreSocialProof } from "@shared/store/storeSocialProof";
import {
  humanizeFollowerCount,
  formatMemberSince,
  DEFAULT_SOCIAL_PROOF_VISIBILITY,
} from "@shared/store/storeSocialProof";
import type { StoreSocialProofConfig } from "@shared/store/storeLayout";
import type { StoreThemeTokens } from "@shared/store/storeLayout";

interface StoreSocialProofProps {
  socialProof: StoreSocialProof | undefined;
  visibility: StoreSocialProofConfig | undefined;
  tokens: StoreThemeTokens;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium whitespace-nowrap"
      style={{
        backgroundColor: "var(--store-accent)",
        color: "var(--store-text)",
        borderRadius: "var(--store-radius)",
        fontFamily: "var(--store-font-body)",
      }}
    >
      {children}
    </span>
  );
}

function PillIcon({ icon: Icon }: { icon: React.ElementType }) {
  return <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--store-primary)" }} />;
}

export default function StoreSocialProof({
  socialProof,
  visibility,
}: StoreSocialProofProps) {
  if (!socialProof) return null;

  const vis = { ...DEFAULT_SOCIAL_PROOF_VISIBILITY, ...visibility };

  const pills: React.ReactNode[] = [];

  if (
    vis.showReviewRating &&
    socialProof.reviewRating != null &&
    socialProof.reviewRating.count > 0
  ) {
    const { average, count } = socialProof.reviewRating;
    pills.push(
      <Pill key="rating">
        <PillIcon icon={Star} />
        {average.toFixed(1)} ({count} review{count !== 1 ? "s" : ""})
      </Pill>,
    );
  }

  if (vis.showCookoffWins && typeof socialProof.cookoffWins === "number" && socialProof.cookoffWins > 0) {
    const w = socialProof.cookoffWins;
    pills.push(
      <Pill key="wins">
        <PillIcon icon={Trophy} />
        {w} cook-off {w === 1 ? "win" : "wins"}
      </Pill>,
    );
  }

  if (vis.showFollowerCount && typeof socialProof.followerCount === "number") {
    pills.push(
      <Pill key="followers">
        <PillIcon icon={Users} />
        {humanizeFollowerCount(socialProof.followerCount)} followers
      </Pill>,
    );
  }

  if (vis.showChefClubs && socialProof.chefClubs && socialProof.chefClubs.length > 0) {
    const clubs = socialProof.chefClubs;
    const shown = clubs.slice(0, 3).map((c) => c.name).join(", ");
    const extra = clubs.length - 3;
    pills.push(
      <Pill key="clubs">
        <PillIcon icon={Award} />
        {shown}
        {extra > 0 ? ` +${extra} more` : ""}
      </Pill>,
    );
  }

  if (vis.showMemberSince && socialProof.memberSince) {
    const label = formatMemberSince(socialProof.memberSince);
    if (label) {
      pills.push(
        <Pill key="since">
          <PillIcon icon={Calendar} />
          {label}
        </Pill>,
      );
    }
  }

  if (pills.length === 0) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-3">
      <div className="flex flex-wrap gap-2">{pills}</div>
    </div>
  );
}
