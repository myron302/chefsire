// client/src/pages/substitutions/SubstitutionsPage.tsx
import * as React from "react";

type Alt = { name: string; note?: string; confidence?: number; tags?: string[] };
type Item = { original: string; alternatives: Alt[] };
type ApiResponse =
  | { items: Item[]; info: { diet: string | null; avoid: string[]; engine: string } }
  | { message: string };

export default function SubstitutionsPage() {
  const [ingredientsInput, setIngredientsInput] = React.useState("milk,butter,egg");
  const [diet, setDiet] = React.useState<"" | "vegan">("vegan");
  const [avoidInput, setAvoidInput] = React.useState("dairy,nut");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<ApiResponse | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setData(null);

    const ingredients = ingredientsInput.trim();
    const avoid = avoidInput.trim();

    const params = new URLSearchParams();
    if (ingredients) params.set("ingredients", ingredients);
    if (diet) params.set("diet", diet);
    if (avoid) params.set("avoid", avoid);

    try {
      const res = await fetch(`/api/substitutions/suggest?${params.toString()}`);
      const json: ApiResponse = await res.json();
      if (!res.ok) {
        const msg = (json as any)?.message || `Request failed (${res.status})`;
        throw new Error(msg);
      }
      setData(json);
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const items = (data as any)?.items as Item[] | undefined;

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>Ingredient Substitutions</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Type ingredients separated by commas (e.g. <code>milk,butter,egg</code>), choose a diet, optionally list things to avoid,
        then click <strong>Suggest</strong>. This calls <code>/api/substitutions/suggest</code>.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginBottom: 24 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Ingredients (comma-separated)</span>
          <input
            value={ingredientsInput}
            onChange={(e) => setIngredientsInput(e.target.value)}
            placeholder="milk,butter,egg"
            style={{
              padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14,
            }}
          />
        </label>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Diet</span>
            <select
              value={diet}
              onChange={(e) => setDiet(e.target.value as any)}
              style={{ padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14 }}
            >
              <option value="">None</option>
              <option value="vegan">Vegan</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Avoid (comma-separated)</span>
            <input
              value={avoidInput}
              onChange={(e) => setAvoidInput(e.target.value)}
              placeholder="dairy,nut"
              style={{
                padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14,
              }}
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 8,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #0a7",
            background: loading ? "#e9fff7" : "#0a7",
            color: loading ? "#0a7" : "white",
            fontWeight: 600,
            cursor: loading ? "default" : "pointer",
            width: "fit-content",
          }}
        >
          {loading ? "Suggesting…" : "Suggest"}
        </button>
      </form>

      {error && (
        <div style={{ background: "#fff1f0", border: "1px solid #ffa39e", padding: 12, borderRadius: 8, color: "#a8071a" }}>
          {error}
        </div>
      )}

      {items && (
        <div style={{ display: "grid", gap: 16 }}>
          {items.map((it) => (
            <div key={it.original} style={{ border: "1px solid #eee", borderRadius: 10, padding: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{it.original}</div>
              {it.alternatives.length === 0 ? (
                <div style={{ color: "#666" }}>No suggestions.</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
                  {it.alternatives.map((alt, idx) => (
                    <li key={idx}>
                      <span style={{ fontWeight: 600 }}>{alt.name}</span>
                      {typeof alt.confidence === "number" && (
                        <span style={{ color: "#999" }}> · {(alt.confidence * 100).toFixed(0)}%</span>
                      )}
                      {alt.note && <div style={{ color: "#555" }}>{alt.note}</div>}
                      {alt.tags && alt.tags.length > 0 && (
                        <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                          {alt.tags.map((t) => (
                            <span
                              key={t}
                              style={{
                                fontSize: 12,
                                background: "#f4f4f5",
                                border: "1px solid #e4e4e7",
                                padding: "2px 6px",
                                borderRadius: 999,
                                color: "#444",
                              }}
                            >
                              {t}
                            </span>
                          ))}
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
