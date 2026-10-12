export interface OrderItemEntry {
  idx: number;
  cost: number;
  qty: number;
  weightGrams?: number; // estimated weight, defaults to ~700g for denim jeans
}

export interface UnitItemAssignment {
  idx: number;
  totalQty: number;
  keptQty: number; // STRICTLY INTEGER
  returnedQty: number; // STRICTLY INTEGER
  itemCost: number;
  keptValue: number;
  returnedValue: number;
}

export interface SubsetMatchResult {
  matchedIndices: Set<number>;
  matchedValue: number;
  targetUsed: number;
  confidence: 'EXACT_MATCH' | 'TOLERANCE_MATCH' | 'CLOSEST_DISCRETE_MATCH';
  toleranceDifference: number;
  itemAssignments: Map<number, UnitItemAssignment>;
  keptTotalValue: number;
  returnedTotalValue: number; // Leftover price of returned items
}

/**
 * Advanced Partial Order Subset-Sum & Knapsack Resolution Engine.
 * 
 * Rules:
 * 1. The collected/delivered price often includes a delivery fee (commonly 50 TK inside Dhaka or 90 TK outside Dhaka).
 *    Once the delivery fee is deducted, the remainder matches the price of the item(s) the customer received (kept).
 * 2. The leftover price is the price of the returned items.
 * 3. Returned items quantity CANNOT be a float (e.g. 0.5 is forbidden); it MUST be an integer value (0, 1, 2, ...).
 */
export function matchPartialItemsAdvanced(
  items: OrderItemEntry[],
  collectedCod: number,
  orderTotalAmount: number
): SubsetMatchResult {
  // Flatten items with quantities into discrete individual garments
  const units: { unitId: number; originalIdx: number; cost: number; weight: number }[] = [];
  let uCounter = 0;
  items.forEach(it => {
    const w = it.weightGrams || 700;
    const cleanQty = Math.max(1, Math.round(it.qty));
    for (let q = 0; q < cleanQty; q++) {
      units.push({ unitId: uCounter++, originalIdx: it.idx, cost: it.cost, weight: w });
    }
  });

  const totalProductCost = units.reduce((sum, u) => sum + u.cost, 0);
  const calculatedDeliveryFee = Math.max(0, orderTotalAmount - totalProductCost);

  // Candidate target values for the kept merchandise cost
  const candidateTargets: { target: number; label: string }[] = [];

  const addCandidate = (t: number, lbl: string) => {
    if (t > 10 && t <= totalProductCost + 15) {
      if (!candidateTargets.some(c => Math.abs(c.target - t) < 0.5)) {
        candidateTargets.push({ target: t, label: lbl });
      }
    }
  };

  // 1. Delivery fee subtracted from collected COD (50 TK, 90 TK, 60 TK, 100 TK, 120 TK, or calculated)
  addCandidate(collectedCod - 90, 'Outside Dhaka 90 TK Delivery Fee Subtracted');
  addCandidate(collectedCod - 50, 'Inside Dhaka 50 TK Delivery Fee Subtracted');
  addCandidate(collectedCod - 60, 'Sub-Dhaka 60 TK Delivery Fee Subtracted');
  addCandidate(collectedCod - 100, 'Standard 100 TK Delivery Fee Subtracted');
  addCandidate(collectedCod - 120, 'Heavy/Express 120 TK Delivery Fee Subtracted');
  if (calculatedDeliveryFee > 0 && calculatedDeliveryFee !== 50 && calculatedDeliveryFee !== 90) {
    addCandidate(collectedCod - calculatedDeliveryFee, 'Calculated Delivery Fee Subtracted');
  }

  // 2. Direct COD without delivery fee (customer paid zero delivery fee on spot, or advance-paid)
  addCandidate(collectedCod, 'Direct Merchandise Cost without Delivery Fee');

  // 3. 1% Courier commission adjustments (if courier deducted 1% COD fee)
  addCandidate((collectedCod - 90) / 0.99, '1% Courier COD Commission Adjusted (90 Fee)');
  addCandidate((collectedCod - 50) / 0.99, '1% Courier COD Commission Adjusted (50 Fee)');
  addCandidate(collectedCod / 0.99, '1% Courier COD Commission Adjusted (Direct)');

  // 4. Reverse target: If collectedCod actually corresponds to the returned items' cost
  addCandidate(totalProductCost - (collectedCod - 90), 'Reverse Returned Calculation (90 Fee)');
  addCandidate(totalProductCost - (collectedCod - 50), 'Reverse Returned Calculation (50 Fee)');
  addCandidate(totalProductCost - collectedCod, 'Reverse Returned Calculation (Direct)');

  let bestSubset: SubsetFound | null = null;
  let bestConfidence: SubsetMatchResult['confidence'] = 'EXACT_MATCH';
  let bestTargetUsed = collectedCod;
  let minDiff = Infinity;

  // Pass 1: Exact Match (<= 2 BDT tolerance)
  for (const { target } of candidateTargets) {
    const match = findBestSubset(units, target, 2.0);
    if (match) {
      const diff = Math.abs(match.sum - target);
      if (diff < minDiff) {
        minDiff = diff;
        bestSubset = match;
        bestConfidence = 'EXACT_MATCH';
        bestTargetUsed = target;
        if (diff < 0.5) break;
      }
    }
  }

  // Pass 2: Tolerance Match (<= 25 BDT tolerance)
  if (!bestSubset) {
    for (const { target } of candidateTargets) {
      const match = findBestSubset(units, target, 25.0);
      if (match) {
        const diff = Math.abs(match.sum - target);
        if (diff < minDiff) {
          minDiff = diff;
          bestSubset = match;
          bestConfidence = 'TOLERANCE_MATCH';
          bestTargetUsed = target;
        }
      }
    }
  }

  // Pass 3: Nearest Discrete Subset Match
  // Find the closest combination of whole garments to the primary targets (90 TK or 50 TK fee deducted)
  if (!bestSubset) {
    const fallbackTarget = Math.max(0, collectedCod > 90 ? collectedCod - 90 : collectedCod);
    const closest = findClosestDiscreteSubset(units, fallbackTarget);
    bestSubset = closest;
    bestConfidence = 'CLOSEST_DISCRETE_MATCH';
    bestTargetUsed = fallbackTarget;
    minDiff = Math.abs(closest.sum - fallbackTarget);
  }

  // Build strictly integer unit assignments for each item
  const selectedUnitIds = new Set(bestSubset.selectedUnits.map(u => u.unitId));
  const matchedIndices = new Set<number>();
  const itemAssignments = new Map<number, UnitItemAssignment>();

  items.forEach(it => {
    const itemUnits = units.filter(u => u.originalIdx === it.idx);
    const totalQty = itemUnits.length;
    let keptQty = 0;

    itemUnits.forEach(u => {
      if (selectedUnitIds.has(u.unitId)) {
        keptQty++;
      }
    });

    const returnedQty = totalQty - keptQty; // STRICTLY INTEGER
    const keptValue = keptQty * it.cost;
    const returnedValue = returnedQty * it.cost;

    if (keptQty > 0) {
      matchedIndices.add(it.idx);
    }

    itemAssignments.set(it.idx, {
      idx: it.idx,
      totalQty,
      keptQty,
      returnedQty,
      itemCost: it.cost,
      keptValue,
      returnedValue
    });
  });

  const keptTotalValue = Array.from(itemAssignments.values()).reduce((s, a) => s + a.keptValue, 0);
  const returnedTotalValue = Array.from(itemAssignments.values()).reduce((s, a) => s + a.returnedValue, 0);

  return {
    matchedIndices,
    matchedValue: bestSubset.sum,
    targetUsed: bestTargetUsed,
    confidence: bestConfidence,
    toleranceDifference: minDiff,
    itemAssignments,
    keptTotalValue,
    returnedTotalValue
  };
}

