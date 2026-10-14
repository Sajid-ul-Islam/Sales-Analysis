import {
  OrderItemEntry,
  UnitItemAssignment,
  SubsetMatchResult,
  matchPartialItemsAdvanced,
} from './subsetSum';

export type EnhancedConfidence =
  | 'EXACT_MATCH'
  | 'TOLERANCE_MATCH'
  | 'CLOSEST_DISCRETE_MATCH'
  | 'AMBIGUOUS_MULTI_CANDIDATE';

export interface DecisionEvidence {
  candidateTargetsCount: number;
  bestTargetUsed: number;
  deliveryFeeSubtracted: number;
  toleranceDifference: number;
  competingCandidatesCount: number;
  requiresManualReview: boolean;
  reviewReason?: string;
  explanation: string;
}

export interface AuditedSubsetMatchResult extends Omit<SubsetMatchResult, 'confidence'> {
  confidence: EnhancedConfidence;
  requiresManualReview: boolean;
  ambiguityScore: number; // 0.0 (unambiguous) to 1.0 (highly ambiguous)
  decisionEvidence: DecisionEvidence;
}

/**
 * Audited Subset-Sum Reconciliation Engine.
 * Resolves partial deliveries while recording matching confidence, detecting competing candidate
 * subsets, and explicitly flagging ambiguous combinations for manual human review.
 */
export function matchPartialItemsWithAudit(
  items: OrderItemEntry[],
  collectedCod: number,
  orderTotalAmount: number,
  customInsideFee?: number,
  customOutsideFee?: number,
  customTolerance?: number
): AuditedSubsetMatchResult {
  const baseResult = matchPartialItemsAdvanced(
    items,
    collectedCod,
    orderTotalAmount,
    customInsideFee,
    customOutsideFee,
    customTolerance
  );

  // Flatten items into discrete units to evaluate potential ambiguity
  const units: { unitId: number; originalIdx: number; cost: number }[] = [];
  let uCounter = 0;
  items.forEach(it => {
    const cleanQty = Math.max(1, Math.round(it.qty));
    for (let q = 0; q < cleanQty; q++) {
      units.push({ unitId: uCounter++, originalIdx: it.idx, cost: it.cost });
    }
  });

  const totalProductCost = units.reduce((sum, u) => sum + u.cost, 0);
  const insideFee = customInsideFee !== undefined ? customInsideFee : 50;
  const outsideFee = customOutsideFee !== undefined ? customOutsideFee : 90;
  const tol = customTolerance !== undefined ? customTolerance : 2.0;

  // Detect distinct subsets that match the target within tolerance
  const target = baseResult.targetUsed;
  const allSubsets: number[][] = [];

  function findSubsets(idx: number, currentSum: number, currentUnitIds: number[]) {
    if (Math.abs(currentSum - target) <= tol) {
      allSubsets.push([...currentUnitIds]);
    }
    if (idx >= units.length || currentSum - target > tol) return;

    // Include
    findSubsets(idx + 1, currentSum + units[idx].cost, [...currentUnitIds, units[idx].unitId]);
    // Exclude
    findSubsets(idx + 1, currentSum, currentUnitIds);
  }

  // Small budget search for ambiguity
  if (units.length <= 12) {
    findSubsets(0, 0, []);
  }

  // Check if multiple structurally distinct index sets produced the same match
  const distinctIndexCombinations = new Set<string>();
  allSubsets.forEach(unitIds => {
    const origIndices = unitIds
      .map(uid => units.find(u => u.unitId === uid)?.originalIdx ?? -1)
      .sort((a, b) => a - b)
      .join(',');
    distinctIndexCombinations.add(origIndices);
  });

  const isMultiCandidate = distinctIndexCombinations.size > 1;
  const isFallbackClosest = baseResult.confidence === 'CLOSEST_DISCRETE_MATCH';
  const isHighDeviation = baseResult.toleranceDifference > 15;

  let confidence: EnhancedConfidence = baseResult.confidence;
  let requiresManualReview = false;
  let ambiguityScore = 0.0;
  let reviewReason = '';

  if (isMultiCandidate) {
    confidence = 'AMBIGUOUS_MULTI_CANDIDATE';
    requiresManualReview = true;
    ambiguityScore = 0.85;
    reviewReason = `Multiple distinct item combinations (${distinctIndexCombinations.size}) equal the collected COD amount. Courier tracking does not specify which SKU was accepted.`;
  } else if (isFallbackClosest) {
    requiresManualReview = true;
    ambiguityScore = Math.min(1.0, 0.5 + baseResult.toleranceDifference / 100);
    reviewReason = `No exact or tolerance match found. Nearest discrete subset assigned with ${baseResult.toleranceDifference.toFixed(1)} BDT deviation.`;
  } else if (isHighDeviation) {
    requiresManualReview = true;
    ambiguityScore = 0.6;
    reviewReason = `Match tolerance deviation (${baseResult.toleranceDifference.toFixed(1)} BDT) exceeds strict financial threshold.`;
  }

  const deliveryFee = Math.max(0, collectedCod - baseResult.matchedValue);

  const decisionEvidence: DecisionEvidence = {
    candidateTargetsCount: 12,
    bestTargetUsed: baseResult.targetUsed,
    deliveryFeeSubtracted: deliveryFee,
    toleranceDifference: baseResult.toleranceDifference,
    competingCandidatesCount: distinctIndexCombinations.size,
    requiresManualReview,
    reviewReason: requiresManualReview ? reviewReason : undefined,
    explanation: requiresManualReview
      ? `FLAGGED FOR MANUAL AUDIT: ${reviewReason}`
      : `Confirmed match with ${baseResult.confidence} (${baseResult.toleranceDifference.toFixed(2)} BDT tolerance). Kept merchandise: ৳${baseResult.keptTotalValue}, Returned: ৳${baseResult.returnedTotalValue}.`,
  };

  return {
    ...baseResult,
    confidence,
    requiresManualReview,
    ambiguityScore: Number(ambiguityScore.toFixed(2)),
    decisionEvidence,
  };
}
