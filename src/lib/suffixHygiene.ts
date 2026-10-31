/**
 * DEEN Commerce — Warehouse & Outlet Suffix Hygiene Engine
 * Validates, audits, and auto-sanitizes branch courier dispatch order IDs
 * according to DEEN Order & Fulfillment Business Rules.
 *
 * Rules:
 * - Central Warehouse: No suffix (e.g. "17263")
 * - Cumilla Branch: "17263 c" (with single space)
 * - Wari Branch: "17263 w" (with single space)
 * - Sylhet Branch: "17263 s" (with single space)
 * - Mirpur Outlet: "17263 m" (with single space)
 * - Exchange Replacement: "D-17263" or "DD-17263"
 */

export interface SuffixValidationResult {
  rawId: string;
  isValid: boolean;
  baseOrderId: string;
  detectedBranch: string;
  branchCode: 'ONLINE' | 'MIRPUR' | 'CUMILLA' | 'WARI' | 'SYLHET' | 'EXCHANGE';
  issue?: 'MISSING_SPACE' | 'HYPHEN_SUFFIX' | 'FULL_NAME_SUFFIX' | 'INVALID_CHARACTERS' | 'MALFORMED_EXCHANGE' | 'NONE';
  issueDescription?: string;
  suggestedFix?: string;
}

