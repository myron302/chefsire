import React, { useState } from 'react';
import { Check, ChevronRight, ChevronLeft, Store, Palette, Package, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ThemeSelector from './ThemeSelector';

interface StoreWizardProps {
  onComplete: (storeData: StoreData) => Promise<void>;
  onCancel: () => void;
}

export interface StoreData {
  handle: string;
  name: string;
  bio: string;
  theme: string;
  logo_url?: string;
  banner_url?: string;
}

const STEPS = [
  { id: 1, name: 'Basic Info', icon: Store },
  { id: 2, name: 'Choose Theme', icon: Palette },
  { id: 3, name: 'Add Products', icon: Package },
  { id: 4, name: 'Launch', icon: Rocket },
];

export const StoreWizard: React.FC<StoreWizardProps> = ({ onComplete, onCancel }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [storeData, setStoreData] = useState<StoreData>({
    handle: '',
    name: '',
    bio: '',
    theme: 'modern',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof StoreData, string>>>({});
  const [loading, setLoading] = useState(false);

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<keyof StoreData, string>> = {};

    if (step === 1) {
      if (!storeData.handle.trim()) {
        newErrors.handle = 'Store handle is required';
      } else if (!/^[a-z0-9-]+$/.test(storeData.handle)) {
        newErrors.handle = 'Handle can only contain lowercase letters, numbers, and hyphens';
      }
      if (!storeData.name.trim()) {
        newErrors.name = 'Store name is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < STEPS.length) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      await onComplete(storeData);
    } catch (error) {
      console.error('Failed to create store:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof StoreData, value: string) => {
    setStoreData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;

            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isCurrent
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {isCompleted ? <Check size={20} /> : <Icon size={20} />}
                  </div>
                  <span className="text-sm mt-2 font-medium">{step.name}</span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-4 ${
                      currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <Card className="p-8">
        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Let's set up your store</h2>
              <p className="text-gray-600">
                Choose a unique handle and name for your store. This is how customers will find you.
              </p>
            </div>

            {/* Store Handle */}
            <div>
              <Label htmlFor="handle">Store Handle *</Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gray-500">chefsire.com/store/</span>
                <Input
                  id="handle"
                  value={storeData.handle}
                  onChange={(e) => updateField('handle', e.target.value.toLowerCase())}
                  placeholder="your-store-handle"
                  className={errors.handle ? 'border-red-500' : ''}
                />
              </div>
              {errors.handle && (
                <p className="text-red-500 text-sm mt-1">{errors.handle}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                This will be your store's URL. Use only lowercase letters, numbers, and hyphens.
              </p>
            </div>

            {/* Store Name */}
            <div>
              <Label htmlFor="name">Store Name *</Label>
              <Input
                id="name"
                value={storeData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="My Amazing Culinary Store"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name}</p>
              )}
            </div>

            {/* Store Bio */}
            <div>
              <Label htmlFor="bio">Store Description</Label>
              <Textarea
                id="bio"
                value={storeData.bio}
                onChange={(e) => updateField('bio', e.target.value)}
                placeholder="Tell customers about your store and what makes it special..."
                rows={4}
              />
              <p className="text-xs text-gray-500 mt-1">
                A brief description of your store (optional)
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Choose Theme */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Choose your store theme</h2>
              <p className="text-gray-600">
                Select a pre-built theme that matches your brand. You can customize it later.
              </p>
            </div>

            <ThemeSelector
              selectedTheme={storeData.theme}
              onSelectTheme={(theme) => updateField('theme', theme)}
            />
          </div>
        )}

        {/* Step 3: Add Products */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Add products (optional)</h2>
              <p className="text-gray-600">
                You can add products now or skip and do it later from your dashboard.
              </p>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <Package size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="font-semibold mb-2">No products yet</h3>
              <p className="text-gray-600 mb-4">
                You'll be able to add products from your store dashboard
              </p>
              <Badge variant="secondary">Coming after launch</Badge>
            </div>
          </div>
        )}

        {/* Step 4: Launch */}
        {currentStep === 4 && (
          <div className="space-y-6 text-center">
            <div>
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Rocket size={40} className="text-orange-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Ready to launch!</h2>
              <p className="text-gray-600">
                Your store is ready to go. You can publish it now or keep it private while you add products.
              </p>
            </div>

            <Card className="p-6 bg-gray-50 text-left">
              <h3 className="font-semibold mb-4">Store Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Store URL:</span>
                  <span className="font-medium">/{storeData.handle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Name:</span>
                  <span className="font-medium">{storeData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Theme:</span>
                  <span className="font-medium capitalize">{storeData.theme}</span>
                </div>
                {storeData.bio && (
                  <div className="pt-2 border-t">
                    <span className="text-gray-600">Description:</span>
                    <p className="mt-1">{storeData.bio}</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t">
          <Button
            variant="outline"
            onClick={currentStep === 1 ? onCancel : handleBack}
            disabled={loading}
          >
            <ChevronLeft size={16} className="mr-1" />
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </Button>

          {currentStep < STEPS.length ? (
            <Button
              onClick={handleNext}
              className="bg-orange-500 hover:bg-orange-600"
              disabled={loading}
            >
              Next
              <ChevronRight size={16} className="ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              className="bg-green-600 hover:bg-green-700"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Launch Store'}
              <Rocket size={16} className="ml-1" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default StoreWizard;
