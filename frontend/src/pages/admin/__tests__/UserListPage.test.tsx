import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, adminUser } from '@/test/helpers/renderWithAuth';
import UserListPage from '@/pages/admin/UserListPage';
import { AppLayout } from '@/components/layout/AppLayout';
import type { User, PaginatedResponse } from '@/types';
import { ApiError } from '@/types';

const mockListUsers = vi.fn<() => Promise<PaginatedResponse<User>>>();
const mockDeleteUser = vi.fn<() => Promise<void>>();
const mockDeactivateUser = vi.fn<() => Promise<void>>();
const mockReactivateUser = vi.fn<() => Promise<void>>();
const mockForcePasswordReset = vi.fn<() => Promise<void>>();

vi.mock('@/api/users', () => ({
  listUsers: (...args: unknown[]) => mockListUsers(...args as []),
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

const testUsers: User[] = [
  {
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
    updatedAt: '2025-03-01T00:00:00Z',
  },
  {
    id: '2',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    displayName: 'Admin User',
    avatarUrl: null,
    role: 'admin',
    isActive: true,
    emailVerified: true,
    createdAt: '2025-01-10T08:00:00Z',
    updatedAt: '2025-01-10T08:00:00Z',
  },
];

const defaultResponse: PaginatedResponse<User> = {
  items: testUsers,
  total: 2,
  page: 1,
  pageSize: 10,
  totalPages: 1,
};

function renderUserList() {
  const routes = [
    {
      Component: AppLayout,
      children: [
        { path: '/admin/users', Component: UserListPage },
        { path: '/admin/users/:id', element: <div>User Detail</div> },
        { path: '/admin/users/new', element: <div>Create User</div> },
      ],
    },
  ];

  return renderWithAuth(<></>, {
    routes,
    route: '/admin/users',
    user: adminUser,
  });
}

describe('UserListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListUsers.mockResolvedValue(defaultResponse);
  });

  it('renders the page heading and create button', async () => {
    renderUserList();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'Create New User' })).toHaveAttribute('href', '/admin/users/new');
  });

  it('renders user data after loading', async () => {
    renderUserList();

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  it('calls listUsers with default params', async () => {
    renderUserList();

    await waitFor(() => {
      expect(mockListUsers).toHaveBeenCalledWith({
        page: 1,
        pageSize: 10,
        search: undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    });
  });

  it('shows error state when fetch fails', async () => {
    mockListUsers.mockRejectedValue(new ApiError('Server error', 500));
    renderUserList();

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  it('shows empty state when no users match', async () => {
    mockListUsers.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    });
    renderUserList();

    await waitFor(() => {
      expect(screen.getByText('No users found.')).toBeInTheDocument();
    });
  });

  it('debounces search input', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderUserList();

    await waitFor(() => {
      expect(mockListUsers).toHaveBeenCalledTimes(1);
    });

    const searchInput = screen.getByLabelText('Search users');
    await user.type(searchInput, 'alice');

    // Should not have called yet with search
    expect(mockListUsers).toHaveBeenCalledTimes(1);

    // Advance past debounce
    await vi.advanceTimersByTimeAsync(300);

    await waitFor(() => {
      expect(mockListUsers).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'alice', page: 1 }),
      );
    });

    vi.useRealTimers();
  });

  it('updates sort when column header is clicked', async () => {
    const user = userEvent.setup();
    renderUserList();

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Name'));

    await waitFor(() => {
      expect(mockListUsers).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: 'lastName', sortOrder: 'asc' }),
      );
    });
  });

  it('shows pagination when multiple pages exist', async () => {
    mockListUsers.mockResolvedValue({
      items: testUsers,
      total: 25,
      page: 1,
      pageSize: 10,
      totalPages: 3,
    });
    const user = userEvent.setup();
    renderUserList();

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(mockListUsers).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
      );
    });
  });

  it('disables deactivate and delete for own account', async () => {
    renderUserList();

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    // The admin user (id: '2') matches adminUser from renderWithAuth
    // Find the admin row via their email which is unique
    const adminRow = screen.getByText('admin@example.com').closest('tr')!;
    const deactivateBtn = within(adminRow).getByRole('button', { name: 'Deactivate' });
    const deleteBtn = within(adminRow).getByRole('button', { name: 'Delete' });

    expect(deactivateBtn).toBeDisabled();
    expect(deleteBtn).toBeDisabled();
  });

  it('opens delete confirmation dialog requiring email', async () => {
    const user = userEvent.setup();
    renderUserList();

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    const aliceRow = screen.getByText('Alice Smith').closest('tr')!;
    await user.click(within(aliceRow).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.getByText('Delete User', { selector: 'h2' })).toBeInTheDocument();
    });

    // Confirm button inside dialog should be disabled until email is typed
    const dialog = screen.getByRole('dialog');
    const confirmBtn = within(dialog).getByRole('button', { name: 'Delete' });
    expect(confirmBtn).toBeDisabled();

    await user.type(screen.getByLabelText(/Type.*to confirm/), 'alice@example.com');
    expect(confirmBtn).toBeEnabled();
  });

  it('calls deleteUser on confirm and shows toast', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();
    mockDeleteUser.mockResolvedValue(undefined);
    renderUserList();

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    const aliceRow = screen.getByText('Alice Smith').closest('tr')!;
    await user.click(within(aliceRow).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.getByText('Delete User', { selector: 'h2' })).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    await user.type(screen.getByLabelText(/Type.*to confirm/), 'alice@example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockDeleteUser).toHaveBeenCalledWith('10');
    });
    expect(toast.success).toHaveBeenCalledWith('User alice@example.com has been deleted.');
  });

  it('opens deactivate confirmation dialog', async () => {
    const user = userEvent.setup();
    mockDeactivateUser.mockResolvedValue(undefined);
    renderUserList();

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    const aliceRow = screen.getByText('Alice Smith').closest('tr')!;
    await user.click(within(aliceRow).getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => {
      expect(screen.getByText('Deactivate User', { selector: 'h2' })).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => {
      expect(mockDeactivateUser).toHaveBeenCalledWith('10');
    });
  });

  it('calls forcePasswordReset and shows toast', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();
    mockForcePasswordReset.mockResolvedValue(undefined);
    renderUserList();

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    const aliceRow = screen.getByText('Alice Smith').closest('tr')!;
    await user.click(within(aliceRow).getByRole('button', { name: 'Reset Password' }));

    await waitFor(() => {
      expect(mockForcePasswordReset).toHaveBeenCalledWith('10');
    });
    expect(toast.success).toHaveBeenCalledWith('Password reset email sent to alice@example.com.');
  });

  it('has View links to user detail pages', async () => {
    renderUserList();

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    const aliceRow = screen.getByText('Alice Smith').closest('tr')!;
    const viewLink = within(aliceRow).getByRole('link', { name: 'View' });
    expect(viewLink).toHaveAttribute('href', '/admin/users/10');
  });
});
