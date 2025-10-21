import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createStore } from '../lib/stores';
import { Upload, Store, Palette, Check } from 'lucide-react';

interface StoreFormData {
  handle: string;
  name: string;
  bio: string;
  logo: string;
  theme: string;
}

const THEMES = [
  { id: 'minimal', name: 'Minimal', colors: { primary: '#000000', background: '#ffffff' } },
  { id: 'warm', name: 'Warm', colors: { primary: '#b45309', background: '#fef3c7' } },
  { id: 'modern', name: 'Modern', colors: { primary: '#1e40af', background: '#f8fafc' } },
];

export const StoreSetup: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<StoreFormData>({
    handle: '',
    name: '',
    bio: '',
    logo: '',
    theme: 'minimal'
  });

  const handleInputChange = (field: keyof StoreFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const store = await createStore({
        ...formData,
        owner_id: user.id,
        is_published: false
      });
      navigate(`/dashboard/store/${store.id}`);
    } catch (error) {
      console.error('Failed to create store:', error);
    } finally {
      setLoading(false);
    }
  };

  const Step1 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">Store Handle</label>
        <div className="flex items-center">
          <span className="text-gray-500 mr-2">artisana/</span>
          <input
            type="text"
            value={formData.handle}
            onChange={(e) => handleInputChange('handle', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            className="flex-1 border rounded-lg px-3 py-2"
            placeholder="your-store-name"
          />
        </div>
        <p className="text-sm text-gray-500 mt-1">This will be your store URL: artisana/{formData.handle || 'your-store'}</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Store Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Enter your store name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Store Bio</label>
        <textarea
          value={formData.bio}
          onChange={(e) => handleInputChange('bio', e.target.value)}
          className="w-full border rounded-lg px-3 py-2 h-20"
          placeholder="Describe what makes your store special..."
        />
      </div>
    </div>
  );

  const Step2 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">Store Logo</label>
        <div className="border-2 border-dashed rounded-lg p-6 text-center">
          <Upload className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2">Upload your store logo</p>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={(e) => {
              // Handle file upload - would integrate with your file storage
              console.log('File upload:', e.target.files?.[0]);
            }}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Choose Theme</label>
        <div className="grid grid-cols-3 gap-4">
          {THEMES.map((theme) => (
            <div
              key={theme.id}
              className={`border-2 rounded-lg p-4 cursor-pointer ${
                formData.theme === theme.id ? 'border-blue-500' : 'border-gray-200'
              }`}
              onClick={() => handleInputChange('theme', theme.id)}
            >
              <div 
                className="w-full h-16 rounded mb-2"
                style={{ backgroundColor: theme.colors.background }}
              >
                <div 
                  className="w-8 h-2 rounded-full float-left m-2"
                  style={{ backgroundColor: theme.colors.primary }}
                />
              </div>
              <p className="text-sm font-medium">{theme.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-sm p-8">
        <div className="text-center mb-8">
          <Store className="mx-auto h-12 w-12 text-blue-600" />
          <h1 className="text-2xl font-bold mt-4">Create Your Store</h1>
          <p className="text-gray-600 mt-2">Set up your store in just a few steps</p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-between mb-8">
          {[1, 2].map((stepNumber) => (
            <div key={stepNumber} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= stepNumber ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {step > stepNumber ? <Check className="w-4 h-4" /> : stepNumber}
              </div>
              {stepNumber < 2 && (
                <div className={`w-12 h-1 mx-2 ${
                  step > stepNumber ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        {step === 1 && <Step1 />}
        {step === 2 && <Step2 />}

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 border rounded-lg text-gray-600"
            >
              Back
            </button>
          ) : (
            <div></div>
          )}

          {step < 2 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!formData.handle || !formData.name}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-300"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-300"
            >
              {loading ? 'Creating...' : 'Create Store'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
