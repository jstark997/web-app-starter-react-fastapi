import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { AuthUser } from '@/types';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<AuthUser>;
  logout: () => Promise<void>;
  updateUser: (user: AuthUser) => void;
}

interface RenderWithAuthOptions extends Omit<RenderOptions, 'wrapper'> {
  user?: AuthUser | null;
  route?: string;
  routes?: RouteObject[];
}

const defaultUser: AuthUser = {
  id: '1',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  displayName: 'Test User',
  avatarUrl: null,
  role: 'user',
  isActive: true,
  emailVerified: true,
  createdAt: '2025-01-15T10:00:00Z',
};

const adminUser: AuthUser = {
  id: '2',
  email: 'admin@example.com',
  firstName: 'Admin',
  lastName: 'User',
  displayName: 'Admin User',
  avatarUrl: null,
  role: 'admin',
  isActive: true,
  emailVerified: true,
  createdAt: '2025-01-10T08:00:00Z',
};

/**
 * Mock AuthContext module so we can provide preset auth state
 * without hitting the real API.
 */
import { vi } from 'vitest';

const mockLogin = vi.fn<() => Promise<AuthUser>>();
const mockLogout = vi.fn<() => Promise<void>>();
const mockUpdateUser = vi.fn<(user: AuthUser) => void>();

// We mock useAuth to return controlled state
let currentAuthValue: AuthContextValue;

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => currentAuthValue,
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));

function renderWithAuth(
  ui: ReactNode,
  options: RenderWithAuthOptions = {},
) {
  const { user = defaultUser, route = '/', routes, ...renderOptions } = options;

  const isAuthenticated = user !== null;

  currentAuthValue = {
    user,
    isAuthenticated,
    isLoading: false,
    login: mockLogin,
    logout: mockLogout,
    updateUser: mockUpdateUser,
  };

  const routeConfig: RouteObject[] = routes ?? [
    {
      path: '*',
      element: <>{ui}</>,
    },
  ];

  const router = createMemoryRouter(routeConfig, {
    initialEntries: [route],
  });

  const result = render(<RouterProvider router={router} />, renderOptions);

  return {
    ...result,
    mockLogin,
    mockLogout,
    mockUpdateUser,
  };
}

export { renderWithAuth, defaultUser, adminUser };
