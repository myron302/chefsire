// client/src/pages/pantry/index.tsx
import * as React from "react";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";

import {
  ScanLine,
  AlertCircle,
  CalendarDays,
  Clock,
  XCircle,
  Check,
} from "lucide-react";

type PantryItem = {
  id: string;
  name: string;
  category?: string;
  quantity?: number;
  unit?: string;
  location?: string;
  expirationDate?: string | null;
  notes?: string;
  isRunningLow?: boolean;
};

export default function PantryPage() {
  const [q, setQ] = useState("");
  const [showExpiryDialog, setShowExpiryDialog] = useState(false);
  const queryClient = useQueryClient();

  // ---------- Queries ----------
  const itemsQuery = useQuery({
    queryKey: ["/api/pantry/items"],
    queryFn: async (): Promise<PantryItem[]> => {
      const res = await fetch("/api/pantry/items", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch items");
      return res.json();
    },
  });

  const expiringSoonQuery = useQuery({
    queryKey: ["/api/pantry/expiring-soon?days=7"],
    queryFn: async (): Promise<PantryItem[]> => {
      const res = await fetch("/api/pantry/expiring-soon?days=7", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch expiring items");
      return res.json();
    },
  });

  const runningLowQuery = useQuery({
    queryKey: ["/api/pantry/running-low"],
    queryFn: async (): Promise<PantryItem[]> => {
      const res = await fetch("/api/pantry/running-low", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch low items");
      return res.json();
    },
  });

  const items = itemsQuery.data ?? [];
  const expiringItems = expiringSoonQuery.data ?? [];
  const runningLowItems = runningLowQuery.data ?? [];

  const filtered = useMemo(
    () =>
      !q
        ? items
        : items.filter((i) =>
            [i.name, i.category, i.location, i.unit]
              .filter(Boolean)
              .some((s) => s!.toLowerCase().includes(q.toLowerCase()))
          ),
    [items, q]
  );

  // ---------- Mutations ----------
  const patchRunningLow = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: boolean }) => {
      const res = await fetch(`/api/pantry/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isRunningLow: next }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pantry/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pantry/running-low"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pantry/expiring-soon?days=7"] });
      toast({ title: "Updated!" });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  // ---------- UI ----------
  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pantry</h1>
          <p className="text-muted-foreground">Track ingredients, reduce waste, cook smarter</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Link href="/pantry/scanner" className="flex-1 md:flex-none">
            <Button variant="outline" className="w-full md:w-auto">
              <ScanLine className="w-4 h-4 mr-2" />
              Scan Barcode
            </Button>
          </Link>
          <Button variant="outline" onClick={() => setShowExpiryDialog(true)}>
            <CalendarDays className="w-4 h-4 mr-2" />
            Expiry Calendar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle>Total</CardTitle></CardHeader>
          <CardContent>{items.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle>Expiring (7d)</CardTitle></CardHeader>
          <CardContent>{expiringItems.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle>Running Low</CardTitle></CardHeader>
          <CardContent>{runningLowItems.length}</CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <Input
          placeholder="Search by name, category, location"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* List */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => {
          const exp = item.expirationDate ? new Date(item.expirationDate) : null;
          const daysLeft =
            exp ? Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

          return (
            <Card key={item.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="truncate">{item.name}</CardTitle>
                  <div className="flex gap-2">
                    {daysLeft !== null && (
                      <Badge variant={daysLeft <= 3 ? "destructive" : "secondary"}>
                        <Clock className="w-3 h-3 mr-1" />
                        {daysLeft}d
                      </Badge>
                    )}
                    {item.isRunningLow && (
                      <Badge variant="secondary">Low</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <div className="text-sm text-muted-foreground space-x-2">
                  {item.category && <span>#{item.category}</span>}
                  {item.location && <span>@{item.location}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {typeof item.quantity === "number" ? (
                    <Badge variant="outline">{item.quantity} {item.unit || ""}</Badge>
                  ) : (
                    <Badge variant="outline">—</Badge>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant={item.isRunningLow ? "default" : "outline"}
                    size="sm"
                    onClick={() => patchRunningLow.mutate({ id: item.id, next: !item.isRunningLow })}
                  >
                    {item.isRunningLow ? <Check className="w-4 h-4 mr-1" /> : <AlertCircle className="w-4 h-4 mr-1" />}
                    {item.isRunningLow ? "Running Low ✓" : "Mark Low"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Expiry Calendar Dialog */}
      <Dialog open={showExpiryDialog} onOpenChange={setShowExpiryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Expiry Calendar (Next 7 Days)</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {expiringItems.length === 0 ? (
              <p className="text-muted-foreground">Nothing expiring soon.</p>
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
                .sort(([a], [b]) => a.localeCompare(b))
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
                            {typeof i.quantity === "number" && i.unit ? `${i.quantity} ${i.unit}` : "—"}
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
    </div>
  );
}
