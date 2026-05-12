import { useCallback, useEffect, useReducer } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getMe, login as apiLogin, logout as apiLogout } from '@/api/auth';
import type { AuthUser, AuthState, LoginRequest } from '@/types';
import { AuthContext } from './useAuth';
import type { AuthContextValue } from './useAuth';

type AuthAction =
  | { type: 'HYDRATE_SUCCESS'; user: AuthUser }
  | { type: 'HYDRATE_FAILURE' }
  | { type: 'LOGIN_SUCCESS'; user: AuthUser }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; user: AuthUser };

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'HYDRATE_SUCCESS':
    case 'LOGIN_SUCCESS':
      return { user: action.user, isAuthenticated: true, isLoading: false };
    case 'HYDRATE_FAILURE':
    case 'LOGOUT':
      return { user: null, isAuthenticated: false, isLoading: false };
    case 'UPDATE_USER':
      return { ...state, user: action.user };
  }
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const user = await getMe();
        if (!cancelled) {
          dispatch({ type: 'HYDRATE_SUCCESS', user });
        }
      } catch {
        if (!cancelled) {
          dispatch({ type: 'HYDRATE_FAILURE' });
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleSessionExpired() {
      dispatch({ type: 'LOGOUT' });
      toast.error('Your session has expired. Please sign in again.');
      void navigate('/login', { replace: true });
    }

    window.addEventListener('auth:expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth:expired', handleSessionExpired);
    };
  }, [navigate]);

  const login = useCallback(async (data: LoginRequest): Promise<AuthUser> => {
    const user = await apiLogin(data);
    dispatch({ type: 'LOGIN_SUCCESS', user });
    return user;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await apiLogout();
    dispatch({ type: 'LOGOUT' });
    void navigate('/login', { replace: true });
  }, [navigate]);

  const updateUser = useCallback((user: AuthUser): void => {
    dispatch({ type: 'UPDATE_USER', user });
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    updateUser,
  };

  if (state.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" aria-busy="true">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
