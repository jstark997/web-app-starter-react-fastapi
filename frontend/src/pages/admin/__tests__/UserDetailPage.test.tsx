import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, adminUser } from '@/test/helpers/renderWithAuth';
import UserDetailPage from '@/pages/admin/UserDetailPage';
import { AppLayout } from '@/components/layout/AppLayout';
import type { User } from '@/types';
import { ApiError } from '@/types';

const mockGetUser = vi.fn<() => Promise<User>>();
const mockDeleteUser = vi.fn<() => Promise<void>>();
const mockDeactivateUser = vi.fn<() => Promise<void>>();
const mockReactivateUser = vi.fn<() => Promise<void>>();
const mockForcePasswordReset = vi.fn<() => Promise<void>>();

vi.mock('@/api/users', () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args as []),
  deleteUser: (...args: unknown[]) => mockDeleteUser(...args as []),
  deactivateUser: (...args: unknown[]) => mockDeactivateUser(...args as []),
  reactivateUser: (...args: unknown[]) => mockReactivateUser(...args as []),
  forcePasswordReset: (...args: unknown[]) => mockForcePasswordReset(...args as []),
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

const testUser: User = {
  id: '10',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Smith',
  displayName: 'Alice S',
  avatarUrl: null,
  role: 'user',
  isActive: true,
  emailVerified: true,
  createdAt: '2025-03-01T00:00:00Z',
  updatedAt: '2025-03-15T00:00:00Z',
};

function renderUserDetail(userId = '10') {
  const routes = [
    {
      Component: AppLayout,
      children: [
        { path: '/admin/users/:id', Component: UserDetailPage },
        { path: '/admin/users', element: <div>User List Page</div> },
      ],
    },
  ];

  return renderWithAuth(<></>, {
    routes,
    route: `/admin/users/${userId}`,
    user: adminUser,
  });
}

describe('UserDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(testUser);
  });

  it('renders all user fields', async () => {
    renderUserDetail();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Alice S' })).toBeInTheDocument();
    });
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getAllByText('alice@example.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('User').length).toBeGreaterThan(0); // Badge
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0); // Badge
    expect(screen.getByText('Verified')).toBeInTheDocument(); // Badge
  });

  it('shows loading skeleton initially', () => {
    mockGetUser.mockImplementation(() => new Promise(() => {})); // never resolves
    const { container } = renderUserDetail();

    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows error for 404', async () => {
    mockGetUser.mockRejectedValue(new ApiError('Not Found', 404));
    renderUserDetail();

    await waitFor(() => {
      expect(screen.getByText('User not found.')).toBeInTheDocument();
    });
    expect(screen.getByText('Back to Users')).toHaveAttribute('href', '/admin/users');
  });

  it('shows generic error on failure', async () => {
    mockGetUser.mockRejectedValue(new ApiError('Server error', 500));
    renderUserDetail();

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  it('has action buttons', async () => {
    renderUserDetail();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Alice S' })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Edit User' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Force Password Reset' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete User' })).toBeEnabled();
  });

  it('disables deactivate and delete for own account', async () => {
    const selfUser: User = {
      ...testUser,
      id: adminUser.id,
      email: 'admin@example.com',
    };
    mockGetUser.mockResolvedValue(selfUser);
    renderUserDetail(adminUser.id);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Deactivate' })).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: 'Delete User' })).toBeDisabled();
  });

  it('deletes user and redirects to user list', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();
    mockDeleteUser.mockResolvedValue(undefined);
    renderUserDetail();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Alice S' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Delete User' }));

    await waitFor(() => {
      expect(screen.getByText('Delete User', { selector: 'h2' })).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Type.*to confirm/), 'alice@example.com');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockDeleteUser).toHaveBeenCalledWith('10');
    });
    expect(toast.success).toHaveBeenCalledWith('User alice@example.com has been deleted.');

    await waitFor(() => {
      expect(screen.getByText('User List Page')).toBeInTheDocument();
    });
  });

  it('deactivates user and updates display', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();
    mockDeactivateUser.mockResolvedValue(undefined);
    renderUserDetail();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Alice S' })).toBeInTheDocument();
    });

    // Click the page-level Deactivate button
    const deactivateButtons = screen.getAllByRole('button', { name: 'Deactivate' });
    await user.click(deactivateButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Deactivate User', { selector: 'h2' })).toBeInTheDocument();
    });

    // Click the dialog confirm button
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => {
      expect(mockDeactivateUser).toHaveBeenCalledWith('10');
    });
    expect(toast.success).toHaveBeenCalledWith('User alice@example.com has been deactivated.');
  });

  it('calls forcePasswordReset and shows toast', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();
    mockForcePasswordReset.mockResolvedValue(undefined);
    renderUserDetail();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Alice S' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Force Password Reset' }));

    await waitFor(() => {
      expect(mockForcePasswordReset).toHaveBeenCalledWith('10');
    });
    expect(toast.success).toHaveBeenCalledWith('Password reset email sent to alice@example.com.');
  });

  it('has back to users link', async () => {
    renderUserDetail();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Alice S' })).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: 'Back to Users' })).toHaveAttribute('href', '/admin/users');
  });
});
