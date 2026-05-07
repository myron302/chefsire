import {
  AlertCircle,
  CheckCircle2,
  Image,
  Layers3,
  PackagePlus,
  PencilLine,
  Star,
  Store as StoreIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { MarketplaceProduct } from "@/lib/store/marketplaceTypes";

type ReadinessAction =
  | "description"
  | "banner"
  | "featured"
  | "category"
  | "product"
  | "publish";

type StoreReadinessPanelProps = {
  store: any;
  products?: MarketplaceProduct[];
  productsLoaded: boolean;
  onAction: (action: ReadinessAction) => void;
};

type ReadinessSignal = {
  key: string;
  label: string;
  description: string;
  status: "ready" | "attention";
  action?: {
    label: string;
    type: ReadinessAction;
  };
};

const hasText = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0;

const getLayoutObject = (store: any): Record<string, any> => {
  const layout = store?.layout;
  return layout && typeof layout === "object" && !Array.isArray(layout)
    ? layout
    : {};
};

const hasFeaturedField = (products: MarketplaceProduct[]) =>
  products.some((product) =>
    Object.prototype.hasOwnProperty.call(product, "isFeatured"),
  );

export function getStoreReadinessSignals(
  store: any,
  products: MarketplaceProduct[] | undefined,
  productsLoaded: boolean,
): ReadinessSignal[] {
  const layout = getLayoutObject(store);
  const productList = productsLoaded ? products || [] : undefined;
  const signals: ReadinessSignal[] = [];

  const hasDescription =
    hasText(store?.bio) ||
    (layout.aboutEnabled === true && hasText(layout.aboutContent));
  if (!hasDescription) {
    signals.push({
      key: "missing-description",
      label: "Store is missing a description",
      description:
        "Add a short bio or about section so shoppers know what you sell.",
      status: "attention",
      action: { label: "Add Description", type: "description" },
    });
  }

  const bannerIsEnabled = layout.showBanner !== false;
  if (bannerIsEnabled && !hasText(layout.bannerImage)) {
    signals.push({
      key: "missing-banner",
      label: "Add a banner image",
      description:
        "A hero banner makes the storefront feel more polished at a glance.",
      status: "attention",
      action: { label: "Upload Banner", type: "banner" },
    });
  }

  if (productList) {
    if (productList.length === 0) {
      signals.push({
        key: "missing-products",
        label: "Add your first product",
        description:
          "Your store needs at least one product before shoppers have something to browse.",
        status: "attention",
        action: { label: "Add First Product", type: "product" },
      });
    } else if (productList.length < 3) {
      signals.push({
        key: "catalog-depth",
        label: "Add more products to improve discovery",
        description: `${productList.length} product${productList.length === 1 ? "" : "s"} listed. A few more items can make the store feel fuller.`,
        status: "attention",
        action: { label: "Add Product", type: "product" },
      });
    }

    const categoryCount = new Set(
      productList
        .map((product) => product.category)
        .filter(
          (category) =>
            hasText(category) && category.trim().toLowerCase() !== "other",
        ),
    ).size;
    if (productList.length > 0 && categoryCount === 0) {
      signals.push({
        key: "missing-categories",
        label: "Store has no categories yet",
        description:
          "Use product categories to help customers understand your catalog quickly.",
        status: "attention",
        action: { label: "Create Category", type: "category" },
      });
    }

    if (
      productList.length > 0 &&
      hasFeaturedField(productList) &&
      !productList.some((product) => product.isFeatured)
    ) {
      signals.push({
        key: "missing-featured-products",
        label: "No featured products selected",
        description:
          "Feature one strong product to give new shoppers a clear starting point.",
        status: "attention",
        action: { label: "Add Featured Product", type: "featured" },
      });
    }
  }

  if (store?.published === false) {
    signals.push({
      key: "not-published",
      label: "Store is not published",
      description:
        "Publish when the basics look good so customers can see your storefront.",
      status: "attention",
      action: { label: "Publish Store", type: "publish" },
    });
  }

  if (signals.length === 0) {
    signals.push({
      key: "ready",
      label: "Store looks ready to publish ✅",
      description: store?.published
        ? "Basics, catalog signals, and visibility look good."
        : "Basics and catalog signals look good.",
      status: "ready",
    });
  }

  return signals;
}

const iconForSignal = (signal: ReadinessSignal) => {
  if (signal.status === "ready")
    return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (signal.key.includes("description"))
    return <PencilLine className="h-4 w-4 text-orange-500" />;
  if (signal.key.includes("banner"))
    return <Image className="h-4 w-4 text-orange-500" />;
  if (signal.key.includes("categor"))
    return <Layers3 className="h-4 w-4 text-orange-500" />;
  if (signal.key.includes("featured"))
    return <Star className="h-4 w-4 text-orange-500" />;
  if (signal.key.includes("product"))
    return <PackagePlus className="h-4 w-4 text-orange-500" />;
  return <AlertCircle className="h-4 w-4 text-orange-500" />;
};

export default function StoreReadinessPanel({
  store,
  products,
  productsLoaded,
  onAction,
}: StoreReadinessPanelProps) {
  const signals = getStoreReadinessSignals(store, products, productsLoaded);
  const attentionSignals = signals.filter(
    (signal) => signal.status === "attention",
  );
  const ready = attentionSignals.length === 0;
  const totalChecks = ready ? signals.length : signals.length + 1;
  const completedChecks = ready
    ? signals.length
    : Math.max(totalChecks - attentionSignals.length, 0);
  const progress =
    totalChecks > 0 ? Math.round((completedChecks / totalChecks) * 100) : 0;

  return (
    <Card className="border-orange-200 bg-gradient-to-r from-orange-50 via-white to-blue-50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <StoreIcon className="h-5 w-5 text-orange-600" />
              Store Readiness + Fix It
            </CardTitle>
            <CardDescription>
              Lightweight checks to polish your storefront before sharing it.
            </CardDescription>
          </div>
          <Badge
            variant={ready ? "default" : "secondary"}
            className={ready ? "bg-green-600 hover:bg-green-600" : ""}
          >
            {ready ? "Ready" : `${attentionSignals.length} to fix`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Readiness progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {signals.map((signal) => (
            <div key={signal.key} className="rounded-lg border bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-2">
                  <div className="mt-0.5">{iconForSignal(signal)}</div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {signal.label}
                    </p>
                    <p className="mt-1 text-xs text-gray-600">
                      {signal.description}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {signal.status === "ready" ? "Ready" : "Fix It"}
                </Badge>
              </div>
              {signal.action && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => onAction(signal.action!.type)}
                >
                  {signal.action.label}
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
