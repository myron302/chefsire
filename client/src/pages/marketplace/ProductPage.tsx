import React, { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import {
  Package,
  ShoppingCart,
  MapPin,
  Truck,
  Star,
  ArrowLeft,
  Minus,
  Plus,
  Edit,
} from "lucide-react";

export default function ProductPage() {
  const [, params] = useRoute("/marketplace/product/:id");
  const [location, navigate] = useLocation();
  const { user } = useUser();
  const { toast } = useToast();

  const [product, setProduct] = useState<any>(null);
  const [seller, setSeller] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (params?.id) {
      fetchProduct(params.id);
    }
  }, [params?.id]);

  const fetchProduct = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/marketplace/products/${id}`);
      if (response.ok) {
        const data = await response.json();
        setProduct(data.product || data);
        if (data.seller) {
          setSeller(data.seller);
        }
      } else {
        toast({
          title: "Product not found",
          description: "This product may no longer be available",
          variant: "destructive",
        });
        navigate("/marketplace");
      }
    } catch (error) {
      console.error("Error fetching product:", error);
      toast({
        title: "Error",
        description: "Failed to load product",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBuyNow = () => {
    if (!user) {
      toast({
        title: "Please log in",
        description: "You must be logged in to make a purchase",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    // Navigate to checkout with product details
    navigate(`/checkout?productId=${product.id}&quantity=${quantity}`);
  };

  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && (!product.inventory || newQuantity <= product.inventory)) {
      setQuantity(newQuantity);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  const price = parseFloat(product.price);
  const total = price * quantity;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back button and Edit */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/marketplace")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Marketplace
          </Button>

          {user && product.sellerId === user.id && (
            <Button
              variant="outline"
              onClick={() => navigate(`/store/products/edit/${product.id}`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Product
            </Button>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left - Images */}
          <div>
            <Card>
              <CardContent className="p-6">
                <div className="aspect-square bg-gray-200 rounded-lg flex items-center justify-center mb-4">
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <Package className="h-32 w-32 text-gray-400" />
                  )}
                </div>

                {product.images && product.images.length > 1 && (
                  <div className="grid grid-cols-4 gap-2">
                    {product.images.slice(1, 5).map((img: string, idx: number) => (
                      <div
                        key={idx}
                        className="aspect-square bg-gray-200 rounded-lg overflow-hidden"
                      >
                        <img
                          src={img}
                          alt={`${product.name} ${idx + 2}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Seller Info */}
            {seller && (
              <Card className="mt-4">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-3">Sold by</h3>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                      {seller.avatar ? (
                        <img
                          src={seller.avatar}
                          alt={seller.username}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-bold text-gray-600">
                          {seller.username?.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">
                        {seller.displayName || seller.username}
                      </p>
                      {seller.isChef && (
                        <Badge variant="secondary" className="mt-1">
                          Verified Chef
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right - Details */}
          <div className="space-y-6">
            <div>
              <Badge className="mb-3 bg-orange-500">{product.category}</Badge>
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                {product.name}
              </h1>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-4xl font-bold text-orange-600">
                  ${price.toFixed(2)}
                </span>
                {quantity > 1 && (
                  <span className="text-xl text-gray-600">
                    (${total.toFixed(2)} total)
                  </span>
                )}
              </div>

              {product.description && (
                <p className="text-gray-700 text-lg leading-relaxed mb-6">
                  {product.description}
                </p>
              )}
            </div>

            {/* Quantity */}
            <Card>
              <CardContent className="p-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Quantity
                </label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-2xl font-bold w-16 text-center">
                    {quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleQuantityChange(1)}
                    disabled={
                      product.inventory !== null && quantity >= product.inventory
                    }
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  {product.inventory !== null && (
                    <span className="text-sm text-gray-600 ml-4">
                      {product.inventory} available
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Shipping */}
            <Card>
              <CardContent className="p-6 space-y-3">
                <h3 className="font-semibold mb-3">Delivery Options</h3>

                {product.shippingEnabled && (
                  <div className="flex items-start gap-3">
                    <Truck className="h-5 w-5 text-gray-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Shipping Available</p>
                      <p className="text-sm text-gray-600">
                        {product.shippingCost
                          ? `$${parseFloat(product.shippingCost).toFixed(2)} shipping`
                          : "Free shipping"}
                      </p>
                    </div>
                  </div>
                )}

                {product.localPickupEnabled && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-gray-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Local Pickup</p>
                      <p className="text-sm text-gray-600">
                        {product.pickupLocation || "Available for pickup"}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="space-y-3">
              <Button
                onClick={handleBuyNow}
                className="w-full bg-orange-500 hover:bg-orange-600 text-lg py-6"
                disabled={!product.isActive}
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                Buy Now - ${total.toFixed(2)}
              </Button>

              {!product.isActive && (
                <p className="text-center text-red-600 text-sm">
                  This product is currently unavailable
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
