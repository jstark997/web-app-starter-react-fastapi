import { apiClient } from '@/api/client';
import type { AuthUser, ChangeEmailRequest, UpdateProfileRequest } from '@/types';

export async function updateProfile(data: UpdateProfileRequest): Promise<AuthUser> {
  return apiClient<AuthUser>('/api/profile', { method: 'PATCH', body: data });
}

export async function changeEmail(data: ChangeEmailRequest): Promise<void> {
  return apiClient<void>('/api/profile/change-email', { method: 'POST', body: data });
}
