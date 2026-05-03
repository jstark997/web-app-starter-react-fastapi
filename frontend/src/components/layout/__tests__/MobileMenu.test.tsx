import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, defaultUser, adminUser } from '@/test/helpers/renderWithAuth';
import { AppLayout } from '@/components/layout/AppLayout';

function createRoutes() {
  return [
    {
      Component: AppLayout,
      children: [
        { path: '/', element: <div>Page Content</div> },
        { path: '/dashboard', element: <div>Dashboard Page</div> },
      ],
    },
  ];
}

function getHamburgerButton(): HTMLElement {
  return screen.getByRole('button', { name: /menu/i });
}

describe('MobileMenu', () => {
  it('mobile menu is not visible by default', () => {
    renderWithAuth(<></>, { routes: createRoutes(), route: '/', user: defaultUser });
    expect(screen.queryByTestId('mobile-menu')).not.toBeInTheDocument();
  });

  it('clicking hamburger opens mobile menu', async () => {
    const user = userEvent.setup();
    renderWithAuth(<></>, { routes: createRoutes(), route: '/', user: defaultUser });

    await user.click(getHamburgerButton());
    expect(screen.getByTestId('mobile-menu')).toBeInTheDocument();
  });

  it('clicking hamburger again closes mobile menu', async () => {
    const user = userEvent.setup();
    renderWithAuth(<></>, { routes: createRoutes(), route: '/', user: defaultUser });

    await user.click(getHamburgerButton());
    expect(screen.getByTestId('mobile-menu')).toBeInTheDocument();

    await user.click(getHamburgerButton());
    expect(screen.queryByTestId('mobile-menu')).not.toBeInTheDocument();
  });

  it('shows admin links in mobile menu for admin user', async () => {
    const user = userEvent.setup();
    renderWithAuth(<></>, { routes: createRoutes(), route: '/', user: adminUser });

    await user.click(getHamburgerButton());
    const menu = screen.getByTestId('mobile-menu');
    expect(within(menu).getByText('Users')).toBeInTheDocument();
    expect(within(menu).getByText('Whitelist')).toBeInTheDocument();
  });

  it('does not show admin links in mobile menu for regular user', async () => {
    const user = userEvent.setup();
    renderWithAuth(<></>, { routes: createRoutes(), route: '/', user: defaultUser });

    await user.click(getHamburgerButton());
    const menu = screen.getByTestId('mobile-menu');
    expect(within(menu).queryByText('Users')).not.toBeInTheDocument();
    expect(within(menu).queryByText('Whitelist')).not.toBeInTheDocument();
  });

  it('clicking a nav link closes the mobile menu', async () => {
    const user = userEvent.setup();
    renderWithAuth(<></>, { routes: createRoutes(), route: '/', user: defaultUser });

    await user.click(getHamburgerButton());
    expect(screen.getByTestId('mobile-menu')).toBeInTheDocument();

    const menu = screen.getByTestId('mobile-menu');
    await user.click(within(menu).getByText('Dashboard'));
    expect(screen.queryByTestId('mobile-menu')).not.toBeInTheDocument();
  });

  it('hamburger button has correct aria-expanded state', async () => {
    const user = userEvent.setup();
    renderWithAuth(<></>, { routes: createRoutes(), route: '/', user: defaultUser });

    const hamburger = getHamburgerButton();
    expect(hamburger).toHaveAttribute('aria-expanded', 'false');

    await user.click(hamburger);
    expect(hamburger).toHaveAttribute('aria-expanded', 'true');
  });
});
