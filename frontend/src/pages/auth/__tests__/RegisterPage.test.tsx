import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithAuth } from '@/test/helpers/renderWithAuth';
import RegisterPage from '@/pages/auth/RegisterPage';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { ApiError } from '@/types';

const mockRegister = vi.fn<() => Promise<void>>();

vi.mock('@/api/auth', () => ({
  register: (...args: unknown[]) => mockRegister(...args as []),
  getMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
}));

function renderRegister() {
  return renderWithAuth(<></>, {
    routes: [
      {
        Component: AuthLayout,
        children: [
          { path: '/register', Component: RegisterPage },
        ],
      },
      { path: '/login', element: <div>Login Page</div> },
    ],
    route: '/register',
    user: null,
  });
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders registration form', () => {
    renderRegister();
    expect(screen.getByText('Create your account')).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
  });

  it('shows success message after successful registration', async () => {
    const user = userEvent.setup();
    mockRegister.mockResolvedValue(undefined);
    renderRegister();

    await user.type(screen.getByLabelText('First name'), 'John');
    await user.type(screen.getByLabelText('Last name'), 'Doe');
    await user.type(screen.getByLabelText('Email address'), 'john@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.type(screen.getByLabelText('Confirm password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument();
    });
    expect(screen.queryByText('Create your account')).not.toBeInTheDocument();
  });

  it('shows validation error for password mismatch', async () => {
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByLabelText('First name'), 'John');
    await user.type(screen.getByLabelText('Last name'), 'Doe');
    await user.type(screen.getByLabelText('Email address'), 'john@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.type(screen.getByLabelText('Confirm password'), 'different99');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    });
  });

  it('shows server error for whitelist rejection', async () => {
    const user = userEvent.setup();
    mockRegister.mockRejectedValue(
      new ApiError('Registration restricted', 403, [], { whitelistRestricted: true }),
    );
    renderRegister();

    await user.type(screen.getByLabelText('First name'), 'John');
    await user.type(screen.getByLabelText('Last name'), 'Doe');
    await user.type(screen.getByLabelText('Email address'), 'john@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.type(screen.getByLabelText('Confirm password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(screen.getByText('Registration is not available for this email address.')).toBeInTheDocument();
    });
  });

  it('shows generic success screen for already-registered emails', async () => {
    // The backend no longer differentiates duplicate emails from new ones —
    // both responses are 201 with the generic "check your email" message.
    const user = userEvent.setup();
    mockRegister.mockResolvedValue(undefined);
    renderRegister();

    await user.type(screen.getByLabelText('First name'), 'John');
    await user.type(screen.getByLabelText('Last name'), 'Doe');
    await user.type(screen.getByLabelText('Email address'), 'existing@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.type(screen.getByLabelText('Confirm password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument();
    });
    expect(screen.queryByText('Email already registered.')).not.toBeInTheDocument();
  });

  it('has link to sign in', () => {
    renderRegister();
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });

  it('has password visibility toggles', () => {
    renderRegister();
    const toggleButtons = screen.getAllByRole('button', { name: 'Show password' });
    expect(toggleButtons).toHaveLength(2);
  });
});
