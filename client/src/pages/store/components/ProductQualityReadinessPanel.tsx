import {
  AlertCircle,
  CheckCircle2,
  Image,
  Layers3,
  PackagePlus,
  PencilLine,
  ShoppingBag,
} from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MarketplaceProduct } from "@/lib/store/marketplaceTypes";

type ProductQualityIssueKey =
  | "missing-image"
  | "missing-description"
  | "missing-category"
  | "out-of-stock"
  | "not-active";

type ProductQualityIssue = {
  key: ProductQualityIssueKey;
  label: string;
};

type ProductQualityAction = {
  product: MarketplaceProduct;
  issues: ProductQualityIssue[];
};

type ProductQualityReadinessPanelProps = {
  products: MarketplaceProduct[];
  productsLoaded: boolean;
};

const hasText = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0;

const hasProductImage = (product: MarketplaceProduct) =>
  Array.isArray(product.images) && product.images.some(hasText);

const hasUsefulDescription = (product: MarketplaceProduct) =>
  hasText(product.description) && product.description.trim().length >= 30;

const hasUsefulCategory = (product: MarketplaceProduct) =>
  hasText(product.category) &&
  product.category.trim().toLowerCase() !== "other";

export function getProductQualityActions(
  products: MarketplaceProduct[],
): ProductQualityAction[] {
  return products
    .map((product) => {
      const issues: ProductQualityIssue[] = [];

      if (!hasProductImage(product)) {
        issues.push({
          key: "missing-image",
          label: "Add a clear product photo",
        });
      }

      if (!hasUsefulDescription(product)) {
        issues.push({
          key: "missing-description",
          label: "Write a fuller description",
        });
      }

      if (!hasUsefulCategory(product)) {
        issues.push({
          key: "missing-category",
          label: "Choose a specific category",
        });
      }

      if (typeof product.inventory === "number" && product.inventory <= 0) {
        issues.push({
          key: "out-of-stock",
          label: "Restock or update inventory",
        });
      }

      if (product.isActive === false) {
        issues.push({
          key: "not-active",
          label: "Make the listing active when ready",
        });
      }

      return { product, issues };
    })
    .filter((action) => action.issues.length > 0)
    .sort((a, b) => b.issues.length - a.issues.length);
}

const iconForIssue = (key: ProductQualityIssueKey) => {
  if (key === "missing-image") return <Image className="h-3.5 w-3.5" />;
  if (key === "missing-category")
    return <Layers3 className="h-3.5 w-3.5" />;
  if (key === "out-of-stock") return <ShoppingBag className="h-3.5 w-3.5" />;
  if (key === "not-active") return <AlertCircle className="h-3.5 w-3.5" />;
  return <PencilLine className="h-3.5 w-3.5" />;
};

export default function ProductQualityReadinessPanel({
  products,
  productsLoaded,
}: ProductQualityReadinessPanelProps) {
  if (!productsLoaded) {
    return (
      <Card className="border-dashed bg-gray-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingBag className="h-4 w-4 text-gray-500" />
            Product Quality Readiness
          </CardTitle>
          <CardDescription>
            Loading product checks from your current catalog.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const qualityActions = getProductQualityActions(products);
  const polishedCount = Math.max(products.length - qualityActions.length, 0);
  const shownActions = qualityActions.slice(0, 4);
  const remainingActions = Math.max(
    qualityActions.length - shownActions.length,
    0,
  );

  return (
    <Card className="border-blue-100 bg-blue-50/40">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingBag className="h-4 w-4 text-blue-600" />
              Product Quality Readiness
            </CardTitle>
            <CardDescription>
              Lightweight listing checks so the catalog feels polished in the storefront.
            </CardDescription>
          </div>
          <Badge
            variant={qualityActions.length === 0 ? "default" : "secondary"}
            className={
              qualityActions.length === 0
                ? "bg-green-600 hover:bg-green-600"
                : ""
            }
          >
            {qualityActions.length === 0
              ? "Products polished"
              : `${qualityActions.length} product${
                  qualityActions.length === 1 ? "" : "s"
                } need attention`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {products.length === 0 ? (
          <div className="flex flex-col gap-3 rounded-lg border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-gray-900">
                No products to review yet
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Add a product first, then this panel will point out any quick
                listing polish.
              </p>
            </div>
            <Link href="/store/products/new">
              <Button className="bg-orange-500 hover:bg-orange-600">
                <PackagePlus className="mr-1.5 h-4 w-4" />
                Add Product
              </Button>
            </Link>
          </div>
        ) : qualityActions.length === 0 ? (
          <div className="flex gap-3 rounded-lg border border-green-100 bg-white p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-gray-900">
                Your current products cover the basics.
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Photos, descriptions, categories, inventory, and active status
                look ready for shoppers.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>
                {polishedCount} of {products.length} products pass these quick
                checks.
              </span>
              <span>
                {qualityActions.length} action
                {qualityActions.length === 1 ? "" : "s"}
              </span>
            </div>
            {shownActions.map(({ product, issues }) => (
              <div key={product.id} className="rounded-lg border bg-white p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {product.name || "Untitled product"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {issues.slice(0, 3).map((issue) => (
                        <Badge
                          key={issue.key}
                          variant="outline"
                          className="gap-1 bg-orange-50 text-orange-700"
                        >
                          {iconForIssue(issue.key)}
                          {issue.label}
                        </Badge>
                      ))}
                      {issues.length > 3 ? (
                        <Badge variant="outline">
                          +{issues.length - 3} more
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <Link href={`/store/products/edit/${product.id}`}>
                    <Button type="button" variant="outline" size="sm">
                      Edit Product
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
            {remainingActions > 0 ? (
              <p className="text-xs text-gray-500">
                {remainingActions} more product
                {remainingActions === 1 ? "" : "s"} also need quick polish. Use
                the product list below to continue.
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
