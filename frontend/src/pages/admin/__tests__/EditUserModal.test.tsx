import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, adminUser } from '@/test/helpers/renderWithAuth';
import { EditUserModal } from '@/pages/admin/EditUserModal';
import type { User } from '@/types';
import { ApiError } from '@/types';

const mockUpdateUser = vi.fn<() => Promise<User>>();

vi.mock('@/api/users', () => ({
  updateUser: (...args: unknown[]) => mockUpdateUser(...args as []),
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
  updatedAt: '2025-03-01T00:00:00Z',
};

const mockOnClose = vi.fn();
const mockOnUserUpdated = vi.fn();

function renderEditModal(isOpen = true) {
  return renderWithAuth(
    <EditUserModal
      isOpen={isOpen}
      onClose={mockOnClose}
      user={testUser}
      onUserUpdated={mockOnUserUpdated}
    />,
    { user: adminUser },
  );
}

describe('EditUserModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pre-fills form with user data', () => {
    renderEditModal();

    expect(screen.getByLabelText('First name')).toHaveValue('Alice');
    expect(screen.getByLabelText('Last name')).toHaveValue('Smith');
    expect(screen.getByLabelText('Display name')).toHaveValue('Alice S');
    expect(screen.getByLabelText('Email')).toHaveValue('alice@example.com');
    expect(screen.getByLabelText('Role')).toHaveValue('user');
    expect(screen.getByLabelText('Active')).toBeChecked();
  });

  it('calls updateUser with correct payload on save', async () => {
    const user = userEvent.setup();
    const updatedUser: User = { ...testUser, firstName: 'Alicia' };
    mockUpdateUser.mockResolvedValue(updatedUser);
    renderEditModal();

    const firstNameInput = screen.getByLabelText('First name');
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'Alicia');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith('10', {
        firstName: 'Alicia',
        lastName: 'Smith',
        displayName: 'Alice S',
        email: 'alice@example.com',
        role: 'user',
        isActive: true,
      });
    });
  });

  it('shows success toast and calls callbacks on success', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();
    const updatedUser: User = { ...testUser, firstName: 'Alicia' };
    mockUpdateUser.mockResolvedValue(updatedUser);
    renderEditModal();

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('User updated successfully.');
    });
    expect(mockOnUserUpdated).toHaveBeenCalledWith(updatedUser);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('maps server field errors to form fields', async () => {
    const user = userEvent.setup();
    mockUpdateUser.mockRejectedValue(
      new ApiError('Validation failed', 422, [
        { field: 'email', message: 'Email already in use.' },
      ]),
    );
    renderEditModal();

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(screen.getByText('Email already in use.')).toBeInTheDocument();
    });
  });

  it('shows form-level server error for generic ApiError', async () => {
    const user = userEvent.setup();
    mockUpdateUser.mockRejectedValue(new ApiError('Internal server error', 500));
    renderEditModal();

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Internal server error');
    });
  });

  it('cancel button calls onClose', async () => {
    const user = userEvent.setup();
    renderEditModal();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockOnClose).toHaveBeenCalled();
  });
});
