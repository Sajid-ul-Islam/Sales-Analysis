"use client";

export interface ManualOverride {
  orderId: string;
  sku?: string;
  itemDeliveryStatus?: 'Delivered' | 'Returned' | 'Exchange' | 'Dispute';
  orderDeliveryStatus?: 'Delivered' | 'Paid Return' | 'Not Paid Return' | 'Exchange' | 'Partial' | 'Dispute';
  notes?: string;
  updatedAt: string;
}

const STORAGE_KEY = 'deen_reconciliation_overrides';

export function getManualOverrides(): Record<string, ManualOverride> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Failed to read overrides from localStorage', e);
    return {};
  }
}

export function saveManualOverride(override: ManualOverride): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getManualOverrides();
    const key = override.sku ? `${override.orderId}___${override.sku}` : override.orderId;
    existing[key] = override;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    window.dispatchEvent(new CustomEvent('deen_overrides_updated', { detail: existing }));
  } catch (e) {
    console.error('Failed to save override to localStorage', e);
  }
}

export function removeManualOverride(orderId: string, sku?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getManualOverrides();
    const key = sku ? `${orderId}___${sku}` : orderId;
    delete existing[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    window.dispatchEvent(new CustomEvent('deen_overrides_updated', { detail: existing }));
  } catch (e) {
    console.error('Failed to remove override from localStorage', e);
  }
}

export function clearAllOverrides(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('deen_overrides_updated', { detail: {} }));
  } catch (e) {
    console.error('Failed to clear overrides from localStorage', e);
  }
}
