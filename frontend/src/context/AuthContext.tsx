import React, { createContext, useState, useEffect, useContext } from 'react';
import { User } from '../types';
import { authService } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: any) => Promise<void>;
  signup: (credentials: any) => Promise<any>;
  verifyCode: (email: string, code: string) => Promise<void>;
  resendCode: (email: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    const token = localStorage.getItem('tripmate_token');
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    
    try {
      const userData = await authService.getMe();
      setUser(userData);
    } catch (error: any) {
      console.error("Failed to load user profile:", error);
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        localStorage.removeItem('tripmate_token');
      }
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (credentials: any) => {
    setIsLoading(true);
    try {
      const data = await authService.login(credentials);
      localStorage.setItem('tripmate_token', data.access_token);
      await refreshUser();
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const signup = async (credentials: any) => {
    setIsLoading(true);
    try {
      const data = await authService.signup(credentials);
      setIsLoading(false);
      return data;
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const verifyCode = async (email: string, code: string) => {
    setIsLoading(true);
    try {
      const data = await authService.verifyCode(email, code);
      localStorage.setItem('tripmate_token', data.access_token);
      await refreshUser();
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const resendCode = async (email: string) => {
    try {
      await authService.resendCode(email);
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('tripmate_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        verifyCode,
        resendCode,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
export default AuthContext;
