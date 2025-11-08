import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Store, Check, AlertCircle, Crown, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';

export default function StoreCreatePage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [formData, setFormData] = useState({
    handle: '',
    name: '',
    bio: ''
  });
  const [loading, setLoading] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [hasAccess, setHasAccess] = useState(true);

  useEffect(() => {
    checkExistingStore();
  }, [user]);

  useEffect(() => {
    // Check subscription tier access
    const tier = user?.subscriptionTier || 'free';
    setHasAccess(tier !== 'free');
  }, [user]);

  useEffect(() => {
    // Check handle availability as user types
    if (formData.handle.length >= 3) {
      const timer = setTimeout(() => {
        checkHandleAvailability();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [formData.handle]);

  const checkExistingStore = async () => {
    if (!user?.id) return;

    try {
      const response = await fetch(`/api/stores/by-user/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.store) {
          // User already has a store, redirect to dashboard
          toast({
            title: "Store exists",
            description: "You already have a store. Redirecting to dashboard...",
          });
          setTimeout(() => setLocation('/store/dashboard'), 1000);
          return;
        }
      }
    } catch (error) {
      console.error('Error checking existing store:', error);
    } finally {
      setCheckingExisting(false);
    }
  };

  const checkHandleAvailability = async () => {
    const handle = formData.handle.trim().toLowerCase();
    if (handle.length < 3) {
      setHandleAvailable(null);
      return;
    }

    try {
      const response = await fetch(`/api/stores/${handle}`);
      setHandleAvailable(response.status === 404);
    } catch (error) {
      console.error('Error checking handle:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === 'handle') {
      // Only allow lowercase letters, numbers, and hyphens
      const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
      setFormData(prev => ({ ...prev, [name]: sanitized }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Not logged in",
        description: "Please log in to create a store",
        variant: "destructive"
      });
      setLocation('/login');
      return;
    }

    if (!hasAccess) {
      toast({
        title: "Upgrade Required",
        description: "Please upgrade to Starter tier or higher to create a store",
        variant: "destructive"
      });
      return;
    }

    if (formData.handle.length < 3) {
      setError('Handle must be at least 3 characters');
      return;
    }

    if (formData.name.length < 3) {
      setError('Store name must be at least 3 characters');
      return;
    }

    if (handleAvailable === false) {
      setError('This handle is already taken');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/stores-crud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          handle: formData.handle.trim().toLowerCase(),
          name: formData.name.trim(),
          bio: formData.bio.trim() || null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data.requiredFeature === 'storeBuilder') {
          setError('Store builder requires Starter tier or higher. Please upgrade your subscription.');
          setHasAccess(false);
        } else {
          setError(data.error || 'Failed to create store');
        }
        return;
      }

      toast({
        title: "Store created!",
        description: `Your store "${formData.name}" is ready`,
      });

      // Redirect to store dashboard
      setTimeout(() => setLocation('/store/dashboard'), 1000);
    } catch (error) {
      console.error('Error creating store:', error);
      setError('An error occurred while creating your store');
    } finally {
      setLoading(false);
    }
  };

  if (checkingExisting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="mx-auto w-12 h-12 text-orange-500 animate-spin" />
          <p className="mt-4 text-gray-600">Checking your store...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full">
          <CardHeader>
            <Store className="mx-auto w-12 h-12 text-orange-500 mb-4" />
            <CardTitle className="text-center">Create Your Store</CardTitle>
            <CardDescription className="text-center">
              Please log in to create your store
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full bg-orange-500 hover:bg-orange-600"
              onClick={() => setLocation('/login')}
            >
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-orange-100 rounded-full">
              <Store className="w-8 h-8 text-orange-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Create Your Store</h1>
          <p className="text-gray-600">
            Set up your custom storefront to start selling products
          </p>
        </div>

        {/* Subscription Warning */}
        {!hasAccess && (
          <Alert className="mb-6 border-orange-200 bg-orange-50">
            <Crown className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-900">
              <strong>Upgrade Required:</strong> Store builder is available on Starter tier and higher.
              <Button
                className="ml-4 bg-orange-500 hover:bg-orange-600"
                size="sm"
                onClick={() => setLocation('/marketplace')}
              >
                View Plans
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Create Form */}
        <Card>
          <CardHeader>
            <CardTitle>Store Details</CardTitle>
            <CardDescription>
              Choose a unique handle and name for your store
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Store Handle */}
              <div>
                <Label htmlFor="handle">Store Handle *</Label>
                <div className="mt-1 relative">
                  <Input
                    id="handle"
                    name="handle"
                    value={formData.handle}
                    onChange={handleInputChange}
                    placeholder="my-awesome-store"
                    required
                    minLength={3}
                    maxLength={50}
                    disabled={!hasAccess}
                    className="pr-10"
                  />
                  {formData.handle.length >= 3 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {handleAvailable === true && (
                        <Check className="w-5 h-5 text-green-600" />
                      )}
                      {handleAvailable === false && (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Your store URL: chefsire.com/store/<span className="font-medium">{formData.handle || 'your-handle'}</span>
                </p>
                {handleAvailable === false && (
                  <p className="text-sm text-red-600 mt-1">This handle is already taken</p>
                )}
              </div>

              {/* Store Name */}
              <div>
                <Label htmlFor="name">Store Name *</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="My Awesome Store"
                  required
                  minLength={3}
                  maxLength={100}
                  disabled={!hasAccess}
                  className="mt-1"
                />
                <p className="text-sm text-gray-500 mt-1">
                  The display name for your store
                </p>
              </div>

              {/* Store Bio */}
              <div>
                <Label htmlFor="bio">Store Description (Optional)</Label>
                <Textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  placeholder="Tell customers about your store..."
                  rows={4}
                  maxLength={500}
                  disabled={!hasAccess}
                  className="mt-1"
                />
                <p className="text-sm text-gray-500 mt-1">
                  {formData.bio.length}/500 characters
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation('/marketplace')}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!hasAccess || loading || !formData.handle || !formData.name || handleAvailable === false}
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create Store
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Features Preview */}
        <Card className="mt-6 border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-lg">What you'll get:</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm">Custom storefront URL</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm">Drag-and-drop store builder</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm">Product management</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm">Order tracking</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm">Sales analytics</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm">Payment processing</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
