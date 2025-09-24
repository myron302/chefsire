// Minimal tooltip implementation with no Radix dependency.
// Keeps the same named exports used across the app so you don't have to change imports.
//
// Usage remains compatible with:
// <TooltipProvider>
//   <Tooltip>
//     <TooltipTrigger asChild>
//       <button>Hover me</button>
//     </TooltipTrigger>
//     <TooltipContent>Hello!</TooltipContent>
//   </Tooltip>
// </TooltipProvider>

import * as React from "react";

type TooltipProps = { children: React.ReactNode };
type TooltipTriggerProps = {
  asChild?: boolean;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>;
type TooltipContentProps = {
  className?: string;
  sideOffset?: number; // kept for compatibility; not used
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

const TooltipContext = React.createContext<{ open: boolean } | null>(null);

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function Tooltip({ children }: TooltipProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
    >
      <TooltipContext.Provider value={{ open }}>{children}</TooltipContext.Provider>
    </span>
  );
}

export function TooltipTrigger({
  asChild,
  className,
  children,
  ...rest
}: TooltipTriggerProps) {
  // We don't rely on Radix's "asChild"; we just wrap to keep layout predictable.
  // If the child is a valid element and asChild=true, we still wrap to avoid cloning logic complexity.
  return (
    <span
      tabIndex={0}
      className={["inline-flex items-center outline-none", className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </span>
  );
}

export function TooltipContent({
  className,
  children,
  style,
  ...rest
}: TooltipContentProps) {
  const ctx = React.useContext(TooltipContext);
  const visible = !!ctx?.open;

  return (
    <div
      role="tooltip"
      aria-hidden={visible ? "false" : "true"}
      {...rest}
      className={[
        "pointer-events-none absolute z-50 rounded-md border px-2 py-1 text-xs shadow",
        "bg-white text-black dark:bg-neutral-900 dark:text-white border-neutral-200 dark:border-neutral-800",
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1",
        "transition-opacity duration-100 will-change-transform",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        top: "100%",
        left: 0,
        marginTop: 6,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export const TooltipArrow = (_props: React.HTMLAttributes<HTMLSpanElement>) => null;

// Default export to match some import patterns
export default {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipArrow,
};
