import { maskPhoneNumber, maskCustomerName, maskAddress } from './auth/dataMasking';

export interface PiiAuditReport {
  hasPII: boolean;
  totalRecords: number;
  piiRecordCount: number;
  detectedFields: string[];
  sampleViolations: Array<{ orderId: string; field: string; sample: string }>;
}

export interface DataProvenanceInfo {
  source: 'live_api' | 'demo_anonymized' | 'baseline_bundled' | 'disk_spreadsheet' | 'vercel_blob';
  environment: string;
  isDemoMode: boolean;
  isPIISanitized: boolean;
  timestamp: string;
  recordCount: number;
}

/**
 * Audits a dataset to detect unmasked customer PII (real phone numbers, full names, addresses).
 */
export function auditDatasetPII(records: any[]): PiiAuditReport {
  if (!Array.isArray(records)) {
    return {
      hasPII: false,
      totalRecords: 0,
      piiRecordCount: 0,
      detectedFields: [],
      sampleViolations: [],
    };
  }

  const phoneRegex = /\b01[3-9]\d{8}\b/;
  const detectedFieldSet = new Set<string>();
  const violations: Array<{ orderId: string; field: string; sample: string }> = [];
  let piiCount = 0;

  for (const row of records) {
    if (!row || typeof row !== 'object') continue;
    let rowHasPii = false;
    const orderId = String(row['Order ID'] || row.orderId || row.id || 'unknown');

    // Check Phone
    const phoneVal = row['Phone (Shipping)'] || row.Phone || row.phone || row['Customer Phone'];
    if (phoneVal && phoneRegex.test(String(phoneVal))) {
      detectedFieldSet.add('Phone');
      rowHasPii = true;
      if (violations.length < 5) {
        violations.push({ orderId, field: 'Phone', sample: String(phoneVal).slice(0, 4) + '******' });
      }
    }

    // Check Address
    const addrVal = row['Address 1&2 (Shipping)'] || row.address || row.Address;
    if (addrVal && String(addrVal).length > 15 && !String(addrVal).includes('[REDACTED')) {
      detectedFieldSet.add('Address');
      rowHasPii = true;
      if (violations.length < 5) {
        violations.push({ orderId, field: 'Address', sample: String(addrVal).slice(0, 15) + '...' });
      }
    }

    // Check Full Name
    const nameVal = row['Full Name (Shipping)'] || row['Customer Name'] || row.customerName;
    if (nameVal && typeof nameVal === 'string' && nameVal.trim().length > 3 && !nameVal.includes('***')) {
      detectedFieldSet.add('Customer Name');
      rowHasPii = true;
    }

    if (rowHasPii) {
      piiCount++;
    }
  }

  return {
    hasPII: piiCount > 0,
    totalRecords: records.length,
    piiRecordCount: piiCount,
    detectedFields: Array.from(detectedFieldSet),
    sampleViolations: violations,
  };
}

/**
 * Anonymizes an operational dataset for safe public demonstrations or portfolio showcases.
 * Preserves financial amounts, order IDs, SKUs, and dates for algorithm verification.
 */
export function anonymizeDataset(records: any[]): any[] {
  if (!Array.isArray(records)) return [];
  return records.map((row, idx) => {
    if (!row || typeof row !== 'object') return row;
    const clone = { ...row };

    // Pseudonymize customer name
    if ('Full Name (Shipping)' in clone) {
      clone['Full Name (Shipping)'] = maskCustomerName(clone['Full Name (Shipping)']);
    }
    if ('Customer Name' in clone) {
      clone['Customer Name'] = maskCustomerName(clone['Customer Name']);
    }
    if ('customerName' in clone) {
      clone.customerName = maskCustomerName(clone.customerName);
    }

    // Pseudonymize phone
    if ('Phone (Shipping)' in clone) {
      clone['Phone (Shipping)'] = maskPhoneNumber(clone['Phone (Shipping)']);
    }
    if ('Phone' in clone) {
      clone.Phone = maskPhoneNumber(clone.Phone);
    }
    if ('phone' in clone) {
      clone.phone = maskPhoneNumber(clone.phone);
    }

    // Pseudonymize address
    const city = clone['City (Shipping)'] || clone.City || clone.city || '';
    if ('Address 1&2 (Shipping)' in clone) {
      clone['Address 1&2 (Shipping)'] = maskAddress(clone['Address 1&2 (Shipping)'], city);
    }
    if ('Address' in clone) {
      clone.Address = maskAddress(clone.Address, city);
    }

    // Mask sensitive customer notes
    if ('Customer Note' in clone && typeof clone['Customer Note'] === 'string') {
      clone['Customer Note'] = clone['Customer Note'].replace(/\b01[3-9]\d{8}\b/g, '[PHONE REDACTED]');
    }

    return clone;
  });
}

/**
 * Creates provenance metadata for data responses to guarantee clear separation between demo and live data.
 */
export function createDataProvenance(
  source: DataProvenanceInfo['source'],
  recordCount: number,
  isPIISanitized: boolean = true
): DataProvenanceInfo {
  return {
    source,
    environment: process.env.NODE_ENV || 'development',
    isDemoMode: source !== 'live_api',
    isPIISanitized,
    timestamp: new Date().toISOString(),
    recordCount,
  };
}
