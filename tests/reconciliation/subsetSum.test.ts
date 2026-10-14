import { describe, it, expect } from 'vitest';
import { matchPartialItemsAdvanced, OrderItemEntry } from '@/lib/subsetSum';
import { matchPartialItemsWithAudit } from '@/lib/subsetSumAuditor';

describe('Knapsack Subset-Sum & Ambiguity Audit Engine', () => {
  it('solves exact match with 50 TK inside Dhaka delivery fee deduction', () => {
    const items: OrderItemEntry[] = [
      { idx: 0, cost: 650, qty: 1 },
      { idx: 1, cost: 1400, qty: 1 },
    ];
    // Customer kept the ৳650 shirt, paid ৳700 at doorstep (৳650 + ৳50 delivery fee)
    const res = matchPartialItemsAdvanced(items, 700, 2100, 50, 90);

    expect(res.confidence).toBe('EXACT_MATCH');
    expect(res.toleranceDifference).toBeLessThan(0.5);
    expect(res.matchedValue).toBe(650);
    expect(res.keptTotalValue).toBe(650);
    expect(res.returnedTotalValue).toBe(1400);

    const shirtAssignment = res.itemAssignments.get(0);
    const jeansAssignment = res.itemAssignments.get(1);
    expect(shirtAssignment?.keptQty).toBe(1);
    expect(shirtAssignment?.returnedQty).toBe(0);
    expect(jeansAssignment?.keptQty).toBe(0);
    expect(jeansAssignment?.returnedQty).toBe(1);
  });

  it('guarantees strictly integer quantities (never float 0.5)', () => {
    const items: OrderItemEntry[] = [
      { idx: 0, cost: 500, qty: 2 },
    ];
    // Paid ৳550 (one item ৳500 kept + ৳50 fee)
    const res = matchPartialItemsAdvanced(items, 550, 1050, 50, 90);

    const assignment = res.itemAssignments.get(0);
    expect(assignment).toBeDefined();
    expect(Number.isInteger(assignment?.keptQty)).toBe(true);
    expect(Number.isInteger(assignment?.returnedQty)).toBe(true);
    expect(assignment?.keptQty).toBe(1);
    expect(assignment?.returnedQty).toBe(1);
  });

  it('flags ambiguous multi-candidate orders for manual review', () => {
    // Order contains two distinct items of the exact same cost: ৳1200
    const items: OrderItemEntry[] = [
      { idx: 0, cost: 1200, qty: 1 }, // Olive Jacket
      { idx: 1, cost: 1200, qty: 1 }, // Navy Jacket
      { idx: 2, cost: 600, qty: 1 },  // T-Shirt
    ];
    // Customer paid ৳1250 (৳1200 + ৳50 fee). One jacket was kept, but which one is ambiguous.
    const audited = matchPartialItemsWithAudit(items, 1250, 3050, 50, 90);

    expect(audited.requiresManualReview).toBe(true);
    expect(audited.confidence).toBe('AMBIGUOUS_MULTI_CANDIDATE');
    expect(audited.ambiguityScore).toBeGreaterThan(0.5);
    expect(audited.decisionEvidence.reviewReason).toContain('Multiple distinct item combinations');
  });

  it('flags fallback nearest discrete match for manual human review', () => {
    const items: OrderItemEntry[] = [
      { idx: 0, cost: 1500, qty: 1 },
      { idx: 1, cost: 2500, qty: 1 },
    ];
    // Courier collected arbitrary COD 900 that does not match any candidate delivery fee deduction
    const audited = matchPartialItemsWithAudit(items, 900, 4050, 50, 90);

    expect(audited.requiresManualReview).toBe(true);
    expect(audited.decisionEvidence.reviewReason).toBeDefined();
  });
});
