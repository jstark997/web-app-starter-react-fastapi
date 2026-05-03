import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyEmail, resendVerification } from '@/api/auth';
import { Spinner, Button, Input } from '@/components/ui';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema } from '@/utils/validation';
import type { ForgotPasswordFormData } from '@/utils/validation';

type VerifyState = 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<VerifyState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const verify = useCallback(async (verifyToken: string) => {
    try {
      await verifyEmail({ token: verifyToken });
      setState('success');
    } catch (err) {
      setState('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Verification failed. The link may be invalid or expired.',
      );
    }
  }, []);

  useEffect(() => {
    if (token) {
      void verify(token);
    } else {
      setState('error');
      setErrorMessage('No verification token provided.');
    }
  }, [token, verify]);

  if (state === 'loading') {
    return (
      <div className="flex flex-col items-center py-8" aria-busy="true">
        <Spinner size="lg" />
        <p className="mt-4 text-sm text-gray-600">Verifying your email...</p>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="text-center">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Email verified</h2>
        <p className="mb-6 text-sm text-gray-600">
          Your email has been verified successfully. You can now sign in.
        </p>
        <Link to="/login" className="text-sm text-blue-600 hover:text-blue-500">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">Verification failed</h2>
      <p className="mb-6 text-sm text-red-600">{errorMessage}</p>
      <ResendVerificationForm />
    </div>
  );
}

function ResendVerificationForm() {
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
      await resendVerification({ email: data.email });
      toast.success('Verification email sent. Please check your inbox.');
    } catch {
      toast.error('Failed to send verification email. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4 text-left">
      <p className="text-center text-sm text-gray-600">
        Enter your email to receive a new verification link.
      </p>
      <Input
        label="Email address"
        type="email"
        autoComplete="email"
        disabled={isSubmitting}
        error={errors.email?.message}
        {...register('email')}
      />
      <Button type="submit" isLoading={isSubmitting} className="w-full">
        Resend verification email
      </Button>
    </form>
  );
}
