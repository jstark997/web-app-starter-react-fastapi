import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithAuth } from '@/test/helpers/renderWithAuth';
import { AuthLayout } from '@/components/layout/AuthLayout';

describe('AuthLayout', () => {
  const routes = [
    {
      Component: AuthLayout,
      children: [
        { path: '/', element: <div>Auth Page Content</div> },
      ],
    },
  ];

  it('renders child content via Outlet', () => {
    renderWithAuth(<></>, { routes, route: '/', user: null });
    expect(screen.getByText('Auth Page Content')).toBeInTheDocument();
  });

  it('renders branding text', () => {
    renderWithAuth(<></>, { routes, route: '/', user: null });
    expect(screen.getByText('React Starter')).toBeInTheDocument();
  });

  it('does not render navigation elements', () => {
    renderWithAuth(<></>, { routes, route: '/', user: null });
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Profile')).not.toBeInTheDocument();
    expect(screen.queryByText('Sign Out')).not.toBeInTheDocument();
  });
});
