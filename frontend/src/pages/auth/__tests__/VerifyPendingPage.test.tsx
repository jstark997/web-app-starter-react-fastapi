import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithAuth } from '@/test/helpers/renderWithAuth';
import VerifyPendingPage from '@/pages/auth/VerifyPendingPage';
import type { AuthUser } from '@/types';

const mockResendVerification = vi.fn<() => Promise<void>>();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('@/api/auth', () => ({
  resendVerification: (...args: unknown[]) =>
    mockResendVerification(...(args as [])),
  getMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (msg: string) => mockToastSuccess(msg),
    error: (msg: string) => mockToastError(msg),
  },
}));

const unverifiedUser: AuthUser = {
  id: '1',
  email: 'pending@example.com',
  firstName: 'Pending',
  lastName: 'User',
  displayName: 'Pending User',
  avatarUrl: null,
  role: 'user',
  isActive: true,
  emailVerified: false,
  createdAt: '2025-01-15T10:00:00Z',
};

function renderPage() {
  return renderWithAuth(<VerifyPendingPage />, { user: unverifiedUser });
}

describe('VerifyPendingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the user email and instructions', () => {
    renderPage();
    expect(screen.getByText('Verify your email')).toBeInTheDocument();
    expect(screen.getByText('pending@example.com')).toBeInTheDocument();
  });

  it('sends a verification email when "Resend" is clicked', async () => {
    const user = userEvent.setup();
    mockResendVerification.mockResolvedValue(undefined);
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Resend verification email' }));

    await waitFor(() => {
      expect(mockResendVerification).toHaveBeenCalledWith({ email: 'pending@example.com' });
    });
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it('shows an error toast if the resend fails', async () => {
    const user = userEvent.setup();
    mockResendVerification.mockRejectedValue(new Error('network'));
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Resend verification email' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  it('calls logout when "Sign out" is clicked', async () => {
    const user = userEvent.setup();
    const { mockLogout } = renderPage();

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
  });
});
