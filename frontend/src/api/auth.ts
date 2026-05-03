import { apiClient } from '@/api/client';
import type {
  AuthUser,
  LoginRequest,
  RegisterRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
  ResendVerificationRequest,
  ChangePasswordRequest,
} from '@/types';

export async function login(data: LoginRequest): Promise<AuthUser> {
  return apiClient<AuthUser>('/api/auth/login', { method: 'POST', body: data });
}

export async function logout(): Promise<void> {
  return apiClient<void>('/api/auth/logout', { method: 'POST' });
}

export async function register(data: RegisterRequest): Promise<void> {
  return apiClient<void>('/api/auth/register', { method: 'POST', body: data });
}

export async function getMe(): Promise<AuthUser> {
  return apiClient<AuthUser>('/api/auth/me');
}

export async function forgotPassword(data: ForgotPasswordRequest): Promise<void> {
  return apiClient<void>('/api/auth/forgot-password', { method: 'POST', body: data });
}

export async function resetPassword(data: ResetPasswordRequest): Promise<void> {
  return apiClient<void>('/api/auth/reset-password', { method: 'POST', body: data });
}

export async function verifyEmail(data: VerifyEmailRequest): Promise<void> {
  return apiClient<void>('/api/auth/verify-email', { method: 'POST', body: data });
}

export async function resendVerification(data: ResendVerificationRequest): Promise<void> {
  return apiClient<void>('/api/auth/resend-verification', { method: 'POST', body: data });
}

export async function changePassword(data: ChangePasswordRequest): Promise<void> {
  return apiClient<void>('/api/auth/change-password', { method: 'POST', body: data });
}

