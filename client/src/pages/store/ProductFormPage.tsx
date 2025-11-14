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
  const [, paramsNew] = useRoute('/store/products/new');
  const [, paramsEdit] = useRoute('/store/products/edit/:id');
  const productId = paramsEdit?.id || null;

  const [loading, setLoading] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(!!productId);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    inventory: '',
    category: '',
    images: [] as string[],
    productCategory: 'physical',
    deliveryMethods: ['shipped'] as string[],
    digitalFileUrl: '',
    digitalFileName: ''
  });

  // Auto-select digital download when product category changes to digital
  useEffect(() => {
    if (formData.productCategory === 'digital' || formData.productCategory === 'cookbook') {
      setFormData(prev => ({
        ...prev,
        deliveryMethods: ['digital_download']
      }));
    } else if (formData.deliveryMethods.includes('digital_download') &&
               formData.productCategory !== 'digital' &&
               formData.productCategory !== 'cookbook') {
      // Remove digital_download if changing back to physical
      setFormData(prev => ({
        ...prev,
        deliveryMethods: ['shipped']
      }));
    }
  }, [formData.productCategory]);

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
          images: data.images || [],
          productCategory: data.productCategory || 'physical',
          deliveryMethods: data.deliveryMethods || ['shipped'],
          digitalFileUrl: data.digitalFileUrl || '',
          digitalFileName: data.digitalFileName || ''
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDeliveryMethodToggle = (method: string) => {
    setFormData(prev => {
      const methods = prev.deliveryMethods.includes(method)
        ? prev.deliveryMethods.filter(m => m !== method)
        : [...prev.deliveryMethods, method];

      // Ensure at least one method is selected
      return {
        ...prev,
        deliveryMethods: methods.length > 0 ? methods : prev.deliveryMethods
      };
    });
  };

  const handleRemoveImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
    toast({
      title: "Image Removed",
      description: "Image removed successfully"
    });
  };

  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an image file (JPG, PNG, GIF, etc.)",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 10MB for images)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 10MB",
        variant: "destructive"
      });
      return;
    }

    if (formData.images.length >= 5) {
      toast({
        title: "Limit Reached",
        description: "You can add up to 5 images per product",
        variant: "destructive"
      });
      return;
    }

    setUploadingFile(true);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: uploadFormData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Upload failed with status ${response.status}`);
      }

      setFormData(prev => ({
        ...prev,
        images: [...prev.images, data.url]
      }));

      toast({
        title: "Image Uploaded",
        description: `${file.name} uploaded successfully`
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to upload image. Please try again.";
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setUploadingFile(false);
      // Reset the file input
      e.target.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 100MB",
        variant: "destructive"
      });
      return;
    }

    setUploadingFile(true);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: uploadFormData
      });

      const data = await response.json();

      if (!response.ok) {
        // Show specific error from server if available
        throw new Error(data.error || `Upload failed with status ${response.status}`);
      }

      setFormData(prev => ({
        ...prev,
        digitalFileUrl: data.url,
        digitalFileName: file.name
      }));

      toast({
        title: "File uploaded",
        description: `${file.name} uploaded successfully`
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to upload file. Please try again.";
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setUploadingFile(false);
      // Reset the file input so the same file can be selected again if needed
      e.target.value = '';
    }
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

    // Validate delivery methods
    if (formData.deliveryMethods.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one delivery method",
        variant: "destructive"
      });
      return;
    }

    // Validate digital products
    if ((formData.productCategory === 'digital' || formData.productCategory === 'cookbook') &&
        !formData.digitalFileUrl.trim()) {
      toast({
        title: "Validation Error",
        description: "Digital products require a file URL",
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
          price: formData.price.trim(),
          inventory: inventory,
          category: formData.category.trim() || 'other',
          images: formData.images,
          productCategory: formData.productCategory,
          deliveryMethods: formData.deliveryMethods,
          digitalFileUrl: formData.digitalFileUrl.trim() || null,
          digitalFileName: formData.digitalFileName.trim() || null,
          isDigital: formData.productCategory === 'digital' || formData.productCategory === 'cookbook',
          inStoreOnly: formData.deliveryMethods.length === 1 &&
                       (formData.deliveryMethods[0] === 'pickup' || formData.deliveryMethods[0] === 'in_store')
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
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select a category</option>
                  <option value="spices">Spices & Seasonings</option>
                  <option value="ingredients">Ingredients</option>
                  <option value="cookware">Cookware & Tools</option>
                  <option value="cookbooks">Cookbooks</option>
                  <option value="sauces">Sauces & Condiments</option>
                  <option value="baked_goods">Baked Goods</option>
                  <option value="prepared_foods">Prepared Foods</option>
                  <option value="beverages">Beverages</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Product Type */}
              <div>
                <Label htmlFor="productCategory">Product Type *</Label>
                <select
                  id="productCategory"
                  name="productCategory"
                  value={formData.productCategory}
                  onChange={handleInputChange}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                >
                  <option value="physical">Physical Product</option>
                  <option value="digital">Digital Product</option>
                  <option value="cookbook">Digital Cookbook</option>
                  <option value="course">Online Course</option>
                  <option value="ingredient">Ingredient/Raw Material</option>
                  <option value="tool">Kitchen Tool/Equipment</option>
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  {formData.productCategory === 'digital' || formData.productCategory === 'cookbook'
                    ? 'Commission: 10% (FREE tier) • 5% (Starter) • 3% (Pro) • 0% (Enterprise)'
                    : 'Physical products have varying commission based on delivery method'}
                </p>
              </div>

              {/* Delivery Methods */}
              <div>
                <Label>Available Delivery Methods *</Label>
                <div className="mt-2 space-y-2">
                  {/* Digital Download - only show for digital products */}
                  {(formData.productCategory === 'digital' || formData.productCategory === 'cookbook') && (
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="method-digital"
                        checked={formData.deliveryMethods.includes('digital_download')}
                        onChange={() => handleDeliveryMethodToggle('digital_download')}
                        className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                      />
                      <label htmlFor="method-digital" className="ml-2 text-sm">
                        <span className="font-medium">Digital Download</span>
                        <span className="text-blue-600 ml-2">
                          • Instant delivery • Commission: 10% (FREE) • 5% (Starter) • 3% (Pro) • 0% (Enterprise)
                        </span>
                      </label>
                    </div>
                  )}

                  {/* Physical delivery methods - only show for non-digital products */}
                  {formData.productCategory !== 'digital' && formData.productCategory !== 'cookbook' && (
                    <>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="method-shipped"
                          checked={formData.deliveryMethods.includes('shipped')}
                          onChange={() => handleDeliveryMethodToggle('shipped')}
                          className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                        />
                        <label htmlFor="method-shipped" className="ml-2 text-sm">
                          <span className="font-medium">Shipping Available</span>
                          <span className="text-gray-500 ml-2">
                            • Commission: 15% (FREE) • 10% (Starter) • 5% (Pro) • 2% (Enterprise)
                          </span>
                        </label>
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="method-pickup"
                          checked={formData.deliveryMethods.includes('pickup')}
                          onChange={() => handleDeliveryMethodToggle('pickup')}
                          className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                        />
                        <label htmlFor="method-pickup" className="ml-2 text-sm">
                          <span className="font-medium">Pickup Available</span>
                          <span className="text-green-600 ml-2">• 0% commission on all tiers</span>
                        </label>
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="method-in-store"
                          checked={formData.deliveryMethods.includes('in_store')}
                          onChange={() => handleDeliveryMethodToggle('in_store')}
                          className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                        />
                        <label htmlFor="method-in-store" className="ml-2 text-sm">
                          <span className="font-medium">In-Store Only</span>
                          <span className="text-green-600 ml-2">• 0% commission on all tiers</span>
                        </label>
                      </div>
                    </>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  {(formData.productCategory === 'digital' || formData.productCategory === 'cookbook')
                    ? 'Digital products are delivered instantly via download link.'
                    : 'Select all methods that apply. Pickup and in-store sales have 0% commission!'}
                </p>
              </div>

              {/* Digital File Upload (for digital products) */}
              {(formData.productCategory === 'digital' || formData.productCategory === 'cookbook') && (
                <div>
                  <Label htmlFor="digitalFile">Digital File *</Label>
                  <div className="mt-1">
                    {formData.digitalFileUrl ? (
                      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm text-green-700 font-medium">{formData.digitalFileName || 'File uploaded'}</span>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, digitalFileUrl: '', digitalFileName: '' }))}
                          className="ml-auto text-red-600 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type="file"
                          id="digitalFile"
                          onChange={handleFileUpload}
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.mp4,.mov,.avi,.zip,.epub"
                          disabled={uploadingFile}
                          className="block w-full text-sm text-gray-500
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-md file:border-0
                            file:text-sm file:font-semibold
                            file:bg-orange-50 file:text-orange-700
                            hover:file:bg-orange-100
                            cursor-pointer"
                        />
                        {uploadingFile && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Upload PDF, DOC, Excel, video files, or ZIP archives (max 100MB)
                  </p>
                </div>
              )}

              {/* Product Images */}
              <div>
                <Label>Product Images (up to 5)</Label>

                {/* Display existing images */}
                {formData.images.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-3">
                    {formData.images.map((imageUrl, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={imageUrl}
                          alt={`Product ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg border"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Remove image"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        {index === 0 && (
                          <span className="absolute bottom-1 left-1 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                            Primary
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new image */}
                {formData.images.length < 5 && (
                  <div className="mt-3">
                    {/* File Upload Option */}
                    <label
                      htmlFor="imageFileUpload"
                      className="flex items-center justify-center w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-orange-400 transition-colors"
                    >
                      <div className="text-center">
                        {uploadingFile ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                            <span className="text-sm text-gray-600">Uploading...</span>
                          </div>
                        ) : (
                          <>
                            <svg className="mx-auto w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="mt-3 text-base text-gray-700 font-medium">
                              Click to upload or take a photo
                            </p>
                            <p className="mt-1 text-sm text-gray-500">PNG, JPG, GIF up to 10MB</p>
                            <p className="mt-2 text-xs text-gray-400">
                              {formData.images.length === 0
                                ? "First image will be the primary image"
                                : `${5 - formData.images.length} more image${5 - formData.images.length === 1 ? '' : 's'} can be added`
                              }
                            </p>
                          </>
                        )}
                      </div>
                      <input
                        id="imageFileUpload"
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileUpload}
                        disabled={uploadingFile}
                        className="hidden"
                      />
                    </label>
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
