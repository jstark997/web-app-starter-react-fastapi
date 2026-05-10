import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { register as registerUser } from '@/api/auth';
import { Input, PasswordInput, Button } from '@/components/ui';
import { registerSchema } from '@/utils/validation';
import type { RegisterFormData } from '@/utils/validation';
import { ApiError } from '@/types';

export default function RegisterPage() {
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(data: RegisterFormData) {
    try {
      await registerUser({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError && err.details.whitelistRestricted === true) {
        setError('root.serverError', {
          type: 'server',
          message: 'Registration is not available for this email address.',
        });
      } else {
        setError('root.serverError', {
          type: 'server',
          message: 'An unexpected error occurred. Please try again.',
        });
      }
    }
  }

  if (success) {
    return (
      <div className="text-center">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Check your email</h2>
        <p className="mb-6 text-sm text-gray-600">
          We&apos;ve sent a verification link to your email address. Please check your inbox to verify your account.
        </p>
        <Link to="/login" className="text-sm text-blue-600 hover:text-blue-500">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <h2 className="mb-6 text-center text-xl font-semibold text-gray-900">
        Create your account
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {errors.root?.serverError && (
          <div className="rounded-md bg-red-50 p-3" role="alert">
            <p className="text-sm text-red-700">{errors.root.serverError.message}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First name"
            autoComplete="given-name"
            disabled={isSubmitting}
            error={errors.firstName?.message}
            {...register('firstName')}
          />
          <Input
            label="Last name"
            autoComplete="family-name"
            disabled={isSubmitting}
            error={errors.lastName?.message}
            {...register('lastName')}
          />
        </div>

        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          disabled={isSubmitting}
          error={errors.email?.message}
          {...register('email')}
        />

        <PasswordInput
          label="Password"
          autoComplete="new-password"
          disabled={isSubmitting}
          error={errors.password?.message}
          {...register('password')}
        />

        <PasswordInput
          label="Confirm password"
          autoComplete="new-password"
          disabled={isSubmitting}
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Create account
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link to="/login" className="text-blue-600 hover:text-blue-500">
          Sign in
        </Link>
      </p>
    </>
  );
}
