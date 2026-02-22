// client/src/pages/ImportPaprikaPage.tsx
import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  FileArchive,
  ChefHat,
  ArrowLeft,
  ExternalLink,
  Loader2,
  Link as LinkIcon,
  FileText,
  Files,
  Globe,
} from "lucide-react";

type ImportMode = "paprika" | "anylist" | "plan-to-eat" | "url";

type ImportResult = {
  ok: boolean;
  imported?: number;
  skipped?: number;
  total?: number;
  errors?: string[];
  error?: string;
};

type ModeConfig = {
  key: ImportMode;
  label: string;
  shortLabel: string;
  endpoint: string;
  kind: "file" | "url";
  accept?: string;
  allowedExtensions?: string[];
  dropLabel: string;
  emptyHint: string;
  guideTitle: string;
  guideDescription: string;
  guideSteps: { step: string; title: string; detail: string }[];
  docsUrl?: string;
  docsLabel?: string;
};

const MODE_CONFIGS: Record<ImportMode, ModeConfig> = {
  paprika: {
    key: "paprika",
    label: "Paprika Export",
    shortLabel: "Paprika",
    endpoint: "/api/recipes/import-paprika",
    kind: "file",
    accept: ".paprikarecipes,.zip",
    allowedExtensions: [".paprikarecipes", ".zip"],
    dropLabel: "Drop your .paprikarecipes file here",
    emptyHint: "or click to browse",
    guideTitle: "How to export from Paprika",
    guideDescription: "Takes about 30 seconds on any device.",
    guideSteps: [
      { step: "1", title: "Open Paprika", detail: "Open the Paprika app on your phone or computer." },
      {
        step: "2",
        title: "Export your recipes",
        detail:
          "iOS/Android: ☰ → Settings → Export Recipes. Mac: File → Export. Choose Paprika Recipe Format.",
      },
      {
        step: "3",
        title: "Save the file",
        detail: "You’ll get a .paprikarecipes file. Save it somewhere you can find it.",
      },
      {
        step: "4",
        title: "Upload here",
        detail: "Drop the file below and click Import. ChefSire will parse and import your recipes.",
      },
    ],
    docsUrl: "https://www.paprikaapp.com",
    docsLabel: "paprikaapp.com",
  },
  anylist: {
    key: "anylist",
    label: "AnyList Export",
    shortLabel: "AnyList",
    endpoint: "/api/recipes/import-anylist",
    kind: "file",
    accept: ".paprikarecipes,.zip",
    allowedExtensions: [".paprikarecipes", ".zip"],
    dropLabel: "Drop your AnyList export (.paprikarecipes) here",
    emptyHint: "or click to browse",
    guideTitle: "How to export from AnyList",
    guideDescription: "ChefSire accepts the Paprika-style export format used for migration workflows.",
    guideSteps: [
      { step: "1", title: "Open AnyList", detail: "Open AnyList on your device." },
      {
        step: "2",
        title: "Export your recipes",
        detail: "Use AnyList’s recipe export/share option and export in a Paprika-compatible recipe file format.",
      },
      {
        step: "3",
        title: "Save the export",
        detail: "Save the .paprikarecipes export file to your phone/computer.",
      },
      {
        step: "4",
        title: "Upload to ChefSire",
        detail: "Drop the file below and import.",
      },
    ],
  },
  "plan-to-eat": {
    key: "plan-to-eat",
    label: "Plan to Eat Export",
    shortLabel: "Plan to Eat",
    endpoint: "/api/recipes/import-plan-to-eat",
    kind: "file",
    accept: ".csv,.txt,text/csv,text/plain",
    allowedExtensions: [".csv", ".txt"],
    dropLabel: "Drop your Plan to Eat .csv or .txt file here",
    emptyHint: "or click to browse",
    guideTitle: "How to export from Plan to Eat",
    guideDescription: "Export your recipe book from the Plan to Eat website, then upload the file here.",
    guideSteps: [
      { step: "1", title: "Open Plan to Eat", detail: "Go to your Plan to Eat account on the web." },
      {
        step: "2",
        title: "Export recipes",
        detail: "Use the recipe export option to download your recipe book as CSV or TXT.",
      },
      {
        step: "3",
        title: "Save the file",
        detail: "Keep the exported .csv or .txt file handy.",
      },
      {
        step: "4",
        title: "Upload and import",
        detail: "Drop the file below and click Import.",
      },
    ],
  },
  url: {
    key: "url",
    label: "Recipe URL",
    shortLabel: "URL",
    endpoint: "/api/recipes/import-url",
    kind: "url",
    dropLabel: "",
    emptyHint: "",
    guideTitle: "Import from a public recipe URL",
    guideDescription: "Paste a recipe page link (public page) and ChefSire will try to read the recipe data.",
    guideSteps: [
      {
        step: "1",
        title: "Copy a recipe link",
        detail: "Copy the URL of a public recipe page (AllRecipes, Food Network, blogs, etc.).",
      },
      {
        step: "2",
        title: "Paste it below",
        detail: "Paste the full URL into the input box.",
      },
      {
        step: "3",
        title: "Import",
        detail: "ChefSire looks for recipe structured data (JSON-LD / schema.org Recipe).",
      },
      {
        step: "4",
        title: "Review your result",
        detail: "If the page has valid structured recipe data, it imports as a standalone recipe.",
      },
    ],
  },
};

