// src/contexts/UserContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  username: string;
  displayName: string;
  royalTitle?: string;
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
  email?: string; // Add email to track login
}

interface UserContextType {
  user: User | null;
  updateUser: (newUser: Partial<User>) => void;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  signup: (name: string, email: string, password: string, royalTitle?: string) => Promise<boolean>;
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
      
      // Get stored users from localStorage
      const savedUser = localStorage.getItem('user');
      
      if (!savedUser) {
        // No user exists - require signup first
        console.log('No existing user found - please sign up first');
        return false;
      }

      const existingUser = JSON.parse(savedUser);
      
      // Check if this is the demo user or a real registered user
      // For demo purposes, we'll check if the user has an email property
      // In a real app, you'd check against your backend
      if (existingUser.email && existingUser.email !== email) {
        console.log('Email does not match registered user');
        return false;
      }

      // Basic password check (in real app, this would be hashed password check)
      // For now, we'll just require password to be at least 6 chars
      // and check if it matches the stored user's expected password pattern
      if (password.length < 6) {
        console.log('Password too short');
        return false;
      }

      // If we have a matching user, log them in
      const mockUser: User = {
        id: existingUser.id || 'user-1',
        username: existingUser.username || email.split('@')[0],
        displayName: existingUser.displayName || email.split('@')[0],
        royalTitle: existingUser.royalTitle || 'Knight',
        avatar: existingUser.avatar || 'https://images.unsplash.com/photo-1566554273541-37a9ca77b91f',
        bio: existingUser.bio || 'Food enthusiast and recipe creator',
        email: email, // Store the email used to login
        subscription: existingUser.subscription || 'free',
        productCount: existingUser.productCount || 0,
        postsCount: existingUser.postsCount || 0,
        followersCount: existingUser.followersCount || 0,
        followingCount: existingUser.followingCount || 0,
        isChef: existingUser.isChef || false
      };
      
      setUser(mockUser);
      localStorage.setItem('user', JSON.stringify(mockUser));
      return true;
      
    } catch (error) {
      console.error('Login error:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (name: string, email: string, password: string, royalTitle?: string): Promise<boolean> => {
    try {
      setLoading(true);
      
      // Check if user already exists
      const existingUser = localStorage.getItem('user');
      if (existingUser) {
        const userData = JSON.parse(existingUser);
        if (userData.email === email) {
          console.log('User already exists with this email');
          return false;
        }
      }

      // Mock signup - replace with real API call
      if (name && email && password.length >= 6) {
        const mockUser: User = {
          id: 'user-' + Date.now(),
          username: email.split('@')[0],
          displayName: name,
          royalTitle: royalTitle || 'Knight',
          avatar: 'https://images.unsplash.com/photo-1566554273541-37a9ca77b91f',
          bio: 'New food enthusiast!',
          email: email, // Store email for login validation
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
