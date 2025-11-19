import React, { useState } from 'react';
import { Upload, X, Plus, Instagram, Facebook, Twitter, Mail, Phone, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface StoreCustomizationProps {
  store: any;
  onUpdate: (config: any) => void;
}

export default function StoreCustomization({ store, onUpdate }: StoreCustomizationProps) {
  const { toast } = useToast();
  const customization = store?.layout || {};
  const [config, setConfig] = useState({
    logo: customization?.logo || '',
    bannerImage: customization?.bannerImage || '',
    bannerTitle: customization?.bannerTitle || '',
    bannerSubtitle: customization?.bannerSubtitle || '',
    showBanner: customization?.showBanner !== false,
    aboutEnabled: customization?.aboutEnabled || false,
    aboutTitle: customization?.aboutTitle || 'About Us',
    aboutContent: customization?.aboutContent || '',
    announcementBar: customization?.announcementBar || '',
    announcementEnabled: customization?.announcementEnabled || false,
    socialLinks: customization?.socialLinks || {
      instagram: '',
      facebook: '',
      twitter: '',
      email: '',
      phone: '',
    },
    contactInfo: customization?.contactInfo || {
      address: '',
      hours: '',
    },
    layout: customization?.layout || {
      gridColumns: 4,
      productCardStyle: 'elevated',
      spacing: 'normal',
    },
    colors: customization?.colors || {
      primary: '#FF6B35',
      secondary: '#2C3E50',
      accent: '#F7F7F7',
    },
  });

  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logo' | 'bannerImage') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(prev => ({ ...prev, [field]: data.url }));
        toast({
          title: 'Image uploaded',
          description: 'Your image has been uploaded successfully',
        });
      } else {
        toast({
          title: 'Upload failed',
          description: 'Failed to upload image',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      await onUpdate({ customization: config });
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="branding" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
        </TabsList>

        {/* Branding Tab */}
        <TabsContent value="branding" className="space-y-6">
          {/* Logo Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Store Logo</CardTitle>
              <CardDescription>Upload your store logo (recommended: 200x200px)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {config.logo ? (
                <div className="relative inline-block">
                  <img src={config.logo} alt="Logo" className="h-32 w-32 object-contain border rounded-lg" />
                  <button
                    onClick={() => setConfig(prev => ({ ...prev, logo: '' }))}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-2 text-gray-400" />
                    <p className="text-sm text-gray-500">Click to upload logo</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'logo')}
                    disabled={uploading}
                  />
                </label>
              )}
            </CardContent>
          </Card>

          {/* Custom Colors */}
          <Card>
            <CardHeader>
              <CardTitle>Custom Colors</CardTitle>
              <CardDescription>Override theme colors with your brand colors</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Primary Color</Label>
                  <div className="flex gap-2 items-center mt-1">
                    <Input
                      type="color"
                      value={config.colors.primary}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        colors: { ...prev.colors, primary: e.target.value }
                      }))}
                      className="w-16 h-10"
                    />
                    <Input
                      type="text"
                      value={config.colors.primary}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        colors: { ...prev.colors, primary: e.target.value }
                      }))}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <Label>Secondary Color</Label>
                  <div className="flex gap-2 items-center mt-1">
                    <Input
                      type="color"
                      value={config.colors.secondary}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        colors: { ...prev.colors, secondary: e.target.value }
                      }))}
                      className="w-16 h-10"
                    />
                    <Input
                      type="text"
                      value={config.colors.secondary}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        colors: { ...prev.colors, secondary: e.target.value }
                      }))}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <Label>Background Color</Label>
                  <div className="flex gap-2 items-center mt-1">
                    <Input
                      type="color"
                      value={config.colors.accent}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        colors: { ...prev.colors, accent: e.target.value }
                      }))}
                      className="w-16 h-10"
                    />
                    <Input
                      type="text"
                      value={config.colors.accent}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        colors: { ...prev.colors, accent: e.target.value }
                      }))}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sections Tab */}
        <TabsContent value="sections" className="space-y-6">
          {/* Announcement Bar */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Announcement Bar</CardTitle>
                  <CardDescription>Show a message at the top of your store</CardDescription>
                </div>
                <Switch
                  checked={config.announcementEnabled}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, announcementEnabled: checked }))}
                />
              </div>
            </CardHeader>
            {config.announcementEnabled && (
              <CardContent>
                <Input
                  placeholder="e.g., Free shipping on orders over $50!"
                  value={config.announcementBar}
                  onChange={(e) => setConfig(prev => ({ ...prev, announcementBar: e.target.value }))}
                />
              </CardContent>
            )}
          </Card>

          {/* Hero Banner */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Hero Banner</CardTitle>
                  <CardDescription>Large banner image at the top of your store</CardDescription>
                </div>
                <Switch
                  checked={config.showBanner}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, showBanner: checked }))}
                />
              </div>
            </CardHeader>
            {config.showBanner && (
              <CardContent className="space-y-4">
                {config.bannerImage ? (
                  <div className="relative">
                    <img src={config.bannerImage} alt="Banner" className="w-full h-48 object-cover rounded-lg" />
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, bannerImage: '' }))}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <div className="flex flex-col items-center justify-center">
                      <Upload className="w-8 h-8 mb-2 text-gray-400" />
                      <p className="text-sm text-gray-500">Click to upload banner image</p>
                      <p className="text-xs text-gray-400">Recommended: 1200x400px</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'bannerImage')}
                      disabled={uploading}
                    />
                  </label>
                )}
                <div>
                  <Label>Banner Title</Label>
                  <Input
                    placeholder="Welcome to our store!"
                    value={config.bannerTitle}
                    onChange={(e) => setConfig(prev => ({ ...prev, bannerTitle: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Banner Subtitle</Label>
                  <Input
                    placeholder="Discover amazing products"
                    value={config.bannerSubtitle}
                    onChange={(e) => setConfig(prev => ({ ...prev, bannerSubtitle: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* About Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>About Section</CardTitle>
                  <CardDescription>Tell customers about your store</CardDescription>
                </div>
                <Switch
                  checked={config.aboutEnabled}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, aboutEnabled: checked }))}
                />
              </div>
            </CardHeader>
            {config.aboutEnabled && (
              <CardContent className="space-y-4">
                <div>
                  <Label>Section Title</Label>
                  <Input
                    value={config.aboutTitle}
                    onChange={(e) => setConfig(prev => ({ ...prev, aboutTitle: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Content</Label>
                  <Textarea
                    placeholder="Tell your story..."
                    value={config.aboutContent}
                    onChange={(e) => setConfig(prev => ({ ...prev, aboutContent: e.target.value }))}
                    rows={6}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>

        {/* Layout Tab */}
        <TabsContent value="layout" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Product Grid Layout</CardTitle>
              <CardDescription>Customize how products are displayed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Grid Columns (Desktop)</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {[2, 3, 4, 5].map(cols => (
                    <button
                      key={cols}
                      onClick={() => setConfig(prev => ({
                        ...prev,
                        layout: { ...prev.layout, gridColumns: cols }
                      }))}
                      className={`p-4 border-2 rounded-lg text-center font-semibold transition-colors ${
                        config.layout.gridColumns === cols
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {cols} Col
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Card Style</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <button
                    onClick={() => setConfig(prev => ({
                      ...prev,
                      layout: { ...prev.layout, productCardStyle: 'elevated' }
                    }))}
                    className={`p-6 border-2 rounded-lg transition-colors ${
                      config.layout.productCardStyle === 'elevated'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="bg-white p-4 rounded-lg shadow-lg mb-2">
                      <div className="h-2 bg-gray-200 rounded mb-2"></div>
                      <div className="h-2 bg-gray-200 rounded w-2/3"></div>
                    </div>
                    <p className="text-sm font-medium">Elevated</p>
                    <p className="text-xs text-gray-500">Cards with shadow</p>
                  </button>
                  <button
                    onClick={() => setConfig(prev => ({
                      ...prev,
                      layout: { ...prev.layout, productCardStyle: 'flat' }
                    }))}
                    className={`p-6 border-2 rounded-lg transition-colors ${
                      config.layout.productCardStyle === 'flat'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="bg-white p-4 rounded-lg border mb-2">
                      <div className="h-2 bg-gray-200 rounded mb-2"></div>
                      <div className="h-2 bg-gray-200 rounded w-2/3"></div>
                    </div>
                    <p className="text-sm font-medium">Flat</p>
                    <p className="text-xs text-gray-500">Simple borders</p>
                  </button>
                </div>
              </div>

              <div>
                <Label>Spacing</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {[
                    { value: 'compact', label: 'Compact' },
                    { value: 'normal', label: 'Normal' },
                    { value: 'relaxed', label: 'Relaxed' },
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => setConfig(prev => ({
                        ...prev,
                        layout: { ...prev.layout, spacing: option.value }
                      }))}
                      className={`p-3 border-2 rounded-lg text-center text-sm font-medium transition-colors ${
                        config.layout.spacing === option.value
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Tab */}
        <TabsContent value="contact" className="space-y-6">
          {/* Social Links */}
          <Card>
            <CardHeader>
              <CardTitle>Social Media Links</CardTitle>
              <CardDescription>Connect with customers on social platforms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="flex items-center gap-2">
                  <Instagram size={16} />
                  Instagram
                </Label>
                <Input
                  placeholder="https://instagram.com/yourstore"
                  value={config.socialLinks.instagram}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    socialLinks: { ...prev.socialLinks, instagram: e.target.value }
                  }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  <Facebook size={16} />
                  Facebook
                </Label>
                <Input
                  placeholder="https://facebook.com/yourstore"
                  value={config.socialLinks.facebook}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    socialLinks: { ...prev.socialLinks, facebook: e.target.value }
                  }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  <Twitter size={16} />
                  Twitter
                </Label>
                <Input
                  placeholder="https://twitter.com/yourstore"
                  value={config.socialLinks.twitter}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    socialLinks: { ...prev.socialLinks, twitter: e.target.value }
                  }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  <Mail size={16} />
                  Email
                </Label>
                <Input
                  type="email"
                  placeholder="contact@yourstore.com"
                  value={config.socialLinks.email}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    socialLinks: { ...prev.socialLinks, email: e.target.value }
                  }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  <Phone size={16} />
                  Phone
                </Label>
                <Input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={config.socialLinks.phone}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    socialLinks: { ...prev.socialLinks, phone: e.target.value }
                  }))}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Store Information</CardTitle>
              <CardDescription>Display your store location and hours</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="flex items-center gap-2">
                  <MapPin size={16} />
                  Address
                </Label>
                <Textarea
                  placeholder="123 Main St, City, State 12345"
                  value={config.contactInfo.address}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    contactInfo: { ...prev.contactInfo, address: e.target.value }
                  }))}
                  rows={3}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Store Hours</Label>
                <Textarea
                  placeholder="Mon-Fri: 9am-6pm&#10;Sat-Sun: 10am-4pm"
                  value={config.contactInfo.hours}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    contactInfo: { ...prev.contactInfo, hours: e.target.value }
                  }))}
                  rows={3}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          onClick={() => window.location.href = `/store/${store.handle}`}
          variant="outline"
        >
          Preview Store
        </Button>
        <Button onClick={handleSave} className="bg-orange-500 hover:bg-orange-600">
          Save Changes
        </Button>
      </div>
    </div>
  );
}
