import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Gift, Link as LinkIcon } from "lucide-react";

type RegistryLink = {
  id: number;
  name: string;
  url: string;
  icon: string;
};

type PublicRegistryResponse = {
  ok: boolean;
  username?: string;
  registryLinks?: RegistryLink[];
  error?: string;
};

const normalizeExternalUrl = (value: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

export default function PublicRegistryPage() {
  const [, params] = useRoute<{ slug: string }>("/registry/:slug");
  const slug = params?.slug || "";

  const { data, isLoading, isError, error } = useQuery<PublicRegistryResponse>({
    queryKey: ["public-registry", slug],
    enabled: !!slug,
    queryFn: async () => {
      const response = await fetch(`/api/wedding/public-registry/${encodeURIComponent(slug)}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || "Failed to load registry");
      }
      return body;
    },
  });

  const links = useMemo(
    () =>
      Array.isArray(data?.registryLinks)
        ? data.registryLinks
            .map((l) => ({ ...l, url: normalizeExternalUrl(l.url) }))
            .filter((l) => !!l.url)
        : [],
    [data?.registryLinks]
  );

  const title = data?.username ? `${data.username}'s Wedding Registry` : "Wedding Registry";

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white py-10 px-4">
      <div className="mx-auto w-full max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Gift className="h-6 w-6 text-rose-500" />
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading registry...</p>
            ) : isError ? (
              <p className="text-sm text-red-600">{(error as Error)?.message || "Registry not found."}</p>
            ) : links.length === 0 ? (
              <p className="text-sm text-muted-foreground">No registry links are available yet.</p>
            ) : (
              <div className="space-y-3">
                {links.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between rounded-md border border-rose-100 bg-rose-50/40 p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 flex items-center gap-2">
                        <span>{link.icon || "🎁"}</span>
                        <span>{link.name || "Registry"}</span>
                      </p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-1">
                        <LinkIcon className="h-3 w-3" />
                        {link.url}
                      </p>
                    </div>
                    <Button asChild size="sm" className="ml-3">
                      <a href={link.url} target="_blank" rel="noopener noreferrer">
                        Open <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
