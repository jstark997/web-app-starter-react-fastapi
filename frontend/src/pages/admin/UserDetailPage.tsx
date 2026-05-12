import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/context/useAuth';
import { getUser, deleteUser, deactivateUser, reactivateUser, forcePasswordReset } from '@/api/users';
import { Button, Badge, Skeleton, ConfirmDialog } from '@/components/ui';
import { EditUserModal } from '@/pages/admin/EditUserModal';
import type { User } from '@/types';
import { ApiError } from '@/types';

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUser = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getUser(id);
      setUser(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError('User not found.');
      } else {
        const message = err instanceof ApiError ? err.message : 'Failed to load user.';
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const isSelf = user?.id === currentUser?.id;

  async function handleDelete() {
    if (!user) return;
    setActionLoading(true);
    try {
      await deleteUser(user.id);
      toast.success(`User ${user.email} has been deleted.`);
      navigate('/admin/users');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete user.';
      toast.error(message);
    } finally {
      setActionLoading(false);
      setDeleteDialogOpen(false);
    }
  }

  async function handleDeactivateToggle() {
    if (!user) return;
    const newStatus = !user.isActive;
    setActionLoading(true);
    try {
      if (newStatus) {
        await reactivateUser(user.id);
      } else {
        await deactivateUser(user.id);
      }
      setUser({ ...user, isActive: newStatus });
      toast.success(`User ${user.email} has been ${newStatus ? 'reactivated' : 'deactivated'}.`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update user status.';
      toast.error(message);
    } finally {
      setActionLoading(false);
      setDeactivateDialogOpen(false);
    }
  }

  async function handleForcePasswordReset() {
    if (!user) return;
    setActionLoading(true);
    try {
      await forcePasswordReset(user.id);
      toast.success(`Password reset email sent to ${user.email}.`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to send password reset.';
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function getInitials(): string {
    if (!user) return '';
    const first = user.firstName?.[0] ?? '';
    const last = user.lastName?.[0] ?? '';
    return (first + last).toUpperCase();
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <Skeleton variant="text" width="12rem" height="2rem" />
          <Skeleton variant="rectangular" width="8rem" height="2.5rem" />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          <div className="flex items-start gap-6">
            <Skeleton variant="circular" width="5rem" height="5rem" />
            <div className="flex-1 space-y-3">
              <Skeleton variant="text" width="60%" height="1.5rem" />
              <Skeleton variant="text" width="40%" height="1rem" />
              <Skeleton variant="text" width="30%" height="1rem" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-md bg-red-50 p-6 text-center" role="alert">
          <p className="text-sm text-red-700">{error}</p>
          <Link
            to="/admin/users"
            className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-500"
          >
            Back to Users
          </Link>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{user.displayName || `${user.firstName} ${user.lastName}`}</h1>
        <Link to="/admin/users">
          <Button variant="secondary">Back to Users</Button>
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start gap-6">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-xl font-semibold text-blue-700">
              {getInitials()}
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <span className="text-sm font-medium text-gray-500">Full Name</span>
              <p className="text-sm text-gray-900">{user.firstName} {user.lastName}</p>
            </div>

            {user.displayName && (
              <div>
                <span className="text-sm font-medium text-gray-500">Display Name</span>
                <p className="text-sm text-gray-900">{user.displayName}</p>
              </div>
            )}

            <div>
              <span className="text-sm font-medium text-gray-500">Email</span>
              <p className="text-sm text-gray-900">{user.email}</p>
            </div>

            <div className="flex flex-wrap gap-4">
              <div>
                <span className="text-sm font-medium text-gray-500">Role</span>
                <div className="mt-1">
                  <Badge variant={user.role} />
                </div>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Status</span>
                <div className="mt-1">
                  <Badge variant={user.isActive ? 'active' : 'inactive'} />
                </div>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Email Verified</span>
                <div className="mt-1">
                  <Badge variant={user.emailVerified ? 'verified' : 'unverified'} />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div>
                <span className="text-sm font-medium text-gray-500">Member Since</span>
                <p className="text-sm text-gray-900">{formatDate(user.createdAt)}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Last Updated</span>
                <p className="text-sm text-gray-900">{formatDate(user.updatedAt)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={() => setEditModalOpen(true)}>Edit User</Button>
        <Button
          variant="secondary"
          disabled={actionLoading}
          onClick={handleForcePasswordReset}
        >
          Force Password Reset
        </Button>
        <Button
          variant={user.isActive ? 'danger' : 'primary'}
          disabled={isSelf || actionLoading}
          onClick={() => setDeactivateDialogOpen(true)}
        >
          {user.isActive ? 'Deactivate' : 'Reactivate'}
        </Button>
        <Button
          variant="danger"
          disabled={isSelf || actionLoading}
          onClick={() => setDeleteDialogOpen(true)}
        >
          Delete User
        </Button>
      </div>

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete User"
        message={`Are you sure you want to delete ${user.email}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        confirmationText={user.email}
      />

      <ConfirmDialog
        isOpen={deactivateDialogOpen}
        onClose={() => setDeactivateDialogOpen(false)}
        onConfirm={handleDeactivateToggle}
        title={user.isActive ? 'Deactivate User' : 'Reactivate User'}
        message={
          user.isActive
            ? `Are you sure you want to deactivate ${user.email}? They will be unable to log in.`
            : `Are you sure you want to reactivate ${user.email}?`
        }
        confirmLabel={user.isActive ? 'Deactivate' : 'Reactivate'}
        variant="warning"
      />

      <EditUserModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        user={user}
        onUserUpdated={(updatedUser) => {
          setUser(updatedUser);
          setEditModalOpen(false);
        }}
      />
    </div>
  );
}
