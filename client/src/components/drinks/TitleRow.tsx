import * as React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { SafeArea } from "@/mobile/MobileKit";

/**
 * Drinks Title Row
 * - Mobile-first wrap layout that prevents crowding/smashing.
 * - Slots for: back link, title, tier badge, level/xp, and an optional search component.
 * - Uses flex-wrap + gap-y to break lines gracefully on small screens.
 */
type TitleRowProps = {
  backHref?: string;
  backLabel?: string;
  title: string;
  tierLabel?: string;        // e.g. "Premium"
  level?: number;            // e.g. 50
  xp?: number;               // e.g. 12475
  // Optional search slot: pass any node (e.g. <UniversalSearch ... />)
  search?: React.ReactNode;
  className?: string;
  gradient?: boolean;        // if true, wraps in the gradient hero like your designs
};

export default function TitleRow({
  backHref,
  backLabel = "Back",
  title,
  tierLabel,
  level,
  xp,
  search,
  className = "",
  gradient = true,
}: TitleRowProps) {
  const Wrapper: React.ElementType = gradient ? "div" : React.Fragment;

  return (
    <Wrapper
      {...(gradient
        ? {
            className:
              "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-xl shadow-2xl",
          }
        : {})}
    >
      {/* Safe top padding if used at the very top (header beneath notch) */}
      <SafeArea edge="top" />

      <div className={`px-4 md:px-6 ${gradient ? "py-6 md:py-10" : "py-4"} ${className}`}>
        {/* Row 1: Back link */}
        {backHref ? (
          <div className="mb-3">
            <Link href={backHref}>
              <Button
                variant={gradient ? "ghost" : "outline"}
                className={gradient ? "text-white hover:bg-white/20" : ""}
                size="sm"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {backLabel}
              </Button>
            </Link>
          </div>
        ) : null}

        {/* Row 2+: Title + tier + metrics + (on mobile) search */}
        <div
          className={[
            // Wrap by default; prevent smash on small screens
            "flex flex-wrap items-center gap-x-3 gap-y-2",
            // On md+ allow more horizontal space
            "md:gap-x-4",
          ].join(" ")}
        >
          {/* Title */}
          <h1
            className={[
              "text-2xl sm:text-3xl md:text-4xl font-bold",
              gradient ? "" : "text-foreground",
            ].join(" ")}
          >
            {title}
          </h1>

          {/* Tier badge (e.g., Premium) */}
          {tierLabel ? (
            <Badge
              className={[
                "rounded-full",
                gradient ? "bg-white/15 backdrop-blur text-white border-white/20" : "",
              ].join(" ")}
              variant={gradient ? "default" : "outline"}
            >
              {tierLabel}
            </Badge>
          ) : null}

          {/* Spacer that lets the right metrics float to the end on larger screens */}
          <div className="flex-1 min-w-[12px]" />

          {/* Level / XP cluster */}
          {(typeof level === "number" || typeof xp === "number") && (
            <div className="flex items-center gap-2">
              {typeof level === "number" && (
                <Badge
                  variant={gradient ? "default" : "outline"}
                  className={gradient ? "bg-white/15 backdrop-blur text-white border-white/20" : ""}
                >
                  Level {level}
                </Badge>
              )}
              {typeof xp === "number" && (
                <Badge
                  variant={gradient ? "default" : "outline"}
                  className={gradient ? "bg-white/15 backdrop-blur text-white border-white/20" : ""}
                >
                  {xp.toLocaleString()} XP
                </Badge>
              )}
            </div>
          )}

          {/* On small screens, force the search to a new wrapped row */}
          {search ? (
            <div className="basis-full mt-2 md:mt-0 md:basis-auto md:ml-2">
              {search}
            </div>
          ) : null}
        </div>
      </div>
    </Wrapper>
  );
}
