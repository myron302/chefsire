// client/src/components/SpoonRating.tsx
import React from "react";

interface SpoonRatingProps {
  /** Rating value from 0-5 (can be number or string from database decimal) */
  value: number | string | null | undefined;
  /** Optional: make it interactive for user input */
  interactive?: boolean;
  /** Optional: callback when user clicks a spoon */
  onChange?: (rating: number) => void;
  /** Optional: size variant */
  size?: "sm" | "md" | "lg" | "xl";
  /** Optional: show numeric value */
  showValue?: boolean;
  /** Optional: className for container */
  className?: string;
}

const sizeMap = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
  xl: "text-3xl",
};

export function SpoonRating({
  value,
  interactive = false,
  onChange,
  size = "md",
  showValue = false,
  className = "",
}: SpoonRatingProps) {
  // Parse value to number if it's a string (from database decimal)
  const numericValue = typeof value === "string" ? parseFloat(value) : value;
  const rating = Math.max(0, Math.min(5, Math.round(numericValue ?? 0)));
  const [hoveredRating, setHoveredRating] = React.useState<number | null>(null);

  const displayRating = interactive && hoveredRating !== null ? hoveredRating : rating;

  const handleClick = (clickedRating: number) => {
    if (interactive && onChange) {
      onChange(clickedRating);
    }
  };

  const handleMouseEnter = (index: number) => {
    if (interactive) {
      setHoveredRating(index);
    }
  };

  const handleMouseLeave = () => {
    if (interactive) {
      setHoveredRating(null);
    }
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className={`flex items-center gap-0.5 ${sizeMap[size]}`}>
        {Array.from({ length: 5 }).map((_, i) => {
          const spoonIndex = i + 1;
          const isFilled = spoonIndex <= displayRating;

          return (
            <span
              key={i}
              onClick={() => handleClick(spoonIndex)}
              onMouseEnter={() => handleMouseEnter(spoonIndex)}
              onMouseLeave={handleMouseLeave}
              className={`
                ${interactive ? "cursor-pointer transition-transform hover:scale-110" : ""}
                ${isFilled ? "" : "opacity-30"}
              `}
              style={{
                display: "inline-block",
                filter: isFilled
                  ? "brightness(1.2) contrast(1.1) drop-shadow(0 1px 2px rgba(0,0,0,0.3))"
                  : "grayscale(100%) brightness(0.8)",
              }}
              role={interactive ? "button" : undefined}
              aria-label={interactive ? `Rate ${spoonIndex} spoon${spoonIndex > 1 ? "s" : ""}` : undefined}
              tabIndex={interactive ? 0 : undefined}
              onKeyDown={(e) => {
                if (interactive && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  handleClick(spoonIndex);
                }
              }}
            >
              🥄
            </span>
          );
        })}
      </div>
      {showValue && (
        <span className="text-sm text-gray-600 ml-1">
          ({numericValue !== null && numericValue !== undefined ? Number(numericValue).toFixed(1) : "0.0"})
        </span>
      )}
    </div>
  );
}

// Alternative: Fancy colored spoons variant
interface FancySpoonRatingProps extends SpoonRatingProps {
  color?: "gold" | "orange" | "blue" | "purple";
}

export function FancySpoonRating({
  value,
  interactive = false,
  onChange,
  size = "md",
  showValue = false,
  color = "gold",
  className = "",
}: FancySpoonRatingProps) {
  // Parse value to number if it's a string (from database decimal)
  const numericValue = typeof value === "string" ? parseFloat(value) : value;
  const rating = Math.max(0, Math.min(5, Math.round(numericValue ?? 0)));
  const [hoveredRating, setHoveredRating] = React.useState<number | null>(null);

  const displayRating = interactive && hoveredRating !== null ? hoveredRating : rating;

  const colorMap = {
    gold: "text-yellow-500",
    orange: "text-orange-500",
    blue: "text-blue-500",
    purple: "text-purple-500",
  };

  const handleClick = (clickedRating: number) => {
    if (interactive && onChange) {
      onChange(clickedRating);
    }
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className={`flex items-center gap-0.5 ${sizeMap[size]}`}>
        {Array.from({ length: 5 }).map((_, i) => {
          const spoonIndex = i + 1;
          const isFilled = spoonIndex <= displayRating;

          return (
            <span
              key={i}
              onClick={() => handleClick(spoonIndex)}
              onMouseEnter={() => interactive && setHoveredRating(spoonIndex)}
              onMouseLeave={() => interactive && setHoveredRating(null)}
              className={`
                ${colorMap[color]}
                ${interactive ? "cursor-pointer transition-all hover:scale-125" : ""}
                ${isFilled ? "opacity-100" : "opacity-20"}
              `}
              style={{
                display: "inline-block",
                textShadow: isFilled ? "0 0 4px rgba(0,0,0,0.1)" : "none",
              }}
              role={interactive ? "button" : undefined}
              aria-label={interactive ? `Rate ${spoonIndex} spoon${spoonIndex > 1 ? "s" : ""}` : undefined}
              tabIndex={interactive ? 0 : undefined}
            >
              🥄
            </span>
          );
        })}
      </div>
      {showValue && (
        <span className={`text-sm ${colorMap[color]} font-medium ml-1`}>
          {numericValue !== null && numericValue !== undefined ? Number(numericValue).toFixed(1) : "0.0"}
        </span>
      )}
    </div>
  );
}

// Compact inline display for lists
export function CompactSpoonRating({ value }: { value: number | string | null | undefined }) {
  const numericValue = typeof value === "string" ? parseFloat(value) : value;
  const rating = numericValue !== null && numericValue !== undefined ? Number(numericValue).toFixed(1) : "0.0";
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span>🥄</span>
      <span className="font-medium">{rating}</span>
    </span>
  );
}
