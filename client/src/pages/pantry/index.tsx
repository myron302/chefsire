import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Package, Plus, Search, Filter, ScanLine, ChefHat,
  Calendar, AlertCircle, CheckCircle, Clock, Home,
  Trash2, Edit, MapPin, DollarSign, Users, ShoppingCart
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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

export default function PantryDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterLocation, setFilterLocation] = useState("all");
  const [filterExpiry, setFilterExpiry] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showExpiryDialog, setShowExpiryDialog] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<PantryItem | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Handle scanned barcode from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const barcode = params.get('barcode');
    const name = params.get('name');

    if (barcode && name) {
      const category = params.get('category') || '';
      const quantity = params.get('quantity') || '1';
      const unit = params.get('unit') || 'piece';
      const brand = params.get('brand') || '';
      const imageUrl = params.get('imageUrl') || '';

      // Show toast that item was scanned
      toast({
        title: "Product Scanned!",
        description: `Adding ${name} to your pantry...`,
      });

      // Add item to pantry
      fetch("/api/pantry/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          category: category || null,
          quantity,
          unit,
          notes: brand ? `Brand: ${brand}` : null,
          imageUrl: imageUrl || null,
        }),
      })
        .then((res) => {
          if (res.ok) {
            toast({
              title: "Success!",
              description: `${name} has been added to your pantry`,
            });
            queryClient.invalidateQueries({ queryKey: ["/api/pantry/items"] });
            // Clear URL parameters
            setLocation('/pantry');
          } else {
            throw new Error("Failed to add item");
          }
        })
        .catch((err) => {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to add item to pantry",
          });
        });
    }
  }, [location, toast, queryClient, setLocation]);

  // Fetch pantry items
  const { data: pantryData, isLoading } = useQuery({
    queryKey: ["/api/pantry/items"],
    refetchInterval: 30000, // Refresh every 30s
  });

  // Fetch expiring items
  const { data: expiringData } = useQuery({
    queryKey: ["/api/pantry/expiring-soon?days=7"],
    queryFn: async () => {
      const res = await fetch("/api/pantry/expiring-soon?days=7", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch expiring items");
      return res.json();
    },
  });

  const items: PantryItem[] = pantryData?.items || [];
  const expiringItems: PantryItem[] = expiringData?.items || [];

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
      queryClient.invalidateQueries({ queryKey: ["/api/pantry/expiring-soon?days=7"] });
      toast({ title: "Item deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete item", variant: "destructive" });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<PantryItem> & { id: string }) => {
      const res = await fetch(`/api/pantry/items/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: data.name,
          category: data.category,
          quantity: data.quantity,
          unit: data.unit,
          location: data.location,
          expirationDate: data.expirationDate ? new Date(data.expirationDate).toISOString() : null,
          notes: data.notes,
          isRunningLow: data.isRunningLow,
        }),
      });
      if (!res.ok) throw new Error("Failed to update item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pantry/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pantry/expiring-soon?days=7"] });
      toast({ title: "Item updated successfully!" });
      setShowEditDialog(false);
      setItemToEdit(null);
    },
    onError: () => {
      toast({ title: "Failed to update item", variant: "destructive" });
    },
  });

  // Toggle running low mutation
  const toggleRunningLowMutation = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: boolean }) => {
      const res = await fetch(`/api/pantry/items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isRunningLow: next }),
      });
      if (!res.ok) throw new Error("Failed to update running-low state");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pantry/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pantry/expiring-soon?days=7"] });
      toast({ title: "Updated!" });
    },
    onError: () => {
      toast({ title: "Failed to update", variant: "destructive" });
    },
  });

  // Add to shopping list mutation
  const addToShoppingListMutation = useMutation({
    mutationFn: async (items: PantryItem[]) => {
      const promises = items.map(item =>
        fetch("/api/meal-planner/grocery-list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            ingredientName: item.name,
            quantity: item.quantity || "1",
            unit: item.unit || "",
            category: item.category || "Other",
            notes: item.notes,
          }),
        })
      );

      const results = await Promise.all(promises);
      const failedResults = results.filter(r => !r.ok);

      if (failedResults.length > 0) {
        throw new Error(`Failed to add ${failedResults.length} item(s) to shopping list`);
      }

      return results;
    },
    onSuccess: (_, items) => {
      queryClient.invalidateQueries({ queryKey: ["/api/meal-planner/grocery-list"] });
      toast({
        title: "Added to shopping list!",
        description: `${items.length} item(s) added to your shopping list`
      });
      setSelectedItems(new Set()); // Clear selections
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Toggle item selection
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  // Add selected items to shopping list
  const addSelectedToShoppingList = () => {
    const itemsToAdd = filteredItems.filter(item => selectedItems.has(item.id));
    if (itemsToAdd.length === 0) {
      toast({
        title: "No items selected",
        description: "Please select items to add to shopping list",
        variant: "destructive"
      });
      return;
    }
    addToShoppingListMutation.mutate(itemsToAdd);
  };

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
            <Button
              variant="outline"
              className="flex-1 sm:flex-none w-full sm:w-auto"
              onClick={addSelectedToShoppingList}
              disabled={selectedItems.size === 0 || addToShoppingListMutation.isPending}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              <span className="whitespace-nowrap">
                {selectedItems.size > 0
                  ? `Add ${selectedItems.size} to List`
                  : "Add to List"}
              </span>
            </Button>
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

          <Link href="/pantry/shopping-list">
            <Card className="cursor-pointer hover:bg-accent transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="w-10 h-10 text-primary" />
                  <div>
                    <h3 className="font-semibold">Shopping List</h3>
                    <p className="text-sm text-muted-foreground">
                      Manage your grocery list
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Card
            className="cursor-pointer hover:bg-accent transition-colors"
            onClick={() => setShowExpiryDialog(true)}
          >
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
      <div data-items-section>
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
                  <div className="flex items-start gap-3 mb-3">
                    <Checkbox
                      checked={selectedItems.has(item.id)}
                      onCheckedChange={() => toggleItemSelection(item.id)}
                      className="mt-1"
                    />
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

                  <div className="grid gap-2 text-sm ml-9">
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
                    <p className="mt-3 text-sm text-muted-foreground border-t pt-2 ml-9">
                      {item.notes}
                    </p>
                  )}

                  {/* Running Low Button */}
                  <div className="mt-3 border-t pt-3 ml-9">
                    <Button
                      size="sm"
                      variant={item.isRunningLow ? "default" : "outline"}
                      className="w-full"
                      onClick={() => {
                        toggleRunningLowMutation.mutate({ id: item.id, next: !item.isRunningLow });
                      }}
                    >
                      <AlertCircle className="w-4 h-4 mr-2" />
                      {item.isRunningLow ? "Running Low ✓" : "Mark as Running Low"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      </div>

      {/* Expiry Calendar Dialog */}
      <Dialog open={showExpiryDialog} onOpenChange={setShowExpiryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Expiry Calendar (Next 7 Days)</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {expiringItems.length === 0 ? (
              <p className="text-muted-foreground">Nothing expiring in the next week.</p>
            ) : (
              Object.entries(
                expiringItems.reduce<Record<string, PantryItem[]>>((acc, item) => {
                  const key = item.expirationDate
                    ? new Date(item.expirationDate).toISOString().split("T")[0]
                    : "No date";
                  (acc[key] ||= []).push(item);
                  return acc;
                }, {})
              )
              .sort(([a],[b]) => a.localeCompare(b))
              .map(([day, items]) => (
                <div key={day} className="border rounded-lg">
                  <div className="px-4 py-2 font-semibold bg-muted/50">
                    {day === "No date"
                      ? "No expiration date"
                      : format(new Date(day), "EEEE, MMM d, yyyy")}
                  </div>
                  <div className="p-4 space-y-2">
                    {items.map((i) => (
                      <div key={i.id} className="flex items-center justify-between">
                        <span>{i.name}</span>
                        <Badge variant="secondary">
                          {i.quantity && i.unit ? `${i.quantity} ${i.unit}` : "—"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Pantry Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="text-sm font-medium">Item Name *</label>
              <Input
                value={itemToEdit?.name || ""}
                onChange={(e) => setItemToEdit(itemToEdit ? { ...itemToEdit, name: e.target.value } : null)}
                placeholder="e.g., Milk, Eggs"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Category</label>
              <Select
                value={itemToEdit?.category || ""}
                onValueChange={(value) => setItemToEdit(itemToEdit ? { ...itemToEdit, category: value } : null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Produce">Produce</SelectItem>
                  <SelectItem value="Dairy">Dairy</SelectItem>
                  <SelectItem value="Meat">Meat</SelectItem>
                  <SelectItem value="Bakery">Bakery</SelectItem>
                  <SelectItem value="Pantry">Pantry</SelectItem>
                  <SelectItem value="Frozen">Frozen</SelectItem>
                  <SelectItem value="Beverages">Beverages</SelectItem>
                  <SelectItem value="Snacks">Snacks</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Quantity</label>
                <Input
                  value={itemToEdit?.quantity || ""}
                  onChange={(e) => setItemToEdit(itemToEdit ? { ...itemToEdit, quantity: e.target.value } : null)}
                  placeholder="e.g., 2"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Unit</label>
                <Input
                  value={itemToEdit?.unit || ""}
                  onChange={(e) => setItemToEdit(itemToEdit ? { ...itemToEdit, unit: e.target.value } : null)}
                  placeholder="e.g., lbs, pieces"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Location</label>
              <Input
                value={itemToEdit?.location || ""}
                onChange={(e) => setItemToEdit(itemToEdit ? { ...itemToEdit, location: e.target.value } : null)}
                placeholder="e.g., Fridge, Pantry"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Expiration Date</label>
              <Input
                type="date"
                value={itemToEdit?.expirationDate ? new Date(itemToEdit.expirationDate).toISOString().split('T')[0] : ""}
                onChange={(e) => setItemToEdit(itemToEdit ? { ...itemToEdit, expirationDate: e.target.value ? new Date(e.target.value).toISOString() : null } : null)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Input
                value={itemToEdit?.notes || ""}
                onChange={(e) => setItemToEdit(itemToEdit ? { ...itemToEdit, notes: e.target.value } : null)}
                placeholder="Optional notes"
              />
            </div>
            <Button
              onClick={() => {
                if (!itemToEdit?.name?.trim()) {
                  toast({ title: "Please enter an item name", variant: "destructive" });
                  return;
                }
                updateMutation.mutate(itemToEdit);
              }}
              className="w-full"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Updating..." : "Update Item"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
  const [alsoAddToShoppingList, setAlsoAddToShoppingList] = useState(false);

  // Check if user is premium
  const { data: userData } = useQuery({
    queryKey: ["/api/user"],
  });
  const isPremium = userData?.nutritionPremium || false;

  const addMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Add to pantry
      const res = await fetch("/api/pantry/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to add item");
      }

      // Also add to shopping list if checkbox is checked and user is premium
      if (alsoAddToShoppingList && isPremium) {
        await fetch("/api/meal-planner/grocery-list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            ingredientName: data.name,
            quantity: data.quantity || "1",
            unit: data.unit || "",
            category: data.category || "Other",
            notes: data.notes,
          }),
        });
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pantry/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pantry/expiring-soon?days=7"] });
      if (alsoAddToShoppingList && isPremium) {
        queryClient.invalidateQueries({ queryKey: ["/api/meal-planner/grocery-list"] });
        toast({ title: "Item added to pantry and shopping list!" });
      } else {
        toast({ title: "Item added to pantry!" });
      }
      // Reset form
      setFormData({
        name: "",
        category: "",
        quantity: "",
        unit: "",
        location: "",
        expirationDate: "",
        notes: "",
      });
      setAlsoAddToShoppingList(false);
      onSuccess();
    },
    onError: (error: Error) => {
      console.error("Error adding pantry item:", error);
      toast({ title: error.message || "Failed to add item", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: "Item name is required", variant: "destructive" });
      return;
    }
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

      {/* Shopping List Option (Premium Only) */}
      {isPremium && (
        <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <input
            type="checkbox"
            id="alsoAddToShoppingList"
            checked={alsoAddToShoppingList}
            onChange={(e) => setAlsoAddToShoppingList(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <label htmlFor="alsoAddToShoppingList" className="text-sm font-medium cursor-pointer">
            ✨ Also add to shopping list (for future purchases)
          </label>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={addMutation.isPending}>
        {addMutation.isPending ? "Adding..." : "Add Item"}
      </Button>
    </form>
  );
}
