import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Package, Plus, ScanLine, ChefHat, Calendar, Users, ShoppingCart
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CookingToolsReference from "@/components/meal-planner/CookingToolsReference";
import { useToast } from "@/hooks/use-toast";
import {
  addItemsToGroceryList,
  addScannedPantryItem,
  deletePantryItem,
  fetchAllergenWarnings,
  fetchExpiringPantryItems,
  fetchPantryHousehold,
  updatePantryItem,
} from "./lib/api";
import {
  normalizeAllergenWarningsResponse,
  normalizeExpiringItemsResponse,
  normalizePantryItemsResponse,
} from "./lib/normalizers";
import type { PantryItem } from "./lib/types";
import {
  derivePantryCategories,
  derivePantryLocations,
  derivePantryStats,
  filterPantryItems,
  getExpiryStatus,
} from "./lib/dashboard-helpers";
import {
  buildPantryTabUrl,
  getInitialPantryTab,
  parseScannedPantryItemFromSearch,
} from "./lib/url-state";
import { AddItemForm } from "./components/AddItemForm";
import { PantryStatsCards } from "./components/PantryStatsCards";
import { PantryFilters } from "./components/PantryFilters";
import { PantryInventorySection } from "./components/PantryInventorySection";
import { PantryStatsDialog } from "./components/PantryStatsDialog";
import { ExpiryCalendarDialog } from "./components/ExpiryCalendarDialog";
import { EditPantryItemDialog } from "./components/EditPantryItemDialog";

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
  const [showStatsDialog, setShowStatsDialog] = useState<'total' | 'expiring' | 'expired' | 'runningLow' | null>(null);
  const [itemToEdit, setItemToEdit] = useState<PantryItem | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState(() => getInitialPantryTab(window.location.search));

  // Handle scanned barcode from URL parameters
  useEffect(() => {
    const scannedItem = parseScannedPantryItemFromSearch(window.location.search);

    if (scannedItem) {
      // Show toast that item was scanned
      toast({
        title: "Product Scanned!",
        description: `Adding ${scannedItem.name} to your pantry...`,
      });

      // Add item to pantry
      addScannedPantryItem(scannedItem)
        .then((res) => {
          if (res.ok) {
            toast({
              title: "Success!",
              description: `${scannedItem.name} has been added to your pantry`,
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

  // Fetch allergen warnings for pantry items
  const { data: allergenWarningsData } = useQuery({
    queryKey: ["/api/allergies/pantry/check"],
    queryFn: fetchAllergenWarnings,
    refetchInterval: 60000, // Refresh every minute
  });

  const allergenWarnings = normalizeAllergenWarningsResponse(allergenWarningsData);

  // Helper to get warnings for a specific item
  const getItemWarnings = (itemId: string) => {
    return allergenWarnings.filter((w: any) => w.itemId === itemId);
  };

  // Household membership (so we can share items into a household pantry)
  const { data: householdInfo } = useQuery<any>({
    queryKey: ["/api/pantry/household"],
    queryFn: fetchPantryHousehold,
    staleTime: 60_000,
  });

  const myHouseholdId: string | null = householdInfo?.household?.id ?? null;

  // Fetch expiring items
  const { data: expiringData } = useQuery({
    queryKey: ["/api/pantry/expiring-soon", { days: 7 }],
    queryFn: () => fetchExpiringPantryItems(7),
  });

  const items: PantryItem[] = normalizePantryItemsResponse(pantryData);
  const expiringItems: PantryItem[] = normalizeExpiringItemsResponse(expiringData);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deletePantryItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pantry/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pantry/expiring-soon"] });
      toast({ title: "Item deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete item", variant: "destructive" });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: updatePantryItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pantry/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pantry/expiring-soon"] });
      toast({ title: "Item updated successfully!" });
      setShowEditDialog(false);
      setItemToEdit(null);
    },
    onError: () => {
      toast({ title: "Failed to update item", variant: "destructive" });
    },
  });

  // Add to shopping list mutation
  const addToShoppingListMutation = useMutation({
    mutationFn: addItemsToGroceryList,
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

  const filteredItems = filterPantryItems(items, {
    searchQuery,
    filterCategory,
    filterLocation,
    filterExpiry,
  });
  const categories = derivePantryCategories(items);
  const locations = derivePantryLocations(items);
  const stats = derivePantryStats(items, expiringItems);

  const handleTabChange = (nextTab: string) => {
    setActiveTab(nextTab);
    const nextUrl = buildPantryTabUrl(window.location.pathname, window.location.search, nextTab);
    window.history.replaceState(null, "", nextUrl);
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

        <PantryStatsCards stats={stats} onSelect={setShowStatsDialog} />

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

        <PantryFilters
          searchQuery={searchQuery}
          filterCategory={filterCategory}
          filterLocation={filterLocation}
          filterExpiry={filterExpiry}
          categories={categories}
          locations={locations}
          onSearchQueryChange={setSearchQuery}
          onCategoryChange={setFilterCategory}
          onLocationChange={setFilterLocation}
          onExpiryChange={setFilterExpiry}
        />
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="mb-6 grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="inventory">Pantry Inventory</TabsTrigger>
          <TabsTrigger value="tools">Cooking Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <div data-items-section>
            <PantryInventorySection
              filteredItems={filteredItems}
              searchQuery={searchQuery}
              filterCategory={filterCategory}
              selectedItems={selectedItems}
              getExpiryStatus={getExpiryStatus}
              getItemWarnings={getItemWarnings}
              onToggleItemSelection={toggleItemSelection}
              onEditItem={(item) => {
                setItemToEdit(item);
                setShowEditDialog(true);
              }}
              onDeleteItem={(itemId) => {
                if (confirm("Delete this item?")) {
                  deleteMutation.mutate(itemId);
                }
              }}
              onToggleRunningLow={(item) => {
                updateMutation.mutate({
                  id: item.id,
                  isRunningLow: !item.isRunningLow,
                });
              }}
              onShowAddDialog={() => setShowAddDialog(true)}
            />
          </div>
        </TabsContent>

        <TabsContent value="tools">
          <CookingToolsReference />
        </TabsContent>
      </Tabs>

      <PantryStatsDialog
        showStatsDialog={showStatsDialog}
        items={items}
        expiringItems={expiringItems}
        getExpiryStatus={getExpiryStatus}
        addToShoppingListPending={addToShoppingListMutation.isPending}
        onOpenChange={() => setShowStatsDialog(null)}
        onAddExpiredItemToList={(item) => addToShoppingListMutation.mutate([item])}
      />

      <ExpiryCalendarDialog
        open={showExpiryDialog}
        expiringItems={expiringItems}
        onOpenChange={setShowExpiryDialog}
      />

      <EditPantryItemDialog
        open={showEditDialog}
        itemToEdit={itemToEdit}
        isPending={updateMutation.isPending}
        onOpenChange={setShowEditDialog}
        onItemChange={setItemToEdit}
        onSubmit={() => {
          if (!itemToEdit?.name?.trim()) {
            toast({ title: "Please enter an item name", variant: "destructive" });
            return;
          }
          updateMutation.mutate(itemToEdit);
        }}
      />

    </div>
  );
}
