import { useState } from 'react';
import { toast } from 'sonner';
import { resendVerification } from '@/api/auth';
import { Button } from '@/components/ui';
import { useAuth } from '@/context/useAuth';

export default function VerifyPendingPage() {
  const { user, logout } = useAuth();
  const [isResending, setIsResending] = useState(false);

  async function handleResend() {
    if (!user) return;
    setIsResending(true);
    try {
      await resendVerification({ email: user.email });
      toast.success('Verification email sent. Please check your inbox.');
    } catch {
      toast.error('Unable to send verification email. Please try again.');
    } finally {
      setIsResending(false);
    }
  }

  async function handleLogout() {
    await logout();
  }

  return (
    <div className="text-center">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">Verify your email</h2>
      <p className="mb-2 text-sm text-gray-600">
        We sent a verification link to{' '}
        <span className="font-medium text-gray-900">{user?.email}</span>.
      </p>
      <p className="mb-6 text-sm text-gray-600">
        Click the link in that email to finish setting up your account. The link expires in 24 hours.
      </p>

      <div className="flex flex-col items-stretch gap-2">
        <Button
          type="button"
          onClick={handleResend}
          isLoading={isResending}
          disabled={isResending}
        >
          Resend verification email
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={handleLogout}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
