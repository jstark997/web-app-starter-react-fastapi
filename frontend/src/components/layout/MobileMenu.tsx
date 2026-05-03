import { NavLink } from 'react-router-dom';
import type { AuthUser } from '@/types';
import { Button } from '@/components/ui';

interface NavItem {
  to: string;
  label: string;
}

interface MobileMenuProps {
  navLinks: NavItem[];
  adminLinks: NavItem[];
  user: AuthUser | null;
  onLogout: () => void;
  onClose: () => void;
}

function linkClass({ isActive }: { isActive: boolean }): string {
  return `block px-4 py-2 text-sm font-medium rounded-md ${
    isActive
      ? 'bg-blue-50 text-blue-600'
      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
  }`;
}

export function MobileMenu({
  navLinks,
  adminLinks,
  user,
  onLogout,
  onClose,
}: MobileMenuProps) {
  function handleLinkClick() {
    onClose();
  }

  function handleLogout() {
    onClose();
    void onLogout();
  }

  return (
    <nav
      className="border-b border-gray-200 bg-white px-4 pb-4 md:hidden"
      aria-label="Mobile navigation"
      data-testid="mobile-menu"
    >
      <div className="space-y-1">
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={linkClass}
            onClick={handleLinkClick}
          >
            {link.label}
          </NavLink>
        ))}
        {adminLinks.length > 0 && (
          <>
            <div className="border-t border-gray-200 pt-2 mt-2">
              <span className="block px-4 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Admin
              </span>
            </div>
            {adminLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={linkClass}
                onClick={handleLinkClick}
              >
                {link.label}
              </NavLink>
            ))}
          </>
        )}
      </div>
      <div className="mt-4 border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between px-4">
          <span className="text-sm text-gray-700">
            {user?.displayName || user?.email}
          </span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Sign Out
          </Button>
        </div>
      </div>
    </nav>
  );
}

export type { MobileMenuProps, NavItem };