function formatBytesMb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function getExtension(name: string) {
  const lower = name.toLowerCase();
  const idx = lower.lastIndexOf(".");
  return idx >= 0 ? lower.slice(idx) : "";
}

function modeIcon(mode: ImportMode) {
  if (mode === "url") return <LinkIcon className="h-4 w-4" />;
  if (mode === "plan-to-eat") return <FileText className="h-4 w-4" />;
  return <Files className="h-4 w-4" />;
}

export default function ImportPaprikaPage() {
  const { toast } = useToast();

  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<ImportMode>("paprika");
  const [file, setFile] = useState<File | null>(null);
  const [urlValue, setUrlValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);

  const config = useMemo(() => MODE_CONFIGS[mode], [mode]);
  const isFileMode = config.kind === "file";
  const isUrlMode = config.kind === "url";

  function resetInputsAndResult(nextMode?: ImportMode) {
    setFile(null);
    setResult(null);
    setDragging(false);
    if (fileRef.current) fileRef.current.value = "";

    if (nextMode === "url") {
      // keep URL if already in URL mode switch? easier UX to keep it
      return;
    }
  }

  function switchMode(nextMode: ImportMode) {
    if (nextMode === mode) return;
    setMode(nextMode);
    setResult(null);
    setDragging(false);
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function validateAndSetFile(f: File | null) {
    if (!f) return;

    const ext = getExtension(f.name);
    const allowed = MODE_CONFIGS[mode].allowedExtensions ?? [];

    if (!allowed.includes(ext)) {
      const human =
        mode === "plan-to-eat"
          ? "Please select a .csv or .txt file."
          : "Please select a .paprikarecipes file.";
      toast({ variant: "destructive", description: human });
      return;
    }

    setFile(f);
    setResult(null);
  }

  async function handleImport() {
    setLoading(true);
    setResult(null);

    try {
      let res: Response;

      if (isFileMode) {
        if (!file) {
          toast({ variant: "destructive", description: "Please choose a file first." });
          setLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append("recipesFile", file);

        res = await fetch(config.endpoint, {
          method: "POST",
          body: formData,
          credentials: "include",
        });
      } else {
        const trimmedUrl = urlValue.trim();
        if (!trimmedUrl) {
          toast({ variant: "destructive", description: "Please paste a recipe URL first." });
          setLoading(false);
          return;
        }

        res = await fetch(config.endpoint, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmedUrl }),
        });
      }

      let data: ImportResult;
      try {
        data = await res.json();
      } catch {
        data = { ok: false, error: `Request failed (${res.status}).` };
      }

      setResult(data);

      if (data.ok) {
        toast({
          description: `Successfully imported ${data.imported ?? 0} recipe${(data.imported ?? 0) !== 1 ? "s" : ""}!`,
        });
      } else {
        toast({ variant: "destructive", description: data.error || "Import failed" });
      }
    } catch {
      const errResult: ImportResult = { ok: false, error: "Network error — please try again." };
      setResult(errResult);
      toast({ variant: "destructive", description: errResult.error });
    } finally {
      setLoading(false);
    }
  }

  const importButtonLabel = isUrlMode ? "Import from URL" : "Import Recipes";
  const canSubmit = isUrlMode ? !!urlValue.trim() : !!file;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Back nav */}
        <Link href="/recipes">
          <Button variant="ghost" size="sm" className="mb-6 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Recipes
          </Button>
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-sm">
            <ChefHat className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Import Recipes</h1>
            <p className="text-sm text-muted-foreground">
              Import recipes from recipe apps or public recipe websites.
            </p>
          </div>
        </div>

        {/* Source selector */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Choose an import source</CardTitle>
            <CardDescription>
              Start with Paprika/AnyList file imports, Plan to Eat exports, or paste a public recipe URL.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(Object.keys(MODE_CONFIGS) as ImportMode[]).map((m) => {
                const active = m === mode;
                const cfg = MODE_CONFIGS[m];
                return (
                  <Button
                    key={m}
                    type="button"
                    variant={active ? "default" : "outline"}
                    className={active ? "justify-start" : "justify-start"}
                    onClick={() => switchMode(m)}
                    disabled={loading}
                  >
                    {modeIcon(m)}
                    <span className="ml-2 truncate">{cfg.shortLabel}</span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* How-to steps */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{config.guideTitle}</CardTitle>
            <CardDescription>{config.guideDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {config.guideSteps.map((s) => (
                <div key={`${mode}-${s.step}`} className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-orange-100 text-orange-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {s.step}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {config.docsUrl && (
              <a
                href={config.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-4 text-xs text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
                {config.docsLabel || config.docsUrl}
              </a>
            )}

            {mode === "url" && (
              <div className="mt-4 rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground">Note:</span> URL import works best for{" "}
                  <span className="font-medium text-foreground">public recipe pages</span>. It usually can’t import
                  recipes saved inside private accounts or paywalled recipe boxes.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Import input area */}
        <Card className="mb-4">
          <CardContent className="pt-6">
            {isFileMode ? (
              <>
                <div
                  className={[
                    "relative rounded-xl border-2 border-dashed transition-colors cursor-pointer p-8 text-center",
                    dragging
                      ? "border-orange-400 bg-orange-50"
                      : "border-muted-foreground/25 hover:border-orange-300 hover:bg-orange-50/40",
                  ].join(" ")}
                  onClick={() => !loading && fileRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!loading) setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    if (loading) return;
                    validateAndSetFile(e.dataTransfer.files?.[0] ?? null);
                  }}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept={config.accept}
                    className="hidden"
                    onChange={(e) => validateAndSetFile(e.target.files?.[0] ?? null)}
                  />

                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileArchive className="h-8 w-8 text-orange-500 flex-shrink-0" />
                      <div className="text-left">
                        <p className="font-semibold text-sm break-all">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytesMb(file.size)} — ready to import via {config.shortLabel}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="font-semibold text-sm mb-1">{config.dropLabel}</p>
                      <p className="text-xs text-muted-foreground">{config.emptyHint}</p>
                    </>
                  )}
                </div>

                {file && !loading && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 text-muted-foreground"
                    onClick={() => {
                      setFile(null);
                      setResult(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  >
                    Choose a different file
                  </Button>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border p-4 bg-muted/20">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
                      <Globe className="h-5 w-5" />
                    </div>
                    <div className="w-full">
                      <p className="text-sm font-medium mb-2">Paste a public recipe URL</p>
                      <Input
                        type="url"
                        placeholder="https://example.com/recipes/your-recipe"
                        value={urlValue}
                        onChange={(e) => {
                          setUrlValue(e.target.value);
                          setResult(null);
                        }}
                        disabled={loading}
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Public recipe pages work best (sites that include recipe structured data / JSON-LD).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Button
              className="w-full mt-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
              onClick={handleImport}
              disabled={loading || !canSubmit}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  {isUrlMode ? <LinkIcon className="h-4 w-4 mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  {importButtonLabel}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Result */}
        {result && (
          <Card className={result.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}>
            <CardContent className="pt-5 pb-5">
              {result.ok ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                    <p className="font-semibold text-emerald-800">Import complete!</p>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white">
                      {result.imported ?? 0} imported
                    </Badge>

                    {(result.skipped ?? 0) > 0 && (
                      <Badge variant="secondary">{result.skipped} already existed</Badge>
                    )}

                    {(result.errors?.length ?? 0) > 0 && (
                      <Badge variant="destructive">{result.errors!.length} failed</Badge>
                    )}

                    {typeof result.total === "number" && (
                      <Badge variant="outline">{result.total} total processed</Badge>
                    )}
                  </div>

                  {result.errors && result.errors.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-red-700 mb-1">These recipes couldn’t be imported:</p>
                      <p className="text-xs text-red-600 break-words">{result.errors.join(", ")}</p>
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    <Link href="/recipes">
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        View My Recipes
                      </Button>
                    </Link>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setResult(null);
                        if (isFileMode) {
                          setFile(null);
                          if (fileRef.current) fileRef.current.value = "";
                        } else {
                          setUrlValue("");
                        }
                      }}
                    >
                      Import Another
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-800">Import failed</p>
                    <p className="text-sm text-red-600 mt-0.5">{result.error || "Unknown error"}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer note */}
        <p className="text-xs text-muted-foreground text-center mt-6 leading-relaxed">
          Imported recipes are added privately to your account as standalone recipes.
          <br />
          URL import works only for public pages and depends on the source site exposing recipe structured data.
        </p>
      </div>
    </div>
  );
}
