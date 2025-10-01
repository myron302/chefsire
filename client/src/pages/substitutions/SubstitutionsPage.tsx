// client/src/pages/substitutions/SubstitutionsPage.tsx
import React, { useMemo, useState } from "react";
import { Search, ListChecks, Info, Sparkles } from "lucide-react";
import {
  DATA as LOCAL_DATA,
  GROUPS,
  findSubstitutions as localFind,
} from "@/data/ingredient-substitutions";

type ApiResult = {
  query: string;
  results: {
    id: string;
    name: string;
    groupId: string;
    pantryCategory: string;
    matchedAs: "name" | "synonym";
    score: number;
    substitutes: { name: string; note?: string }[];
    caution?: string;
  }[];
};

export default function SubstitutionsPage() {
  const [q, setQ] = useState("");
  const [groupId, setGroupId] = useState<string>("");
  const [useApi, setUseApi] = useState<boolean>(false);
  const [api, setApi] = useState<ApiResult | null>(null);

  const local = useMemo(() => {
    if (!q) return [];
    return localFind(q, { groupId: groupId || undefined }).map((r) => ({
      id: r.entry.id,
      name: r.entry.name,
      groupId: r.entry.groupId,
      pantryCategory: r.entry.pantryCategory,
      matchedAs: r.matchedAs,
      score: r.score,
      substitutes: r.entry.substitutes,
      caution: r.entry.caution,
    }));
  }, [q, groupId]);

  const runSearch = async () => {
    if (!useApi) return;
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (groupId) params.set("groupId", groupId);
    const res = await fetch(`/api/substitutions?${params}`);
    if (res.ok) setApi(await res.json());
  };

  const results = useApi ? api?.results ?? [] : local;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50">
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        <header className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Ingredient Substitutions
          </h1>
          <p className="text-slate-600 mt-2">
            Search for an ingredient and get smart, practical swaps.
          </p>
        </header>

        <div className="bg-white rounded-xl shadow p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="e.g., buttermilk, egg, olive oil…"
                  className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="px-3 py-2 border rounded-lg"
                title="Filter group"
              >
                <option value="">All groups</option>
                {GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={useApi}
                  onChange={(e) => setUseApi(e.target.checked)}
                />
                Use server API
              </label>
              <button
                onClick={runSearch}
                disabled={!useApi}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white disabled:opacity-40"
                title="Run API search"
              >
                Search API
              </button>
            </div>
          </div>

          {/* Local index size (debug/info) */}
          <div className="mt-3 text-xs text-slate-500 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Local catalog size: {LOCAL_DATA.length} entries. You can add more in
            <code className="mx-1 bg-slate-100 px-1 py-0.5 rounded">
              client/src/data/ingredient-substitutions.ts
            </code>
            .
          </div>
        </div>

        {/* Results */}
        {!q ? (
          <div className="text-center text-slate-500">
            Try searching for “buttermilk”, “egg”, “brown sugar”…
          </div>
        ) : results.length === 0 ? (
          <div className="text-center text-slate-500">
            No matches yet. Try a simpler term or add an entry to the catalog.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {results.map((r) => (
              <article
                key={r.id}
                className="bg-white rounded-xl shadow p-4 border border-slate-100"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{r.name}</h3>
                  <span className="text-xs text-slate-500">
                    {r.matchedAs} • {(r.score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="text-xs mt-1 text-slate-500">
                  Group: {r.groupId} • Pantry: {r.pantryCategory}
                </div>

                <ul className="mt-3 space-y-2">
                  {r.substitutes.map((s, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 bg-slate-50 rounded-lg p-2"
                    >
                      <ListChecks className="w-4 h-4 mt-0.5 text-purple-600" />
                      <div>
                        <div className="font-medium">{s.name}</div>
                        {s.note && (
                          <div className="text-sm text-slate-600">{s.note}</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                {r.caution && (
                  <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                    <Sparkles className="w-4 h-4 inline mr-2" />
                    {r.caution}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
