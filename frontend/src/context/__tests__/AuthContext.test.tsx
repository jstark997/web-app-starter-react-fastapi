import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { useAuth } from '@/context/useAuth';
import type { AuthUser } from '@/types';

const mockGetMe = vi.fn<() => Promise<AuthUser>>();
const mockLogin = vi.fn<() => Promise<AuthUser>>();
const mockLogout = vi.fn<() => Promise<void>>();

vi.mock('@/api/auth', () => ({
  getMe: (...args: unknown[]) => mockGetMe(...args as []),
  login: (...args: unknown[]) => mockLogin(...args as []),
  logout: (...args: unknown[]) => mockLogout(...args as []),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
  Toaster: () => null,
}));

const testUser: AuthUser = {
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

function AuthConsumer() {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Not authenticated</div>;
  return <div>Authenticated as {user?.email}</div>;
}

function renderWithRouter(initialEntries: string[] = ['/']) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <AuthProvider>
            <AuthConsumer />
          </AuthProvider>
        ),
      },
      {
        path: '/login',
        element: <div>Login page</div>,
      },
    ],
    { initialEntries },
  );

  return render(<RouterProvider router={router} />);
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hydration', () => {
    it('shows loading state while hydrating', async () => {
      let resolveGetMe: (user: AuthUser) => void;
      mockGetMe.mockReturnValue(
        new Promise<AuthUser>((resolve) => {
          resolveGetMe = resolve;
        }),
      );

      renderWithRouter();

      expect(screen.getByRole('generic', { busy: true })).toBeInTheDocument();

      await act(async () => {
        resolveGetMe!(testUser);
      });

      await waitFor(() => {
        expect(screen.getByText(`Authenticated as ${testUser.email}`)).toBeInTheDocument();
      });
    });

    it('hydrates correctly on load with valid session', async () => {
      mockGetMe.mockResolvedValueOnce(testUser);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(`Authenticated as ${testUser.email}`)).toBeInTheDocument();
      });
    });

    it('sets unauthenticated state when /api/auth/me fails', async () => {
      mockGetMe.mockRejectedValueOnce(new Error('Unauthorized'));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Not authenticated')).toBeInTheDocument();
      });
    });
  });

  describe('session expiration', () => {
    it('clears state and redirects on auth:expired event', async () => {
      mockGetMe.mockResolvedValueOnce(testUser);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(`Authenticated as ${testUser.email}`)).toBeInTheDocument();
      });

      await act(async () => {
        window.dispatchEvent(new Event('auth:expired'));
      });

      await waitFor(() => {
        expect(screen.getByText('Login page')).toBeInTheDocument();
      });
    });

    it('shows a toast notification on session expiry', async () => {
      const { toast } = await import('sonner');
      mockGetMe.mockResolvedValueOnce(testUser);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(`Authenticated as ${testUser.email}`)).toBeInTheDocument();
      });

      await act(async () => {
        window.dispatchEvent(new Event('auth:expired'));
      });

      expect(toast.error).toHaveBeenCalledWith(
        'Your session has expired. Please sign in again.',
      );
    });
  });
});
