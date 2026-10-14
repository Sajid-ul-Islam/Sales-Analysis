import { describe, it, expect } from 'vitest';
import { readProjectFile } from './responsiveContracts';

describe('Adversarial & Empirical Challenge: Milestone M2 (Responsive Tables with Frozen Columns)', () => {
  const ordersLedgerCode = readProjectFile('src/components/tabs/OrdersLedgerTab.tsx');
  const courierMismatchCode = readProjectFile('src/components/tabs/CourierMismatchTab.tsx');
  const skuPerformanceCode = readProjectFile('src/components/tabs/SkuPerformanceTab.tsx');
  const itemReturnsCode = readProjectFile('src/components/tabs/ItemReturnsTab.tsx');
  const customerRiskCode = readProjectFile('src/components/tabs/CustomerRiskTab.tsx');
  const exchangedOrdersCode = readProjectFile('src/components/tabs/ExchangedOrdersTab.tsx');

  // =========================================================================
  // SECTION 1: CONTAINER ZERO-BLOWOUT CONSTRAINTS (overflow-x-auto min-w-0)
  // =========================================================================
  describe('1. Table Zero-Blowout Container Contract (min-w-0)', () => {
    it('1.1 OrdersLedgerTab wraps table in overflow-x-auto min-w-0', () => {
      expect(ordersLedgerCode).toMatch(/<div[^>]*className="[^"]*overflow-x-auto[^"]*min-w-0/);
    });

    it('1.2 CourierMismatchTab wraps table in overflow-x-auto min-w-0', () => {
      expect(courierMismatchCode).toMatch(/<div[^>]*className="[^"]*overflow-x-auto[^"]*min-w-0/);
    });

    it('1.3 SkuPerformanceTab wraps table in overflow-x-auto min-w-0', () => {
      expect(skuPerformanceCode).toMatch(/<div[^>]*className="[^"]*overflow-x-auto[^"]*min-w-0/);
    });

    it('1.4 ItemReturnsTab wraps table in overflow-x-auto min-w-0', () => {
      expect(itemReturnsCode).toMatch(/<div[^>]*className="[^"]*overflow-x-auto[^"]*min-w-0/);
    });

    it('1.5 CustomerRiskTab wraps table in overflow-x-auto min-w-0', () => {
      expect(customerRiskCode).toMatch(/<div[^>]*className="[^"]*overflow-x-auto[^"]*min-w-0/);
    });

    it('1.6 ExchangedOrdersTab wraps table in overflow-x-auto min-w-0', () => {
      expect(exchangedOrdersCode).toMatch(/<div[^>]*className="[^"]*overflow-x-auto[^"]*min-w-0/);
    });
  });

  // =========================================================================
  // SECTION 2: FROZEN COLUMN COORDINATES & Z-INDEX LAYERING
  // =========================================================================
  describe('2. Sticky Positioning & Z-Index Layering', () => {
    it('2.1 OrdersLedgerTab freezes Order ID with sticky left-0 z-20 on header and z-10 on body', () => {
      expect(ordersLedgerCode).toMatch(/<th[^>]*sticky[^>]*left-0[^>]*z-20[^>]*>Order ID<\/th>/);
      expect(ordersLedgerCode).toMatch(/<td[^>]*sticky[^>]*left-0[^>]*z-10/);
    });

    it('2.2 CourierMismatchTab freezes Order & Tracking with sticky left-0 z-20 on header and z-10 on body', () => {
      expect(courierMismatchCode).toMatch(/<th[^>]*sticky[^>]*left-0[^>]*z-20[^>]*>Order & Tracking<\/th>/);
      expect(courierMismatchCode).toMatch(/<td[^>]*sticky[^>]*left-0[^>]*z-10/);
    });

    it('2.3 SkuPerformanceTab freezes SKU Code corner with sticky top-0 left-0 z-20 and body z-10', () => {
      expect(skuPerformanceCode).toMatch(/<th[^>]*sticky[^>]*top-0[^>]*left-0[^>]*z-20[^>]*>SKU Code<\/th>/);
      expect(skuPerformanceCode).toMatch(/<td[^>]*sticky[^>]*left-0[^>]*z-10/);
    });

    it('2.4 ItemReturnsTab freezes Order ID with sticky left-0 z-20 on header and z-10 on body', () => {
      expect(itemReturnsCode).toMatch(/<th[^>]*sticky[^>]*left-0[^>]*z-20[^>]*>Order ID<\/th>/);
      expect(itemReturnsCode).toMatch(/<td[^>]*sticky[^>]*left-0[^>]*z-10/);
    });

    it('2.5 CustomerRiskTab freezes Phone & Name with sticky left-0 z-20 on header and z-10 on body', () => {
      expect(customerRiskCode).toMatch(/<th[^>]*sticky[^>]*left-0[^>]*z-20[^>]*>Customer Phone & Name<\/th>/);
      expect(customerRiskCode).toMatch(/<td[^>]*sticky[^>]*left-0[^>]*z-10/);
    });

    it('2.6 ExchangedOrdersTab freezes Order ID corner with sticky top-0 left-0 z-20 and body z-10', () => {
      expect(exchangedOrdersCode).toMatch(/<th[^>]*sticky[^>]*top-0[^>]*left-0[^>]*z-20[^>]*>Order ID & Prefix<\/th>/);
      expect(exchangedOrdersCode).toMatch(/<td[^>]*sticky[^>]*left-0[^>]*z-10/);
    });
  });

  // =========================================================================
  // SECTION 3: OPAQUE BACKGROUND LAYERING (ZERO TEXT BLEED-THROUGH)
  // =========================================================================
  describe('3. Opaque Background Guard (Zero Bleed-Through)', () => {
    it('3.1 All frozen headers declare solid bg-slate-50', () => {
      expect(ordersLedgerCode).toMatch(/<th[^>]*bg-slate-50[^>]*sticky/);
      expect(courierMismatchCode).toMatch(/<th[^>]*bg-slate-50[^>]*sticky/);
      expect(skuPerformanceCode).toMatch(/<th[^>]*bg-slate-50[^>]*sticky/);
      expect(itemReturnsCode).toMatch(/<th[^>]*bg-slate-50[^>]*sticky/);
      expect(customerRiskCode).toMatch(/<th[^>]*bg-slate-50[^>]*sticky/);
      expect(exchangedOrdersCode).toMatch(/<th[^>]*bg-slate-50[^>]*sticky/);
    });

    it('3.2 CourierMismatchTab body cells use solid opaque severity hex backgrounds', () => {
      expect(courierMismatchCode).toContain('bg-[#FFF1F2]');
      expect(courierMismatchCode).toContain('bg-[#FFFBEB]');
    });

    it('3.3 OrdersLedgerTab body cells use solid bg-white with group-hover:bg-[#FFF7ED]', () => {
      expect(ordersLedgerCode).toContain('bg-white');
      expect(ordersLedgerCode).toContain('group-hover:bg-[#FFF7ED]');
    });
  });

  // =========================================================================
  // SECTION 4: DROP-SHADOW SEPARATION & SCROLL AFFORDANCE
  // =========================================================================
  describe('4. Elevation Edge & Mobile Scroll Hints', () => {
    it('4.1 All tables declare elevation boundary shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] on sticky cells', () => {
      const shadowToken = 'shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]';
      expect(ordersLedgerCode).toContain(shadowToken);
      expect(courierMismatchCode).toContain(shadowToken);
      expect(skuPerformanceCode).toContain(shadowToken);
      expect(itemReturnsCode).toContain(shadowToken);
      expect(customerRiskCode).toContain(shadowToken);
      expect(exchangedOrdersCode).toContain(shadowToken);
    });

    it('4.2 All tables provide a mobile swipe hint bar (md:hidden)', () => {
      expect(ordersLedgerCode).toMatch(/className="[^"]*md:hidden[^"]*"/);
      expect(courierMismatchCode).toMatch(/className="[^"]*md:hidden[^"]*"/);
      expect(skuPerformanceCode).toMatch(/className="[^"]*md:hidden[^"]*"/);
      expect(itemReturnsCode).toMatch(/className="[^"]*md:hidden[^"]*"/);
      expect(customerRiskCode).toMatch(/className="[^"]*md:hidden[^"]*"/);
      expect(exchangedOrdersCode).toMatch(/className="[^"]*md:hidden[^"]*"/);
    });
  });
});
