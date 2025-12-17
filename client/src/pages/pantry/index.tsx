import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Package, Plus, Search, Filter, ScanLine, ChefHat,
  Calendar, AlertCircle, CheckCircle, Clock, Home,
  Trash2, Edit, MapPin, DollarSign, Users, ShoppingCart
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays, isPast, isFuture } from "date-fns";

type PantryItem = {
  id: string;
  name: string;
  category: string | null;
  quantity: string | null;
  unit: string | null;
  location: string | null;
  expirationDate: string | null;
  purchaseDate: string | null;
  openedDate: string | null;
  estimatedCost: string | null;
  store: string | null;
  notes: string | null;
  imageUrl: string | null;
  isRunningLow: boolean;
  householdId: string | null;
  createdAt: string;
  barcodeData?: {
    productName: string;
    brand?: string;
    imageUrl?: string;
  } | null;
};

type ShoppingListItem = {
  id?: string;
  name: string;
  quantity: string | number;
  unit: string | null;
  checked?: boolean;
};

export default function PantryDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterLocation, setFilterLocation] = useState("all");
  const [filterExpiry, setFilterExpiry] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
  const pendingShoppingProcessedRef = useRef(false);

  // Fetch pantry items
  const { data: pantryData, isLoading } = useQuery({
    queryKey: ["/api/pantry/items"],
    refetchInterval: 30000, // Refresh every 30s
  });

  // Fetch expiring items
  const { data: expiringData } = useQuery({
    queryKey: ["/api/pantry/expiring-soon", { days: 7 }],
  });

  // Fetch shopping list (grocery list items)
  const { data: shoppingData, isLoading: isShoppingLoading } = useQuery({
    queryKey: ["/api/meal-planner/grocery-list", { purchased: false }],
    queryFn: async () => {
      const res = await fetch("/api/meal-planner/grocery-list?purchased=false", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load shopping list");
      return res.json();
    },
  });

  useEffect(() => {
    if (shoppingData?.items) {
      const mapped: ShoppingListItem[] = shoppingData.items.map((item: any) => ({
        id: item.id,
        name: item.ingredientName,
        quantity: item.quantity || 1,
        unit: item.unit,
        checked: false,
      }));
      setShoppingList(mapped);
    }
  }, [shoppingData]);

  const addShoppingItemsMutation = useMutation({
    mutationFn: async (items: ShoppingListItem[]) => {
      const results = await Promise.all(items.map(async (item) => {
        const res = await fetch("/api/meal-planner/grocery-list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            ingredientName: item.name,
            quantity: item.quantity?.toString() ?? "",
            unit: item.unit ?? "",
            isPantryItem: false,
          }),
        });
        if (!res.ok) throw new Error("Failed to add grocery item");
        return res.json();
      }));
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meal-planner/grocery-list"] });
    },
    onError: () => {
      toast({ title: "Failed to save shopping list", variant: "destructive" });
    },
  });

  const deleteShoppingItem = async (id: string) => {
    const res = await fetch(`/api/meal-planner/grocery-list/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to delete grocery item");
  };

  const deleteShoppingItemMutation = useMutation({
    mutationFn: deleteShoppingItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meal-planner/grocery-list"] });
      toast({ title: "Item removed from shopping list" });
    },
    onError: () => {
      toast({ title: "Failed to remove item", variant: "destructive" });
    },
  });

  const items: PantryItem[] = pantryData?.items || [];
  const expiringItems: PantryItem[] = expiringData?.items || [];

  // Load pending shopping list items from RecipeKit
  useEffect(() => {
    if (pendingShoppingProcessedRef.current) return;

    pendingShoppingProcessedRef.current = true;
    console.log('🔍 Pantry: Checking for pending shopping items...');

    (async () => {
      try {
        const pendingRaw = localStorage.getItem('pendingShoppingListItems');
        console.log('🔍 Pantry: Raw localStorage value:', pendingRaw);
        const pending = JSON.parse(pendingRaw || '[]');
        console.log('🔍 Pantry: Parsed pending items:', pending);

        if (pending.length === 0) {
          console.log('ℹ️ Pantry: No pending items found');
          return;
        }

        const formatted: ShoppingListItem[] = pending.map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit ?? "",
        }));

        await addShoppingItemsMutation.mutateAsync(formatted);
        localStorage.removeItem('pendingShoppingListItems');
        toast({ title: `Added ${pending.length} item${pending.length > 1 ? 's' : ''} to shopping list from recipe!` });
      } catch (err) {
        console.error('❌ Error saving pending shopping items:', err);
        toast({ title: "Failed to save shopping list items", variant: "destructive" });
      }
    })();
  }, [toast, addShoppingItemsMutation]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await fetch(`/api/pantry/items/${itemId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pantry/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pantry/expiring-soon"] });
      toast({ title: "Item deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete item", variant: "destructive" });
    },
  });

  // Get expiry status
  const getExpiryStatus = (expirationDate: string | null) => {
    if (!expirationDate) return { status: "none", label: "", color: "" };

    const expDate = new Date(expirationDate);
    const daysUntilExpiry = differenceInDays(expDate, new Date());

    if (isPast(expDate)) {
      return { status: "expired", label: "Expired", color: "bg-red-100 text-red-800" };
    } else if (daysUntilExpiry <= 1) {
      return { status: "urgent", label: `Expires today`, color: "bg-orange-100 text-orange-800" };
    } else if (daysUntilExpiry <= 3) {
      return { status: "warning", label: `${daysUntilExpiry}d left`, color: "bg-yellow-100 text-yellow-800" };
    } else if (daysUntilExpiry <= 7) {
      return { status: "soon", label: `${daysUntilExpiry}d left`, color: "bg-blue-100 text-blue-800" };
    } else {
      return { status: "fresh", label: `${daysUntilExpiry}d left`, color: "bg-green-100 text-green-800" };
    }
  };

  // Filter items
  const filteredItems = items.filter(item => {
    // Search filter
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Category filter
    if (filterCategory !== "all" && item.category !== filterCategory) {
      return false;
    }

    // Location filter
    if (filterLocation !== "all" && item.location !== filterLocation) {
      return false;
    }

    // Expiry filter
    if (filterExpiry !== "all") {
      const expStatus = getExpiryStatus(item.expirationDate).status;
      if (filterExpiry === "expiring" && !["urgent", "warning", "soon"].includes(expStatus)) {
        return false;
      }
      if (filterExpiry === "fresh" && expStatus !== "fresh") {
        return false;
      }
      if (filterExpiry === "expired" && expStatus !== "expired") {
        return false;
      }
    }

    return true;
  });

  // Get unique categories and locations
  const categories = Array.from(new Set(items.map(i => i.category).filter(Boolean)));
  const locations = Array.from(new Set(items.map(i => i.location).filter(Boolean)));

  // Stats
  const stats = {
    total: items.length,
    expiring: expiringItems.length,
    expired: items.filter(i => {
      const exp = getExpiryStatus(i.expirationDate);
      return exp.status === "expired";
    }).length,
    runningLow: items.filter(i => i.isRunningLow).length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Package className="w-12 h-12 mx-auto mb-4 text-gray-400 animate-pulse" />
          <p className="text-gray-500">Loading your pantry...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">My Pantry</h1>
            <p className="text-muted-foreground mt-1">
              Track ingredients, reduce waste, cook smarter
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Link href="/pantry/scanner" className="flex-1 sm:flex-none">
              <Button variant="outline" className="w-full sm:w-auto">
                <ScanLine className="w-4 h-4 mr-2" />
                <span className="whitespace-nowrap">Scan Barcode</span>
              </Button>
            </Link>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="flex-1 sm:flex-none w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Pantry Item</DialogTitle>
                </DialogHeader>
                <AddItemForm onSuccess={() => setShowAddDialog(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Items</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Package className="w-8 h-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-700">Expiring Soon</p>
                  <p className="text-2xl font-bold text-yellow-800">{stats.expiring}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-700">Expired</p>
                  <p className="text-2xl font-bold text-red-800">{stats.expired}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700">Running Low</p>
                  <p className="text-2xl font-bold text-blue-800">{stats.runningLow}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Link href="/pantry/recipe-matches">
            <Card className="cursor-pointer hover:bg-accent transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <ChefHat className="w-10 h-10 text-primary" />
                  <div>
                    <h3 className="font-semibold">What Can I Cook?</h3>
                    <p className="text-sm text-muted-foreground">
                      Find recipes based on your pantry
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/pantry/household">
            <Card className="cursor-pointer hover:bg-accent transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Users className="w-10 h-10 text-primary" />
                  <div>
                    <h3 className="font-semibold">Household Pantry</h3>
                    <p className="text-sm text-muted-foreground">
                      Share pantry with family
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-10 h-10 text-primary" />
                <div>
                  <h3 className="font-semibold">Expiry Calendar</h3>
                  <p className="text-sm text-muted-foreground">
                    View upcoming expirations
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:bg-accent transition-colors border-green-200 bg-green-50"
            onClick={() => {
              const shoppingSection = document.getElementById('shopping-list-section');
              if (shoppingSection) {
                shoppingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
              } else if (shoppingList.length === 0) {
                toast({ title: 'Shopping list is empty', description: 'Add items from recipes by checking ingredients in the modal.' });
              }
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-10 h-10 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-800">Shopping List</h3>
                  <p className="text-sm text-green-700">
                    {isShoppingLoading ? "Loading..." : `${shoppingList.length} items to buy`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat!}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map(loc => (
                    <SelectItem key={loc} value={loc!}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterExpiry} onValueChange={setFilterExpiry}>
                <SelectTrigger>
                  <SelectValue placeholder="Expiry Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  <SelectItem value="expiring">Expiring Soon</SelectItem>
                  <SelectItem value="fresh">Fresh</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items Grid */}
      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-semibold mb-2">
              {searchQuery || filterCategory !== "all" ? "No items found" : "Your pantry is empty"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || filterCategory !== "all"
                ? "Try adjusting your filters"
                : "Start tracking your ingredients to reduce waste and discover recipes"}
            </p>
            {!searchQuery && filterCategory === "all" && (
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Item
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const expiryStatus = getExpiryStatus(item.expirationDate);

            return (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{item.name}</h3>
                      {item.category && (
                        <Badge variant="outline" className="text-xs">
                          {item.category}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        onClick={() => {
                          if (confirm("Delete this item?")) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-2 text-sm">
                    {item.quantity && item.unit && (
                      <div className="flex items-center gap-3">
                        <Package className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                        <span className="text-muted-foreground">{item.quantity} {item.unit}</span>
                      </div>
                    )}

                    {item.location && (
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                        <span className="text-muted-foreground">{item.location}</span>
                      </div>
                    )}

                    {item.expirationDate && (
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-muted-foreground text-sm">
                            Expires {format(new Date(item.expirationDate), "MMM d, yyyy")}
                          </span>
                          <Badge className={`text-xs ${expiryStatus.color} ml-auto`}>
                            {expiryStatus.label}
                          </Badge>
                        </div>
                      </div>
                    )}

                    {item.estimatedCost && (
                      <div className="flex items-center gap-3">
                        <DollarSign className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                        <span className="text-muted-foreground">${item.estimatedCost}</span>
                      </div>
                    )}

                    {item.householdId && (
                      <div className="flex items-center gap-3">
                        <Users className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                        <Badge variant="secondary" className="text-xs">
                          Household Item
                        </Badge>
                      </div>
                    )}
                  </div>

                  {item.notes && (
                    <p className="mt-3 text-sm text-muted-foreground border-t pt-2">
                      {item.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Shopping List Section */}
      {shoppingList.length > 0 && (
        <Card className="mt-6" id="shopping-list-section">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Shopping List
            </CardTitle>
            <CardDescription>
              Items added from recipes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {shoppingList.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={item.checked || false}
                      onChange={() => {
                        setShoppingList(prev => prev.map((si, i) =>
                          i === idx ? { ...si, checked: !si.checked } : si
                        ));
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <div className={item.checked ? 'line-through text-muted-foreground' : ''}>
                      <span className="font-medium">{item.name}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        {item.quantity} {item.unit}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-red-600"
                    onClick={async () => {
                      const target = shoppingList[idx];
                      setShoppingList(prev => prev.filter((_, i) => i !== idx));
                      if (target?.id) {
                        try {
                          await deleteShoppingItemMutation.mutateAsync(target.id);
                        } catch {
                          // Handled in mutation onError
                        }
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const ids = shoppingList.map(item => item.id).filter(Boolean) as string[];
                  setShoppingList([]);
                  if (ids.length > 0) {
                    try {
                      await Promise.all(ids.map(id => deleteShoppingItem(id)));
                      queryClient.invalidateQueries({ queryKey: ["/api/meal-planner/grocery-list"] });
                      toast({ title: "Cleared shopping list" });
                    } catch {
                      toast({ title: "Failed to clear shopping list", variant: "destructive" });
                    }
                  }
                }}
              >
                Clear All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const unchecked = shoppingList.filter(i => !i.checked);
                  const removed = shoppingList.filter(i => i.checked);
                  setShoppingList(unchecked);
                  const ids = removed.map(item => item.id).filter(Boolean) as string[];
                  if (ids.length > 0) {
                    Promise.all(ids.map(id => deleteShoppingItem(id)))
                      .then(() => {
                        queryClient.invalidateQueries({ queryKey: ["/api/meal-planner/grocery-list"] });
                        toast({ title: `Removed ${ids.length} checked item${ids.length > 1 ? 's' : ''}` });
                      })
                      .catch(() => toast({ title: "Failed to remove checked items", variant: "destructive" }));
                  } else {
                    toast({ title: `Removed ${shoppingList.length - unchecked.length} checked items` });
                  }
                }}
              >
                Remove Checked
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Add Item Form Component
function AddItemForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    quantity: "",
    unit: "",
    location: "",
    expirationDate: "",
    notes: "",
  });

  const addMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/pantry/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pantry/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pantry/expiring-soon"] });
      toast({ title: "Item added successfully!" });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Failed to add item", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Item Name *</label>
        <Input
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Milk, Eggs, Flour"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Quantity</label>
          <Input
            type="number"
            step="0.01"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
            placeholder="2"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Unit</label>
          <Input
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            placeholder="cups, lbs, oz"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Category</label>
        <Input
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          placeholder="Dairy, Produce, Meat, etc."
        />
      </div>

      <div>
        <label className="text-sm font-medium">Location</label>
        <Select value={formData.location} onValueChange={(val) => setFormData({ ...formData, location: val })}>
          <SelectTrigger>
            <SelectValue placeholder="Where is it stored?" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fridge">Fridge</SelectItem>
            <SelectItem value="freezer">Freezer</SelectItem>
            <SelectItem value="pantry">Pantry</SelectItem>
            <SelectItem value="spice-rack">Spice Rack</SelectItem>
            <SelectItem value="counter">Counter</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium">Expiration Date</label>
        <Input
          type="date"
          value={formData.expirationDate}
          onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
        />
      </div>

      <div>
        <label className="text-sm font-medium">Notes</label>
        <Input
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Optional notes..."
        />
      </div>

      <Button type="submit" className="w-full" disabled={addMutation.isPending}>
        {addMutation.isPending ? "Adding..." : "Add Item"}
      </Button>
    </form>
  );
}