interface SubsetFound {
  selectedUnits: { unitId: number; originalIdx: number; cost: number; weight: number }[];
  sum: number;
}

/**
 * Branch-and-bound search for a subset sum within maxDiff tolerance.
 */
function findBestSubset(
  units: { unitId: number; originalIdx: number; cost: number; weight: number }[],
  target: number,
  maxDiff: number
): SubsetFound | null {
  const n = units.length;
  if (n === 0) return null;

  let bestResult: SubsetFound | null = null;
  let smallestDiff = maxDiff + 0.001;

  // Sort descending by cost for efficient pruning
  const sorted = [...units].sort((a, b) => b.cost - a.cost);

  function search(idx: number, currentSum: number, selected: typeof units) {
    const diff = Math.abs(currentSum - target);
    if (diff <= maxDiff && diff < smallestDiff) {
      smallestDiff = diff;
      bestResult = { selectedUnits: [...selected], sum: currentSum };
      if (diff < 0.1) return; // exact match
    }

    if (idx >= n) return;
    if (currentSum - target > maxDiff) return; // cannot improve by adding more positive numbers

    // Include sorted[idx]
    search(idx + 1, currentSum + sorted[idx].cost, selected.concat([sorted[idx]]));

    // Exclude sorted[idx]
    search(idx + 1, currentSum, selected);
  }

  search(0, 0, []);
  return bestResult;
}

/**
 * Exhaustive search to find the closest discrete subset of garments to a target amount.
 * Guarantees a valid combination of integer garment units.
 */
function findClosestDiscreteSubset(
  units: { unitId: number; originalIdx: number; cost: number; weight: number }[],
  target: number
): SubsetFound {
  const n = units.length;
  if (n === 0) return { selectedUnits: [], sum: 0 };

  let bestResult: SubsetFound = { selectedUnits: [], sum: 0 };
  let minDiff = Math.abs(target);

  const sorted = [...units].sort((a, b) => b.cost - a.cost);

  function search(idx: number, currentSum: number, selected: typeof units) {
    const diff = Math.abs(currentSum - target);
    if (diff < minDiff) {
      minDiff = diff;
      bestResult = { selectedUnits: [...selected], sum: currentSum };
      if (diff < 0.5) return;
    }

    if (idx >= n) return;

    // Prune branch if current sum already exceeds target by more than minDiff
    if (currentSum - target > minDiff) return;

    // Include
    search(idx + 1, currentSum + sorted[idx].cost, selected.concat([sorted[idx]]));

    // Exclude
    search(idx + 1, currentSum, selected);
  }

  search(0, 0, []);
  return bestResult;
}
