import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, adminUser } from '@/test/helpers/renderWithAuth';
import CreateUserPage from '@/pages/admin/CreateUserPage';
import { AppLayout } from '@/components/layout/AppLayout';
import type { User } from '@/types';
import { ApiError } from '@/types';

const mockCreateUser = vi.fn<() => Promise<User>>();

vi.mock('@/api/users', () => ({
  createUser: (...args: unknown[]) => mockCreateUser(...args as []),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  Toaster: () => null,
}));

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

const createdUser: User = {
  id: '42',
  email: 'newuser@example.com',
  firstName: 'New',
  lastName: 'User',
  displayName: 'New User',
  avatarUrl: null,
  role: 'user',
  isActive: true,
  emailVerified: false,
  createdAt: '2025-04-01T00:00:00Z',
  updatedAt: '2025-04-01T00:00:00Z',
};

function renderCreateUser() {
  const routes = [
    {
      Component: AppLayout,
      children: [
        { path: '/admin/users/new', Component: CreateUserPage },
        { path: '/admin/users/:id', element: <div>User Detail Page</div> },
        { path: '/admin/users', element: <div>User List Page</div> },
      ],
    },
  ];

  return renderWithAuth(<></>, {
    routes,
    route: '/admin/users/new',
    user: adminUser,
  });
}

describe('CreateUserPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form with all fields', () => {
    renderCreateUser();

    expect(screen.getByRole('heading', { name: 'Create New User' })).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Role')).toBeInTheDocument();
    expect(screen.getByLabelText('Send invitation email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create User' })).toBeInTheDocument();
  });

  it('has back link to user list', () => {
    renderCreateUser();

    expect(screen.getByRole('link', { name: 'Back to Users' })).toHaveAttribute('href', '/admin/users');
  });

  it('defaults role to user and invitation checked', () => {
    renderCreateUser();

    expect(screen.getByLabelText('Role')).toHaveValue('user');
    expect(screen.getByLabelText('Send invitation email')).toBeChecked();
  });

  it('shows validation errors on empty submit', async () => {
    const user = userEvent.setup();
    renderCreateUser();

    // Clear the default-checked values aren't the issue; first/last/email are empty
    await user.click(screen.getByRole('button', { name: 'Create User' }));

    await waitFor(() => {
      expect(screen.getByText('First name is required.')).toBeInTheDocument();
    });
    expect(screen.getByText('Last name is required.')).toBeInTheDocument();
    expect(screen.getByText('Email is required.')).toBeInTheDocument();
  });

  it('calls createUser with form data on valid submit', async () => {
    const user = userEvent.setup();
    mockCreateUser.mockResolvedValue(createdUser);
    renderCreateUser();

    await user.type(screen.getByLabelText('First name'), 'New');
    await user.type(screen.getByLabelText('Last name'), 'User');
    await user.type(screen.getByLabelText('Email'), 'newuser@example.com');
    await user.selectOptions(screen.getByLabelText('Role'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Create User' }));

    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalledWith({
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@example.com',
        role: 'admin',
        sendInvitation: true,
      });
    });
  });

  it('shows success toast and redirects on success', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();
    mockCreateUser.mockResolvedValue(createdUser);
    renderCreateUser();

    await user.type(screen.getByLabelText('First name'), 'New');
    await user.type(screen.getByLabelText('Last name'), 'User');
    await user.type(screen.getByLabelText('Email'), 'newuser@example.com');
    await user.click(screen.getByRole('button', { name: 'Create User' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('User created successfully.');
    });

    await waitFor(() => {
      expect(screen.getByText('User Detail Page')).toBeInTheDocument();
    });
  });

  it('maps server field errors to form fields', async () => {
    const user = userEvent.setup();
    mockCreateUser.mockRejectedValue(
      new ApiError('Validation failed', 422, [
        { field: 'email', message: 'Email already exists.' },
      ]),
    );
    renderCreateUser();

    await user.type(screen.getByLabelText('First name'), 'New');
    await user.type(screen.getByLabelText('Last name'), 'User');
    await user.type(screen.getByLabelText('Email'), 'newuser@example.com');
    await user.click(screen.getByRole('button', { name: 'Create User' }));

    await waitFor(() => {
      expect(screen.getByText('Email already exists.')).toBeInTheDocument();
    });
  });

  it('shows form-level server error for generic ApiError', async () => {
    const user = userEvent.setup();
    mockCreateUser.mockRejectedValue(new ApiError('Internal server error', 500));
    renderCreateUser();

    await user.type(screen.getByLabelText('First name'), 'New');
    await user.type(screen.getByLabelText('Last name'), 'User');
    await user.type(screen.getByLabelText('Email'), 'newuser@example.com');
    await user.click(screen.getByRole('button', { name: 'Create User' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Internal server error');
    });
  });
});
