import { describe, it, expect } from 'vitest';
import { validateOrderSuffix, autoSanitizeOrderId } from '@/lib/suffixHygiene';

describe('Warehouse & Outlet Suffix Hygiene Engine', () => {
  it('validates canonical Central Warehouse order IDs (pure numeric)', () => {
    const res = validateOrderSuffix('17263');
    expect(res.isValid).toBe(true);
    expect(res.branchCode).toBe('ONLINE');
    expect(res.baseOrderId).toBe('17263');
    expect(res.issue).toBe('NONE');
  });

  it('validates correctly spaced branch dispatch IDs', () => {
    const cumilla = validateOrderSuffix('17263 c');
    expect(cumilla.isValid).toBe(true);
    expect(cumilla.branchCode).toBe('CUMILLA');
    expect(cumilla.baseOrderId).toBe('17263');

    const wari = validateOrderSuffix('17264 w');
    expect(wari.isValid).toBe(true);
    expect(wari.branchCode).toBe('WARI');

    const sylhet = validateOrderSuffix('17265 s');
    expect(sylhet.isValid).toBe(true);
    expect(sylhet.branchCode).toBe('SYLHET');

    const mirpur = validateOrderSuffix('17266 m');
    expect(mirpur.isValid).toBe(true);
    expect(mirpur.branchCode).toBe('MIRPUR');
  });

  it('validates canonical Exchange Replacement IDs', () => {
    const res = validateOrderSuffix('D-17263');
    expect(res.isValid).toBe(true);
    expect(res.branchCode).toBe('EXCHANGE');
    expect(res.baseOrderId).toBe('17263');

    const doubleD = validateOrderSuffix('DD-17263');
    expect(doubleD.isValid).toBe(true);
    expect(doubleD.branchCode).toBe('EXCHANGE');
  });

  it('flags missing space before suffix and suggests exact fix', () => {
    const res = validateOrderSuffix('17263c');
    expect(res.isValid).toBe(false);
    expect(res.issue).toBe('MISSING_SPACE');
    expect(res.suggestedFix).toBe('17263 c');
    expect(res.branchCode).toBe('CUMILLA');
  });

  it('flags hyphen suffix and suggests space format', () => {
    const res = validateOrderSuffix('17263-w');
    expect(res.isValid).toBe(false);
    expect(res.issue).toBe('HYPHEN_SUFFIX');
    expect(res.suggestedFix).toBe('17263 w');
    expect(res.branchCode).toBe('WARI');
  });

  it('flags full branch name and suggests single letter abbreviation', () => {
    const res = validateOrderSuffix('17263 cumilla');
    expect(res.isValid).toBe(false);
    expect(res.issue).toBe('FULL_NAME_SUFFIX');
    expect(res.suggestedFix).toBe('17263 c');
  });

  it('autoSanitizeOrderId cleans all malformed inputs', () => {
    expect(autoSanitizeOrderId('17263c')).toBe('17263 c');
    expect(autoSanitizeOrderId('17263-s')).toBe('17263 s');
    expect(autoSanitizeOrderId('17263 wari')).toBe('17263 w');
    expect(autoSanitizeOrderId('D17263')).toBe('D-17263');
    expect(autoSanitizeOrderId('17263')).toBe('17263');
  });
});
