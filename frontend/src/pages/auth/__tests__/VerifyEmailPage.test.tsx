import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithAuth } from '@/test/helpers/renderWithAuth';
import VerifyEmailPage from '@/pages/auth/VerifyEmailPage';
import { AuthLayout } from '@/components/layout/AuthLayout';

const mockVerifyEmail = vi.fn<() => Promise<void>>();
const mockResendVerification = vi.fn<() => Promise<void>>();

vi.mock('@/api/auth', () => ({
  verifyEmail: (...args: unknown[]) => mockVerifyEmail(...args as []),
  resendVerification: (...args: unknown[]) => mockResendVerification(...args as []),
  getMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  Toaster: () => null,
}));

function renderVerifyEmail(token?: string) {
  const route = token ? `/verify-email?token=${token}` : '/verify-email';
  return renderWithAuth(<></>, {
    routes: [
      {
        Component: AuthLayout,
        children: [
          { path: '/verify-email', Component: VerifyEmailPage },
        ],
      },
      { path: '/login', element: <div>Login Page</div> },
    ],
    route,
    user: null,
  });
}

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auto-submits token on mount', async () => {
    mockVerifyEmail.mockResolvedValue(undefined);
    renderVerifyEmail('abc123');

    await waitFor(() => {
      expect(mockVerifyEmail).toHaveBeenCalledWith({ token: 'abc123' });
    });
  });

  it('shows loading state while verifying', () => {
    mockVerifyEmail.mockReturnValue(new Promise(() => {}));
    renderVerifyEmail('abc123');

    expect(screen.getByText('Verifying your email...')).toBeInTheDocument();
  });

  it('shows success message on successful verification', async () => {
    mockVerifyEmail.mockResolvedValue(undefined);
    renderVerifyEmail('abc123');

    await waitFor(() => {
      expect(screen.getByText('Email verified')).toBeInTheDocument();
    });
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });

  it('shows error on failed verification', async () => {
    mockVerifyEmail.mockRejectedValue(new Error('Token is invalid or expired.'));
    renderVerifyEmail('bad-token');

    await waitFor(() => {
      expect(screen.getByText('Verification failed')).toBeInTheDocument();
    });
    expect(screen.getByText('Token is invalid or expired.')).toBeInTheDocument();
  });

  it('shows error when no token provided', async () => {
    renderVerifyEmail();

    await waitFor(() => {
      expect(screen.getByText('Verification failed')).toBeInTheDocument();
    });
    expect(screen.getByText('No verification token provided.')).toBeInTheDocument();
  });

  it('shows resend verification form on error', async () => {
    mockVerifyEmail.mockRejectedValue(new Error('Expired'));
    renderVerifyEmail('expired-token');

    await waitFor(() => {
      expect(screen.getByText('Verification failed')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Resend verification email' })).toBeInTheDocument();
  });

  it('calls resend verification API', async () => {
    const user = userEvent.setup();
    mockVerifyEmail.mockRejectedValue(new Error('Expired'));
    mockResendVerification.mockResolvedValue(undefined);
    renderVerifyEmail('expired-token');

    await waitFor(() => {
      expect(screen.getByText('Verification failed')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: 'Resend verification email' }));

    await waitFor(() => {
      expect(mockResendVerification).toHaveBeenCalledWith({ email: 'test@example.com' });
    });
  });
});
