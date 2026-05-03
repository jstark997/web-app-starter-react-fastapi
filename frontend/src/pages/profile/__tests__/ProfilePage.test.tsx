import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, defaultUser } from '@/test/helpers/renderWithAuth';
import ProfilePage from '@/pages/profile/ProfilePage';
import { AppLayout } from '@/components/layout/AppLayout';
import { ApiError } from '@/types';
import type { AuthUser } from '@/types';

// jsdom doesn't implement showModal/close on <dialog>
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  });
});

const mockUpdateProfile = vi.fn<() => Promise<AuthUser>>();
const mockChangeEmail = vi.fn<() => Promise<void>>();

vi.mock('@/api/profile', () => ({
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args as []),
  changeEmail: (...args: unknown[]) => mockChangeEmail(...args as []),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  Toaster: () => null,
}));

function renderProfile() {
  const routes = [
    {
      Component: AppLayout,
      children: [
        { path: '/profile', Component: ProfilePage },
        { path: '/profile/change-password', element: <div>Change Password Page</div> },
      ],
    },
  ];

  return renderWithAuth(<></>, {
    routes,
    route: '/profile',
    user: defaultUser,
  });
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders profile information', () => {
    renderProfile();
    expect(screen.getByText('My Profile')).toBeInTheDocument();
    expect(screen.getByText(defaultUser.email)).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('pre-populates form with user data', () => {
    renderProfile();
    expect(screen.getByLabelText('First name')).toHaveValue(defaultUser.firstName);
    expect(screen.getByLabelText('Last name')).toHaveValue(defaultUser.lastName);
    expect(screen.getByLabelText('Display name')).toHaveValue(defaultUser.displayName);
  });

  it('shows validation errors for empty required fields', async () => {
    const user = userEvent.setup();
    renderProfile();

    await user.clear(screen.getByLabelText('First name'));
    await user.clear(screen.getByLabelText('Last name'));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(screen.getByText('First name is required.')).toBeInTheDocument();
    });
    expect(screen.getByText('Last name is required.')).toBeInTheDocument();
  });

  it('calls updateProfile on valid submission and updates AuthContext', async () => {
    const user = userEvent.setup();
    const updatedUser: AuthUser = {
      ...defaultUser,
      firstName: 'Updated',
      displayName: 'Updated User',
    };
    mockUpdateProfile.mockResolvedValue(updatedUser);

    const { mockUpdateUser } = renderProfile();

    await user.clear(screen.getByLabelText('First name'));
    await user.type(screen.getByLabelText('First name'), 'Updated');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledOnce();
    });

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith(updatedUser);
    });
  });

  it('shows success toast after save', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();
    mockUpdateProfile.mockResolvedValue(defaultUser);

    renderProfile();
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Profile updated successfully.');
    });
  });

  it('shows server error on API failure', async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockRejectedValue(new ApiError('Server error', 500));

    renderProfile();
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  it('opens Change Email dialog', async () => {
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole('button', { name: 'Change Email' }));

    await waitFor(() => {
      expect(screen.getByText('Change Email Address')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('New email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toBeInTheDocument();
  });

  it('submits change email form and shows confirmation', async () => {
    const user = userEvent.setup();
    mockChangeEmail.mockResolvedValue(undefined);

    renderProfile();

    await user.click(screen.getByRole('button', { name: 'Change Email' }));

    await waitFor(() => {
      expect(screen.getByLabelText('New email address')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('New email address'), 'new@example.com');
    await user.type(screen.getByLabelText('Current password'), 'password123');

    // Find the submit button inside the dialog (not the "Change Email" nav button)
    const dialogButtons = screen.getAllByRole('button', { name: 'Change Email' });
    const submitButton = dialogButtons[dialogButtons.length - 1];
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockChangeEmail).toHaveBeenCalledWith({
        newEmail: 'new@example.com',
        currentPassword: 'password123',
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/verification email has been sent/i)).toBeInTheDocument();
    });
  });

  it('has link to change password page', () => {
    renderProfile();
    const link = screen.getByRole('link', { name: 'Change password' });
    expect(link).toHaveAttribute('href', '/profile/change-password');
  });

  it('displays member since date', () => {
    renderProfile();
    expect(screen.getByText('Member since')).toBeInTheDocument();
  });

  it('displays initials when no avatar', () => {
    renderProfile();
    expect(screen.getByText('TU')).toBeInTheDocument();
  });
});
