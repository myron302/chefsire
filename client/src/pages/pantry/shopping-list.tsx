import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ShoppingCart, Plus, Trash2, ArrowLeft, Camera, Edit } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import BarcodeScanner from "@/components/BarcodeScanner";

export default function ShoppingListPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemAmount, setNewItemAmount] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("Other");
  const [itemToToggle, setItemToToggle] = useState<{ id: string; name: string; purchased: boolean } | null>(null);
  const [itemToEdit, setItemToEdit] = useState<any>(null);

  // Fetch grocery list
  const { data: groceryData, isLoading } = useQuery({
    queryKey: ["/api/meal-planner/grocery-list", { purchased: false }],
    queryFn: async () => {
      const res = await fetch("/api/meal-planner/grocery-list?purchased=false", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch grocery list");
      return res.json();
    },
  });

  const groceryItems = groceryData?.items || [];

  // Toggle purchase mutation
  const toggleMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await fetch(`/api/meal-planner/grocery-list/${itemId}/purchase`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ toggle: true }),
      });
      if (!res.ok) throw new Error("Failed to toggle item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meal-planner/grocery-list"] });
    },
    onError: () => {
      toast({ title: "Failed to update item", variant: "destructive" });
    },
  });

  // Add item mutation
  const addMutation = useMutation({
    mutationFn: async (data: { ingredientName: string; quantity: string; unit: string; category: string }) => {
      const res = await fetch("/api/meal-planner/grocery-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meal-planner/grocery-list"] });
      toast({ title: "Item added to shopping list!" });
      setNewItemName("");
      setNewItemAmount("");
      setNewItemCategory("Other");
      setShowAddItemDialog(false);
    },
    onError: () => {
      toast({ title: "Failed to add item", variant: "destructive" });
    },
  });

  // Update item mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; ingredientName: string; quantity: string; unit: string; category: string; notes?: string }) => {
      const res = await fetch(`/api/meal-planner/grocery-list/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ingredientName: data.ingredientName,
          quantity: data.quantity,
          unit: data.unit,
          category: data.category,
          notes: data.notes,
        }),
      });
      if (!res.ok) throw new Error("Failed to update item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meal-planner/grocery-list"] });
      toast({ title: "Item updated successfully!" });
      setShowEditDialog(false);
      setItemToEdit(null);
    },
    onError: () => {
      toast({ title: "Failed to update item", variant: "destructive" });
    },
  });

  // Delete item mutation
  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await fetch(`/api/meal-planner/grocery-list/${itemId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meal-planner/grocery-list"] });
      toast({ title: "Item removed from shopping list" });
    },
    onError: () => {
      toast({ title: "Failed to delete item", variant: "destructive" });
    },
  });

  const handleAddItem = () => {
    if (!newItemName.trim()) {
      toast({ title: "Please enter an item name", variant: "destructive" });
      return;
    }

    // Parse quantity and unit from amount
    let quantity = "1";
    let unit = "";
    const match = newItemAmount?.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    if (match) {
      quantity = match[1];
      unit = match[2];
    } else if (newItemAmount) {
      unit = newItemAmount;
    }

    addMutation.mutate({
      ingredientName: newItemName,
      quantity,
      unit,
      category: newItemCategory,
    });
  };

  const handleEditItem = () => {
    if (!itemToEdit || !itemToEdit.ingredientName.trim()) {
      toast({ title: "Please enter an item name", variant: "destructive" });
      return;
    }

    // Parse quantity and unit from amount
    let quantity = "1";
    let unit = "";
    const amount = `${itemToEdit.quantity || ""} ${itemToEdit.unit || ""}`.trim();
    const match = amount.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    if (match) {
      quantity = match[1];
      unit = match[2];
    } else if (amount) {
      unit = amount;
    }

    updateMutation.mutate({
      id: itemToEdit.id,
      ingredientName: itemToEdit.ingredientName,
      quantity,
      unit,
      category: itemToEdit.category || "Other",
      notes: itemToEdit.notes,
    });
  };

  const handleScanBarcode = async (barcode: string) => {
    try {
      // Fetch product info from barcode
      const response = await fetch(`/api/products/barcode/${barcode}`, {
        credentials: "include",
      });

      if (response.ok) {
        const productData = await response.json();

        // Add scanned product to shopping list
        await addMutation.mutateAsync({
          ingredientName: productData.name || barcode,
          quantity: "1",
          unit: "",
          category: "Other",
        });

        setShowScanModal(false);
        toast({
          title: "Item added!",
          description: `${productData.name || barcode} added to shopping list`,
        });
      } else {
        // Product not found, still add barcode
        await addMutation.mutateAsync({
          ingredientName: `Product ${barcode}`,
          quantity: "1",
          unit: "",
          category: "Other",
        });

        setShowScanModal(false);
        toast({
          title: "Item added",
          description: "Barcode added to shopping list",
        });
      }
    } catch (error) {
      console.error("Error scanning barcode:", error);
      toast({
        title: "Scan failed",
        description: "Failed to add item from barcode",
        variant: "destructive",
      });
    }
  };

  const categories = Array.from(new Set(groceryItems.map((i: any) => i.category || "Other")));
  const sortedCategories = categories.sort();

  const totalItems = groceryItems.length;
  const checkedItems = groceryItems.filter((item: any) => item.purchased).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/pantry">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Pantry
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">Shopping List</h1>
            <p className="text-muted-foreground mt-1">
              Your grocery list for the next shopping trip
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {totalItems > 0 && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Progress</p>
                <p className="text-2xl font-bold">
                  {checkedItems} / {totalItems} items
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Completion</p>
                <p className="text-2xl font-bold">
                  {totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Shopping List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Items
              </CardTitle>
              <CardDescription className="mt-1">
                {totalItems === 0 ? "No items yet" : `${totalItems} item${totalItems === 1 ? '' : 's'}`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowScanModal(true)}>
                <Camera className="w-4 h-4 mr-2" />
                Scan
              </Button>
              <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Item
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add to Shopping List</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Item Name *</label>
                    <Input
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="e.g., Milk, Eggs"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Amount</label>
                    <Input
                      value={newItemAmount}
                      onChange={(e) => setNewItemAmount(e.target.value)}
                      placeholder="e.g., 2 lbs, 1 gallon"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Category</label>
                    <Select value={newItemCategory} onValueChange={setNewItemCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Protein">Protein</SelectItem>
                        <SelectItem value="Produce">Produce</SelectItem>
                        <SelectItem value="Dairy">Dairy</SelectItem>
                        <SelectItem value="Grains">Grains</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleAddItem}
                    className="w-full"
                    disabled={addMutation.isPending}
                  >
                    {addMutation.isPending ? "Adding..." : "Add to List"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50 animate-pulse" />
              <p>Loading shopping list...</p>
            </div>
          ) : groceryItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="font-medium">Your shopping list is empty</p>
              <p className="text-sm mt-1">Add items from your pantry or create new ones</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedCategories.map((category) => {
                const categoryItems = groceryItems.filter((item: any) => (item.category || "Other") === category);
                if (categoryItems.length === 0) return null;

                return (
                  <div key={category}>
                    <h3 className="font-medium text-sm text-muted-foreground mb-2">{category}</h3>
                    <div className="space-y-2">
                      {categoryItems.map((item: any) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
                        >
                          <Checkbox
                            checked={item.purchased}
                            onCheckedChange={() => {
                              // Show confirmation dialog before toggling
                              setItemToToggle({
                                id: item.id,
                                name: item.ingredientName,
                                purchased: item.purchased,
                              });
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm ${item.purchased ? "line-through text-muted-foreground" : "font-medium"}`}>
                              {item.ingredientName}
                            </span>
                            {item.notes && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.notes}</p>
                            )}
                          </div>
                          {(item.quantity || item.unit) && (
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                              {item.quantity} {item.unit}
                            </span>
                          )}
                          <div className="flex gap-1 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setItemToEdit(item);
                                setShowEditDialog(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => deleteMutation.mutate(item.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Item Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Item Name *</label>
              <Input
                value={itemToEdit?.ingredientName || ""}
                onChange={(e) => setItemToEdit({ ...itemToEdit, ingredientName: e.target.value })}
                placeholder="e.g., Milk, Eggs"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Quantity</label>
              <Input
                value={itemToEdit?.quantity || ""}
                onChange={(e) => setItemToEdit({ ...itemToEdit, quantity: e.target.value })}
                placeholder="e.g., 2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Unit</label>
              <Input
                value={itemToEdit?.unit || ""}
                onChange={(e) => setItemToEdit({ ...itemToEdit, unit: e.target.value })}
                placeholder="e.g., lbs, gallons"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Category</label>
              <Select
                value={itemToEdit?.category || "Other"}
                onValueChange={(value) => setItemToEdit({ ...itemToEdit, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Protein">Protein</SelectItem>
                  <SelectItem value="Produce">Produce</SelectItem>
                  <SelectItem value="Dairy">Dairy</SelectItem>
                  <SelectItem value="Grains">Grains</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Input
                value={itemToEdit?.notes || ""}
                onChange={(e) => setItemToEdit({ ...itemToEdit, notes: e.target.value })}
                placeholder="Optional notes"
              />
            </div>
            <Button
              onClick={handleEditItem}
              className="w-full"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Updating..." : "Update Item"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner Modal */}
      {showScanModal && (
        <BarcodeScanner
          onDetected={(barcode) => {
            handleScanBarcode(barcode);
          }}
          onClose={() => setShowScanModal(false)}
        />
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={!!itemToToggle} onOpenChange={() => setItemToToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {itemToToggle?.purchased ? "Unmark as Purchased?" : "Mark as Purchased?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {itemToToggle?.purchased
                ? `Do you want to unmark "${itemToToggle?.name}" as purchased? This will remove it from your pantry.`
                : `Did you purchase "${itemToToggle?.name}"? This will mark it as purchased and add it to your pantry.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (itemToToggle) {
                  toggleMutation.mutate(itemToToggle.id);
                  setItemToToggle(null);
                }
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
