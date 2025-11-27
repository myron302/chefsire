// client/src/components/RecipeCollections.tsx
import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Plus, Folder, FolderOpen, Lock, Globe, Trash2, Edit, BookmarkPlus } from "lucide-react";
import { useUser } from "@/contexts/UserContext";

interface Collection {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  recipeCount: number;
  createdAt: string;
  updatedAt: string;
}

interface RecipeCollectionsProps {
  recipeId?: string; // If provided, show collections this recipe is in
  userId?: string; // If provided, show collections for this user
}

export function RecipeCollections({ recipeId, userId }: RecipeCollectionsProps) {
  const { user } = useUser();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIsPublic, setNewIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [recipeInCollections, setRecipeInCollections] = useState<string[]>([]);

  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (targetUserId) {
      fetchCollections();
    }
    if (recipeId && user) {
      checkRecipeCollections();
    }
  }, [targetUserId, recipeId]);

  const fetchCollections = async () => {
    if (!targetUserId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/collections/user/${targetUserId}`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setCollections(data);
      }
    } catch (error) {
      console.error("Error fetching collections:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkRecipeCollections = async () => {
    if (!recipeId || !user) return;

    try {
      const response = await fetch(`/api/collections/check/${recipeId}`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setRecipeInCollections(data.map((c: any) => c.collectionId));
      }
    } catch (error) {
      console.error("Error checking recipe collections:", error);
    }
  };

  const createCollection = async () => {
    if (!newName.trim()) return;

    try {
      setSubmitting(true);
      const response = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newName,
          description: newDescription,
          isPublic: newIsPublic,
        }),
      });

      if (response.ok) {
        const newCollection = await response.json();
        setCollections([newCollection, ...collections]);
        setNewName("");
        setNewDescription("");
        setNewIsPublic(false);
        setShowCreateModal(false);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to create collection");
      }
    } catch (error) {
      console.error("Error creating collection:", error);
      alert("Failed to create collection");
    } finally {
      setSubmitting(false);
    }
  };

  const updateCollection = async () => {
    if (!editingCollection || !newName.trim()) return;

    try {
      setSubmitting(true);
      const response = await fetch(`/api/collections/${editingCollection.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newName,
          description: newDescription,
          isPublic: newIsPublic,
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        setCollections(collections.map((c) => (c.id === updated.id ? updated : c)));
        setEditingCollection(null);
        setNewName("");
        setNewDescription("");
        setNewIsPublic(false);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update collection");
      }
    } catch (error) {
      console.error("Error updating collection:", error);
      alert("Failed to update collection");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteCollection = async (collectionId: string) => {
    if (!confirm("Are you sure you want to delete this collection?")) return;

    try {
      const response = await fetch(`/api/collections/${collectionId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        setCollections(collections.filter((c) => c.id !== collectionId));
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete collection");
      }
    } catch (error) {
      console.error("Error deleting collection:", error);
      alert("Failed to delete collection");
    }
  };

  const toggleRecipeInCollection = async (collectionId: string) => {
    if (!recipeId) return;

    const isInCollection = recipeInCollections.includes(collectionId);

    try {
      if (isInCollection) {
        // Remove from collection
        const response = await fetch(`/api/collections/${collectionId}/recipes/${recipeId}`, {
          method: "DELETE",
          credentials: "include",
        });

        if (response.ok) {
          setRecipeInCollections(recipeInCollections.filter((id) => id !== collectionId));
          // Update count
          setCollections(
            collections.map((c) =>
              c.id === collectionId ? { ...c, recipeCount: c.recipeCount - 1 } : c
            )
          );
        }
      } else {
        // Add to collection
        const response = await fetch(`/api/collections/${collectionId}/recipes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ recipeId }),
        });

        if (response.ok) {
          setRecipeInCollections([...recipeInCollections, collectionId]);
          // Update count
          setCollections(
            collections.map((c) =>
              c.id === collectionId ? { ...c, recipeCount: c.recipeCount + 1 } : c
            )
          );
        }
      }
    } catch (error) {
      console.error("Error toggling recipe in collection:", error);
    }
  };

  const startEdit = (collection: Collection) => {
    setEditingCollection(collection);
    setNewName(collection.name);
    setNewDescription(collection.description || "");
    setNewIsPublic(collection.isPublic);
  };

  const isOwnCollections = user && targetUserId === user.id;

  if (loading) {
    return <div className="text-sm text-gray-500">Loading collections...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header with Create Button */}
      {isOwnCollections && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">My Collections</h3>
          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                New Collection
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Collection</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Collection Name</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g., Weeknight Dinners"
                    maxLength={100}
                  />
                </div>
                <div>
                  <Label>Description (Optional)</Label>
                  <Textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Add a description for this collection..."
                    rows={3}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="public"
                    checked={newIsPublic}
                    onCheckedChange={(checked) => setNewIsPublic(checked as boolean)}
                  />
                  <Label htmlFor="public" className="font-normal cursor-pointer">
                    Make this collection public
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Button onClick={createCollection} disabled={submitting || !newName.trim()}>
                    Create
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Collections List */}
      {collections.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            {isOwnCollections ? (
              <>
                <Folder className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>No collections yet. Create one to organize your recipes!</p>
              </>
            ) : (
              <p>This user has no public collections.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {collections.map((collection) => (
            <Card key={collection.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {collection.isPublic ? (
                        <Globe className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Lock className="w-4 h-4 text-gray-600" />
                      )}
                      <h4 className="font-semibold">{collection.name}</h4>
                      <Badge variant="secondary">{collection.recipeCount} recipes</Badge>
                    </div>
                    {collection.description && (
                      <p className="text-sm text-gray-600 mt-1">{collection.description}</p>
                    )}
                    <div className="text-xs text-gray-500 mt-2">
                      Updated {collection.updatedAt ? new Date(collection.updatedAt).toLocaleDateString() : "Recently"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Toggle for adding/removing recipe */}
                    {recipeId && isOwnCollections && (
                      <Checkbox
                        checked={recipeInCollections.includes(collection.id)}
                        onCheckedChange={() => toggleRecipeInCollection(collection.id)}
                      />
                    )}

                    {/* Edit/Delete buttons */}
                    {isOwnCollections && !recipeId && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(collection)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteCollection(collection.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingCollection && (
        <Dialog open={true} onOpenChange={() => setEditingCollection(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Collection</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Collection Name</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div>
                <Label>Description (Optional)</Label>
                <Textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-public"
                  checked={newIsPublic}
                  onCheckedChange={(checked) => setNewIsPublic(checked as boolean)}
                />
                <Label htmlFor="edit-public" className="font-normal cursor-pointer">
                  Make this collection public
                </Label>
              </div>
              <div className="flex gap-2">
                <Button onClick={updateCollection} disabled={submitting || !newName.trim()}>
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setEditingCollection(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Compact version for recipe pages - just shows "Add to Collection" button
export function AddToCollectionButton({ recipeId }: { recipeId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BookmarkPlus className="w-4 h-4 mr-2" />
          Save to Collection
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Collection</DialogTitle>
        </DialogHeader>
        <RecipeCollections recipeId={recipeId} />
      </DialogContent>
    </Dialog>
  );
}
