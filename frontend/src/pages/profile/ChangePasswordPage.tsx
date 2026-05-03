import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { changePassword } from '@/api/auth';
import { PasswordInput, Button } from '@/components/ui';
import { changePasswordSchema } from '@/utils/validation';
import type { ChangePasswordFormData } from '@/utils/validation';
import { ApiError } from '@/types';

export default function ChangePasswordPage() {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  async function onSubmit(data: ChangePasswordFormData) {
    try {
      await changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success('Password changed successfully.');
      void navigate('/profile');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400 || err.status === 401) {
          setError('currentPassword', {
            type: 'server',
            message: 'Current password is incorrect.',
          });
        } else {
          for (const fieldError of err.fieldErrors) {
            const field = fieldError.field as keyof ChangePasswordFormData;
            if (field === 'currentPassword' || field === 'newPassword' || field === 'confirmNewPassword') {
              setError(field, { type: 'server', message: fieldError.message });
            }
          }
          if (err.fieldErrors.length === 0) {
            setError('root.serverError', { type: 'server', message: err.message });
          }
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
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Change Password</h1>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {errors.root?.serverError && (
            <div className="rounded-md bg-red-50 p-3" role="alert">
              <p className="text-sm text-red-700">{errors.root.serverError.message}</p>
            </div>
          )}

          <PasswordInput
            label="Current password"
            autoComplete="current-password"
            disabled={isSubmitting}
            error={errors.currentPassword?.message}
            {...register('currentPassword')}
          />

          <PasswordInput
            label="New password"
            autoComplete="new-password"
            disabled={isSubmitting}
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />

          <PasswordInput
            label="Confirm new password"
            autoComplete="new-password"
            disabled={isSubmitting}
            error={errors.confirmNewPassword?.message}
            {...register('confirmNewPassword')}
          />

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" isLoading={isSubmitting}>
              Change Password
            </Button>
            <Link
              to="/profile"
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              Back to profile
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
