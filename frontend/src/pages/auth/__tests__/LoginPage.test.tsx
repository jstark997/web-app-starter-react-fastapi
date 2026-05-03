import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithAuth } from '@/test/helpers/renderWithAuth';
import LoginPage from '@/pages/auth/LoginPage';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { ApiError } from '@/types';

const mockLoginApi = vi.fn<() => Promise<void>>();

vi.mock('@/api/auth', () => ({
  login: (...args: unknown[]) => mockLoginApi(...args as []),
  getMe: vi.fn(),
  logout: vi.fn(),
}));

function renderLogin(from?: string) {
  const initialRoute = from ? `/login` : '/login';
  const routes = [
    {
      Component: AuthLayout,
      children: [
        { path: '/login', Component: LoginPage },
      ],
    },
    { path: '/dashboard', element: <div>Dashboard Page</div> },
    { path: '/profile', element: <div>Profile Page</div> },
  ];

  const state = from ? { from } : undefined;
  return renderWithAuth(<></>, {
    routes,
    route: initialRoute,
    user: null,
    ...(state ? {} : {}),
  });
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sign in form', () => {
    renderLogin();
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Remember me')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.getByText('Email is required.')).toBeInTheDocument();
    });
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
  });

  it('calls login on valid submission', async () => {
    const user = userEvent.setup();
    const { mockLogin } = renderLogin();
    mockLogin.mockResolvedValue({
      id: '1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      displayName: 'Test User',
      avatarUrl: null,
      role: 'user' as const,
      isActive: true,
      emailVerified: true,
      createdAt: '2025-01-15T10:00:00Z',
    });

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledOnce();
    });
  });

  it('shows generic error on 401 failure', async () => {
    const user = userEvent.setup();
    const { mockLogin } = renderLogin();
    mockLogin.mockRejectedValue(new ApiError('Unauthorized', 401));

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password.')).toBeInTheDocument();
    });
  });

  it('has links to forgot password and register', () => {
    renderLogin();
    expect(screen.getByText('Forgot your password?')).toBeInTheDocument();
    expect(screen.getByText('Create an account')).toBeInTheDocument();
  });

  it('disables form while submitting', async () => {
    const user = userEvent.setup();
    const { mockLogin } = renderLogin();
    let resolveLogin!: () => void;
    mockLogin.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = () => resolve({
            id: '1', email: 'test@example.com', firstName: 'Test',
            lastName: 'User', displayName: 'Test User', avatarUrl: null,
            role: 'user', isActive: true, emailVerified: true, createdAt: '2025-01-15T10:00:00Z',
          });
        }),
    );

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Email address')).toBeDisabled();
    });
    expect(screen.getByLabelText('Password')).toBeDisabled();

    resolveLogin();
  });

  it('has password visibility toggle', async () => {
    const user = userEvent.setup();
    renderLogin();

    const passwordInput = screen.getByLabelText('Password');
    expect(passwordInput).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(passwordInput).toHaveAttribute('type', 'text');
  });
});
