import { createContext, useContext } from 'react';
import type { AuthState, AuthUser, LoginRequest } from '@/types';

export interface AuthContextValue extends AuthState {
  login: (data: LoginRequest) => Promise<AuthUser>;
  logout: () => Promise<void>;
  updateUser: (user: AuthUser) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
