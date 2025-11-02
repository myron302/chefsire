import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Users, ArrowLeft, Plus, Copy, LogOut, Crown, Shield, User, Check, AlertCircle, Home } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type HouseholdInfo = {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  userRole: "owner" | "admin" | "member";
  members: {
    id: string;
    username: string;
    displayName: string | null;
    role: "owner" | "admin" | "member";
    joinedAt: string;
  }[];
  itemCount: number;
};

export default function HouseholdPantry() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "" });
  const [joinForm, setJoinForm] = useState({ inviteCode: "" });

  // Fetch household info
  const { data: householdData, isLoading } = useQuery({
    queryKey: ["/api/pantry/household"],
  });

  const household: HouseholdInfo | null = householdData?.household || null;

  // Create household mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await fetch("/api/pantry/household", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create household");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pantry/household"] });
      toast({ title: "✓ Household created", description: "Your family pantry is ready!" });
      setShowCreateDialog(false);
      setCreateForm({ name: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create household", description: error.message, variant: "destructive" });
    },
  });

  // Join household mutation
  const joinMutation = useMutation({
    mutationFn: async (data: { inviteCode: string }) => {
      const res = await fetch("/api/pantry/household/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to join household");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pantry/household"] });
      toast({ title: "✓ Joined household", description: "You can now access the shared pantry!" });
      setShowJoinDialog(false);
      setJoinForm({ inviteCode: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to join household", description: error.message, variant: "destructive" });
    },
  });

  // Leave household mutation
  const leaveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/pantry/household/leave", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to leave household");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pantry/household"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pantry/items"] });
      toast({ title: "Left household", description: "You can create or join another household anytime." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to leave household", description: error.message, variant: "destructive" });
    },
  });

  // Copy invite code
  const copyInviteCode = () => {
    if (household?.inviteCode) {
      navigator.clipboard.writeText(household.inviteCode);
      toast({ title: "✓ Copied", description: "Invite code copied to clipboard" });
    }
  };

  // Get role icon and color
  const getRoleIcon = (role: string) => {
    if (role === "owner") return <Crown className="w-4 h-4 text-yellow-600" />;
    if (role === "admin") return <Shield className="w-4 h-4 text-blue-600" />;
    return <User className="w-4 h-4 text-gray-600" />;
  };

  const getRoleBadge = (role: string) => {
    if (role === "owner") return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Owner</Badge>;
    if (role === "admin") return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Admin</Badge>;
    return <Badge variant="outline">Member</Badge>;
  };

  // Handle leave confirmation
  const handleLeave = () => {
    if (household?.userRole === "owner") {
      toast({
        title: "Cannot leave as owner",
        description: "Transfer ownership or delete the household first.",
        variant: "destructive",
      });
      return;
    }

    if (confirm("Are you sure you want to leave this household? You'll lose access to shared pantry items.")) {
      leaveMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Users className="w-12 h-12 mx-auto mb-4 text-gray-400 animate-pulse" />
          <p className="text-gray-500">Loading household...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/pantry">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Pantry
          </Button>
        </Link>

        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <Users className="w-10 h-10 text-primary" />
              Household Pantry
            </h1>
            <p className="text-muted-foreground mt-2">
              Share your pantry with family members
            </p>
          </div>
        </div>
      </div>

      {/* No Household - Create or Join */}
      {!household ? (
        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <Home className="w-6 h-6 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-lg mb-2">What is Household Pantry?</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Share a pantry with your family, roommates, or anyone you live with.
                    Everyone can add, edit, and track shared ingredients together.
                  </p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      Track shared ingredients in real-time
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      Everyone sees expiry dates and running low alerts
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      Coordinate grocery shopping and meal planning
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Create Household */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Create Household
                </CardTitle>
                <CardDescription>
                  Start a new shared pantry for your family
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                  <DialogTrigger asChild>
                    <Button className="w-full">
                      <Plus className="w-4 h-4 mr-2" />
                      Create New Household
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Household</DialogTitle>
                      <DialogDescription>
                        Give your household a name. You'll get an invite code to share with others.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="householdName">Household Name *</Label>
                        <Input
                          id="householdName"
                          placeholder="e.g., Smith Family, Apt 4B"
                          value={createForm.name}
                          onChange={(e) => setCreateForm({ name: e.target.value })}
                        />
                      </div>
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          onClick={() => setShowCreateDialog(false)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => createMutation.mutate(createForm)}
                          disabled={!createForm.name.trim() || createMutation.isPending}
                          className="flex-1"
                        >
                          {createMutation.isPending ? "Creating..." : "Create"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            {/* Join Household */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Join Household
                </CardTitle>
                <CardDescription>
                  Enter an invite code from a family member
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <Users className="w-4 h-4 mr-2" />
                      Join Existing Household
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Join Household</DialogTitle>
                      <DialogDescription>
                        Enter the 8-character invite code shared by your household owner.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="inviteCode">Invite Code *</Label>
                        <Input
                          id="inviteCode"
                          placeholder="e.g., ABC12345"
                          value={joinForm.inviteCode}
                          onChange={(e) => setJoinForm({ inviteCode: e.target.value.toUpperCase() })}
                          maxLength={8}
                        />
                      </div>
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          onClick={() => setShowJoinDialog(false)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => joinMutation.mutate(joinForm)}
                          disabled={joinForm.inviteCode.length !== 8 || joinMutation.isPending}
                          className="flex-1"
                        >
                          {joinMutation.isPending ? "Joining..." : "Join"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* Household Exists - Show Details */
        <div className="space-y-6">
          {/* Household Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Home className="w-6 h-6 text-primary" />
                    {household.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {household.members.length} {household.members.length === 1 ? "member" : "members"} •{" "}
                    {household.itemCount} shared {household.itemCount === 1 ? "item" : "items"}
                  </CardDescription>
                </div>
                {getRoleBadge(household.userRole)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Invite Code */}
                <div>
                  <Label className="text-sm font-medium">Invite Code</Label>
                  <div className="flex gap-2 mt-2">
                    <div className="flex-1 relative">
                      <Input
                        value={household.inviteCode}
                        readOnly
                        className="pr-12 font-mono text-lg text-center tracking-wider"
                      />
                    </div>
                    <Button onClick={copyInviteCode} variant="outline">
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Share this code with family members to invite them to your household
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Link href="/pantry" className="flex-1">
                    <Button variant="outline" className="w-full">
                      View Shared Pantry
                    </Button>
                  </Link>
                  {household.userRole !== "owner" && (
                    <Button
                      variant="outline"
                      onClick={handleLeave}
                      disabled={leaveMutation.isPending}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      {leaveMutation.isPending ? "Leaving..." : "Leave"}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Members List */}
          <Card>
            <CardHeader>
              <CardTitle>Household Members</CardTitle>
              <CardDescription>
                People who have access to this shared pantry
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {household.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {getRoleIcon(member.role)}
                      <div>
                        <p className="font-medium">{member.displayName || member.username}</p>
                        <p className="text-xs text-muted-foreground">
                          @{member.username} • Joined {new Date(member.joinedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {getRoleBadge(member.role)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tips Card */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 mb-1">Household Tips</p>
                  <ul className="space-y-1 text-blue-800">
                    <li>• Items marked as "Household Item" are shared with all members</li>
                    <li>• Personal items remain private to your account</li>
                    <li>• All members can add, edit, and remove shared items</li>
                    <li>• Expiry reminders are sent to all household members</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
