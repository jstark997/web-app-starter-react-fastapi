import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/context/useAuth';
import { updateProfile, changeEmail } from '@/api/profile';
import { Input, PasswordInput, Button, Dialog, Badge } from '@/components/ui';
import { profileSchema, changeEmailSchema } from '@/utils/validation';
import type { ProfileFormData, ProfileFormInput, ChangeEmailFormData } from '@/utils/validation';
import { ApiError } from '@/types';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailChangeSuccess, setEmailChangeSuccess] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string>(user?.avatarUrl ?? '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormInput, unknown, ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      displayName: user?.displayName ?? '',
      avatarUrl: user?.avatarUrl ?? '',
    },
  });

  const emailForm = useForm<ChangeEmailFormData>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: {
      newEmail: '',
      currentPassword: '',
    },
  });

  async function onSubmit(data: ProfileFormData) {
    try {
      const updatedUser = await updateProfile({
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.displayName || null,
        avatarUrl: data.avatarUrl || null,
      });
      updateUser(updatedUser);
      toast.success('Profile updated successfully.');
    } catch (err) {
      if (err instanceof ApiError) {
        for (const fieldError of err.fieldErrors) {
          const field = fieldError.field as keyof ProfileFormData;
          if (field in profileSchema.shape) {
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

  async function onEmailSubmit(data: ChangeEmailFormData) {
    try {
      await changeEmail({
        newEmail: data.newEmail,
        currentPassword: data.currentPassword,
      });
      setEmailChangeSuccess(data.newEmail);
    } catch (err) {
      if (err instanceof ApiError) {
        for (const fieldError of err.fieldErrors) {
          const field = fieldError.field as keyof ChangeEmailFormData;
          if (field === 'newEmail' || field === 'currentPassword') {
            emailForm.setError(field, { type: 'server', message: fieldError.message });
          }
        }
        if (err.fieldErrors.length === 0) {
          emailForm.setError('root.serverError', { type: 'server', message: err.message });
        }
      } else {
        emailForm.setError('root.serverError', {
          type: 'server',
          message: 'An unexpected error occurred. Please try again.',
        });
      }
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_AVATAR_SIZE) {
      setError('avatarUrl', { type: 'validate', message: 'File size must be under 2MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setValue('avatarUrl', result, { shouldValidate: true });
      setAvatarPreview(result);
    };
    reader.readAsDataURL(file);
  }

  function handleCloseEmailDialog() {
    setEmailDialogOpen(false);
    setEmailChangeSuccess('');
    emailForm.reset();
  }

  function getInitials(): string {
    if (!user) return '';
    const first = user.firstName?.[0] ?? '';
    const last = user.lastName?.[0] ?? '';
    return (first + last).toUpperCase();
  }

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">My Profile</h1>

      {/* Avatar and read-only info */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Profile avatar"
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-xl font-semibold text-blue-700">
                {getInitials()}
              </div>
            )}
          </div>

          {/* Read-only fields */}
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <span className="text-sm font-medium text-gray-500">Email</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-900">{user?.email}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setEmailDialogOpen(true)}
                >
                  Change Email
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div>
                <span className="text-sm font-medium text-gray-500">Role</span>
                <div className="mt-1">
                  <Badge variant={user?.role ?? 'user'} />
                </div>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Status</span>
                <div className="mt-1">
                  <Badge variant={user?.isActive ? 'active' : 'inactive'} />
                </div>
              </div>
            </div>

            {memberSince && (
              <div>
                <span className="text-sm font-medium text-gray-500">Member since</span>
                <p className="text-sm text-gray-900">{memberSince}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit form */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-medium text-gray-900">Edit Profile</h2>

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

          <div className="space-y-1">
            <span className="block text-sm font-medium text-gray-700">Avatar</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isSubmitting}
                onClick={() => fileInputRef.current?.click()}
              >
                Upload image
              </Button>
              {avatarPreview && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => {
                    setValue('avatarUrl', '', { shouldValidate: true });
                    setAvatarPreview('');
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
            {errors.avatarUrl?.message && (
              <p className="text-sm text-red-600" role="alert">
                {errors.avatarUrl.message}
              </p>
            )}
            <p className="text-xs text-gray-500">
              JPEG, PNG, WebP, GIF, or SVG. Max 2 MB.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" isLoading={isSubmitting}>
              Save Changes
            </Button>
            <Link
              to="/profile/change-password"
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              Change password
            </Link>
          </div>
        </form>
      </div>

      {/* Change Email Dialog */}
      <Dialog
        isOpen={emailDialogOpen}
        onClose={handleCloseEmailDialog}
        title="Change Email Address"
      >
        {emailChangeSuccess ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              A verification email has been sent to{' '}
              <span className="font-medium">{emailChangeSuccess}</span>. Your email address will
              not change until you verify the new address.
            </p>
            <Button variant="secondary" onClick={handleCloseEmailDialog} className="w-full">
              Close
            </Button>
          </div>
        ) : (
          <form
            onSubmit={emailForm.handleSubmit(onEmailSubmit)}
            noValidate
            className="space-y-4"
          >
            {emailForm.formState.errors.root?.serverError && (
              <div className="rounded-md bg-red-50 p-3" role="alert">
                <p className="text-sm text-red-700">
                  {emailForm.formState.errors.root.serverError.message}
                </p>
              </div>
            )}

            <Input
              label="New email address"
              type="email"
              autoComplete="email"
              disabled={emailForm.formState.isSubmitting}
              error={emailForm.formState.errors.newEmail?.message}
              {...emailForm.register('newEmail')}
            />

            <PasswordInput
              label="Current password"
              autoComplete="current-password"
              disabled={emailForm.formState.isSubmitting}
              error={emailForm.formState.errors.currentPassword?.message}
              {...emailForm.register('currentPassword')}
            />

            <div className="flex gap-3">
              <Button
                type="submit"
                isLoading={emailForm.formState.isSubmitting}
                className="flex-1"
              >
                Change Email
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleCloseEmailDialog}
                disabled={emailForm.formState.isSubmitting}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
