import React, { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Star,
  Store,
  MapPin,
  Truck,
  Download,
  ShoppingCart,
  Heart,
  Share2,
  Eye,
  Package
} from "lucide-react";

interface ProductData {
  id: number;
  name: string;
  description: string;
  price: string;
  images: string[];
  sellerId: number;
  sellerName: string;
  storeName?: string;
  storeHandle?: string;
  category: string;
  productCategory: string;
  deliveryMethods: string[];
  rating?: number;
  reviewCount?: number;
  location?: string;
  shippingEnabled?: boolean;
  localPickupEnabled?: boolean;
  inStoreOnly?: boolean;
  isDigital?: boolean;
  viewCount?: number;
  favoriteCount?: number;
  tags?: string[];
  digitalDownloadUrl?: string;
  digitalFileName?: string;
  digitalFileSize?: number;
  inventory?: number;
  createdAt: string;
}

export default function ProductPage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/product/:id");
  const { toast } = useToast();

  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);

  const productId = params?.id;

  const fetchProduct = async () => {
    if (!productId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/marketplace/products/${productId}`);

      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: "Product not found",
            description: "This product doesn't exist or has been removed.",
            variant: "destructive"
          });
          setLocation("/marketplace");
          return;
        }
        throw new Error("Failed to fetch product");
      }

      const productData = await response.json();
      setProduct(productData);
    } catch (error) {
      console.error("Error fetching product:", error);
      toast({
        title: "Error",
        description: "Failed to load product. Please try again.",
        variant: "destructive"
      });
      setLocation("/marketplace");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const handleAddToCart = () => {
    toast({
      title: "Added to cart",
      description: `${product?.name} has been added to your cart.`
    });
  };

  const handleFavorite = () => {
    setIsFavorited(!isFavorited);
    toast({
      title: isFavorited ? "Removed from favorites" : "Added to favorites",
      description: `${product?.name} has been ${isFavorited ? "removed from" : "added to"} your favorites.`
    });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product?.name,
        text: product?.description,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copied",
        description: "Product link has been copied to clipboard."
      });
    }
  };

  const getDeliveryIcon = (method: string) => {
    switch (method) {
      case "shipping":
        return <Truck className="w-4 h-4" />;
      case "local_pickup":
        return <MapPin className="w-4 h-4" />;
      case "digital":
        return <Download className="w-4 h-4" />;
      case "in_store":
        return <Store className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  if (!match) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-32 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Skeleton className="h-96 w-full" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => setLocation("/marketplace")}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Marketplace
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Images */}
          <div>
            <Card className="mb-4">
              <CardContent className="p-0">
                <img
                  src={product.images?.[selectedImage] || "/placeholder-product.jpg"}
                  alt={product.name}
                  className="w-full h-96 object-cover rounded-lg"
                />
              </CardContent>
            </Card>

            {product.images?.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${
                      selectedImage === index ? "border-blue-500" : "border-gray-200"
                    }`}
                  >
                    <img
                      src={image}
                      alt={`${product.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Details */}
          <div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
                <div className="flex items-center gap-4 mb-2">
                  <span className="text-3xl font-bold text-green-600">
                    ${product.price}
                  </span>
                  {product.inventory !== undefined && (
                    <Badge variant={product.inventory > 0 ? "default" : "destructive"}>
                      {product.inventory > 0 ? `${product.inventory} in stock` : "Out of stock"}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleFavorite}>
                  <Heart className={`w-4 h-4 ${isFavorited ? "fill-current text-red-500" : ""}`} />
                </Button>
                <Button size="sm" variant="outline" onClick={handleShare}>
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center gap-1">
                <Star className="w-5 h-5 text-yellow-500 fill-current" />
                <span className="font-semibold">{product.rating || 0}</span>
              </div>
              <span className="text-gray-500">
                ({product.reviewCount || 0} reviews)
              </span>
              {typeof product.viewCount === "number" && (
                <div className="flex items-center gap-1 text-gray-500">
                  <Eye className="w-4 h-4" />
                  <span>{product.viewCount}</span>
                </div>
              )}
            </div>

            {/* Seller Info */}
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Store className="w-8 h-8 text-gray-500" />
                    <div>
                      <p className="font-semibold">{product.sellerName}</p>
                      {product.storeName && (
                        <p className="text-sm text-gray-600">{product.storeName}</p>
                      )}
                      {product.location && (
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {product.location}
                        </p>
                      )}
                    </div>
                  </div>

                  {product.storeHandle && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation(`/store/${product.storeHandle}`)}
                    >
                      Visit Store
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Delivery Methods */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Delivery Options</h3>
              <div className="flex flex-wrap gap-2">
                {product.deliveryMethods?.map((method, index) => (
                  <Badge key={index} variant="outline" className="flex items-center gap-1">
                    {getDeliveryIcon(method)}
                    {method.replace("_", " ")}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Description</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{product.description}</p>
            </div>

            {/* Tags */}
            {product.tags && product.tags.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {product.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <Button
                className="w-full"
                size="lg"
                onClick={handleAddToCart}
                disabled={product.inventory !== undefined && product.inventory <= 0}
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Add to Cart
              </Button>

              {product.isDigital && product.digitalDownloadUrl && (
                <Button className="w-full" size="lg" variant="outline">
                  <Download className="w-5 h-5 mr-2" />
                  Download Now
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
