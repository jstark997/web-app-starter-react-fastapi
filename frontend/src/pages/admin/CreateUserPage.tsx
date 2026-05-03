import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { createUser } from '@/api/users';
import { Input, Button } from '@/components/ui';
import { createUserSchema } from '@/utils/validation';
import type { CreateUserFormData } from '@/utils/validation';
import { ApiError } from '@/types';

export default function CreateUserPage() {
  const navigate = useNavigate();
  const roleId = useId();
  const roleErrorId = `${roleId}-error`;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      role: 'user',
      sendInvitation: true,
    },
  });

  async function onSubmit(data: CreateUserFormData) {
    try {
      const newUser = await createUser({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        role: data.role,
        sendInvitation: data.sendInvitation,
      });
      toast.success('User created successfully.');
      navigate(`/admin/users/${newUser.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        for (const fieldError of err.fieldErrors) {
          const field = fieldError.field as keyof CreateUserFormData;
          if (field in createUserSchema.shape) {
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
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Create New User</h1>
        <Link to="/admin/users">
          <Button variant="secondary">Back to Users</Button>
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
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
              {...register('sendInvitation')}
            />
            <span className="text-sm text-gray-700">Send invitation email</span>
          </label>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" isLoading={isSubmitting}>
              Create User
            </Button>
            <Link
              to="/admin/users"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
