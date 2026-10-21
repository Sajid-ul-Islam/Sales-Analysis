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
  orderTotalAmount: number,
  customInsideFee?: number,
  customOutsideFee?: number,
  customTolerance?: number
): SubsetMatchResult {
  // Flatten items with quantities into discrete individual garments
  const units: { unitId: number; originalIdx: number; cost: number; weight: number }[] = [];
  let uCounter = 0;
  items.forEach(it => {
    const w = it.weightGrams || 700;
    const cleanQty = Math.max(0, Math.round(it.qty));
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

  const insideFee = customInsideFee !== undefined ? customInsideFee : 50;
  const outsideFee = customOutsideFee !== undefined ? customOutsideFee : 90;
  const tol = customTolerance !== undefined ? customTolerance : 2.0;

  // 1. Delivery fee subtracted from collected COD (Custom inside/outside, standard 50/90/60/100/120)
  addCandidate(collectedCod - outsideFee, `Outside Dhaka ${outsideFee} TK Delivery Fee Subtracted`);
  addCandidate(collectedCod - insideFee, `Inside Dhaka ${insideFee} TK Delivery Fee Subtracted`);
  if (insideFee !== 50) addCandidate(collectedCod - 50, 'Inside Dhaka 50 TK Delivery Fee Subtracted');
  if (outsideFee !== 90) addCandidate(collectedCod - 90, 'Outside Dhaka 90 TK Delivery Fee Subtracted');
  addCandidate(collectedCod - 60, 'Sub-Dhaka 60 TK Delivery Fee Subtracted');
  addCandidate(collectedCod - 100, 'Standard 100 TK Delivery Fee Subtracted');
  addCandidate(collectedCod - 120, 'Heavy/Express 120 TK Delivery Fee Subtracted');
  if (calculatedDeliveryFee > 0 && calculatedDeliveryFee !== insideFee && calculatedDeliveryFee !== outsideFee) {
    addCandidate(collectedCod - calculatedDeliveryFee, 'Calculated Delivery Fee Subtracted');
  }

  // 2. Direct COD without delivery fee (customer paid zero delivery fee on spot, or advance-paid)
  addCandidate(collectedCod, 'Direct Merchandise Cost without Delivery Fee');

  // 3. 1% Courier commission adjustments (if courier deducted 1% COD fee)
  addCandidate((collectedCod - outsideFee) / 0.99, `1% Courier COD Commission Adjusted (${outsideFee} Fee)`);
  addCandidate((collectedCod - insideFee) / 0.99, `1% Courier COD Commission Adjusted (${insideFee} Fee)`);
  addCandidate(collectedCod / 0.99, '1% Courier COD Commission Adjusted (Direct)');

  // 4. Reverse target: If collectedCod actually corresponds to the returned items' cost
  addCandidate(totalProductCost - (collectedCod - outsideFee), `Reverse Returned Calculation (${outsideFee} Fee)`);
  addCandidate(totalProductCost - (collectedCod - insideFee), `Reverse Returned Calculation (${insideFee} Fee)`);
  addCandidate(totalProductCost - collectedCod, 'Reverse Returned Calculation (Direct)');

  let bestSubset: SubsetFound | null = null;
  let bestConfidence: SubsetMatchResult['confidence'] = 'EXACT_MATCH';
  let bestTargetUsed = collectedCod;
  let minDiff = Infinity;

  // Pass 1: Exact Match (<= tol tolerance)
  for (const { target } of candidateTargets) {
    const match = findBestSubset(units, target, tol);
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
 * Optimized with suffix-sum pruning, allocation-free stack, and a step budget
 * to ensure < 1ms execution time and zero event loop lockup.
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

  // Precompute suffix sums in O(n) for instantaneous pruning
  const suffix = new Array(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    suffix[i] = suffix[i + 1] + sorted[i].cost;
  }

  let stepCount = 0;
  const maxSteps = 1500;
  const currentUnits: typeof units = [];

  function search(idx: number, currentSum: number) {
    stepCount++;
    if (stepCount > maxSteps) return;

    const diff = Math.abs(currentSum - target);
    if (diff <= maxDiff && diff < smallestDiff) {
      smallestDiff = diff;
      bestResult = { selectedUnits: [...currentUnits], sum: currentSum };
      if (diff < 0.1) return; // exact match
    }

    if (idx >= n) return;
    if (currentSum - target > maxDiff) return; // cannot improve by adding more positive numbers
    if (currentSum + suffix[idx] < target - smallestDiff) return; // cannot reach target even with all remaining elements

    // Include sorted[idx]
    currentUnits.push(sorted[idx]);
    search(idx + 1, currentSum + sorted[idx].cost);
    currentUnits.pop();
    if (smallestDiff < 0.1) return;

    // Exclude sorted[idx]
    search(idx + 1, currentSum);
  }

  search(0, 0);
  return bestResult;
}

/**
 * Exhaustive search to find the closest discrete subset of garments to a target amount.
 * Guarantees a valid combination of integer garment units.
 * Optimized with suffix-sum pruning, allocation-free stack, and a step budget.
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

  // Precompute suffix sums in O(n) for instantaneous pruning
  const suffix = new Array(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    suffix[i] = suffix[i + 1] + sorted[i].cost;
  }

  let stepCount = 0;
  const maxSteps = 1500;
  const currentUnits: typeof units = [];

  function search(idx: number, currentSum: number) {
    stepCount++;
    if (stepCount > maxSteps) return;

    const diff = Math.abs(currentSum - target);
    if (diff < minDiff) {
      minDiff = diff;
      bestResult = { selectedUnits: [...currentUnits], sum: currentSum };
      if (diff < 0.5) return;
    }

    if (idx >= n) return;

    // Prune branch if current sum already exceeds target by more than minDiff
    if (currentSum - target > minDiff) return;
    if (currentSum + suffix[idx] < target - minDiff) return;

    // Include
    currentUnits.push(sorted[idx]);
    search(idx + 1, currentSum + sorted[idx].cost);
    currentUnits.pop();
    if (minDiff < 0.5) return;

    // Exclude
    search(idx + 1, currentSum);
  }

  search(0, 0);
  return bestResult;
}
