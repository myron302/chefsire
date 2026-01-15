import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Heart, Plus, AlertTriangle, Shield, User, Crown, Edit, Trash2,
  Calendar, Stethoscope, FileText, ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type FamilyMember = {
  id: string;
  name: string;
  relationship: string | null;
  dateOfBirth: string | null;
  species: string;
  allergenCount: number;
  severeCases: number;
  createdAt: string;
};

type AllergenProfile = {
  id: string;
  familyMemberId: string;
  allergen: string;
  severity: "mild" | "moderate" | "severe" | "life-threatening";
  diagnosedBy: string | null;
  diagnosedDate: string | null;
  notes: string | null;
};

export default function AllergiesDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [showAllergenDialog, setShowAllergenDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [selectedHouseholdMemberId, setSelectedHouseholdMemberId] = useState("");

  const [memberForm, setMemberForm] = useState({
    name: "",
    relationship: "",
    dateOfBirth: "",
    species: "human",
    notes: "",
  });

  const [allergenForm, setAllergenForm] = useState({
    allergen: "",
    severity: "moderate" as const,
    diagnosedBy: "",
    diagnosedDate: "",
    notes: "",
  });

  // Fetch household info and members
  const { data: householdData } = useQuery({
    queryKey: ["/api/pantry/household"],
    queryFn: async () => {
      const res = await fetch("/api/pantry/household", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch household");
      return res.json();
    },
  });

  const householdMembers = householdData?.members || [];

  // Fetch family members (for allergies)
  const { data: membersData, isLoading } = useQuery({
    queryKey: ["/api/allergies/family-members"],
    queryFn: async () => {
      const res = await fetch("/api/allergies/family-members", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch family members");
      return res.json();
    },
  });

  const members: FamilyMember[] = membersData?.members || [];

  // Fetch allergen profiles for selected member
  const { data: profilesData } = useQuery({
    queryKey: ["/api/allergies/profiles", selectedMember?.id],
    queryFn: async () => {
      const res = await fetch(`/api/allergies/profiles/${selectedMember?.id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch allergen profiles");
      return res.json();
    },
    enabled: !!selectedMember,
  });

  const profiles: AllergenProfile[] = profilesData?.profiles || [];

  // Add family member mutation
  const addMemberMutation = useMutation({
    mutationFn: async (data: typeof memberForm & { householdMemberId: string | null }) => {
      console.log("=== ADD FAMILY MEMBER DEBUG ===");
      console.log("Form data:", data);

      const res = await fetch("/api/allergies/family-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      console.log("Response status:", res.status);
      console.log("Response ok:", res.ok);

      const responseText = await res.text();
      console.log("Response text:", responseText);

      if (!res.ok) {
        let errorMessage = "Failed to add family member";
        let serverError = "";
        try {
          const error = JSON.parse(responseText);
          errorMessage = error.message || errorMessage;
          serverError = error.error || "";
        } catch {
          errorMessage = responseText || errorMessage;
        }

        const debugError = new Error(errorMessage);
        (debugError as any).status = res.status;
        (debugError as any).responseText = responseText;
        (debugError as any).serverError = serverError;
        (debugError as any).formData = data;
        throw debugError;
      }

      return JSON.parse(responseText);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/allergies/family-members"] });
      toast({ title: "✓ Family member added", description: "You can now add allergen profiles." });
      setShowAddMemberDialog(false);
      setSelectedHouseholdMemberId("");
      setMemberForm({ name: "", relationship: "", dateOfBirth: "", species: "human", notes: "" });
    },
    onError: (error: any) => {
      console.error("Add family member error:", error);

      const debugInfo = [
        `Error: ${error.message || "Unknown error"}`,
        `Status: ${error.status || "N/A"}`,
        error.serverError ? `Server Error: ${error.serverError}` : "",
        `Form Data: ${JSON.stringify(error.formData || {})}`,
        error.responseText ? `Response: ${error.responseText.substring(0, 200)}` : ""
      ].filter(Boolean).join("\n");

      toast({
        title: "Failed to add family member - Debug Info",
        description: debugInfo,
        variant: "destructive"
      });
    },
  });

  // Delete family member mutation
  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/allergies/family-members/${memberId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete family member");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/allergies/family-members"] });
      toast({ title: "Family member deleted" });
      if (selectedMember && members.find(m => m.id === selectedMember.id)) {
        setSelectedMember(null);
      }
    },
    onError: () => {
      toast({ title: "Failed to delete family member", variant: "destructive" });
    },
  });

  // Add allergen profile mutation
  const addAllergenMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/allergies/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to add allergen");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/allergies/profiles", selectedMember?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/allergies/family-members"] });
      toast({ title: "✓ Allergen added" });
      setShowAllergenDialog(false);
      setAllergenForm({ allergen: "", severity: "moderate", diagnosedBy: "", diagnosedDate: "", notes: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add allergen", description: error.message, variant: "destructive" });
    },
  });

  // Delete allergen profile mutation
  const deleteAllergenMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const res = await fetch(`/api/allergies/profiles/${profileId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete allergen");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/allergies/profiles", selectedMember?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/allergies/family-members"] });
      toast({ title: "Allergen removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove allergen", variant: "destructive" });
    },
  });

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "life-threatening": return "bg-red-100 text-red-800 border-red-200";
      case "severe": return "bg-orange-100 text-orange-800 border-orange-200";
      case "moderate": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "mild": return "bg-blue-100 text-blue-800 border-blue-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getSeverityIcon = (severity: string) => {
    if (severity === "life-threatening" || severity === "severe") {
      return <AlertTriangle className="w-4 h-4" />;
    }
    return <Shield className="w-4 h-4" />;
  };

  // Handle add allergen
  const handleAddAllergen = () => {
    if (!selectedMember) return;
    if (!allergenForm.allergen.trim()) {
      toast({ title: "Enter allergen name", variant: "destructive" });
      return;
    }

    addAllergenMutation.mutate({
      familyMemberId: selectedMember.id,
      ...allergenForm,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Heart className="w-12 h-12 mx-auto mb-4 text-gray-400 animate-pulse" />
          <p className="text-gray-500">Loading allergy profiles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <Heart className="w-10 h-10 text-red-500" />
              Allergy Profiles
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage allergen profiles for your family and check recipe safety
            </p>
          </div>
          <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Family Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Family Member</DialogTitle>
                <DialogDescription>
                  {memberForm.species === "human"
                    ? "Select a household member to track their allergen profiles"
                    : "Add a pet to track their allergen profiles"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="species">Type *</Label>
                  <Select value={memberForm.species} onValueChange={(val) => {
                    setMemberForm({ ...memberForm, species: val, name: "" });
                    setSelectedHouseholdMemberId("");
                  }}>
                    <SelectTrigger id="species">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="human">Human</SelectItem>
                      <SelectItem value="dog">Dog</SelectItem>
                      <SelectItem value="cat">Cat</SelectItem>
                      <SelectItem value="other">Other Pet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {memberForm.species === "human" ? (
                  householdMembers.length === 0 ? (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        You need to join a household first. Go to <Link href="/pantry/household" className="underline font-semibold">Household Pantry</Link> to create or join one.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="householdMember">Household Member *</Label>
                      <Select
                        value={selectedHouseholdMemberId}
                        onValueChange={(val) => {
                          setSelectedHouseholdMemberId(val);
                          const member = householdMembers.find((m: any) => m.userId === val);
                          if (member) {
                            setMemberForm({
                              ...memberForm,
                              name: member.username || member.email || "Household Member"
                            });
                          }
                        }}
                      >
                        <SelectTrigger id="householdMember">
                          <SelectValue placeholder="Select a household member" />
                        </SelectTrigger>
                        <SelectContent>
                          {householdMembers.map((member: any) => (
                            <SelectItem key={member.userId} value={member.userId}>
                              {member.username || member.email} {member.role === 'owner' ? '(Owner)' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                ) : (
                  <div>
                    <Label htmlFor="petName">Pet Name *</Label>
                    <Input
                      id="petName"
                      placeholder="e.g., Max, Buddy, Fluffy"
                      value={memberForm.name}
                      onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                    />
                  </div>
                )}

                {memberForm.species !== "human" && (
                  <div>
                    <Label htmlFor="relationship">Relationship</Label>
                    <Select value={memberForm.relationship} onValueChange={(val) => setMemberForm({ ...memberForm, relationship: val })}>
                      <SelectTrigger id="relationship">
                        <SelectValue placeholder="Select relationship" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pet">Pet</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label htmlFor="dob">Date of Birth (optional)</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={memberForm.dateOfBirth}
                    onChange={(e) => setMemberForm({ ...memberForm, dateOfBirth: e.target.value })}
                  />
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => {
                    setShowAddMemberDialog(false);
                    setSelectedHouseholdMemberId("");
                    setMemberForm({ name: "", relationship: "", dateOfBirth: "", species: "human", notes: "" });
                  }} className="flex-1">
                    Cancel
                  </Button>
                  <Button
                    onClick={() => addMemberMutation.mutate({
                      ...memberForm,
                      householdMemberId: memberForm.species === "human" ? selectedHouseholdMemberId : null
                    })}
                    disabled={
                      !memberForm.name.trim() ||
                      (memberForm.species === "human" && !selectedHouseholdMemberId) ||
                      addMemberMutation.isPending
                    }
                    className="flex-1"
                  >
                    {addMemberMutation.isPending ? "Adding..." : "Add Member"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Info Card */}
        <Card className="bg-gradient-to-r from-red-50 to-pink-50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-red-900 mb-1">Safety First</p>
                <p className="text-red-800">
                  Add family members and their allergen profiles to get safety warnings when viewing recipes
                  or scanning product barcodes. We'll highlight ingredients that may cause allergic reactions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Empty State */}
      {members.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <User className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-semibold mb-2">No family members yet</h3>
            <p className="text-muted-foreground mb-6">
              Start by adding family members (including pets!) to track their allergen profiles
            </p>
            <Button onClick={() => setShowAddMemberDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Member
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Family Members List */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-xl font-semibold">Family Members</h2>
            {members.map((member) => (
              <Card
                key={member.id}
                className={`cursor-pointer transition-all ${
                  selectedMember?.id === member.id ? "ring-2 ring-primary bg-accent" : "hover:bg-accent/50"
                }`}
                onClick={() => setSelectedMember(member)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{member.name}</h3>
                        {member.severeCases > 0 && (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {member.severeCases} severe
                          </Badge>
                        )}
                      </div>
                      {member.relationship && (
                        <p className="text-sm text-muted-foreground capitalize">{member.relationship}</p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {member.allergenCount} {member.allergenCount === 1 ? "allergen" : "allergens"}
                        </Badge>
                        {member.species !== "human" && (
                          <Badge variant="outline" className="text-xs capitalize">
                            {member.species}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Allergen Profiles Detail */}
          <div className="lg:col-span-2">
            {!selectedMember ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-muted-foreground">Select a family member to view and manage their allergen profiles</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{selectedMember.name}'s Allergens</CardTitle>
                        <CardDescription>
                          {profiles.length === 0 ? "No allergens tracked yet" : `${profiles.length} ${profiles.length === 1 ? "allergen" : "allergens"} tracked`}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Dialog open={showAllergenDialog} onOpenChange={setShowAllergenDialog}>
                          <DialogTrigger asChild>
                            <Button size="sm">
                              <Plus className="w-4 h-4 mr-2" />
                              Add Allergen
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Add Allergen for {selectedMember.name}</DialogTitle>
                              <DialogDescription>
                                Record an allergen and its severity level
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="allergen">Allergen *</Label>
                                <Input
                                  id="allergen"
                                  placeholder="e.g., Peanuts, Dairy, Shellfish"
                                  value={allergenForm.allergen}
                                  onChange={(e) => setAllergenForm({ ...allergenForm, allergen: e.target.value })}
                                />
                              </div>

                              <div>
                                <Label htmlFor="severity">Severity *</Label>
                                <Select value={allergenForm.severity} onValueChange={(val: any) => setAllergenForm({ ...allergenForm, severity: val })}>
                                  <SelectTrigger id="severity">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="mild">Mild (discomfort)</SelectItem>
                                    <SelectItem value="moderate">Moderate (significant reaction)</SelectItem>
                                    <SelectItem value="severe">Severe (medical attention needed)</SelectItem>
                                    <SelectItem value="life-threatening">Life-Threatening (anaphylaxis)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label htmlFor="diagnosedBy">Diagnosed By</Label>
                                <Select value={allergenForm.diagnosedBy} onValueChange={(val) => setAllergenForm({ ...allergenForm, diagnosedBy: val })}>
                                  <SelectTrigger id="diagnosedBy">
                                    <SelectValue placeholder="Optional" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="doctor">Doctor</SelectItem>
                                    <SelectItem value="allergist">Allergist</SelectItem>
                                    <SelectItem value="vet">Veterinarian</SelectItem>
                                    <SelectItem value="self">Self-identified</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label htmlFor="diagnosedDate">Diagnosis Date</Label>
                                <Input
                                  id="diagnosedDate"
                                  type="date"
                                  value={allergenForm.diagnosedDate}
                                  onChange={(e) => setAllergenForm({ ...allergenForm, diagnosedDate: e.target.value })}
                                />
                              </div>

                              <div>
                                <Label htmlFor="notes">Notes</Label>
                                <Input
                                  id="notes"
                                  placeholder="Optional notes..."
                                  value={allergenForm.notes}
                                  onChange={(e) => setAllergenForm({ ...allergenForm, notes: e.target.value })}
                                />
                              </div>

                              <div className="flex gap-3">
                                <Button variant="outline" onClick={() => setShowAllergenDialog(false)} className="flex-1">
                                  Cancel
                                </Button>
                                <Button
                                  onClick={handleAddAllergen}
                                  disabled={addAllergenMutation.isPending}
                                  className="flex-1"
                                >
                                  {addAllergenMutation.isPending ? "Adding..." : "Add Allergen"}
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => {
                            if (confirm(`Delete ${selectedMember.name} and all allergen profiles?`)) {
                              deleteMemberMutation.mutate(selectedMember.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {profiles.length > 0 && (
                    <CardContent>
                      <div className="space-y-3">
                        {profiles.map((profile) => (
                          <div
                            key={profile.id}
                            className="flex items-start justify-between p-3 rounded-lg border bg-card"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {getSeverityIcon(profile.severity)}
                                <h4 className="font-medium capitalize">{profile.allergen}</h4>
                                <Badge className={`text-xs ${getSeverityColor(profile.severity)}`}>
                                  {profile.severity.replace("-", " ")}
                                </Badge>
                              </div>
                              {profile.diagnosedBy && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Stethoscope className="w-3 h-3" />
                                  <span className="capitalize">Diagnosed by {profile.diagnosedBy}</span>
                                  {profile.diagnosedDate && (
                                    <span>• {new Date(profile.diagnosedDate).toLocaleDateString()}</span>
                                  )}
                                </div>
                              )}
                              {profile.notes && (
                                <div className="flex items-start gap-2 text-sm text-muted-foreground mt-2">
                                  <FileText className="w-3 h-3 mt-0.5" />
                                  <span>{profile.notes}</span>
                                </div>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => {
                                if (confirm("Remove this allergen profile?")) {
                                  deleteAllergenMutation.mutate(profile.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
