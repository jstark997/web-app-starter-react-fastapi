import { apiClient } from '@/api/client';
import type { WhitelistEntry, WhitelistSettings, AddWhitelistEntryRequest } from '@/types';

export async function getWhitelistSettings(): Promise<WhitelistSettings> {
  return apiClient<WhitelistSettings>('/api/whitelist/settings');
}

export async function updateWhitelistSettings(data: WhitelistSettings): Promise<WhitelistSettings> {
  return apiClient<WhitelistSettings>('/api/whitelist/settings', {
    method: 'PATCH',
    body: data,
  });
}

export async function listWhitelistEntries(): Promise<WhitelistEntry[]> {
  const response = await apiClient<{ items: WhitelistEntry[]; total: number }>('/api/whitelist');
  return response.items;
}

export async function addWhitelistEntry(data: AddWhitelistEntryRequest): Promise<WhitelistEntry> {
  return apiClient<WhitelistEntry>('/api/whitelist', {
    method: 'POST',
    body: data,
  });
}

export async function removeWhitelistEntry(id: string): Promise<void> {
  return apiClient<void>(`/api/whitelist/${id}`, { method: 'DELETE' });
}
