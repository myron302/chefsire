// src/contexts/UserContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  username: string;
  avatar?: string;
  subscription: 'free' | 'pro' | 'enterprise';
  productCount: number;
  trialEndDate?: Date | null;
}

interface UserContextType {
  user: User | null;
  updateUser: (newUser: Partial<User>) => void;
  loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch user data from API (e.g., localStorage for demo, replace with fetch('/api/user'))
    const fetchUser = async () => {
      try {
        // Mock data for now; replace with real API call
        const mockUser: User = {
          id: '1',
          username: 'demo-user',
          avatar: 'https://images.unsplash.com/photo-1566554273541-37a9ca77b91f',
          subscription: 'free',
          productCount: 3,
          trialEndDate: null, // Or new Date() + 30 days for trial
        };
        setUser(mockUser);
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const updateUser = (updates: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  };

  return (
    <UserContext.Provider value={{ user, updateUser, loading }}>
      {children}
    </UserContext.Provider>
  );
};
