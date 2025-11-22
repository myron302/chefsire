// client/src/components/ModeToggle.tsx

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Simple dark / light theme toggle for ChefSire.
 * It:
 * - remembers the user’s choice in localStorage
 * - applies / removes the `dark` class on <html>
 *   (Tailwind is already configured with darkMode: ["class"])
 */
export function ModeToggle() {
  const [isDark, setIsDark] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;

    // 1) If user has already chosen a theme, use that
    const stored = window.localStorage.getItem("chefsire-theme");
    if (stored === "dark") return true;
    if (stored === "light") return false;

    // 2) Otherwise, respect system preference
    if (window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return true;
    }

    return false;
  });

  React.useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;

    if (isDark) {
      root.classList.add("dark");
      window.localStorage.setItem("chefsire-theme", "dark");
    } else {
      root.classList.remove("dark");
      window.localStorage.setItem("chefsire-theme", "light");
    }
  }, [isDark]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Toggle color mode"
      onClick={() => setIsDark((prev) => !prev)}
    >
      {isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}
