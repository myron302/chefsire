// src/contexts/UserContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  subscription: 'free' | 'pro' | 'enterprise';
  productCount: number;
  trialEndDate?: Date | null;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  isChef: boolean;
  specialty?: string;
}

interface UserContextType {
  user: User | null;
  updateUser: (newUser: Partial<User>) => void;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  signup: (name: string, email: string, password: string) => Promise<boolean>;
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
    // Check if user is logged in from localStorage
    const checkLoggedInUser = async () => {
      try {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          const userData = JSON.parse(savedUser);
          setUser(userData);
        } else {
          // For demo purposes, auto-login with mock user
          const mockUser: User = {
            id: 'user-1',
            username: 'alexandra_chef',
            displayName: 'Alexandra Chef',
            avatar: 'https://images.unsplash.com/photo-1566554273541-37a9ca77b91f',
            bio: 'Professional chef & mixology enthusiast. Love creating healthy recipes and custom drinks!',
            subscription: 'pro',
            productCount: 3,
            trialEndDate: null,
            postsCount: 24,
            followersCount: 1247,
            followingCount: 289,
            isChef: true,
            specialty: 'Mediterranean Cuisine'
          };
          setUser(mockUser);
          localStorage.setItem('user', JSON.stringify(mockUser));
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkLoggedInUser();
  }, []);

  const updateUser = (updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const updatedUser = { ...prev, ...updates };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return updatedUser;
    });
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      // Mock login - replace with real API call
      if (email && password.length >= 6) {
        const mockUser: User = {
          id: 'user-1',
          username: email.split('@')[0],
          displayName: email.split('@')[0],
          avatar: 'https://images.unsplash.com/photo-1566554273541-37a9ca77b91f',
          bio: 'Food enthusiast and recipe creator',
          subscription: 'free',
          productCount: 0,
          postsCount: 0,
          followersCount: 0,
          followingCount: 0,
          isChef: false
        };
        setUser(mockUser);
        localStorage.setItem('user', JSON.stringify(mockUser));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (name: string, email: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      // Mock signup - replace with real API call
      if (name && email && password.length >= 6) {
        const mockUser: User = {
          id: 'user-' + Date.now(),
          username: email.split('@')[0],
          displayName: name,
          avatar: 'https://images.unsplash.com/photo-1566554273541-37a9ca77b91f',
          bio: 'New food enthusiast!',
          subscription: 'free',
          productCount: 0,
          postsCount: 0,
          followersCount: 0,
          followingCount: 0,
          isChef: false
        };
        setUser(mockUser);
        localStorage.setItem('user', JSON.stringify(mockUser));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Signup error:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <UserContext.Provider value={{ user, updateUser, loading, login, logout, signup }}>
      {children}
    </UserContext.Provider>
  );
};
