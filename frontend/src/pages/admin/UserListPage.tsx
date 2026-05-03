import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { listUsers, deleteUser, deactivateUser, reactivateUser, forcePasswordReset } from '@/api/users';
import { useDebounce } from '@/hooks/useDebounce';
import { Button, Badge, Input, Table, Pagination, ConfirmDialog } from '@/components/ui';
import type { TableColumn } from '@/components/ui';
import { EditUserModal } from '@/pages/admin/EditUserModal';
import type { User } from '@/types';
import { ApiError } from '@/types';

export default function UserListPage() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 300);
  const prevSearchRef = useRef(debouncedSearch);

  const fetchUsers = useCallback(async (currentPage: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await listUsers({
        page: currentPage,
        pageSize: 10,
        search: debouncedSearch || undefined,
        sortBy,
        sortOrder,
      });
      setUsers(response.items);
      setTotalPages(response.totalPages);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load users.';
      setError(message);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, sortBy, sortOrder]);

  useEffect(() => {
    if (prevSearchRef.current !== debouncedSearch) {
      prevSearchRef.current = debouncedSearch;
      setPage(1);
      fetchUsers(1);
    } else {
      fetchUsers(page);
    }
  }, [page, debouncedSearch, sortBy, sortOrder, fetchUsers]);

  function handleSort(key: string) {
    if (sortBy === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
    setPage(1);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setActionLoading(deleteTarget.id);
    try {
      await deleteUser(deleteTarget.id);
      toast.success(`User ${deleteTarget.email} has been deleted.`);
      setDeleteTarget(null);
      fetchUsers(page);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete user.';
      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeactivateToggle() {
    if (!deactivateTarget) return;
    const newStatus = !deactivateTarget.isActive;
    setActionLoading(deactivateTarget.id);
    try {
      if (newStatus) {
        await reactivateUser(deactivateTarget.id);
      } else {
        await deactivateUser(deactivateTarget.id);
      }
      toast.success(`User ${deactivateTarget.email} has been ${newStatus ? 'reactivated' : 'deactivated'}.`);
      setDeactivateTarget(null);
      fetchUsers(page);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update user status.';
      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleForcePasswordReset(targetUser: User) {
    setActionLoading(targetUser.id);
    try {
      await forcePasswordReset(targetUser.id);
      toast.success(`Password reset email sent to ${targetUser.email}.`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to send password reset.';
      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function getInitials(user: User): string {
    const first = user.firstName?.[0] ?? '';
    const last = user.lastName?.[0] ?? '';
    return (first + last).toUpperCase();
  }

  const isSelf = (user: User) => user.id === currentUser?.id;

  const columns: TableColumn<User>[] = [
    {
      key: 'avatar',
      header: '',
      hideOnMobile: true,
      render: (user) =>
        user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
            {getInitials(user)}
          </div>
        ),
    },
    {
      key: 'lastName',
      header: 'Name',
      sortable: true,
      render: (user) => (
        <div>
          <div className="font-medium">{user.firstName} {user.lastName}</div>
          {user.displayName && (
            <div className="text-xs text-gray-500">{user.displayName}</div>
          )}
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      hideOnMobile: true,
      render: (user) => user.email,
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      hideOnMobile: true,
      render: (user) => <Badge variant={user.role} />,
    },
    {
      key: 'status',
      header: 'Status',
      hideOnMobile: true,
      render: (user) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant={user.isActive ? 'active' : 'inactive'} />
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Member Since',
      sortable: true,
      hideOnMobile: true,
      render: (user) => formatDate(user.createdAt),
    },
    {
      key: 'actions',
      header: '',
      render: (user) => (
        <div className="flex flex-wrap gap-1">
          <Link to={`/admin/users/${user.id}`}>
            <Button variant="ghost" size="sm">View</Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => setEditTarget(user)}>Edit</Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={isSelf(user) || actionLoading === user.id}
            onClick={() => setDeactivateTarget(user)}
          >
            {user.isActive ? 'Deactivate' : 'Reactivate'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={actionLoading === user.id}
            onClick={() => handleForcePasswordReset(user)}
          >
            Reset Password
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={isSelf(user) || actionLoading === user.id}
            onClick={() => setDeleteTarget(user)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
        <Link to="/admin/users/new">
          <Button>Create New User</Button>
        </Link>
      </div>

      <div className="mb-4">
        <Input
          label="Search users"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
        />
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3" role="alert">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <Table<User>
        columns={columns}
        data={users}
        rowKey={(user) => user.id}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        isLoading={isLoading}
        emptyMessage="No users found."
      />

      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete User"
        message={`Are you sure you want to delete ${deleteTarget?.email}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        confirmationText={deleteTarget?.email}
      />

      <ConfirmDialog
        isOpen={deactivateTarget !== null}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivateToggle}
        title={deactivateTarget?.isActive ? 'Deactivate User' : 'Reactivate User'}
        message={
          deactivateTarget?.isActive
            ? `Are you sure you want to deactivate ${deactivateTarget?.email}? They will be unable to log in.`
            : `Are you sure you want to reactivate ${deactivateTarget?.email}?`
        }
        confirmLabel={deactivateTarget?.isActive ? 'Deactivate' : 'Reactivate'}
        variant="warning"
      />

      {editTarget && (
        <EditUserModal
          isOpen={editTarget !== null}
          onClose={() => setEditTarget(null)}
          user={editTarget}
          onUserUpdated={() => {
            setEditTarget(null);
            fetchUsers(page);
          }}
        />
      )}
    </div>
  );
}
