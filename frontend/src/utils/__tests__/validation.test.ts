import { describe, expect, it } from 'vitest';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  emailSchema,
  passwordSchema,
  profileSchema,
  changePasswordSchema,
  changeEmailSchema,
} from '@/utils/validation';

describe('emailSchema', () => {
  it('accepts a valid email', () => {
    expect(emailSchema.safeParse('user@example.com').success).toBe(true);
  });

  it('rejects an empty string', () => {
    const result = emailSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email', () => {
    const result = emailSchema.safeParse('not-an-email');
    expect(result.success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('accepts a password with 8+ characters', () => {
    expect(passwordSchema.safeParse('abcdefgh').success).toBe(true);
  });

  it('rejects a password with fewer than 8 characters', () => {
    const result = passwordSchema.safeParse('short');
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts valid login data', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'password',
      rememberMe: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing email', () => {
    const result = loginSchema.safeParse({
      email: '',
      password: 'password',
      rememberMe: false,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: '',
      rememberMe: false,
    });
    expect(result.success).toBe(false);
  });
});

describe('registerSchema', () => {
  const validData = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    password: 'password123',
    confirmPassword: 'password123',
  };

  it('accepts valid registration data', () => {
    expect(registerSchema.safeParse(validData).success).toBe(true);
  });

  it('rejects empty first name', () => {
    const result = registerSchema.safeParse({ ...validData, firstName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty last name', () => {
    const result = registerSchema.safeParse({ ...validData, lastName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = registerSchema.safeParse({ ...validData, email: 'bad' });
    expect(result.success).toBe(false);
  });

  it('rejects password shorter than 8 characters', () => {
    const result = registerSchema.safeParse({
      ...validData,
      password: 'short',
      confirmPassword: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched passwords', () => {
    const result = registerSchema.safeParse({
      ...validData,
      confirmPassword: 'different123',
    });
    expect(result.success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts a valid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'bad' });
    expect(result.success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('accepts valid matching passwords', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'newpassword1',
      confirmPassword: 'newpassword1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects short password', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'short',
      confirmPassword: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched passwords', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'newpassword1',
      confirmPassword: 'different99',
    });
    expect(result.success).toBe(false);
  });
});

describe('profileSchema', () => {
  const validData = {
    firstName: 'John',
    lastName: 'Doe',
    displayName: 'John Doe',
    avatarUrl: '',
  };

  it('accepts valid profile data', () => {
    expect(profileSchema.safeParse(validData).success).toBe(true);
  });

  it('accepts a valid avatar URL', () => {
    const result = profileSchema.safeParse({
      ...validData,
      avatarUrl: 'https://example.com/avatar.jpg',
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty avatar URL', () => {
    const result = profileSchema.safeParse({ ...validData, avatarUrl: '' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid avatar URL', () => {
    const result = profileSchema.safeParse({
      ...validData,
      avatarUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty first name', () => {
    const result = profileSchema.safeParse({ ...validData, firstName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty last name', () => {
    const result = profileSchema.safeParse({ ...validData, lastName: '' });
    expect(result.success).toBe(false);
  });

  it('accepts empty display name', () => {
    const result = profileSchema.safeParse({ ...validData, displayName: '' });
    expect(result.success).toBe(true);
  });

  it('accepts omitted display name', () => {
    const { displayName: _, ...dataWithout } = validData;
    const result = profileSchema.safeParse(dataWithout);
    expect(result.success).toBe(true);
  });
});

describe('changePasswordSchema', () => {
  const validData = {
    currentPassword: 'oldpassword',
    newPassword: 'newpassword1',
    confirmNewPassword: 'newpassword1',
  };

  it('accepts valid change password data', () => {
    expect(changePasswordSchema.safeParse(validData).success).toBe(true);
  });

  it('rejects empty current password', () => {
    const result = changePasswordSchema.safeParse({
      ...validData,
      currentPassword: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects short new password', () => {
    const result = changePasswordSchema.safeParse({
      ...validData,
      newPassword: 'short',
      confirmNewPassword: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched passwords', () => {
    const result = changePasswordSchema.safeParse({
      ...validData,
      confirmNewPassword: 'different99',
    });
    expect(result.success).toBe(false);
  });
});

describe('changeEmailSchema', () => {
  it('accepts valid change email data', () => {
    const result = changeEmailSchema.safeParse({
      newEmail: 'new@example.com',
      currentPassword: 'password',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = changeEmailSchema.safeParse({
      newEmail: 'not-an-email',
      currentPassword: 'password',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = changeEmailSchema.safeParse({
      newEmail: 'new@example.com',
      currentPassword: '',
    });
    expect(result.success).toBe(false);
  });
});
