import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithAuth } from '@/test/helpers/renderWithAuth';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import { AuthLayout } from '@/components/layout/AuthLayout';

const mockForgotPassword = vi.fn<() => Promise<void>>();

vi.mock('@/api/auth', () => ({
  forgotPassword: (...args: unknown[]) => mockForgotPassword(...args as []),
  getMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
}));

function renderForgotPassword() {
  return renderWithAuth(<></>, {
    routes: [
      {
        Component: AuthLayout,
        children: [
          { path: '/forgot-password', Component: ForgotPasswordPage },
        ],
      },
      { path: '/login', element: <div>Login Page</div> },
    ],
    route: '/forgot-password',
    user: null,
  });
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form', () => {
    renderForgotPassword();
    expect(screen.getByText('Forgot your password?')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeInTheDocument();
  });

  it('shows success message after submission', async () => {
    const user = userEvent.setup();
    mockForgotPassword.mockResolvedValue(undefined);
    renderForgotPassword();

    await user.type(screen.getByLabelText('Email address'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    await waitFor(() => {
      expect(screen.getByText(/If an account with that email exists/)).toBeInTheDocument();
    });
  });

  it('shows success message even when API fails', async () => {
    const user = userEvent.setup();
    mockForgotPassword.mockRejectedValue(new Error('Network error'));
    renderForgotPassword();

    await user.type(screen.getByLabelText('Email address'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    await waitFor(() => {
      expect(screen.getByText(/If an account with that email exists/)).toBeInTheDocument();
    });
  });

  it('validates email before submission', async () => {
    const user = userEvent.setup();
    renderForgotPassword();

    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    await waitFor(() => {
      expect(screen.getByText('Email is required.')).toBeInTheDocument();
    });
    expect(mockForgotPassword).not.toHaveBeenCalled();
  });

  it('has link back to sign in', () => {
    renderForgotPassword();
    const links = screen.getAllByText('Back to sign in');
    expect(links.length).toBeGreaterThan(0);
  });
});
