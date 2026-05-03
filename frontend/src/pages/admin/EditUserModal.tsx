import { useEffect, useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { updateUser } from '@/api/users';
import { Dialog, Input, Button } from '@/components/ui';
import { editUserSchema } from '@/utils/validation';
import type { EditUserFormData, EditUserFormInput } from '@/utils/validation';
import type { User } from '@/types';
import { ApiError } from '@/types';

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUserUpdated: (updatedUser: User) => void;
}

export function EditUserModal({ isOpen, onClose, user, onUserUpdated }: EditUserModalProps) {
  const roleId = useId();
  const roleErrorId = `${roleId}-error`;

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditUserFormInput, unknown, EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName ?? '',
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName ?? '',
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      });
    }
  }, [isOpen, user, reset]);

  async function onSubmit(data: EditUserFormData) {
    try {
      const updatedUser = await updateUser(user.id, {
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.displayName || undefined,
        email: data.email,
        role: data.role,
        isActive: data.isActive,
      });
      toast.success('User updated successfully.');
      onUserUpdated(updatedUser);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        for (const fieldError of err.fieldErrors) {
          const field = fieldError.field as keyof EditUserFormData;
          if (field in editUserSchema.shape) {
            setError(field, { type: 'server', message: fieldError.message });
          }
        }
        if (err.fieldErrors.length === 0) {
          setError('root.serverError', { type: 'server', message: err.message });
        }
      } else {
        setError('root.serverError', {
          type: 'server',
          message: 'An unexpected error occurred. Please try again.',
        });
      }
    }
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Edit User">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {errors.root?.serverError && (
          <div className="rounded-md bg-red-50 p-3" role="alert">
            <p className="text-sm text-red-700">{errors.root.serverError.message}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="First name"
            disabled={isSubmitting}
            error={errors.firstName?.message}
            {...register('firstName')}
          />
          <Input
            label="Last name"
            disabled={isSubmitting}
            error={errors.lastName?.message}
            {...register('lastName')}
          />
        </div>

        <Input
          label="Display name"
          disabled={isSubmitting}
          error={errors.displayName?.message}
          {...register('displayName')}
        />

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          disabled={isSubmitting}
          error={errors.email?.message}
          {...register('email')}
        />

        <div className="space-y-1">
          <label htmlFor={roleId} className="block text-sm font-medium text-gray-700">
            Role
          </label>
          <select
            id={roleId}
            disabled={isSubmitting}
            aria-invalid={errors.role ? true : undefined}
            aria-describedby={errors.role ? roleErrorId : undefined}
            className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 ${
              errors.role
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
            } disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500`}
            {...register('role')}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          {errors.role && (
            <p id={roleErrorId} className="text-sm text-red-600" role="alert">
              {errors.role.message}
            </p>
          )}
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            disabled={isSubmitting}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
            {...register('isActive')}
          />
          <span className="text-sm text-gray-700">Active</span>
        </label>

        <div className="flex gap-3 pt-2">
          <Button type="submit" isLoading={isSubmitting} className="flex-1">
            Save Changes
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export type { EditUserModalProps };
