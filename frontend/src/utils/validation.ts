import { z } from 'zod';

export const emailSchema = z.string().min(1, { error: 'Email is required.' }).email({ error: 'Please enter a valid email address.' });

export const passwordSchema = z
  .string()
  .min(8, { error: 'Password must be at least 8 characters.' })
  .max(72, { error: 'Password must be 72 characters or fewer.' });

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, { error: 'Password is required.' })
    .max(72, { error: 'Password must be 72 characters or fewer.' }),
  rememberMe: z.boolean(),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  firstName: z.string().min(1, { error: 'First name is required.' }),
  lastName: z.string().min(1, { error: 'Last name is required.' }),
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, { error: 'Please confirm your password.' }),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    error: 'Passwords do not match.',
    path: ['confirmPassword'],
  },
);

export type RegisterFormData = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string().min(1, { error: 'Please confirm your password.' }),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    error: 'Passwords do not match.',
    path: ['confirmPassword'],
  },
);

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export const profileSchema = z.object({
  firstName: z.string().min(1, { error: 'First name is required.' }),
  lastName: z.string().min(1, { error: 'Last name is required.' }),
  displayName: z.string().optional().default(''),
  avatarUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,/, {
      error: 'Avatar must be an uploaded image.',
    })
    .or(z.literal('')),
});

export type ProfileFormInput = z.input<typeof profileSchema>;
export type ProfileFormData = z.infer<typeof profileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, { error: 'Current password is required.' })
    .max(72, { error: 'Password must be 72 characters or fewer.' }),
  newPassword: passwordSchema,
  confirmNewPassword: z.string().min(1, { error: 'Please confirm your new password.' }),
}).refine(
  (data) => data.newPassword === data.confirmNewPassword,
  {
    error: 'Passwords do not match.',
    path: ['confirmNewPassword'],
  },
);

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export const changeEmailSchema = z.object({
  newEmail: emailSchema,
  currentPassword: z
    .string()
    .min(1, { error: 'Password is required.' })
    .max(72, { error: 'Password must be 72 characters or fewer.' }),
});

export type ChangeEmailFormData = z.infer<typeof changeEmailSchema>;

export const createUserSchema = z.object({
  firstName: z.string().min(1, { error: 'First name is required.' }),
  lastName: z.string().min(1, { error: 'Last name is required.' }),
  email: emailSchema,
  role: z.enum(['admin', 'user'], { error: 'Please select a role.' }),
  sendInvitation: z.boolean(),
});

export type CreateUserFormData = z.infer<typeof createUserSchema>;

export const editUserSchema = z.object({
  firstName: z.string().min(1, { error: 'First name is required.' }),
  lastName: z.string().min(1, { error: 'Last name is required.' }),
  displayName: z.string().optional().default(''),
  email: emailSchema,
  role: z.enum(['admin', 'user'], { error: 'Please select a role.' }),
  isActive: z.boolean(),
});

export type EditUserFormInput = z.input<typeof editUserSchema>;
export type EditUserFormData = z.infer<typeof editUserSchema>;

export const addWhitelistEntrySchema = z.object({
  email: emailSchema,
});

export type AddWhitelistEntryFormData = z.infer<typeof addWhitelistEntrySchema>;
