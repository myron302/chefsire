import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CONTENT_SOURCE_LABELS, type ContentSourceFilter } from "@shared/content-source";

type RecipesToolbarProps = {
  q: string;
  sourceFilter: ContentSourceFilter;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onRandom: () => void;
  onSourceChange: (source: ContentSourceFilter) => void;
};

export function RecipesToolbar({
  q,
  sourceFilter,
  onQueryChange,
  onSearch,
  onRandom,
  onSourceChange,
}: RecipesToolbarProps) {
  return (
    <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-2">
      <Input
        placeholder="Search recipes…"
        value={q}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSearch()}
        className="flex-1 max-w-md"
        aria-label="Search recipes"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={onSearch}>Search</Button>
        <Button variant="ghost" onClick={onRandom}>Random</Button>
        <Link href="/recipes/filters">
          <Button variant="ghost" className="whitespace-nowrap">Advanced filters</Button>
        </Link>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Source:</span>
        {(["all", "chefsire", "external"] as ContentSourceFilter[]).map((source) => (
          <Button
            key={source}
            size="sm"
            variant={sourceFilter === source ? "default" : "outline"}
            onClick={() => onSourceChange(source)}
          >
            {CONTENT_SOURCE_LABELS[source]}
          </Button>
        ))}
      </div>
    </div>
  );
}
