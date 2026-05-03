import { apiClient } from '@/api/client';
import type { User, CreateUserRequest, UpdateUserRequest, UserListParams, PaginatedResponse } from '@/types';

export async function listUsers(params: UserListParams = {}): Promise<PaginatedResponse<User>> {
  const searchParams = new URLSearchParams();

  if (params.page !== undefined) searchParams.set('page', String(params.page));
  if (params.pageSize !== undefined) searchParams.set('pageSize', String(params.pageSize));
  if (params.search) searchParams.set('search', params.search);
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

  const query = searchParams.toString();
  const endpoint = `/api/users${query ? `?${query}` : ''}`;

  return apiClient<PaginatedResponse<User>>(endpoint);
}

export async function getUser(id: string): Promise<User> {
  return apiClient<User>(`/api/users/${id}`);
}

export async function createUser(data: CreateUserRequest): Promise<User> {
  return apiClient<User>('/api/users', { method: 'POST', body: data });
}

export async function updateUser(id: string, data: UpdateUserRequest): Promise<User> {
  return apiClient<User>(`/api/users/${id}`, { method: 'PATCH', body: data });
}

export async function deleteUser(id: string): Promise<void> {
  return apiClient<void>(`/api/users/${id}`, { method: 'DELETE' });
}

export async function deactivateUser(id: string): Promise<void> {
  return apiClient<void>(`/api/users/${id}/deactivate`, { method: 'POST' });
}

export async function reactivateUser(id: string): Promise<void> {
  return apiClient<void>(`/api/users/${id}/reactivate`, { method: 'POST' });
}

export async function forcePasswordReset(id: string): Promise<void> {
  return apiClient<void>(`/api/users/${id}/force-password-reset`, { method: 'POST' });
}
