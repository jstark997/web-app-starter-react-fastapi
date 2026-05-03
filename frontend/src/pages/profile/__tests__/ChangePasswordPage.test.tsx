import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithAuth } from '@/test/helpers/renderWithAuth';
import ChangePasswordPage from '@/pages/profile/ChangePasswordPage';
import { AppLayout } from '@/components/layout/AppLayout';
import { ApiError } from '@/types';

const mockChangePassword = vi.fn<() => Promise<void>>();

vi.mock('@/api/auth', () => ({
  changePassword: (...args: unknown[]) => mockChangePassword(...args as []),
  getMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  Toaster: () => null,
}));

function renderChangePassword() {
  const routes = [
    {
      Component: AppLayout,
      children: [
        { path: '/profile/change-password', Component: ChangePasswordPage },
        { path: '/profile', element: <div>Profile Page</div> },
      ],
    },
  ];

  return renderWithAuth(<></>, {
    routes,
    route: '/profile/change-password',
  });
}

describe('ChangePasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders change password form', () => {
    renderChangePassword();
    expect(screen.getByRole('heading', { name: 'Change Password' })).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change Password' })).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    const user = userEvent.setup();
    renderChangePassword();

    await user.click(screen.getByRole('button', { name: 'Change Password' }));

    await waitFor(() => {
      expect(screen.getByText('Current password is required.')).toBeInTheDocument();
    });
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();
    expect(screen.getByText('Please confirm your new password.')).toBeInTheDocument();
  });

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup();
    renderChangePassword();

    await user.type(screen.getByLabelText('Current password'), 'oldpassword');
    await user.type(screen.getByLabelText('New password'), 'newpassword1');
    await user.type(screen.getByLabelText('Confirm new password'), 'different99');
    await user.click(screen.getByRole('button', { name: 'Change Password' }));

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    });
  });

  it('calls changePassword on valid submission', async () => {
    const user = userEvent.setup();
    mockChangePassword.mockResolvedValue(undefined);

    renderChangePassword();

    await user.type(screen.getByLabelText('Current password'), 'oldpassword');
    await user.type(screen.getByLabelText('New password'), 'newpassword1');
    await user.type(screen.getByLabelText('Confirm new password'), 'newpassword1');
    await user.click(screen.getByRole('button', { name: 'Change Password' }));

    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalledWith({
        currentPassword: 'oldpassword',
        newPassword: 'newpassword1',
      });
    });
  });

  it('shows success toast on successful submission', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();
    mockChangePassword.mockResolvedValue(undefined);

    renderChangePassword();

    await user.type(screen.getByLabelText('Current password'), 'oldpassword');
    await user.type(screen.getByLabelText('New password'), 'newpassword1');
    await user.type(screen.getByLabelText('Confirm new password'), 'newpassword1');
    await user.click(screen.getByRole('button', { name: 'Change Password' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Password changed successfully.');
    });
  });

  it('redirects to /profile on success', async () => {
    const user = userEvent.setup();
    mockChangePassword.mockResolvedValue(undefined);

    renderChangePassword();

    await user.type(screen.getByLabelText('Current password'), 'oldpassword');
    await user.type(screen.getByLabelText('New password'), 'newpassword1');
    await user.type(screen.getByLabelText('Confirm new password'), 'newpassword1');
    await user.click(screen.getByRole('button', { name: 'Change Password' }));

    await waitFor(() => {
      expect(screen.getByText('Profile Page')).toBeInTheDocument();
    });
  });

  it('shows error on incorrect current password', async () => {
    const user = userEvent.setup();
    mockChangePassword.mockRejectedValue(new ApiError('Unauthorized', 401));

    renderChangePassword();

    await user.type(screen.getByLabelText('Current password'), 'wrongpassword');
    await user.type(screen.getByLabelText('New password'), 'newpassword1');
    await user.type(screen.getByLabelText('Confirm new password'), 'newpassword1');
    await user.click(screen.getByRole('button', { name: 'Change Password' }));

    await waitFor(() => {
      expect(screen.getByText('Current password is incorrect.')).toBeInTheDocument();
    });
  });

  it('has link back to profile', () => {
    renderChangePassword();
    const link = screen.getByRole('link', { name: 'Back to profile' });
    expect(link).toHaveAttribute('href', '/profile');
  });

  it('has password visibility toggles', async () => {
    const user = userEvent.setup();
    renderChangePassword();

    const toggleButtons = screen.getAllByRole('button', { name: 'Show password' });
    expect(toggleButtons).toHaveLength(3);

    await user.click(toggleButtons[0]);
    expect(screen.getByLabelText('Current password')).toHaveAttribute('type', 'text');
  });

  it('disables form while submitting', async () => {
    const user = userEvent.setup();
    let resolveSubmit!: () => void;
    mockChangePassword.mockImplementation(
      () => new Promise((resolve) => { resolveSubmit = resolve; }),
    );

    renderChangePassword();

    await user.type(screen.getByLabelText('Current password'), 'oldpassword');
    await user.type(screen.getByLabelText('New password'), 'newpassword1');
    await user.type(screen.getByLabelText('Confirm new password'), 'newpassword1');
    await user.click(screen.getByRole('button', { name: 'Change Password' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Current password')).toBeDisabled();
    });
    expect(screen.getByLabelText('New password')).toBeDisabled();
    expect(screen.getByLabelText('Confirm new password')).toBeDisabled();

    resolveSubmit();
  });
});
