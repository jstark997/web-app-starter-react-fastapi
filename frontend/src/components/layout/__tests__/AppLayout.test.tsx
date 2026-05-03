import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, defaultUser, adminUser } from '@/test/helpers/renderWithAuth';
import { AppLayout } from '@/components/layout/AppLayout';

function createRoutes(childContent: string) {
  return [
    {
      Component: AppLayout,
      children: [
        { path: '/', element: <div>{childContent}</div> },
      ],
    },
  ];
}

describe('AppLayout', () => {
  it('renders child content via Outlet', () => {
    renderWithAuth(<></>, { routes: createRoutes('Page Content'), route: '/' });
    expect(screen.getByText('Page Content')).toBeInTheDocument();
  });

  it('renders Dashboard and Profile links for regular user', () => {
    renderWithAuth(<></>, { routes: createRoutes('Test'), route: '/', user: defaultUser });
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument();
  });

  it('does not render admin links for regular user', () => {
    renderWithAuth(<></>, { routes: createRoutes('Test'), route: '/', user: defaultUser });
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(nav.querySelector('a[href="/admin/users"]')).not.toBeInTheDocument();
    expect(nav.querySelector('a[href="/admin/whitelist"]')).not.toBeInTheDocument();
  });

  it('renders admin links for admin user', () => {
    renderWithAuth(<></>, { routes: createRoutes('Test'), route: '/', user: adminUser });
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(nav.querySelector('a[href="/admin/users"]')).toBeInTheDocument();
    expect(nav.querySelector('a[href="/admin/whitelist"]')).toBeInTheDocument();
  });

  it('displays user displayName', () => {
    renderWithAuth(<></>, { routes: createRoutes('Test'), route: '/', user: defaultUser });
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('calls logout when Sign Out is clicked', async () => {
    const user = userEvent.setup();
    const { mockLogout } = renderWithAuth(<></>, {
      routes: createRoutes('Test'),
      route: '/',
    });

    const signOutButtons = screen.getAllByRole('button', { name: 'Sign Out' });
    await user.click(signOutButtons[0]);
    expect(mockLogout).toHaveBeenCalledOnce();
  });
});
