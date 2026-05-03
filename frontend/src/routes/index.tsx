import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from '@/App';
import { PublicRoute } from '@/routes/PublicRoute';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { AdminRoute } from '@/routes/AdminRoute';
import { AuthLayout, AppLayout } from '@/components/layout';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import VerifyEmailPage from '@/pages/auth/VerifyEmailPage';
import DashboardPage from '@/pages/DashboardPage';
import ProfilePage from '@/pages/profile/ProfilePage';
import ChangePasswordPage from '@/pages/profile/ChangePasswordPage';
import UserListPage from '@/pages/admin/UserListPage';
import UserDetailPage from '@/pages/admin/UserDetailPage';
import CreateUserPage from '@/pages/admin/CreateUserPage';
import WhitelistPage from '@/pages/admin/WhitelistPage';

export const router = createBrowserRouter([
  {
    Component: App,
    children: [
      {
        path: '/',
        element: <Navigate to="/login" replace />,
      },
      {
        Component: PublicRoute,
        children: [
          {
            Component: AuthLayout,
            children: [
              { path: '/login', Component: LoginPage },
              { path: '/register', Component: RegisterPage },
              { path: '/forgot-password', Component: ForgotPasswordPage },
              { path: '/reset-password', Component: ResetPasswordPage },
              { path: '/verify-email', Component: VerifyEmailPage },
            ],
          },
        ],
      },
      {
        Component: ProtectedRoute,
        children: [
          {
            Component: AppLayout,
            children: [
              { path: '/dashboard', Component: DashboardPage },
              { path: '/profile', Component: ProfilePage },
              { path: '/profile/change-password', Component: ChangePasswordPage },
            ],
          },
        ],
      },
      {
        Component: AdminRoute,
        children: [
          {
            Component: AppLayout,
            children: [
              { path: '/admin/users', Component: UserListPage },
              { path: '/admin/users/new', Component: CreateUserPage },
              { path: '/admin/users/:id', Component: UserDetailPage },
              { path: '/admin/whitelist', Component: WhitelistPage },
            ],
          },
        ],
      },
    ],
  },
]);
