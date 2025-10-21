import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createStore } from '../lib/stores';
import { Upload, Store, Palette, Check } from 'lucide-react';
import { Store as StoreType } from '../types/store';

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
      
      // Navigate to the vendor dashboard which now includes store management
      navigate(`/vendor/dashboard?tab=store`);
    } catch (error) {
      console.error('Failed to create store:', error);
    } finally {
      setLoading(false);
    }
  };

  // ... (rest of the component implementation remains the same as previous)
  // Step1, Step2, and JSX structure
