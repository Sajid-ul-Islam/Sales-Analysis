# Quality Assurance & Testing Framework: DEEN Commerce

**Version:** 2.4.0  
**Test Runner:** Vitest 5.0  
**Coverage Standard:** 100% Critical Path Coverage (Reconciliation Algorithms & Accounting Logic)  
**Last Updated:** November 2026  

---

## 1. Testing Philosophy & Test Pyramid

In a financial reconciliation engine, computational errors directly cause incorrect inventory valuations and erroneous merchant remittances. 

Our testing strategy prioritizes **deterministic unit tests** on core mathematical algorithms, backed by **integration suites** verifying multi-month closing ledgers.

```
                  /\
                 /  \      E2E Browser Tests
                /    \     (Table scrolling, Theme switching, Export)
               /------\
              /        \    Integration Tests
             /          \   (Multi-month statements, API sample data)
            /------------\
           /              \  Mathematical Unit Tests
          /________________\ (Subset-sum 0/1 knapsack, Integer check)
```

---

## 2. Running Test Suites

```bash
# Run all unit and integration tests once
npm test

# Run tests with interactive file watcher
npm run test:watch

# Run TypeScript compilation check
npm run type-check

# Run ESLint validation
npm run lint
```

---

## 3. Core Test Suites

### 3.1 Knapsack DP & Subset-Sum Suite (`tests/subsetSum.test.ts`)
Validates that partial delivery line items are reverse-engineered accurately without floating-point pollution:
- **Test 01: Standard Partial Delivery**: Customer buys 2 shirts at ৳1400 each, keeps 1, pays ৳1450 (includes ৳50 shipping).
  - *Expectation:* Delivered: 1 unit (৳1400); Returned: 1 unit (৳1400); Integers: verified.
- **Test 02: Outside Dhaka Shipping Fee (৳90)**: Deducts ৳90 before running subset-sum.
- **Test 03: Fractional Item Prevention**: Injects arbitrary cash amount not matching any item combination.
  - *Expectation:* Flags order as `DISC-01` anomaly without producing fractional item counts.
- **Test 04: Boundary Edge Case**: Order with 0 delivered items (full return).
  - *Expectation:* Status is classified as `Return` or `Paid Return`.

### 3.2 Multi-Month Statements Suite (`tests/statements/`)
- Validates that consolidating September, October, and November 2026 orders produces zero double-counted line items.
- Ensures month-over-month trajectory percentage calculations handle edge cases like zero baseline sales.

### 3.3 Campaign Intelligence Suite (`tests/campaign/`)
- Verifies Delivered ROAS: $\text{Delivered ROAS} = \frac{\text{Net Reconciled Revenue from Delivered Items}}{\text{Ad Spend}}$.
- Ensures returned merchandise value is strictly deducted from campaign ROI calculations.

---

## 4. Unbreakable UI & Responsive Verification Protocol

Before releasing code that alters presentation layouts, execute manual responsive checks:
1. **Viewport 375px (Mobile)**:
   - Verify sidebar collapses into slide-over drawer.
   - Verify all table wrappers allow horizontal scrolling (`overflow-x-auto`) without body horizontal bounce.
2. **Viewport 1440px / 1920px (Desktop)**:
   - Ensure header search box, `Ask AI` button, and operator profile render without overlapping.
   - Check SVG clamping: all icons must maintain $\le 44\times 44\text{px}$.
3. **Theme Background Switching**:
   - Verify instant switch between Native Super White (`#FFFFFF`), Modern Slate, Cool Zinc, Warm Ivory, and Dark Canvas without layout shift.
