import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, X } from "lucide-react";
import type { CateringPortfolioItem } from "@shared/catering-portfolio";
import { Button } from "@/components/ui/button";

export function PortfolioGallery({ items }: { items: CateringPortfolioItem[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const touchStart = useRef<number | null>(null);
  const move = (delta: number) => setActive((index) => index == null ? null : (index + delta + items.length) % items.length);
  const close = () => { setActive(null); requestAnimationFrame(() => triggerRef.current?.focus()); };
  useEffect(() => {
    if (active == null) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); if (event.key === "ArrowLeft") move(-1); if (event.key === "ArrowRight") move(1); if (event.key === "Tab") { event.preventDefault(); closeRef.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [active, items.length]);
  if (!items.length) return <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 text-center"><ImageIcon className="mb-3 h-8 w-8 text-muted-foreground" /><p className="font-medium">No portfolio photos yet</p><p className="mt-1 text-sm text-muted-foreground">This provider has not uploaded any work to their portfolio.</p></div>;
  return <><div className="columns-1 gap-4 sm:columns-2 lg:columns-3" aria-label="Catering portfolio">{items.map((item, index) => <button key={item.id} type="button" className="group relative mb-4 block w-full break-inside-avoid overflow-hidden rounded-xl bg-muted text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2" onClick={(event) => { triggerRef.current = event.currentTarget; setActive(index); }} aria-label={`Open ${item.title}`}>{!loaded.has(item.id) && <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden="true" />}<img src={item.image} alt={item.description || item.title} loading="lazy" decoding="async" className="max-h-[32rem] w-full object-cover transition duration-300 group-hover:scale-[1.02]" onLoad={() => setLoaded((current) => new Set(current).add(item.id))} /><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-12 text-white"><span className="block font-semibold">{item.title}</span><span className="text-xs text-white/80">{item.category}</span></span></button>)}</div>
  {active != null && <div className="fixed inset-0 z-[100] flex touch-pan-y items-center justify-center bg-black/95 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label={`${items[active].title} image viewer`} onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { const end = event.changedTouches[0]?.clientX; if (touchStart.current != null && end != null && Math.abs(end - touchStart.current) > 50) move(end < touchStart.current ? 1 : -1); touchStart.current = null; }}><Button ref={closeRef} variant="ghost" size="icon" className="absolute right-3 top-3 h-11 w-11 text-white hover:bg-white/20 hover:text-white" onClick={close} aria-label="Close image viewer"><X /></Button>{items.length > 1 && <Button variant="ghost" size="icon" className="absolute left-2 h-12 w-12 text-white hover:bg-white/20 hover:text-white sm:left-5" onClick={() => move(-1)} aria-label="Previous image"><ChevronLeft className="h-8 w-8" /></Button>}<figure className="flex max-h-full max-w-5xl flex-col items-center"><img src={items[active].image} alt={items[active].description || items[active].title} className="max-h-[80vh] max-w-full object-contain" /><figcaption className="mt-3 max-w-2xl text-center text-white"><p className="font-semibold">{items[active].title}</p>{items[active].description && <p className="mt-1 text-sm text-white/75">{items[active].description}</p>}<p className="mt-1 text-xs text-white/60">{active + 1} of {items.length}</p></figcaption></figure>{items.length > 1 && <Button variant="ghost" size="icon" className="absolute right-2 h-12 w-12 text-white hover:bg-white/20 hover:text-white sm:right-5" onClick={() => move(1)} aria-label="Next image"><ChevronRight className="h-8 w-8" /></Button>}</div>}</>;
}
