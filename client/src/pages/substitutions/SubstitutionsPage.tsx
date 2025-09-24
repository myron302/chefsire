// client/src/pages/Substitutions.tsx
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Alt = { name: string; note?: string; confidence?: number; tags?: string[] };
type SuggestItem = { original: string; alternatives: Alt[] };
type SuggestResponse = { items: SuggestItem[]; info: { diet: string | null; avoid: string[]; engine: string } };

export default function SubstitutionsPage() {
  const [ingredients, setIngredients] = useState("milk,butter,egg");
  const [diet, setDiet] = useState<"none" | "vegan">("none");
  const [avoid, setAvoid] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuggestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams();
      params.set("ingredients", ingredients);
      if (diet !== "none") params.set("diet", diet);
      if (avoid.trim()) params.set("avoid", avoid.trim());

      const res = await fetch(`/api/substitutions/suggest?${params.toString()}`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Request failed (${res.status})`);
      }
      const json: SuggestResponse = await res.json();
      setResult(json);
    } catch (e: any) {
      setError(e?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      <h1 className="text-2xl md:text-3xl font-bold">Ingredient Substitutions</h1>

      <div className="mt-6 space-y-4 border rounded-lg p-4 bg-card border-border">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Ingredients (comma-separated)</label>
            <Textarea
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              placeholder="e.g. milk,butter,egg"
              rows={3}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Diet</label>
            <div className="mt-1">
              <Select value={diet} onValueChange={(v: "none" | "vegan") => setDiet(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select diet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="vegan">Vegan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium">Avoid (comma-separated)</label>
              <Input
                value={avoid}
                onChange={(e) => setAvoid(e.target.value)}
                placeholder="e.g. nut,dairy"
                className="mt-1"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={fetchSuggest} disabled={loading}>
            {loading ? "Suggesting..." : "Suggest"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setIngredients("");
              setAvoid("");
              setDiet("none");
              setResult(null);
              setError(null);
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 text-sm rounded-md bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          {result.items.map((it) => (
            <div key={it.original} className="border rounded-lg p-4 bg-card border-border">
              <div className="font-semibold mb-2">{it.original}</div>
              {it.alternatives.length === 0 ? (
                <div className="text-sm text-muted-foreground">No suggestions.</div>
              ) : (
                <ul className="space-y-2">
                  {it.alternatives.map((a, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{a.name}</div>
                        {a.note && <div className="text-sm text-muted-foreground">{a.note}</div>}
                        {a.tags?.length ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {a.tags.map((t) => (
                              <span
                                key={t}
                                className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {typeof a.confidence === "number" && (
                        <div className="text-xs text-muted-foreground self-center">
                          {(a.confidence * 100).toFixed(0)}%
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
