import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithAuth } from '@/test/helpers/renderWithAuth';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { ApiError } from '@/types';

const mockResetPassword = vi.fn<() => Promise<void>>();

vi.mock('@/api/auth', () => ({
  resetPassword: (...args: unknown[]) => mockResetPassword(...args as []),
  getMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
}));

function renderResetPassword(token?: string) {
  const route = token ? `/reset-password?token=${token}` : '/reset-password';
  return renderWithAuth(<></>, {
    routes: [
      {
        Component: AuthLayout,
        children: [
          { path: '/reset-password', Component: ResetPasswordPage },
        ],
      },
      { path: '/forgot-password', element: <div>Forgot Password Page</div> },
      { path: '/login', element: <div>Login Page</div> },
    ],
    route,
    user: null,
  });
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to forgot-password when token is absent', async () => {
    renderResetPassword();

    await waitFor(() => {
      expect(screen.getByText('Forgot Password Page')).toBeInTheDocument();
    });
  });

  it('renders form when token is present', () => {
    renderResetPassword('valid-token');
    expect(screen.getByText('Reset your password')).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument();
  });

  it('shows success message after successful reset', async () => {
    const user = userEvent.setup();
    mockResetPassword.mockResolvedValue(undefined);
    renderResetPassword('valid-token');

    await user.type(screen.getByLabelText('New password'), 'newpassword1');
    await user.type(screen.getByLabelText('Confirm new password'), 'newpassword1');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    await waitFor(() => {
      expect(screen.getByText('Password reset successful')).toBeInTheDocument();
    });
  });

  it('shows error on invalid/expired token', async () => {
    const user = userEvent.setup();
    mockResetPassword.mockRejectedValue(new ApiError('Token is invalid or expired.', 400));
    renderResetPassword('bad-token');

    await user.type(screen.getByLabelText('New password'), 'newpassword1');
    await user.type(screen.getByLabelText('Confirm new password'), 'newpassword1');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    await waitFor(() => {
      expect(screen.getByText(/Token is invalid or expired/)).toBeInTheDocument();
    });
    expect(screen.getByText('Request a new link')).toBeInTheDocument();
  });

  it('validates password mismatch', async () => {
    const user = userEvent.setup();
    renderResetPassword('valid-token');

    await user.type(screen.getByLabelText('New password'), 'newpassword1');
    await user.type(screen.getByLabelText('Confirm new password'), 'different99');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    });
  });

  it('has password visibility toggles', () => {
    renderResetPassword('valid-token');
    const toggleButtons = screen.getAllByRole('button', { name: 'Show password' });
    expect(toggleButtons).toHaveLength(2);
  });
});