export function validateOrderSuffix(rawInput: unknown): SuffixValidationResult {
  const rawId = String(rawInput || '').trim();
  if (!rawId) {
    return {
      rawId: '',
      isValid: false,
      baseOrderId: '',
      detectedBranch: 'Unknown',
      branchCode: 'ONLINE',
      issue: 'INVALID_CHARACTERS',
      issueDescription: 'Order ID cannot be empty',
    };
  }

  // 1. Check for standard Exchange Replacement prefix: D-17263, DD-17263
  if (/^dd?-\d+$/i.test(rawId)) {
    const baseOrderId = rawId.replace(/^dd?-/i, '');
    return {
      rawId,
      isValid: true,
      baseOrderId,
      detectedBranch: 'Exchange Replacement',
      branchCode: 'EXCHANGE',
      issue: 'NONE',
    };
  }

  // Check malformed exchange prefix: e.g. D17263, EX-17263, D_17263
  if (/^(d\d+|ex[-_]?\d+|exchange[-_]?\d+|d_\d+)/i.test(rawId)) {
    const baseOrderId = rawId.replace(/^(d|ex[-_]?|exchange[-_]?|d_)/i, '');
    return {
      rawId,
      isValid: false,
      baseOrderId,
      detectedBranch: 'Exchange Replacement',
      branchCode: 'EXCHANGE',
      issue: 'MALFORMED_EXCHANGE',
      issueDescription: 'Exchange replacement must follow format "D-XXXXX"',
      suggestedFix: `D-${baseOrderId}`,
    };
  }

  // 2. Check perfectly formatted Branch Dispatches: "17263 c", "17263 w", "17263 s", "17263 m"
  if (/^\d+\s+[cwsm]$/i.test(rawId)) {
    const [num, suffix] = rawId.split(/\s+/);
    const s = suffix.toLowerCase();
    const branchMap: Record<string, { name: string; code: SuffixValidationResult['branchCode'] }> = {
      c: { name: 'Cumilla Branch', code: 'CUMILLA' },
      w: { name: 'Wari Branch', code: 'WARI' },
      s: { name: 'Sylhet Branch', code: 'SYLHET' },
      m: { name: 'Mirpur Outlet', code: 'MIRPUR' },
    };
    const b = branchMap[s] || { name: 'Central Warehouse', code: 'ONLINE' };
    return {
      rawId,
      isValid: true,
      baseOrderId: num,
      detectedBranch: b.name,
      branchCode: b.code,
      issue: 'NONE',
    };
  }

  // 3. Check perfectly formatted Central Warehouse Order: pure numeric "17263"
  if (/^\d+$/.test(rawId)) {
    return {
      rawId,
      isValid: true,
      baseOrderId: rawId,
      detectedBranch: 'Online Store (Central Warehouse)',
      branchCode: 'ONLINE',
      issue: 'NONE',
    };
  }

  // 4. Detect common formatting mistakes and suggest exact drop-in fix:
  // 4A. Missing space before suffix: "17263c", "17263w", "17263s", "17263m"
  const missingSpaceMatch = rawId.match(/^(\d+)([cwsm])$/i);
  if (missingSpaceMatch) {
    const [, num, s] = missingSpaceMatch;
    const sLower = s.toLowerCase();
    const branchMap: Record<string, string> = {
      c: 'Cumilla Branch',
      w: 'Wari Branch',
      s: 'Sylhet Branch',
      m: 'Mirpur Outlet',
    };
    return {
      rawId,
      isValid: false,
      baseOrderId: num,
      detectedBranch: branchMap[sLower] || 'Branch Outlet',
      branchCode: (sLower === 'c' ? 'CUMILLA' : sLower === 'w' ? 'WARI' : sLower === 's' ? 'SYLHET' : 'MIRPUR'),
      issue: 'MISSING_SPACE',
      issueDescription: `Missing space before suffix letter "${sLower}". Required format: "${num} ${sLower}"`,
      suggestedFix: `${num} ${sLower}`,
    };
  }

  // 4B. Hyphenated suffix: "17263-c", "17263-w", "17263_s"
  const hyphenMatch = rawId.match(/^(\d+)[-_]+([cwsm])$/i);
  if (hyphenMatch) {
    const [, num, s] = hyphenMatch;
    const sLower = s.toLowerCase();
    const branchMap: Record<string, string> = {
      c: 'Cumilla Branch',
      w: 'Wari Branch',
      s: 'Sylhet Branch',
      m: 'Mirpur Outlet',
    };
    return {
      rawId,
      isValid: false,
      baseOrderId: num,
      detectedBranch: branchMap[sLower] || 'Branch Outlet',
      branchCode: (sLower === 'c' ? 'CUMILLA' : sLower === 'w' ? 'WARI' : sLower === 's' ? 'SYLHET' : 'MIRPUR'),
      issue: 'HYPHEN_SUFFIX',
      issueDescription: `Use a single space instead of hyphen for branch suffix. Required format: "${num} ${sLower}"`,
      suggestedFix: `${num} ${sLower}`,
    };
  }

  // 4C. Full branch name appended: "17263 cumilla", "17263-wari", "17263 sylhet"
  const fullNameMatch = rawId.match(/^(\d+)[\s-_]*(cumilla|wari|sylhet|mirpur)$/i);
  if (fullNameMatch) {
    const [, num, bName] = fullNameMatch;
    const bLower = bName.toLowerCase();
    const map: Record<string, { s: string; name: string; code: SuffixValidationResult['branchCode'] }> = {
      cumilla: { s: 'c', name: 'Cumilla Branch', code: 'CUMILLA' },
      wari: { s: 'w', name: 'Wari Branch', code: 'WARI' },
      sylhet: { s: 's', name: 'Sylhet Branch', code: 'SYLHET' },
      mirpur: { s: 'm', name: 'Mirpur Outlet', code: 'MIRPUR' },
    };
    const resolved = map[bLower];
    return {
      rawId,
      isValid: false,
      baseOrderId: num,
      detectedBranch: resolved.name,
      branchCode: resolved.code,
      issue: 'FULL_NAME_SUFFIX',
      issueDescription: `Branch name "${bName}" should be abbreviated as single letter "${resolved.s}". Format: "${num} ${resolved.s}"`,
      suggestedFix: `${num} ${resolved.s}`,
    };
  }

  // 4D. Fallback unparseable characters
  const digitsMatch = rawId.match(/\d+/);
  const baseOrderId = digitsMatch ? digitsMatch[0] : rawId;
  return {
    rawId,
    isValid: false,
    baseOrderId,
    detectedBranch: 'Unrecognized Format',
    branchCode: 'ONLINE',
    issue: 'INVALID_CHARACTERS',
    issueDescription: 'Order ID contains irregular punctuation or unrecognized branch suffix',
    suggestedFix: baseOrderId,
  };
}

/**
 * Automatically cleans and sanitizes an order ID to its canonical standard format.
 */
export function autoSanitizeOrderId(rawInput: unknown): string {
  const result = validateOrderSuffix(rawInput);
  return result.suggestedFix || (result.isValid ? result.rawId : result.baseOrderId);
}
