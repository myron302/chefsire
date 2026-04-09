import * as React from "react";

export function useInfiniteScrollSentinel(
  onIntersect: () => void,
  deps: React.DependencyList,
  options: IntersectionObserverInit = { root: null, rootMargin: "1200px 0px", threshold: 0 }
) {
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!sentinelRef.current) return;
    const node = sentinelRef.current;
    const obs = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry.isIntersecting) {
        Promise.resolve().then(onIntersect);
      }
    }, options);

    obs.observe(node);
    return () => obs.disconnect();
    // caller owns dependency precision for behavior compatibility
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return sentinelRef;
}
