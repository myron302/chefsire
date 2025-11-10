import React, { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';

export default function ProductFormPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/store/products/:id');
  const productId = params?.id === 'new' ? null : params?.id;

  const [loading, setLoading] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(!!productId);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    inventory: '',
    category: '',
    imageUrl: ''
  });

  useEffect(() => {
    if (productId) {
      loadProduct();
    }
  }, [productId]);

  const loadProduct = async () => {
    try {
      const response = await fetch(`/api/marketplace/products/${productId}`);
      if (response.ok) {
        const data = await response.json();
        setFormData({
          name: data.name || '',
          description: data.description || '',
          price: data.price?.toString() || '',
          inventory: data.inventory?.toString() || '',
          category: data.category || '',
          imageUrl: data.imageUrl || ''
        });
      }
    } catch (error) {
      console.error('Error loading product:', error);
      toast({
        title: "Error",
        description: "Failed to load product",
        variant: "destructive"
      });
    } finally {
      setLoadingProduct(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Not logged in",
        description: "Please log in to manage products",
        variant: "destructive"
      });
      return;
    }

    // Validation
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Product name is required",
        variant: "destructive"
      });
      return;
    }

    const price = parseFloat(formData.price);
    if (isNaN(price) || price <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid price",
        variant: "destructive"
      });
      return;
    }

    const inventory = parseInt(formData.inventory);
    if (isNaN(inventory) || inventory < 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid inventory amount",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const url = productId
        ? `/api/marketplace/products/${productId}`
        : '/api/marketplace/products';

      const method = productId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          price: price,
          inventory: inventory,
          category: formData.category.trim() || 'general',
          imageUrl: formData.imageUrl.trim() || null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || 'Failed to save product',
          variant: "destructive"
        });
        return;
      }

      toast({
        title: productId ? "Product Updated" : "Product Created",
        description: `${formData.name} has been ${productId ? 'updated' : 'added to your store'}`,
      });

      // Redirect to store dashboard
      setTimeout(() => setLocation('/store/dashboard'), 1000);
    } catch (error) {
      console.error('Error saving product:', error);
      toast({
        title: "Error",
        description: "An error occurred while saving the product",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loadingProduct) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="mx-auto w-12 h-12 text-orange-500 animate-spin" />
          <p className="mt-4 text-gray-600">Loading product...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => setLocation('/store/dashboard')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold">
            {productId ? 'Edit Product' : 'Add New Product'}
          </h1>
          <p className="text-gray-600 mt-2">
            {productId ? 'Update your product details' : 'Add a new product to your store'}
          </p>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
            <CardDescription>
              Fill in the information about your product
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Product Name */}
              <div>
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Chocolate Chip Cookies"
                  required
                  className="mt-1"
                />
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe your product..."
                  rows={4}
                  className="mt-1"
                />
              </div>

              {/* Price and Inventory Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Price ($) *</Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="inventory">Inventory *</Label>
                  <Input
                    id="inventory"
                    name="inventory"
                    type="number"
                    min="0"
                    value={formData.inventory}
                    onChange={handleInputChange}
                    placeholder="0"
                    required
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  placeholder="e.g., Baked Goods, Spices, Ingredients"
                  className="mt-1"
                />
              </div>

              {/* Image URL */}
              <div>
                <Label htmlFor="imageUrl">Image URL (optional)</Label>
                <Input
                  id="imageUrl"
                  name="imageUrl"
                  type="url"
                  value={formData.imageUrl}
                  onChange={handleInputChange}
                  placeholder="https://example.com/image.jpg"
                  className="mt-1"
                />
                {formData.imageUrl && (
                  <div className="mt-2">
                    <img
                      src={formData.imageUrl}
                      alt="Preview"
                      className="w-32 h-32 object-cover rounded-lg border"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation('/store/dashboard')}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    productId ? 'Update Product' : 'Add Product'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
