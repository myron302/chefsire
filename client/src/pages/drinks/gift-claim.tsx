import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";

import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { useUser } from "@/contexts/UserContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type GiftPayload = {
  ok: boolean;
  gift: {
    id: string;
    giftCode: string;
    status: "pending" | "completed" | "revoked";
    targetType: "collection" | "bundle";
    targetId: string;
    targetName: string;
    targetRoute: string;
    claimUrl: string;
    recipientUserId: string | null;
    claimedAt: string | null;
    completedAt: string | null;
    revokedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  viewer: {
    signedIn: boolean;
    userId: string | null;
    canClaim: boolean;
    alreadyClaimedByViewer: boolean;
    ownsTarget: boolean;
  };
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function DrinkGiftClaimPage() {
  const [matched, params] = useRoute<{ token: string }>("/drinks/gifts/:token");
  const token = matched ? String(params.token ?? "") : "";
  const { user } = useUser();
  const queryClient = useQueryClient();

  const giftQuery = useQuery<GiftPayload>({
    queryKey: ["/api/drinks/gifts", token, user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/gifts/${encodeURIComponent(token)}`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Failed to load gift (${response.status})`);
      return payload as GiftPayload;
    },
    enabled: Boolean(token),
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/drinks/gifts/${encodeURIComponent(token)}/claim`, {
        method: "POST",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Failed to claim gift (${response.status})`);
      return payload;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/gifts", token, user?.id ?? ""] }),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/gifts"] }),
      ]);
    },
  });

  if (!matched) return null;

  const gift = giftQuery.data?.gift;
  const viewer = giftQuery.data?.viewer;

  return (
    <div className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
      <DrinksPlatformNav current="gifts" />

      <Card>
        <CardHeader>
          <CardTitle>Claim Premium Gift</CardTitle>
          <CardDescription>Gift claims grant access through the same ownership model used for paid premium collections and bundles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {giftQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading gift details…</p> : null}
          {giftQuery.isError ? <p className="text-sm text-destructive">{giftQuery.error instanceof Error ? giftQuery.error.message : "Unable to load this gift."}</p> : null}

          {gift ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{gift.targetType === "bundle" ? "Premium Bundle Gift" : "Premium Collection Gift"}</Badge>
                <Badge variant={gift.status === "completed" ? "default" : gift.status === "revoked" ? "outline" : "secondary"}>
                  {gift.status === "completed" ? "Claimed" : gift.status === "revoked" ? "Revoked" : "Pending claim"}
                </Badge>
              </div>
              <div>
                <p className="text-2xl font-semibold">{gift.targetName}</p>
                <p className="text-sm text-muted-foreground">Purchased {formatDateTime(gift.createdAt)} · Last updated {formatDateTime(gift.updatedAt)}</p>
              </div>

              {!viewer?.signedIn ? (
                <div className="flex flex-wrap gap-2">
                  <Link href="/auth/login"><Button>Sign in to claim</Button></Link>
                  <Link href={gift.targetRoute}><Button variant="outline">View premium detail</Button></Link>
                </div>
              ) : null}

              {viewer?.signedIn ? (
                <div className="space-y-3 rounded-md border p-4">
                  {viewer.alreadyClaimedByViewer || viewer.ownsTarget ? (
                    <p className="text-sm text-emerald-600">This gift is already tied to your account. You can open the premium content now.</p>
                  ) : viewer.canClaim ? (
                    <p className="text-sm text-muted-foreground">Claiming this gift grants access directly to your account and does not grant ownership to the purchaser.</p>
                  ) : (
                    <p className="text-sm text-destructive">This gift can no longer be claimed by this account.</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {viewer.canClaim ? (
                      <Button onClick={() => claimMutation.mutate()} disabled={claimMutation.isPending}>
                        {claimMutation.isPending ? "Claiming…" : "Claim gift"}
                      </Button>
                    ) : null}
                    <Link href={gift.targetRoute}><Button variant="outline">Open premium detail</Button></Link>
                    <Link href="/drinks/gifts"><Button variant="ghost">Back to gifts</Button></Link>
                  </div>
                  {claimMutation.isError ? <p className="text-sm text-destructive">{claimMutation.error instanceof Error ? claimMutation.error.message : "Failed to claim gift."}</p> : null}
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
