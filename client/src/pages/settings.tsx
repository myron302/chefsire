import React, { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User,
  Lock,
  Tag,
  Trash2,
  Save,
  Upload,
  Eye,
  EyeOff,
  Building2,
  AlertTriangle,
  Check,
  CreditCard,
  CalendarDays,
  RefreshCw,
  XCircle,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";

const FOOD_CATEGORIES = [
  "Italian",
  "Mexican",
  "Chinese",
  "Japanese",
  "Thai",
  "Indian",
  "French",
  "Mediterranean",
  "American",
  "BBQ",
  "Vegan",
  "Vegetarian",
  "Gluten-Free",
  "Keto",
  "Paleo",
  "Desserts",
  "Baking",
  "Seafood",
  "Breakfast",
  "Appetizers",
  "Soups",
  "Salads",
];

function RecipeImportsSection() {
  return (
    <div>
      <h4 className="font-semibold mb-2">Recipe Imports</h4>
      <div className="flex flex-col gap-3 p-4 border rounded-lg bg-white md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-medium">Import recipes from other apps and websites</div>
          <div className="text-sm text-gray-600">
            Bring in recipes from Paprika, AnyList, Plan to Eat, or paste a public recipe URL.
          </div>
        </div>
        <Button asChild className="bg-orange-500 hover:bg-orange-600">
          <Link href="/recipes/import-paprika">
            <Upload size={16} className="mr-2" />
            Open Recipe Import
          </Link>
        </Button>
      </div>
    </div>
  );
}

function AccountPrivacySection({
  isPrivate,
  onToggle,
  onSave,
  isSaving,
}: {
  isPrivate: boolean;
  onToggle: () => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  return (
    <div>
      <h4 className="font-semibold mb-2">Account Privacy</h4>
      <div className="flex items-center justify-between p-4 border rounded-lg bg-white">
        <div>
          <div className="font-medium">Private account</div>
          <div className="text-sm text-gray-600">When enabled, people must request to follow you.</div>
        </div>
        <Button variant={isPrivate ? "default" : "outline"} size="sm" onClick={onToggle}>
          {isPrivate ? (
            <>
              <EyeOff size={16} className="mr-2" />
              Private
            </>
          ) : (
            <>
              <Eye size={16} className="mr-2" />
              Public
            </>
          )}
        </Button>
      </div>
      <div className="mt-3">
        <Button onClick={onSave} disabled={isSaving} className="bg-orange-500 hover:bg-orange-600">
          {isSaving ? "Saving..." : "Save privacy"}
        </Button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user, updateUser } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [profile, setProfile] = useState({
    username: user?.username || "",
    displayName: user?.displayName || "",
    bio: user?.bio || "",
    avatar: user?.avatar || "",
    isPrivate: user?.isPrivate || false,
  });

  const [isSaving, setIsSaving] = useState(false);

  const [accountType, setAccountType] = useState<"personal" | "business">(user?.isChef ? "business" : "personal");

  const [businessInfo, setBusinessInfo] = useState({
    businessName: "",
    businessCategory: "",
  });

  const [password, setPassword] = useState({
    current: "",
    new: "",
    confirm: "",
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [privacy, setPrivacy] = useState({
    profilePublic: true,
    showEmail: false,
    allowMessages: true,
  });

  const [notifications, setNotifications] = useState({
    emailLikes: true,
    emailComments: true,
    emailFollows: true,
    emailMessages: true,
    emailNewsletter: false,
    pushEnabled: true,
  });

  const [interests, setInterests] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const subscriptionTierOrder = ["free", "starter", "professional", "enterprise", "premium_plus"] as const;

  const titleCase = (value?: string | null) => {
    if (!value) return "—";
    return value
      .replace(/_/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const formatDateTime = (value?: string | Date | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString();
  };

  const subscriptionTiersQuery = useQuery({
    queryKey: ["/api/subscriptions/tiers"],
    enabled: !!user,
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch("/api/subscriptions/tiers", {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to load subscription tiers");
      return data as {
        ok: boolean;
        tiers: Record<
          string,
          {
            name: string;
            price: number;
            commission?: number;
            features?: string[];
            limits?: Record<string, unknown>;
          }
        >;
      };
    },
  });

  const mySubscriptionQuery = useQuery({
    queryKey: ["/api/subscriptions/my-tier"],
    enabled: !!user,
    retry: false,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch("/api/subscriptions/my-tier", {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to load your subscription");
      return data as {
        ok: boolean;
        currentTier: string;
        tierInfo?: {
          name?: string;
          price?: number;
          commission?: number;
          features?: string[];
        };
        status?: string;
        endsAt?: string | null;
        monthlyRevenue?: number;
      };
    },
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: async (tier: string) => {
      const res = await fetch("/api/subscriptions/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tier }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update subscription");
      }
      return data as {
        ok: boolean;
        message?: string;
        tier: string;
        endsAt?: string | Date | null;
      };
    },
    onSuccess: (data) => {
      const nextEndsAt = data?.endsAt ? new Date(data.endsAt).toISOString() : user?.subscriptionEndsAt;
      updateUser({
        subscriptionTier: data.tier,
        subscription: data.tier,
        subscriptionStatus: "active",
        subscriptionEndsAt: nextEndsAt || undefined,
        trialEndDate: nextEndsAt || user?.trialEndDate,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/my-tier"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/tiers"] });
      toast({
        title: "Subscription updated",
        description: data?.message || "Your subscription was updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Unable to update subscription",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/subscriptions/cancel", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to cancel subscription");
      }
      return data as {
        ok: boolean;
        message?: string;
        endsAt?: string | Date | null;
      };
    },
    onSuccess: (data) => {
      const endsAt = data?.endsAt ? new Date(data.endsAt).toISOString() : user?.subscriptionEndsAt;
      updateUser({
        subscriptionStatus: "cancelled",
        subscriptionEndsAt: endsAt || undefined,
        trialEndDate: endsAt || user?.trialEndDate,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/my-tier"] });
      toast({
        title: "Subscription cancelled",
        description:
          data?.message || "You'll keep access until the end of your current billing period.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Unable to cancel subscription",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const getPasswordStrength = (value: string): { strength: number; label: string; color: string } => {
    let strength = 0;
    if (value.length >= 8) strength++;
    if (value.length >= 12) strength++;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) strength++;
    if (/\d/.test(value)) strength++;
    if (/[^a-zA-Z0-9]/.test(value)) strength++;

    if (strength <= 1) return { strength: 20, label: "Weak", color: "bg-red-500" };
    if (strength <= 3) return { strength: 50, label: "Fair", color: "bg-yellow-500" };
    if (strength <= 4) return { strength: 75, label: "Good", color: "bg-blue-500" };
    return { strength: 100, label: "Strong", color: "bg-green-500" };
  };

  function FollowRequestsPanel() {
    const { data, isLoading, error } = useQuery({
      queryKey: ["/api/follows/requests/incoming"],
      enabled: !!user,
      queryFn: async () => {
        const res = await fetch("/api/follows/requests/incoming?limit=50", {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to load follow requests");
        return res.json() as Promise<{
          requests: { id: string; createdAt: string; requester: any }[];
        }>;
      },
      retry: false,
    });

    const accept = useMutation({
      mutationFn: async (requestId: string) => {
        const res = await fetch(`/api/follows/requests/${requestId}/accept`, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to accept request");
        return res.json();
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/follows/requests/incoming"] });
        toast({ title: "Accepted", description: "They can now follow you." });
      },
      onError: () =>
        toast({
          title: "Error",
          description: "Could not accept request",
          variant: "destructive",
        }),
    });

    const decline = useMutation({
      mutationFn: async (requestId: string) => {
        const res = await fetch(`/api/follows/requests/${requestId}/decline`, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to decline request");
        return res.json();
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/follows/requests/incoming"] });
        toast({ title: "Declined", description: "Request declined." });
      },
      onError: () =>
        toast({
          title: "Error",
          description: "Could not decline request",
          variant: "destructive",
        }),
    });

    const requests = data?.requests || [];

    return (
      <div>
        <h4 className="font-semibold mb-2">Follow Requests</h4>
        <div className="border rounded-lg p-4 bg-white">
          {isLoading ? (
            <div className="text-sm text-gray-600">Loading…</div>
          ) : error ? (
            <div className="text-sm text-red-600">Could not load requests.</div>
          ) : requests.length === 0 ? (
            <div className="text-sm text-gray-600">No pending requests.</div>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => (
                <div key={r.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={r.requester?.avatar || "/images/placeholder-avatar.svg"}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover border"
                    />
                    <div>
                      <div className="font-medium">
                        {r.requester?.displayName || r.requester?.username || "User"}
                      </div>
                      <div className="text-sm text-gray-600">@{r.requester?.username}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => accept.mutate(r.id)} disabled={accept.isPending}>
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => decline.mutate(r.id)}
                      disabled={decline.isPending}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function SharedSocialControls({
    includeRecipeImports = false,
  }: {
    includeRecipeImports?: boolean;
  }) {
    return (
      <>
        <AccountPrivacySection
          isPrivate={profile.isPrivate}
          onToggle={() => setProfile((prev) => ({ ...prev, isPrivate: !prev.isPrivate }))}
          onSave={handleSaveProfile}
          isSaving={isSaving}
        />
        <FollowRequestsPanel />
        {includeRecipeImports ? <RecipeImportsSection /> : null}
      </>
    );
  }

  function SubscriptionSettingsPanel() {
    const tiersMap = (subscriptionTiersQuery.data?.tiers || {}) as Record<
      string,
      {
        name?: string;
        price?: number;
        commission?: number;
        features?: string[];
      }
    >;

    const currentTier =
      mySubscriptionQuery.data?.currentTier ||
      user?.subscriptionTier ||
      user?.subscription ||
      "free";

    const currentStatus =
      mySubscriptionQuery.data?.status ||
      user?.subscriptionStatus ||
      (currentTier === "free" ? "active" : "active");

    const currentEndsAt =
      mySubscriptionQuery.data?.endsAt ||
      user?.subscriptionEndsAt ||
      user?.trialEndDate ||
      null;

    const currentTierIndex = subscriptionTierOrder.indexOf(currentTier as (typeof subscriptionTierOrder)[number]);
    const tierEntries = Object.entries(tiersMap).sort((a, b) => {
      const aIdx = subscriptionTierOrder.indexOf(a[0] as (typeof subscriptionTierOrder)[number]);
      const bIdx = subscriptionTierOrder.indexOf(b[0] as (typeof subscriptionTierOrder)[number]);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });

    const isBusy =
      updateSubscriptionMutation.isPending ||
      cancelSubscriptionMutation.isPending ||
      subscriptionTiersQuery.isLoading ||
      mySubscriptionQuery.isLoading;

    const onSelectTier = (tierKey: string) => {
      if (tierKey === "free") {
        if (currentTier === "free") return;
        cancelSubscriptionMutation.mutate();
        return;
      }
      if (tierKey === currentTier) return;
      updateSubscriptionMutation.mutate(tierKey);
    };

    const renderActionLabel = (tierKey: string) => {
      if (tierKey === currentTier) return "Current Plan";
      if (tierKey === "free") return currentTier === "free" ? "Current Plan" : "Cancel / Free";
      const targetIdx = subscriptionTierOrder.indexOf(tierKey as (typeof subscriptionTierOrder)[number]);
      if (currentTierIndex !== -1 && targetIdx !== -1 && targetIdx < currentTierIndex) return "Downgrade";
      return "Upgrade";
    };

    const subscriptionRows = [
      {
        id: "marketplace",
        name: "Marketplace Seller Subscription",
        tier: titleCase(currentTier),
        status: titleCase(currentStatus),
        endsAt: currentEndsAt,
        canManage: true,
        note:
          currentTier === "free"
            ? "You are on the free tier."
            : currentStatus === "cancelled"
            ? "Scheduled to end at the end of your billing period."
            : "Active paid subscription for store / seller tools.",
      },
      ...(user?.nutritionPremium || user?.nutritionTrialEndsAt
        ? [
            {
              id: "nutrition",
              name: "Nutrition Premium",
              tier: user?.nutritionPremium ? "Premium" : "Trial",
              status: user?.nutritionPremium ? "Active" : "Trial",
              endsAt: user?.nutritionTrialEndsAt || null,
              canManage: false,
              note: "Shown for visibility only in Settings.",
            },
          ]
        : []),
    ];

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Subscription Overview</CardTitle>
            <CardDescription>
              See what you&apos;re subscribed to and manage downgrades or cancellations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mySubscriptionQuery.error ? (
              <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
                {(mySubscriptionQuery.error as any)?.message || "Could not load your subscription right now."}
              </div>
            ) : null}

            <div className="grid gap-3">
              {subscriptionRows.map((sub) => (
                <div key={sub.id} className="rounded-lg border bg-white p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CreditCard size={16} className="text-orange-500" />
                        <div className="font-semibold">{sub.name}</div>
                        {!sub.canManage ? (
                          <Badge variant="outline" className="text-xs">
                            Read only
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-1 text-sm text-gray-700">
                        <span className="font-medium">{sub.tier}</span> · {sub.status}
                      </div>
                      {sub.endsAt ? (
                        <div className="mt-1 text-xs text-gray-600 flex items-center gap-1">
                          <CalendarDays size={13} />
                          {sub.status.toLowerCase() === "cancelled" ? "Ends" : "Renews"}:{" "}
                          {formatDateTime(sub.endsAt) || "—"}
                        </div>
                      ) : null}
                      <p className="mt-2 text-xs text-gray-600">{sub.note}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  subscriptionTiersQuery.refetch();
                  mySubscriptionQuery.refetch();
                }}
                disabled={isBusy}
              >
                <RefreshCw size={16} className="mr-2" />
                Refresh
              </Button>
              {currentTier !== "free" ? (
                <Button
                  variant="destructive"
                  onClick={() => cancelSubscriptionMutation.mutate()}
                  disabled={isBusy}
                >
                  <XCircle size={16} className="mr-2" />
                  Cancel Subscription
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change Plan</CardTitle>
            <CardDescription>
              Upgrade or downgrade your seller subscription. Downgrading to Free uses cancel and keeps access until
              period end.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {subscriptionTiersQuery.isLoading ? (
              <div className="text-sm text-gray-600">Loading plans…</div>
            ) : subscriptionTiersQuery.error ? (
              <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
                {(subscriptionTiersQuery.error as any)?.message || "Could not load plans."}
              </div>
            ) : tierEntries.length === 0 ? (
              <div className="text-sm text-gray-600">No subscription plans available right now.</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {tierEntries.map(([tierKey, tier]) => {
                  const isCurrent = tierKey === currentTier;
                  const price =
                    typeof tier?.price === "number" ? `$${tier.price}/mo` : tier?.price ? `$${tier.price}/mo` : "—";
                  const commission =
                    typeof tier?.commission === "number" ? `${tier.commission}% commission` : undefined;

                  return (
                    <Card
                      key={tierKey}
                      className={`border ${isCurrent ? "ring-2 ring-orange-500 border-orange-300" : ""}`}
                    >
                      <CardContent className="pt-6 space-y-4">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-semibold text-lg">{tier?.name || titleCase(tierKey)}</h4>
                            {isCurrent ? (
                              <Badge className="bg-orange-500 hover:bg-orange-600">Current</Badge>
                            ) : null}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{price}</p>
                          {commission ? <p className="text-xs text-gray-500 mt-1">{commission}</p> : null}
                        </div>

                        {Array.isArray(tier?.features) && tier.features.length > 0 ? (
                          <ul className="space-y-2 text-sm">
                            {tier.features.slice(0, 5).map((feature) => (
                              <li key={feature} className="flex items-start gap-2">
                                <Check size={14} className="mt-0.5 text-green-600 flex-shrink-0" />
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-500">No plan details available.</p>
                        )}

                        <Button
                          className={isCurrent ? "" : "bg-orange-500 hover:bg-orange-600"}
                          variant={isCurrent ? "outline" : "default"}
                          disabled={isBusy || isCurrent}
                          onClick={() => onSelectTier(tierKey)}
                        >
                          {renderActionLabel(tierKey)}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const passwordStrength = getPasswordStrength(password.new);

  const toggleInterest = (category: string) => {
    setInterests((prev) => (prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]));
  };

  const handleSaveProfile = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to update your profile",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: profile.username,
          displayName: profile.displayName,
          bio: profile.bio,
          avatar: profile.avatar,
          isPrivate: profile.isPrivate,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data?.error || data?.message || "Failed to update profile";
        throw new Error(errorMsg);
      }

      updateUser({
        username: data.user.username,
        displayName: data.user.displayName,
        bio: data.user.bio,
        avatar: data.user.avatar,
      });

      toast({
        title: "✓ Profile updated",
        description: "Your profile has been saved successfully",
      });
    } catch (error: any) {
      console.error("Profile update error:", error);
      toast({
        title: "Failed to update profile",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!password.current || !password.new || !password.confirm) {
      toast({
        title: "Missing fields",
        description: "Please fill in all password fields",
        variant: "destructive",
      });
      return;
    }

    if (password.new !== password.confirm) {
      toast({
        title: "Passwords don't match",
        description: "New password and confirmation password must match",
        variant: "destructive",
      });
      return;
    }

    if (password.new.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword: password.current,
          newPassword: password.new,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to change password");
      }

      setPassword({ current: "", new: "", confirm: "" });

      toast({
        title: "✓ Password changed",
        description: "Your password has been updated successfully",
      });
    } catch (error: any) {
      console.error("Password change error:", error);
      toast({
        title: "Failed to change password",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to delete your account",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete account");
      }

      toast({
        title: "✓ Account deleted",
        description: "Your account has been permanently deleted",
      });

      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch (error: any) {
      console.error("Account deletion error:", error);
      toast({
        title: "Failed to delete account",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your account settings and preferences</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-7 h-auto">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="interests">Interests</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription>Update your profile information and avatar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <SharedSocialControls includeRecipeImports />

                {/* Avatar */}
                <div>
                  <Label>Profile Picture</Label>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                      {profile.avatar ? (
                        <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User size={32} className="text-gray-400" />
                      )}
                    </div>
                    <div className="space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById("avatar-upload")?.click()}
                      >
                        <Upload size={16} className="mr-2" />
                        Upload Photo
                      </Button>
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setProfile({ ...profile, avatar: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Username */}
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={profile.username}
                    onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                  />
                </div>

                {/* Display Name */}
                <div>
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={profile.displayName}
                    onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                  />
                </div>

                {/* Bio */}
                <div>
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    rows={4}
                    placeholder="Tell us about yourself..."
                  />
                  <p className="text-xs text-gray-500 mt-1">{profile.bio.length}/500 characters</p>
                </div>

                <Button onClick={handleSaveProfile} className="bg-orange-500 hover:bg-orange-600" disabled={isSaving}>
                  <Save size={16} className="mr-2" />
                  {isSaving ? "Saving..." : "Save Profile"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account">
            <Card>
              <CardHeader>
                <CardTitle>Account Type</CardTitle>
                <CardDescription>Switch between personal and business account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <SharedSocialControls includeRecipeImports />

                {/* Account Type Switcher */}
                <div className="grid grid-cols-2 gap-4">
                  <Card
                    className={`cursor-pointer transition-all ${
                      accountType === "personal" ? "ring-2 ring-orange-500" : ""
                    }`}
                    onClick={() => setAccountType("personal")}
                  >
                    <CardContent className="pt-6">
                      <User className="mb-3 text-blue-500" size={24} />
                      <h3 className="font-semibold mb-2">Personal</h3>
                      <p className="text-sm text-gray-600">For individual food enthusiasts and home cooks</p>
                    </CardContent>
                  </Card>

                  <Card
                    className={`cursor-pointer transition-all ${
                      accountType === "business" ? "ring-2 ring-orange-500" : ""
                    }`}
                    onClick={() => setAccountType("business")}
                  >
                    <CardContent className="pt-6">
                      <Building2 className="mb-3 text-orange-500" size={24} />
                      <h3 className="font-semibold mb-2">Business</h3>
                      <p className="text-sm text-gray-600">For chefs, caterers, and food businesses</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Business Info (conditional) */}
                {accountType === "business" && (
                  <div className="space-y-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <h4 className="font-semibold">Business Information</h4>
                    <div>
                      <Label htmlFor="businessName">Business Name</Label>
                      <Input
                        id="businessName"
                        value={businessInfo.businessName}
                        onChange={(e) => setBusinessInfo({ ...businessInfo, businessName: e.target.value })}
                        placeholder="Your Business Name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="businessCategory">Category</Label>
                      <Input
                        id="businessCategory"
                        value={businessInfo.businessCategory}
                        onChange={(e) => setBusinessInfo({ ...businessInfo, businessCategory: e.target.value })}
                        placeholder="e.g., Catering, Restaurant, Bakery"
                      />
                    </div>
                  </div>
                )}

                {/* Business Benefits */}
                {accountType === "business" && (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-6">
                      <h4 className="font-semibold mb-3">Business Account Benefits:</h4>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-start gap-2">
                          <Check size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                          <span>Create and manage your online store</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                          <span>Offer catering services to customers</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                          <span>Access business analytics and insights</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                          <span>Verified business badge</span>
                        </li>
                      </ul>
                    </CardContent>
                  </Card>
                )}

                <Button className="bg-orange-500 hover:bg-orange-600">
                  <Save size={16} className="mr-2" />
                  Save Account Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value="subscription">
            <SubscriptionSettingsPanel />
          </TabsContent>

          {/* Password Tab */}
          <TabsContent value="password">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your password to keep your account secure</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <SharedSocialControls />

                {/* Current Password */}
                <div>
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showPasswords.current ? "text" : "password"}
                      value={password.current}
                      onChange={(e) => setPassword({ ...password, current: e.target.value })}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      onClick={() =>
                        setShowPasswords({
                          ...showPasswords,
                          current: !showPasswords.current,
                        })
                      }
                    >
                      {showPasswords.current ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPasswords.new ? "text" : "password"}
                      value={password.new}
                      onChange={(e) => setPassword({ ...password, new: e.target.value })}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      onClick={() =>
                        setShowPasswords({
                          ...showPasswords,
                          new: !showPasswords.new,
                        })
                      }
                    >
                      {showPasswords.new ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Password Strength Meter */}
                  {password.new && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>Password Strength:</span>
                        <span className="font-semibold">{passwordStrength.label}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${passwordStrength.color}`}
                          style={{ width: `${passwordStrength.strength}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showPasswords.confirm ? "text" : "password"}
                      value={password.confirm}
                      onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      onClick={() =>
                        setShowPasswords({
                          ...showPasswords,
                          confirm: !showPasswords.confirm,
                        })
                      }
                    >
                      {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {password.confirm && password.new !== password.confirm && (
                    <p className="text-red-500 text-sm mt-1">Passwords do not match</p>
                  )}
                </div>

                <Button onClick={handleChangePassword} className="bg-orange-500 hover:bg-orange-600">
                  <Lock size={16} className="mr-2" />
                  Change Password
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Privacy Tab */}
          <TabsContent value="privacy">
            <Card>
              <CardHeader>
                <CardTitle>Privacy Settings</CardTitle>
                <CardDescription>Control who can see your information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <SharedSocialControls />

                {[
                  {
                    key: "profilePublic",
                    label: "Public Profile",
                    description: "Allow anyone to view your profile and posts",
                  },
                  {
                    key: "showEmail",
                    label: "Show Email",
                    description: "Display your email address on your profile",
                  },
                  {
                    key: "allowMessages",
                    label: "Allow Messages",
                    description: "Let other users send you direct messages",
                  },
                ].map((setting) => (
                  <div key={setting.key} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">{setting.label}</div>
                      <div className="text-sm text-gray-600">{setting.description}</div>
                    </div>
                    <Button
                      variant={privacy[setting.key as keyof typeof privacy] ? "default" : "outline"}
                      onClick={() =>
                        setPrivacy({
                          ...privacy,
                          [setting.key]: !privacy[setting.key as keyof typeof privacy],
                        })
                      }
                    >
                      {privacy[setting.key as keyof typeof privacy] ? "Enabled" : "Disabled"}
                    </Button>
                  </div>
                ))}

                <Button className="bg-orange-500 hover:bg-orange-600">
                  <Save size={16} className="mr-2" />
                  Save Privacy Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose what notifications you want to receive</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <SharedSocialControls />

                <div>
                  <h4 className="font-semibold mb-4">Email Notifications</h4>
                  <div className="space-y-4">
                    {[
                      { key: "emailLikes", label: "Likes on your posts" },
                      { key: "emailComments", label: "Comments on your posts" },
                      { key: "emailFollows", label: "New followers" },
                      { key: "emailMessages", label: "Direct messages" },
                      { key: "emailNewsletter", label: "Newsletter and updates" },
                    ].map((setting) => (
                      <div key={setting.key} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>{setting.label}</div>
                        <Button
                          variant={notifications[setting.key as keyof typeof notifications] ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            setNotifications({
                              ...notifications,
                              [setting.key]: !notifications[setting.key as keyof typeof notifications],
                            })
                          }
                        >
                          {notifications[setting.key as keyof typeof notifications] ? "On" : "Off"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-4">Push Notifications</h4>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>Enable push notifications</div>
                    <Button
                      variant={notifications.pushEnabled ? "default" : "outline"}
                      size="sm"
                      onClick={() =>
                        setNotifications({
                          ...notifications,
                          pushEnabled: !notifications.pushEnabled,
                        })
                      }
                    >
                      {notifications.pushEnabled ? "Enabled" : "Disabled"}
                    </Button>
                  </div>
                </div>

                <Button className="bg-orange-500 hover:bg-orange-600">
                  <Save size={16} className="mr-2" />
                  Save Notification Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Interests Tab */}
          <TabsContent value="interests">
            <Card>
              <CardHeader>
                <CardTitle>Food Interests</CardTitle>
                <CardDescription>
                  Select your favorite food categories to personalize your experience
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <SharedSocialControls />

                <div className="flex flex-wrap gap-2">
                  {FOOD_CATEGORIES.map((category) => (
                    <Badge
                      key={category}
                      variant={interests.includes(category) ? "default" : "outline"}
                      className={`cursor-pointer px-4 py-2 ${
                        interests.includes(category)
                          ? "bg-orange-500 hover:bg-orange-600"
                          : "hover:bg-gray-100"
                      }`}
                      onClick={() => toggleInterest(category)}
                    >
                      <Tag size={14} className="mr-1" />
                      {category}
                    </Badge>
                  ))}
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm">
                    <strong>Selected:</strong> {interests.length} categories
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    We&apos;ll use your interests to recommend relevant content and recipes
                  </p>
                </div>

                <Button className="bg-orange-500 hover:bg-orange-600">
                  <Save size={16} className="mr-2" />
                  Save Interests
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Danger Zone */}
        <Card className="border-red-200 mt-8">
          <CardHeader>
            <CardTitle className="text-red-600">Danger Zone</CardTitle>
            <CardDescription>Irreversible and destructive actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
              <div>
                <div className="font-semibold text-red-600">Delete Account</div>
                <div className="text-sm text-gray-600">Permanently delete your account and all associated data</div>
              </div>
              <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 size={16} className="mr-2" />
                Delete Account
              </Button>
            </div>

            {showDeleteConfirm && (
              <div className="mt-4 p-4 border-2 border-red-500 rounded-lg bg-red-50">
                <div className="flex items-start gap-3 mb-4">
                  <AlertTriangle className="text-red-600 flex-shrink-0" size={24} />
                  <div>
                    <p className="font-semibold text-red-600 mb-2">Are you absolutely sure?</p>
                    <p className="text-sm text-gray-700">
                      This action cannot be undone. This will permanently delete your account, remove your profile, and
                      delete all your posts and data.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="destructive" onClick={handleDeleteAccount}>
                    Yes, Delete My Account
                  </Button>
                  <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
