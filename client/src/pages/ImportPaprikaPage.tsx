// client/src/pages/ImportPaprikaPage.tsx
import { useState, useRef } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, CheckCircle2, AlertCircle, FileArchive,
  ChefHat, ArrowLeft, ExternalLink, Loader2
} from "lucide-react";

type ImportResult = {
  ok: boolean;
  imported?: number;
  skipped?: number;
  total?: number;
  errors?: string[];
  error?: string;
};

export default function ImportPaprikaPage() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(f: File | null) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".paprikarecipes")) {
      toast({ variant: "destructive", description: "Please select a .paprikarecipes file." });
      return;
    }
    setFile(f);
    setResult(null);
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("recipesFile", file);

      const res = await fetch("/api/recipes/import-paprika", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data: ImportResult = await res.json();
      setResult(data);

      if (data.ok) {
        toast({ description: `Successfully imported ${data.imported} recipe${data.imported !== 1 ? "s" : ""}!` });
      } else {
        toast({ variant: "destructive", description: data.error || "Import failed" });
      }
    } catch (err) {
      const errResult = { ok: false, error: "Network error — please try again." };
      setResult(errResult);
      toast({ variant: "destructive", description: errResult.error });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Back nav */}
        <Link href="/recipes">
          <Button variant="ghost" size="sm" className="mb-6 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Recipes
          </Button>
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-sm">
            <ChefHat className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Import from Paprika</h1>
            <p className="text-sm text-muted-foreground">Bring your saved recipes into ChefSire in seconds.</p>
          </div>
        </div>

        {/* How-to steps */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">How to export from Paprika</CardTitle>
            <CardDescription>Takes about 30 seconds on any device.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { step: "1", title: "Open Paprika", detail: "Open the Paprika app on your phone or computer." },
                {
                  step: "2", title: "Export your recipes",
                  detail: "iOS/Android: tap ☰ → Settings → Export Recipes. Mac: File → Export. Choose Paprika Recipe Format."
                },
                { step: "3", title: "Save the file", detail: "You'll get a .paprikarecipes file. Save it somewhere you can find it." },
                { step: "4", title: "Upload here", detail: "Drop the file below and click Import. We'll handle the rest." },
              ].map((s) => (
                <div key={s.step} className="flex items-start gap-3">
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

            <a
              href="https://www.paprikaapp.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-4 text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
              paprikaapp.com
            </a>
          </CardContent>
        </Card>

        {/* Drop zone */}
        <Card className="mb-4">
          <CardContent className="pt-6">
            <div
              className={[
                "relative rounded-xl border-2 border-dashed transition-colors cursor-pointer p-8 text-center",
                dragging ? "border-orange-400 bg-orange-50" : "border-muted-foreground/25 hover:border-orange-300 hover:bg-orange-50/40",
              ].join(" ")}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFile(e.dataTransfer.files[0] ?? null);
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".paprikarecipes"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />

              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileArchive className="h-8 w-8 text-orange-500 flex-shrink-0" />
                  <div className="text-left">
                    <p className="font-semibold text-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB — ready to import
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="font-semibold text-sm mb-1">
                    Drop your .paprikarecipes file here
                  </p>
                  <p className="text-xs text-muted-foreground">or click to browse</p>
                </>
              )}
            </div>

            {file && (
              <Button
                className="w-full mt-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                onClick={handleImport}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import Recipes
                  </>
                )}
              </Button>
            )}

            {file && !loading && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-muted-foreground"
                onClick={() => { setFile(null); setResult(null); if (fileRef.current) fileRef.current.value = ""; }}
              >
                Choose a different file
              </Button>
            )}
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
                  <div className="flex gap-3 flex-wrap">
                    <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white">
                      {result.imported} imported
                    </Badge>
                    {(result.skipped ?? 0) > 0 && (
                      <Badge variant="secondary">{result.skipped} already existed</Badge>
                    )}
                    {(result.errors?.length ?? 0) > 0 && (
                      <Badge variant="destructive">{result.errors!.length} failed</Badge>
                    )}
                  </div>
                  {result.errors && result.errors.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-red-700 mb-1">These recipes couldn't be imported:</p>
                      <p className="text-xs text-red-600">{result.errors.join(", ")}</p>
                    </div>
                  )}
                  <Link href="/recipes">
                    <Button size="sm" className="mt-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                      View My Recipes
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-800">Import failed</p>
                    <p className="text-sm text-red-600 mt-0.5">{result.error}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer note */}
        <p className="text-xs text-muted-foreground text-center mt-6 leading-relaxed">
          Your recipes are imported privately to your account. Photos from Paprika are preserved where possible.
          <br />This importer is not affiliated with Hindsight Labs (Paprika's developer).
        </p>
      </div>
    </div>
  );
}
