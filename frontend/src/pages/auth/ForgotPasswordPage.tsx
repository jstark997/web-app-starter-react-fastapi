import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { forgotPassword } from '@/api/auth';
import { Input, Button } from '@/components/ui';
import { forgotPasswordSchema } from '@/utils/validation';
import type { ForgotPasswordFormData } from '@/utils/validation';

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(data: ForgotPasswordFormData) {
    try {
      await forgotPassword({ email: data.email });
    } catch {
      // Always show success to prevent email enumeration
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="text-center">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Check your email</h2>
        <p className="mb-6 text-sm text-gray-600">
          If an account with that email exists, a password reset link has been sent.
        </p>
        <Link to="/login" className="text-sm text-blue-600 hover:text-blue-500">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <h2 className="mb-2 text-center text-xl font-semibold text-gray-900">
        Forgot your password?
      </h2>
      <p className="mb-6 text-center text-sm text-gray-600">
        Enter your email address and we&apos;ll send you a link to reset your password.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          disabled={isSubmitting}
          error={errors.email?.message}
          {...register('email')}
        />

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Send reset link
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-600">
        <Link to="/login" className="text-blue-600 hover:text-blue-500">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
