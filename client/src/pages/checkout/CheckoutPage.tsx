import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import SquarePaymentForm from "@/components/SquarePaymentForm";
import { Package, MapPin, Truck, ShoppingBag, CheckCircle } from "lucide-react";

interface CheckoutPageProps {
  // Product details passed via route state
  productId?: string;
  quantity?: number;
}

export default function CheckoutPage() {
  const { user } = useUser();
  const [location, navigate] = useLocation();
  const { toast } = useToast();

  // Get product from URL params
  const params = new URLSearchParams(window.location.search);
  const productId = params.get("productId");
  const quantity = parseInt(params.get("quantity") || "1");

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"details" | "payment" | "success">("details");
  const [orderId, setOrderId] = useState<string | null>(null);

  // Form state
  const [fulfillmentMethod, setFulfillmentMethod] = useState<"shipping" | "local_pickup">("shipping");
  const [shippingAddress, setShippingAddress] = useState({
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "USA",
  });

  useEffect(() => {
    if (productId) {
      fetchProduct();
    } else {
      navigate("/marketplace");
    }
  }, [productId]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/marketplace/products/${productId}`);
      if (response.ok) {
        const data = await response.json();
        setProduct(data);
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
        description: "Failed to load product details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    if (!product) return 0;
    const subtotal = parseFloat(product.price) * quantity;
    const shipping =
      fulfillmentMethod === "shipping" && product.shippingCost
        ? parseFloat(product.shippingCost)
        : 0;
    return subtotal + shipping;
  };

  const handleCreateOrder = async () => {
    if (!user) {
      toast({
        title: "Please log in",
        description: "You must be logged in to place an order",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    try {
      const orderData: any = {
        productId,
        quantity,
        fulfillmentMethod,
      };

      if (fulfillmentMethod === "shipping") {
        if (!shippingAddress.street || !shippingAddress.city || !shippingAddress.zipCode) {
          toast({
            title: "Missing information",
            description: "Please fill in all shipping address fields",
            variant: "destructive",
          });
          return;
        }
        orderData.shippingAddress = shippingAddress;
      }

      const response = await fetch("/api/orders/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(orderData),
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        setOrderId(data.order.id);
        setStep("payment");
        toast({
          title: "Order created",
          description: "Please complete payment to confirm your order",
        });
      } else {
        throw new Error(data.error || "Failed to create order");
      }
    } catch (error: any) {
      console.error("Order creation error:", error);
      toast({
        title: "Failed to create order",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePaymentSuccess = () => {
    setStep("success");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading checkout...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  if (step === "success") {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <Card className="border-2 border-green-200 bg-green-50">
            <CardContent className="pt-12 pb-12 text-center">
              <CheckCircle className="h-20 w-20 text-green-600 mx-auto mb-6" />
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Confirmed!</h1>
              <p className="text-gray-600 mb-6">
                Thank you for your purchase. You'll receive an email confirmation shortly.
              </p>
              <div className="space-y-3">
                <Button
                  onClick={() => navigate("/orders/my-purchases")}
                  className="bg-orange-500 hover:bg-orange-600 w-full max-w-xs"
                >
                  View My Orders
                </Button>
                <Button
                  onClick={() => navigate("/marketplace")}
                  variant="outline"
                  className="w-full max-w-xs"
                >
                  Continue Shopping
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === "payment") {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Complete Payment</h1>

          <div className="grid gap-6">
            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-gray-200 rounded flex items-center justify-center">
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <Package className="h-8 w-8 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{product.name}</h3>
                    <p className="text-sm text-gray-600">Quantity: {quantity}</p>
                    <p className="text-sm font-medium mt-1">
                      ${parseFloat(product.price).toFixed(2)} each
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>${(parseFloat(product.price) * quantity).toFixed(2)}</span>
                  </div>
                  {fulfillmentMethod === "shipping" && product.shippingCost && (
                    <div className="flex justify-between text-sm">
                      <span>Shipping</span>
                      <span>${parseFloat(product.shippingCost).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total</span>
                    <span>${calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Form */}
            <div className="flex justify-center">
              <SquarePaymentForm
                amount={calculateTotal()}
                orderId={orderId!}
                onPaymentSuccess={handlePaymentSuccess}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Details step
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left column - Form */}
          <div className="md:col-span-2 space-y-6">
            {/* Product Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  Order Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div className="w-24 h-24 bg-gray-200 rounded flex items-center justify-center">
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <Package className="h-10 w-10 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{product.name}</h3>
                    <p className="text-gray-600 text-sm mt-1">{product.description}</p>
                    <p className="text-lg font-bold text-orange-600 mt-2">
                      ${parseFloat(product.price).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    max={product.inventory || 100}
                    value={quantity}
                    disabled
                    className="w-32"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Fulfillment Method */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Delivery Method
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={fulfillmentMethod} onValueChange={(v: any) => setFulfillmentMethod(v)}>
                  {product.shippingEnabled && (
                    <div className="flex items-center space-x-2 border rounded-lg p-4 hover:bg-gray-50">
                      <RadioGroupItem value="shipping" id="shipping" />
                      <Label htmlFor="shipping" className="flex-1 cursor-pointer">
                        <div className="font-medium">Shipping</div>
                        <div className="text-sm text-gray-600">
                          {product.shippingCost
                            ? `$${parseFloat(product.shippingCost).toFixed(2)}`
                            : "Free shipping"}
                        </div>
                      </Label>
                    </div>
                  )}

                  {product.localPickupEnabled && (
                    <div className="flex items-center space-x-2 border rounded-lg p-4 hover:bg-gray-50">
                      <RadioGroupItem value="local_pickup" id="pickup" />
                      <Label htmlFor="pickup" className="flex-1 cursor-pointer">
                        <div className="font-medium">Local Pickup</div>
                        <div className="text-sm text-gray-600">
                          {product.pickupLocation || "Pick up in person"}
                        </div>
                      </Label>
                    </div>
                  )}
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Shipping Address */}
            {fulfillmentMethod === "shipping" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Shipping Address
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="street">Street Address</Label>
                    <Input
                      id="street"
                      value={shippingAddress.street}
                      onChange={(e) =>
                        setShippingAddress({ ...shippingAddress, street: e.target.value })
                      }
                      placeholder="123 Main St"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={shippingAddress.city}
                        onChange={(e) =>
                          setShippingAddress({ ...shippingAddress, city: e.target.value })
                        }
                        placeholder="New York"
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={shippingAddress.state}
                        onChange={(e) =>
                          setShippingAddress({ ...shippingAddress, state: e.target.value })
                        }
                        placeholder="NY"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="zipCode">ZIP Code</Label>
                      <Input
                        id="zipCode"
                        value={shippingAddress.zipCode}
                        onChange={(e) =>
                          setShippingAddress({ ...shippingAddress, zipCode: e.target.value })
                        }
                        placeholder="10001"
                      />
                    </div>
                    <div>
                      <Label htmlFor="country">Country</Label>
                      <Input id="country" value={shippingAddress.country} disabled />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column - Summary */}
          <div>
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal ({quantity}x)</span>
                    <span>${(parseFloat(product.price) * quantity).toFixed(2)}</span>
                  </div>

                  {fulfillmentMethod === "shipping" && product.shippingCost && (
                    <div className="flex justify-between text-sm">
                      <span>Shipping</span>
                      <span>${parseFloat(product.shippingCost).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="border-t pt-2 flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-orange-600">${calculateTotal().toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  onClick={handleCreateOrder}
                  className="w-full bg-orange-500 hover:bg-orange-600"
                >
                  Continue to Payment
                </Button>

                <p className="text-xs text-gray-500 text-center">
                  Secure checkout powered by Square
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
