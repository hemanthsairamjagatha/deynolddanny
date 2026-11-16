/**
 * src/features/account/api/account.api.ts
 * Patron account, saved address book, and DPDP data export/erasure operations.
 */

import { apiFetch, clearClientSession } from '../../../lib/api/client';

export interface PatronAddress {
  id: string;
  address_type: 'Home' | 'Office' | 'Other';
  full_name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  is_default: number;
}

export interface CreateAddressPayload {
  addressType?: 'Home' | 'Office' | 'Other';
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  isDefault?: boolean;
}

export async function listAddressesApi() {
  return apiFetch<{ items: PatronAddress[] }>('/api/users/me/addresses');
}

export async function createAddressApi(payload: CreateAddressPayload) {
  return apiFetch<PatronAddress>('/api/users/me/addresses', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAddressApi(addressId: string, payload: Partial<CreateAddressPayload>) {
  return apiFetch<PatronAddress>(`/api/users/me/addresses/${encodeURIComponent(addressId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteAddressApi(addressId: string) {
  return apiFetch<{ deleted: boolean }>(`/api/users/me/addresses/${encodeURIComponent(addressId)}`, {
    method: 'DELETE',
  });
}

export async function exportPersonalDataApi() {
  return apiFetch<Record<string, unknown>>('/api/users/me/export');
}

export async function deleteAccountApi() {
  const res = await apiFetch<{ deleted: boolean; message?: string }>('/api/users/me', {
    method: 'DELETE',
  });
  if (res.success && res.data?.deleted) {
    clearClientSession();
  }
  return res;
}
