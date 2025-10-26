// src/contexts/UserContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  username: string;
  displayName: string;
  royalTitle?: string;
  avatar?: string;
  bio?: string;
  email: string; // Make email required for validation
  subscription: 'free' | 'pro' | 'enterprise';
  productCount: number;
  trialEndDate?: Date | null;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  isChef: boolean;
  specialty?: string;
  password?: string; // Store password for demo (in real app, this would be hashed)
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
      
      // Get stored user from localStorage
      const savedUser = localStorage.getItem('user');
      
      if (!savedUser) {
        console.log('No user found - please sign up first');
        return false;
      }

      const existingUser: User = JSON.parse(savedUser);
      
      // Validate email matches
      if (existingUser.email !== email) {
        console.log('Email does not match registered user');
        return false;
      }

      // Validate password matches (in real app, this would compare hashes)
      if (existingUser.password !== password) {
        console.log('Password does not match');
        return false;
      }

      // If validation passes, set the user (without password for security)
      const { password: _, ...userWithoutPassword } = existingUser;
      setUser(userWithoutPassword as User);
      return true;
      
    } catch (error) {
      console.error('Login error:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (
    name: string,
    email: string,
    password: string,
    royalTitle?: string,
    meta?: { firstName?: string; lastName?: string; username?: string; [key: string]: any }
  ): Promise<boolean> => {
    try {
      setLoading(true);

      // Extract data from meta or fallback
      const firstName = meta?.firstName || name.split(' ')[0] || name;
      const lastName = meta?.lastName || name.split(' ').slice(1).join(' ') || '';
      const username = meta?.username || name; // Use the username the user typed!

      // Call the backend API
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName,
          lastName,
          username, // Send the actual username the user typed!
          email: email.toLowerCase().trim(),
          password,
          selectedTitle: royalTitle,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Signup failed:', data.error);
        alert(data.error || 'Signup failed');
        return false;
      }

      // Show success message
      alert(data.message || 'Account created! Please check your email to verify your account.');
      return true;
    } catch (error) {
      console.error('Signup error:', error);
      alert('An error occurred during signup. Please try again.');
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
