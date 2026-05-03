import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, adminUser } from '@/test/helpers/renderWithAuth';
import WhitelistPage from '@/pages/admin/WhitelistPage';
import { AppLayout } from '@/components/layout/AppLayout';
import type { WhitelistEntry, WhitelistSettings } from '@/types';
import { ApiError } from '@/types';

const mockGetSettings = vi.fn<() => Promise<WhitelistSettings>>();
const mockUpdateSettings = vi.fn<() => Promise<WhitelistSettings>>();
const mockListEntries = vi.fn<() => Promise<WhitelistEntry[]>>();
const mockAddEntry = vi.fn<() => Promise<WhitelistEntry>>();
const mockRemoveEntry = vi.fn<() => Promise<void>>();

vi.mock('@/api/whitelist', () => ({
  getWhitelistSettings: (...args: unknown[]) => mockGetSettings(...args as []),
  updateWhitelistSettings: (...args: unknown[]) => mockUpdateSettings(...args as []),
  listWhitelistEntries: (...args: unknown[]) => mockListEntries(...args as []),
  addWhitelistEntry: (...args: unknown[]) => mockAddEntry(...args as []),
  removeWhitelistEntry: (...args: unknown[]) => mockRemoveEntry(...args as []),
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

const testEntries: WhitelistEntry[] = [
  {
    id: 'a1',
    email: 'alice@example.com',
    createdAt: '2025-03-01T00:00:00Z',
  },
  {
    id: 'b2',
    email: 'bob@example.com',
    createdAt: '2025-03-02T00:00:00Z',
  },
  {
    id: 'c3',
    email: 'carol@example.com',
    createdAt: '2025-03-03T00:00:00Z',
  },
];

function renderWhitelist() {
  const routes = [
    {
      Component: AppLayout,
      children: [
        { path: '/admin/whitelist', Component: WhitelistPage },
      ],
    },
  ];

  return renderWithAuth(<></>, {
    routes,
    route: '/admin/whitelist',
    user: adminUser,
  });
}

describe('WhitelistPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSettings.mockResolvedValue({ enabled: true });
    mockListEntries.mockResolvedValue(testEntries);
  });

  it('fetches settings and entries on load and renders them', async () => {
    renderWhitelist();

    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalledTimes(1);
    });
    expect(mockListEntries).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    expect(screen.getByText('carol@example.com')).toBeInTheDocument();
  });

  it('reflects enabled toggle state with correct label', async () => {
    mockGetSettings.mockResolvedValue({ enabled: true });
    renderWhitelist();

    await waitFor(() => {
      expect(
        screen.getByText('Whitelist Enabled — only whitelisted emails may register'),
      ).toBeInTheDocument();
    });

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('reflects disabled toggle state with correct label', async () => {
    mockGetSettings.mockResolvedValue({ enabled: false });
    renderWhitelist();

    await waitFor(() => {
      expect(
        screen.getByText('Whitelist Disabled — anyone may register'),
      ).toBeInTheDocument();
    });

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('calls updateWhitelistSettings when toggle is clicked', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue({ enabled: false });
    mockUpdateSettings.mockResolvedValue({ enabled: true });
    renderWhitelist();

    await waitFor(() => {
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({ enabled: true });
    });

    await waitFor(() => {
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    });
  });

  it('shows page-level error when initial load fails', async () => {
    mockGetSettings.mockRejectedValue(new ApiError('Server is down', 500));
    renderWhitelist();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server is down');
    });
  });

  it('does not call addWhitelistEntry when email is invalid', async () => {
    const user = userEvent.setup();
    renderWhitelist();

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
    });
    expect(mockAddEntry).not.toHaveBeenCalled();
  });

  it('does not call addWhitelistEntry when email is empty', async () => {
    const user = userEvent.setup();
    renderWhitelist();

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(screen.getByText('Email is required.')).toBeInTheDocument();
    });
    expect(mockAddEntry).not.toHaveBeenCalled();
  });

  it('adds a valid email and shows it in the list', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();
    mockAddEntry.mockResolvedValue({
      id: 'd4',
      email: 'dan@example.com',
      createdAt: '2025-03-04T00:00:00Z',
    });

    renderWhitelist();

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('Email'), 'dan@example.com');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(mockAddEntry).toHaveBeenCalledWith({ email: 'dan@example.com' });
    });

    await waitFor(() => {
      expect(screen.getByText('dan@example.com')).toBeInTheDocument();
    });
    expect(toast.success).toHaveBeenCalledWith('dan@example.com added to whitelist.');
  });

  it('shows session-invalidation warning when whitelist is enabled', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue({ enabled: true });
    renderWhitelist();

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    const aliceRow = screen.getByText('alice@example.com').closest('li')!;
    await user.click(within(aliceRow).getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/immediately invalidate any active sessions/i);
    expect(dialog).toHaveTextContent('alice@example.com');
  });

  it('does not show session-invalidation warning when whitelist is disabled', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue({ enabled: false });
    renderWhitelist();

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    const aliceRow = screen.getByText('alice@example.com').closest('li')!;
    await user.click(within(aliceRow).getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    expect(dialog).not.toHaveTextContent(/invalidate any active sessions/i);
    expect(dialog).toHaveTextContent('alice@example.com');
  });

  it('removes an entry after confirming and shows toast', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();
    mockRemoveEntry.mockResolvedValue(undefined);
    renderWhitelist();

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    const aliceRow = screen.getByText('alice@example.com').closest('li')!;
    await user.click(within(aliceRow).getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(mockRemoveEntry).toHaveBeenCalledWith('a1');
    });

    await waitFor(() => {
      expect(screen.queryByText('alice@example.com')).not.toBeInTheDocument();
    });
    expect(toast.success).toHaveBeenCalledWith('alice@example.com removed from whitelist.');
  });

  it('filters entries by search input (client-side, case-insensitive)', async () => {
    const user = userEvent.setup();
    renderWhitelist();

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('Search whitelist'), 'BoB');

    await waitFor(() => {
      expect(screen.queryByText('alice@example.com')).not.toBeInTheDocument();
    });
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    expect(screen.queryByText('carol@example.com')).not.toBeInTheDocument();
  });

  it('shows empty-search message when no entries match the filter', async () => {
    const user = userEvent.setup();
    renderWhitelist();

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('Search whitelist'), 'zzz');

    await waitFor(() => {
      expect(screen.getByText('No entries match your search.')).toBeInTheDocument();
    });
  });

  it('shows empty-list message when no entries exist', async () => {
    mockListEntries.mockResolvedValue([]);
    renderWhitelist();

    await waitFor(() => {
      expect(screen.getByText('No emails on the whitelist yet.')).toBeInTheDocument();
    });
  });

  it('maps server field error on add to the email field', async () => {
    const user = userEvent.setup();
    mockAddEntry.mockRejectedValue(
      new ApiError('Validation failed', 422, [
        { field: 'email', message: 'Email already on whitelist.' },
      ]),
    );

    renderWhitelist();

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(screen.getByText('Email already on whitelist.')).toBeInTheDocument();
    });
  });
});
