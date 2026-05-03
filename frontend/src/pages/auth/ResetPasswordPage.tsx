import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '@/api/auth';
import { PasswordInput, Button } from '@/components/ui';
import { resetPasswordSchema } from '@/utils/validation';
import type { ResetPasswordFormData } from '@/utils/validation';
import { ApiError } from '@/types';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      void navigate('/forgot-password', { replace: true });
    }
  }, [token, navigate]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(data: ResetPasswordFormData) {
    if (!token) return;

    try {
      await resetPassword({ token, password: data.password });
      setSuccess(true);
      setTimeout(() => {
        void navigate('/login', { replace: true });
      }, 2000);
    } catch (err) {
      if (err instanceof ApiError) {
        setError('root.serverError', {
          type: 'server',
          message: err.message,
        });
      } else {
        setError('root.serverError', {
          type: 'server',
          message: 'An unexpected error occurred. Please try again.',
        });
      }
    }
  }

  if (!token) {
    return null;
  }

  if (success) {
    return (
      <div className="text-center">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Password reset successful</h2>
        <p className="mb-6 text-sm text-gray-600">
          Your password has been reset. Redirecting you to sign in...
        </p>
        <Link to="/login" className="text-sm text-blue-600 hover:text-blue-500">
          Sign in now
        </Link>
      </div>
    );
  }

  return (
    <>
      <h2 className="mb-6 text-center text-xl font-semibold text-gray-900">
        Reset your password
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {errors.root?.serverError && (
          <div className="rounded-md bg-red-50 p-3" role="alert">
            <p className="text-sm text-red-700">
              {errors.root.serverError.message}{' '}
              <Link to="/forgot-password" className="font-medium underline">
                Request a new link
              </Link>
            </p>
          </div>
        )}

        <PasswordInput
          label="New password"
          autoComplete="new-password"
          disabled={isSubmitting}
          error={errors.password?.message}
          {...register('password')}
        />

        <PasswordInput
          label="Confirm new password"
          autoComplete="new-password"
          disabled={isSubmitting}
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Reset password
        </Button>
      </form>
    </>
  );
}
