import { describe, it, expect, vi } from 'vitest';
import {
  extractProductSize,
  deriveDeterministicStock,
  buildInventoryDataset,
  filterInventoryRows,
  generateInventoryCsvString,
  exportInventoryToCsv,
  compareSizes,
  computeSizeStockBreakdown,
  groupInventoryByProduct,
  ProductStockRow,
} from '@/lib/inventoryEngine';
import { ReconciledOrderRow } from '@/types';

describe('DEEN Inventory Engine & Stock Management', () => {
  describe('extractProductSize', () => {
    it('correctly extracts sizes from trailing dash in product names', () => {
      expect(extractProductSize('Solid Oxford Casual Shirt - L')).toBe('L');
      expect(extractProductSize('Twill Chino Trouser - 34')).toBe('34');
      expect(extractProductSize('Drop Shoulder Tee - 2XL')).toBe('2XL');
      expect(extractProductSize('Slim Fit Denim Jeans - 32')).toBe('32');
    });

    it('correctly extracts sizes from parentheses', () => {
      expect(extractProductSize('Premium Panjabi (XL)')).toBe('XL');
      expect(extractProductSize('Executive Formal Trouser (36)')).toBe('36');
    });

    it('correctly extracts sizes from SKU suffix fallback', () => {
      expect(extractProductSize('Plain T-Shirt', 'TSHIRT-BLK-M')).toBe('M');
      expect(extractProductSize('Denim Jacket', 'JKT-BLU-40')).toBe('40');
    });

    it('identifies accessories as Free Size', () => {
      expect(extractProductSize('DEEN Black Bifold Wallet')).toBe('Free Size');
      expect(extractProductSize('Leather Card Holder')).toBe('Free Size');
      expect(extractProductSize('Executive Belt')).toBe('Free Size');
    });

    it('falls back to Standard when no size is present', () => {
      expect(extractProductSize('DEEN Special Gift Box')).toBe('Standard');
    });
  });

  describe('deriveDeterministicStock', () => {
    it('allocates positive stock across all 5 DEEN inventory locations', () => {
      const stock = deriveDeterministicStock('OXF-SHIRT-NAVY-L', 10, 1290);

      expect(stock.warehouse).toBeGreaterThan(0);
      expect(stock.mirpur).toBeGreaterThanOrEqual(0);
      expect(stock.cumilla).toBeGreaterThanOrEqual(0);
      expect(stock.wari).toBeGreaterThanOrEqual(0);
      expect(stock.sylhet).toBeGreaterThanOrEqual(0);

      // Central Warehouse should hold the major share
      expect(stock.warehouse).toBeGreaterThan(stock.mirpur);
      expect(stock.warehouse).toBeGreaterThan(stock.cumilla);
    });

    it('scales batch target with sales velocity', () => {
      const highVelocityStock = deriveDeterministicStock('HIGH-VOL-SKU-1', 30, 990);
      const lowVelocityStock = deriveDeterministicStock('LOW-VOL-SKU-1', 2, 990);

      const highTotal =
        highVelocityStock.warehouse +
        highVelocityStock.mirpur +
        highVelocityStock.cumilla +
        highVelocityStock.wari +
        highVelocityStock.sylhet;

      const lowTotal =
        lowVelocityStock.warehouse +
        lowVelocityStock.mirpur +
        lowVelocityStock.cumilla +
        lowVelocityStock.wari +
        lowVelocityStock.sylhet;

      expect(highTotal).toBeGreaterThan(lowTotal);
    });
  });

  describe('buildInventoryDataset', () => {
    const mockOrders: ReconciledOrderRow[] = [
      {
        orderId: '1001',
        sku: 'TSH-WHT-L',
        itemName: 'DEEN Drop Shoulder Tee - L',
        itemCost: 890,
        quantity: 3,
        fulfillmentLocation: 'Online Store (Central Warehouse)',
        branchSuffix: '',
        lineStatus: 'Primary Item (Unique Order)',
        deliveryStatus: 'Delivered',
        orderCategory: 'DELIVERED',
        orderDate: new Date('2026-11-01'),
        customerName: 'Karim Rahman',
        phone: '01711000000',
        city: 'Dhaka',
        districtArea: 'Inside Dhaka',
        orderAmount: 2670,
        netRevenueImpact: 2670,
        paymentMethod: 'Cash on Delivery',
        hasSplitSuffix: false,
        cogsEstimate: 380,
      },
      {
        orderId: '1002 c',
        sku: 'TSH-WHT-L',
        itemName: 'DEEN Drop Shoulder Tee - L',
        itemCost: 890,
        quantity: 1,
        fulfillmentLocation: 'Cumilla Branch',
        branchSuffix: 'c',
        lineStatus: 'Primary Item (Unique Order)',
        deliveryStatus: 'Delivered',
        orderCategory: 'DELIVERED',
        orderDate: new Date('2026-11-02'),
        customerName: 'Rahim Ullah',
        phone: '01811000000',
        city: 'Cumilla',
        districtArea: 'Outside Dhaka',
        orderAmount: 890,
        netRevenueImpact: 890,
        paymentMethod: 'Cash on Delivery',
        hasSplitSuffix: true,
        cogsEstimate: 380,
      },
    ];

    it('aggregates unique products and calculates summary metrics', () => {
      const { rows, metrics } = buildInventoryDataset(mockOrders);

      expect(rows.length).toBeGreaterThan(0);
      expect(metrics.totalSkus).toBe(rows.length);
      expect(metrics.totalUnits).toBeGreaterThan(0);
      expect(metrics.totalRetailValue).toBeGreaterThan(0);
      expect(metrics.totalCostValue).toBeGreaterThan(0);

      const whiteTeeRow = rows.find((r) => r.sku === 'TSH-WHT-L');
      expect(whiteTeeRow).toBeDefined();
      expect(whiteTeeRow?.productTitle).toContain('DEEN Drop Shoulder');
      expect(whiteTeeRow?.size).toBe('L');
      expect(whiteTeeRow?.category).toBe('T-Shirt');
      expect(whiteTeeRow?.subCategory).toBe('Drop Shoulder');
      expect(whiteTeeRow?.recentSalesVelocity).toBe(4);
    });

    it('respects live stock overrides when supplied', () => {
      const liveOverride = {
        'TSH-WHT-L': {
          warehouse: 50,
          mirpur: 10,
          cumilla: 5,
          wari: 4,
          sylhet: 3,
        },
      };

      const { rows } = buildInventoryDataset(mockOrders, liveOverride);
      const row = rows.find((r) => r.sku === 'TSH-WHT-L');

      expect(row?.stock.warehouse).toBe(50);
      expect(row?.stock.mirpur).toBe(10);
      expect(row?.stock.cumilla).toBe(5);
      expect(row?.stock.wari).toBe(4);
      expect(row?.stock.sylhet).toBe(3);
      expect(row?.totalStock).toBe(72);
      expect(row?.stockStatus).toBe('IN_STOCK');
    });
  });

  const mockRows: ProductStockRow[] = [
    {
      sku: 'TSH-001-L',
      masterSku: 'TSH-001',
      productId: '101',
      productTitle: 'Solid Black Drop Shoulder Tee',
      category: 'T-Shirt',
      subCategory: 'Drop Shoulder',
      size: 'L',
      unitPrice: 890,
      cogs: 380,
      stock: { warehouse: 20, mirpur: 5, cumilla: 4, wari: 2, sylhet: 1 },
      totalStock: 32,
      stockStatus: 'IN_STOCK',
      retailValuation: 28480,
      costValuation: 12160,
      recentSalesVelocity: 15,
    },
    {
      sku: 'PNT-002-32',
      masterSku: 'PNT-002',
      productId: '102',
      productTitle: 'Executive Formal Trousers',
      category: 'Trousers',
      subCategory: 'Formal Trousers',
      size: '32',
      unitPrice: 1690,
      cogs: 720,
      stock: { warehouse: 2, mirpur: 1, cumilla: 0, wari: 0, sylhet: 0 },
      totalStock: 3,
      stockStatus: 'LOW_STOCK',
      retailValuation: 5070,
      costValuation: 2160,
      recentSalesVelocity: 8,
    },
    {
      sku: 'JEAN-003-34',
      masterSku: 'JEAN-003',
      productId: '103',
      productTitle: 'Regular Fit Raw Denim',
      category: 'Jeans',
      subCategory: 'Regular Fit Jeans',
      size: '34',
      unitPrice: 1990,
      cogs: 850,
      stock: { warehouse: 0, mirpur: 0, cumilla: 0, wari: 0, sylhet: 0 },
      totalStock: 0,
      stockStatus: 'OUT_OF_STOCK',
      retailValuation: 0,
      costValuation: 0,
      recentSalesVelocity: 0,
    },
  ];

  describe('filterInventoryRows', () => {

    it('filters by search term across SKU, title, size, and category', () => {
      const bySku = filterInventoryRows(mockRows, {
        searchTerm: 'TSH-001',
        location: 'ALL',
        category: 'ALL',
        status: 'ALL',
        sortBy: 'totalStock',
        sortOrder: 'desc',
      });
      expect(bySku.length).toBe(1);
      expect(bySku[0].sku).toBe('TSH-001-L');

      const bySize = filterInventoryRows(mockRows, {
        searchTerm: '32',
        location: 'ALL',
        category: 'ALL',
        status: 'ALL',
        sortBy: 'totalStock',
        sortOrder: 'desc',
      });
      expect(bySize.length).toBe(1);
      expect(bySize[0].sku).toBe('PNT-002-32');
    });

    it('filters by category', () => {
      const result = filterInventoryRows(mockRows, {
        searchTerm: '',
        location: 'ALL',
        category: 'Trousers',
        status: 'ALL',
        sortBy: 'totalStock',
        sortOrder: 'desc',
      });
      expect(result.length).toBe(1);
      expect(result[0].category).toBe('Trousers');
    });

    it('filters by stock health status', () => {
      const inStock = filterInventoryRows(mockRows, {
        searchTerm: '',
        location: 'ALL',
        category: 'ALL',
        status: 'IN_STOCK',
        sortBy: 'totalStock',
        sortOrder: 'desc',
      });
      expect(inStock.length).toBe(1);
      expect(inStock[0].sku).toBe('TSH-001-L');

      const lowStock = filterInventoryRows(mockRows, {
        searchTerm: '',
        location: 'ALL',
        category: 'ALL',
        status: 'LOW_STOCK',
        sortBy: 'totalStock',
        sortOrder: 'desc',
      });
      expect(lowStock.length).toBe(1);
      expect(lowStock[0].sku).toBe('PNT-002-32');

      const outOfStock = filterInventoryRows(mockRows, {
        searchTerm: '',
        location: 'ALL',
        category: 'ALL',
        status: 'OUT_OF_STOCK',
        sortBy: 'totalStock',
        sortOrder: 'desc',
      });
      expect(outOfStock.length).toBe(1);
      expect(outOfStock[0].sku).toBe('JEAN-003-34');
    });

    it('filters by location-specific stock health', () => {
      // In Cumilla, PNT-002-32 has 0 stock (Out of Stock)
      const cumillaOutOfStock = filterInventoryRows(mockRows, {
        searchTerm: '',
        location: 'cumilla',
        category: 'ALL',
        status: 'OUT_OF_STOCK',
        sortBy: 'totalStock',
        sortOrder: 'desc',
      });
      expect(cumillaOutOfStock.some((r) => r.sku === 'PNT-002-32')).toBe(true);
      expect(cumillaOutOfStock.some((r) => r.sku === 'JEAN-003-34')).toBe(true);
    });

    it('filters by size variation', () => {
      const sizeL = filterInventoryRows(mockRows, {
        searchTerm: '',
        location: 'ALL',
        category: 'ALL',
        size: 'L',
        status: 'ALL',
        sortBy: 'totalStock',
        sortOrder: 'desc',
      });
      expect(sizeL.length).toBe(1);
      expect(sizeL[0].sku).toBe('TSH-001-L');
    });

    it('sorts rows accurately', () => {
      const sortedByPrice = filterInventoryRows(mockRows, {
        searchTerm: '',
        location: 'ALL',
        category: 'ALL',
        status: 'ALL',
        sortBy: 'unitPrice',
        sortOrder: 'desc',
      });
      expect(sortedByPrice[0].unitPrice).toBe(1990);
      expect(sortedByPrice[2].unitPrice).toBe(890);
    });
  });

  describe('compareSizes (Canonical Variation Ordering)', () => {
    it('sorts standard apparel top sizes in canonical order', () => {
      const unsorted = ['XL', 'S', '3XL', 'M', '2XL', 'L', 'XS'];
      const sorted = [...unsorted].sort(compareSizes);
      expect(sorted).toEqual(['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']);
    });

    it('sorts bottom/waist sizes numerically', () => {
      const unsorted = ['36', '28', '34', '30', '32'];
      const sorted = [...unsorted].sort(compareSizes);
      expect(sorted).toEqual(['28', '30', '32', '34', '36']);
    });
  });

  describe('computeSizeStockBreakdown', () => {
    it('aggregates stock and stockout rates across sizes', () => {
      const breakdown = computeSizeStockBreakdown(mockRows);
      expect(breakdown.length).toBe(3);
      const lSize = breakdown.find((b) => b.size === 'L');
      expect(lSize?.units).toBe(32);
      expect(lSize?.stockoutRate).toBe(0);

      const size34 = breakdown.find((b) => b.size === '34');
      expect(size34?.units).toBe(0);
      expect(size34?.stockoutRate).toBe(100);
    });
  });

  describe('groupInventoryByProduct (Style Matrix)', () => {
    it('groups variation SKUs into master product style groups with size summary', () => {
      const variations: ProductStockRow[] = [
        {
          sku: 'OXF-NAVY-M',
          masterSku: 'OXF-NAVY',
          productId: '501',
          productTitle: 'Solid Oxford Shirt',
          category: 'Shirt',
          subCategory: 'Oxford Shirt',
          size: 'M',
          unitPrice: 1290,
          cogs: 550,
          stock: { warehouse: 10, mirpur: 2, cumilla: 2, wari: 1, sylhet: 1 },
          totalStock: 16,
          stockStatus: 'IN_STOCK',
          retailValuation: 20640,
          costValuation: 8800,
          recentSalesVelocity: 12,
        },
        {
          sku: 'OXF-NAVY-L',
          masterSku: 'OXF-NAVY',
          productId: '501',
          productTitle: 'Solid Oxford Shirt',
          category: 'Shirt',
          subCategory: 'Oxford Shirt',
          size: 'L',
          unitPrice: 1290,
          cogs: 550,
          stock: { warehouse: 15, mirpur: 3, cumilla: 3, wari: 2, sylhet: 2 },
          totalStock: 25,
          stockStatus: 'IN_STOCK',
          retailValuation: 32250,
          costValuation: 13750,
          recentSalesVelocity: 18,
        },
      ];

      const groups = groupInventoryByProduct(variations);
      expect(groups.length).toBe(1);
      expect(groups[0].masterSku).toBe('OXF-NAVY');
      expect(groups[0].totalStock).toBe(41);
      expect(groups[0].variations.length).toBe(2);
      expect(groups[0].sizeSummary['M']).toBe(16);
      expect(groups[0].sizeSummary['L']).toBe(25);
    });
  });

  describe('generateInventoryCsvString and exportInventoryToCsv', () => {
    const sampleRows: ProductStockRow[] = [
      {
        sku: 'TSH-001-L',
        masterSku: 'TSH-001',
        productId: '101',
        productTitle: 'Solid Black Drop Shoulder Tee',
        category: 'T-Shirt',
        subCategory: 'Drop Shoulder',
        size: 'L',
        unitPrice: 890,
        cogs: 380,
        stock: { warehouse: 20, mirpur: 5, cumilla: 4, wari: 2, sylhet: 1 },
        totalStock: 32,
        stockStatus: 'IN_STOCK',
        retailValuation: 28480,
        costValuation: 12160,
        recentSalesVelocity: 15,
      },
    ];

    it('generates properly formatted CSV string with headers and totals', () => {
      const csv = generateInventoryCsvString(sampleRows);
      expect(csv).toContain('"SKU","Master SKU","Product Title","Category"');
      expect(csv).toContain('"TSH-001-L"');
      expect(csv).toContain('"Solid Black Drop Shoulder Tee"');
      expect(csv).toContain('"TOTAL"');
      expect(csv).toContain('"1 SKUs"');
    });

    it('safely handles non-browser (Node.js/SSR) environments without throwing', () => {
      expect(() => exportInventoryToCsv(sampleRows, 'test_inventory.csv')).not.toThrow();
    });

    it('creates a CSV blob and triggers download in browser environments', () => {
      const mockClick = vi.fn();
      const mockAppend = vi.fn();
      const mockRemove = vi.fn();

      const mockDoc = {
        createElement: vi.fn().mockImplementation((tagName: string) => {
          if (tagName === 'a') {
            return {
              set href(_val: string) {},
              set download(_val: string) {},
              click: mockClick,
            };
          }
          return {};
        }),
        body: {
          appendChild: mockAppend,
          removeChild: mockRemove,
        },
      };

      const originalWindow = (global as unknown as { window?: unknown }).window;
      const originalDocument = (global as unknown as { document?: unknown }).document;
      const originalUrl = (global as unknown as { URL?: unknown }).URL;

      (global as unknown as { window?: unknown }).window = {};
      (global as unknown as { document?: unknown }).document = mockDoc;
      (global as unknown as { URL?: unknown }).URL = {
        createObjectURL: vi.fn().mockReturnValue('blob:mock-csv'),
        revokeObjectURL: vi.fn(),
      };

      try {
        exportInventoryToCsv(sampleRows, 'test_inventory.csv');
        expect(mockClick).toHaveBeenCalled();
        expect(mockAppend).toHaveBeenCalled();
        expect(mockRemove).toHaveBeenCalled();
      } finally {
        (global as unknown as { window?: unknown }).window = originalWindow;
        (global as unknown as { document?: unknown }).document = originalDocument;
        (global as unknown as { URL?: unknown }).URL = originalUrl;
      }
    });
  });
});
