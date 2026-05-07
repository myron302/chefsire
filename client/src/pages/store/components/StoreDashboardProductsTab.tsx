import { Link } from "wouter";
import { Plus } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProductManager } from "@/components/store/ProductManager";
import type { MarketplaceProduct } from "@/lib/store/marketplaceTypes";
import ProductQualityReadinessPanel from "./ProductQualityReadinessPanel";

type StoreDashboardProductsTabProps = {
  sellerId: number;
  totalProducts: number;
  products: MarketplaceProduct[];
  productsLoaded: boolean;
};

export default function StoreDashboardProductsTab({
  sellerId,
  totalProducts,
  products,
  productsLoaded,
}: StoreDashboardProductsTabProps) {
  return (
    <div className="space-y-4">
      <ProductQualityReadinessPanel
        products={products}
        productsLoaded={productsLoaded}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Product Management</CardTitle>
              <CardDescription>Manage your store's product listings</CardDescription>
            </div>
            <Link href="/store/products/new">
              <Button className="bg-orange-500 hover:bg-orange-600">
                <Plus className="w-4 h-4 mr-1.5" />
                {totalProducts === 0 ? "Add First Product" : "Add Product"}
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <ProductManager sellerId={sellerId} />
        </CardContent>
      </Card>
    </div>
  );
}
