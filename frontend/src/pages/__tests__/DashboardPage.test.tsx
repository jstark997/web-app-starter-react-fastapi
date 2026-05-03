import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithAuth, defaultUser } from '@/test/helpers/renderWithAuth';
import DashboardPage from '@/pages/DashboardPage';

describe('DashboardPage', () => {
  it('greets the user by their display name when one is set', () => {
    renderWithAuth(<DashboardPage />, {
      user: { ...defaultUser, displayName: 'Ada Lovelace' },
    });

    expect(
      screen.getByRole('heading', { name: /welcome, ada lovelace/i }),
    ).toBeInTheDocument();
  });

  it('falls back to first name when display name is null', () => {
    renderWithAuth(<DashboardPage />, {
      user: { ...defaultUser, displayName: null, firstName: 'Grace' },
    });

    expect(
      screen.getByRole('heading', { name: /welcome, grace/i }),
    ).toBeInTheDocument();
  });

  it('marks the page as a placeholder for the consuming application', () => {
    renderWithAuth(<DashboardPage />);

    expect(screen.getByText(/dashboard placeholder/i)).toBeInTheDocument();
    expect(screen.getByText('src/pages/DashboardPage.tsx')).toBeInTheDocument();
  });
});
