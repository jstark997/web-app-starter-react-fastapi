import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import type { AuthUser } from '@/types';
import { PublicRoute } from '@/routes/PublicRoute';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { AdminRoute } from '@/routes/AdminRoute';

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
  ...defaultUser,
  id: '2',
  email: 'admin@example.com',
  role: 'admin',
};

let mockAuthValue = {
  user: null as AuthUser | null,
  isAuthenticated: false,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  updateUser: vi.fn(),
};

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockAuthValue,
}));

function setAuth(user: AuthUser | null) {
  mockAuthValue = {
    ...mockAuthValue,
    user,
    isAuthenticated: user !== null,
  };
}

function PlaceholderPage({ label }: { label: string }) {
  return <div>{label}</div>;
}

function LoginPageWithState() {
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? '';
  return <div>Login page{from ? ` - from: ${from}` : ''}</div>;
}

function renderWithRoutes(routes: RouteObject[], initialEntry: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  setAuth(null);
});

describe('PublicRoute', () => {
  const routes: RouteObject[] = [
    {
      Component: PublicRoute,
      children: [
        { path: '/login', element: <PlaceholderPage label="Login page" /> },
      ],
    },
    { path: '/dashboard', element: <PlaceholderPage label="Dashboard page" /> },
  ];

  it('renders child route for unauthenticated users', () => {
    setAuth(null);
    renderWithRoutes(routes, '/login');
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('redirects authenticated users to /dashboard', () => {
    setAuth(defaultUser);
    renderWithRoutes(routes, '/login');
    expect(screen.getByText('Dashboard page')).toBeInTheDocument();
  });
});

describe('ProtectedRoute', () => {
  const routes: RouteObject[] = [
    {
      Component: ProtectedRoute,
      children: [
        { path: '/dashboard', element: <PlaceholderPage label="Dashboard page" /> },
        { path: '/profile', element: <PlaceholderPage label="Profile page" /> },
      ],
    },
    { path: '/login', element: <LoginPageWithState /> },
  ];

  it('renders child route for authenticated users', () => {
    setAuth(defaultUser);
    renderWithRoutes(routes, '/dashboard');
    expect(screen.getByText('Dashboard page')).toBeInTheDocument();
  });

  it('redirects unauthenticated users to /login', () => {
    setAuth(null);
    renderWithRoutes(routes, '/dashboard');
    expect(screen.getByText(/Login page/)).toBeInTheDocument();
  });

  it('preserves the originally requested path in location.state', () => {
    setAuth(null);
    renderWithRoutes(routes, '/profile');
    expect(screen.getByText(/from: \/profile/)).toBeInTheDocument();
  });
});

describe('AdminRoute', () => {
  const routes: RouteObject[] = [
    {
      Component: AdminRoute,
      children: [
        { path: '/admin/users', element: <PlaceholderPage label="User List page" /> },
      ],
    },
    { path: '/dashboard', element: <PlaceholderPage label="Dashboard page" /> },
    { path: '/login', element: <PlaceholderPage label="Login page" /> },
  ];

  it('renders child route for admin users', () => {
    setAuth(adminUser);
    renderWithRoutes(routes, '/admin/users');
    expect(screen.getByText('User List page')).toBeInTheDocument();
  });

  it('redirects non-admin authenticated users to /dashboard', () => {
    setAuth(defaultUser);
    renderWithRoutes(routes, '/admin/users');
    expect(screen.getByText('Dashboard page')).toBeInTheDocument();
  });

  it('redirects unauthenticated users to /login', () => {
    setAuth(null);
    renderWithRoutes(routes, '/admin/users');
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });
});
