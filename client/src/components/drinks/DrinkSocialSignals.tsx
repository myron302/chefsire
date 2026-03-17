import { Badge } from "@/components/ui/badge";

type DrinkSocialSignalsProps = {
  isTrending?: boolean;
  remixesCount?: number | null;
  views7d?: number | null;
  className?: string;
};

function formatCount(value: number | null | undefined): string {
  return new Intl.NumberFormat().format(Number(value ?? 0));
}

export default function DrinkSocialSignals({
  isTrending,
  remixesCount,
  views7d,
  className,
}: DrinkSocialSignalsProps) {
  const showRemixes = Number(remixesCount ?? 0) > 0;
  const showViews = Number(views7d ?? 0) > 0;

  if (!isTrending && !showRemixes && !showViews) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? ""}`.trim()}>
      {isTrending ? (
        <Badge variant="secondary" className="text-[10px]">🔥 Trending</Badge>
      ) : null}
      {showRemixes ? (
        <Badge variant="outline" className="text-[10px]">💬 {formatCount(remixesCount)} remixes</Badge>
      ) : null}
      {showViews ? (
        <Badge variant="outline" className="text-[10px]">👀 {formatCount(views7d)} views this week</Badge>
      ) : null}
    </div>
  );
}
