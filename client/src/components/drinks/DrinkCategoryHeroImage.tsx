import { getDrinkCategoryHeroVisual } from '@/constants/drink-images';

type DrinkCategoryHeroImageProps = {
  route: string;
  className?: string;
};

export default function DrinkCategoryHeroImage({ route, className = '' }: DrinkCategoryHeroImageProps) {
  const visual = getDrinkCategoryHeroVisual(route);

  return (
    <section className={`relative mb-8 min-h-[260px] overflow-hidden rounded-3xl border border-white/60 bg-slate-950 shadow-2xl ${className}`}>
      <img
        src={visual.image}
        alt={visual.alt}
        className={`absolute inset-0 h-full w-full object-cover ${visual.positionClass ?? 'object-center'}`}
        onError={(event) => {
          if (event.currentTarget.dataset.fallbackApplied !== 'true') {
            event.currentTarget.dataset.fallbackApplied = 'true';
            event.currentTarget.src = visual.fallbackImage;
          }
        }}
      />
      <div className={`absolute inset-0 ${visual.overlayClass}`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(255,255,255,0.22),transparent_28%),linear-gradient(180deg,transparent,rgba(0,0,0,0.38))]" />
      <div className="relative flex min-h-[260px] max-w-3xl flex-col justify-end p-6 text-white sm:p-8 lg:p-10">
        <p className="mb-3 w-fit rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/85 backdrop-blur">
          {visual.mood}
        </p>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{visual.displayName}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85 sm:text-base">{visual.description}</p>
      </div>
    </section>
  );
}
