import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { MobileMenu } from '@/components/layout/MobileMenu';
import type { NavItem } from '@/components/layout/MobileMenu';
import { Button } from '@/components/ui';

const navLinks: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/profile', label: 'Profile' },
];

const adminLinks: NavItem[] = [
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/whitelist', label: 'Whitelist' },
];

function desktopLinkClass({ isActive }: { isActive: boolean }): string {
  return `text-sm font-medium ${
    isActive
      ? 'text-blue-600'
      : 'text-gray-600 hover:text-gray-900'
  }`;
}

export function Navbar() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdmin = user?.role === 'admin';

  function handleLogout() {
    void logout();
  }

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <span className="text-lg font-bold text-gray-900">React Starter</span>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Main navigation">
          {navLinks.map((link) => (
            <NavLink key={link.to} to={link.to} end className={desktopLinkClass}>
              {link.label}
            </NavLink>
          ))}
          {isAdmin &&
            adminLinks.map((link) => (
              <NavLink key={link.to} to={link.to} end className={desktopLinkClass}>
                {link.label}
              </NavLink>
            ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <span className="text-sm text-gray-700">
            {user?.displayName || user?.email}
          </span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Sign Out
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 md:hidden"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileMenuOpen ? (
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          )}
        </button>
      </div>

      {mobileMenuOpen && (
        <MobileMenu
          navLinks={navLinks}
          adminLinks={isAdmin ? adminLinks : []}
          user={user}
          onLogout={handleLogout}
          onClose={() => setMobileMenuOpen(false)}
        />
      )}
    </header>
  );
}
