import { describe, it, expect } from 'vitest';
import {
  cleanCustomerPhone,
  detectDistrictArea,
  classifyPayment,
  detectBranchFromOrder,
  extractConsignmentTracking,
  extractVariationAttributes,
  formatWooCommerceToOrderRows,
} from '@/lib/woocommerceClient';

describe('WooCommerce Real-Time Order Client & Data Transformation', () => {
  describe('cleanCustomerPhone', () => {
    it('normalizes local 11-digit numbers', () => {
      const res = cleanCustomerPhone('01712345678');
      expect(res.displayPhone).toBe('01712345678');
      expect(res.whatsappPhone).toBe('8801712345678');
    });

    it('normalizes +880 international numbers', () => {
      const res = cleanCustomerPhone('+8801812345678');
      expect(res.displayPhone).toBe('01812345678');
      expect(res.whatsappPhone).toBe('8801812345678');
    });

    it('normalizes 10-digit un-prefixed numbers', () => {
      const res = cleanCustomerPhone('1912345678');
      expect(res.displayPhone).toBe('01912345678');
      expect(res.whatsappPhone).toBe('8801912345678');
    });

    it('handles empty or null inputs gracefully', () => {
      expect(cleanCustomerPhone(null)).toEqual({ displayPhone: '', whatsappPhone: '' });
      expect(cleanCustomerPhone(undefined)).toEqual({ displayPhone: '', whatsappPhone: '' });
    });
  });

  describe('detectDistrictArea', () => {
    it('identifies addresses Inside Dhaka', () => {
      expect(detectDistrictArea('Dhaka', 'Dhaka', 'House 14, Road 5, Mirpur-10')).toBe('Inside Dhaka');
      expect(detectDistrictArea('Uttara', '', 'Sector 4, Road 12')).toBe('Inside Dhaka');
      expect(detectDistrictArea('Gulshan', 'Dhaka', 'Avenue 2')).toBe('Inside Dhaka');
      expect(detectDistrictArea('Keraniganj', 'Dhaka', 'Babubazar Bridge')).toBe('Inside Dhaka');
    });

    it('identifies addresses Outside Dhaka', () => {
      expect(detectDistrictArea('Chittagong', 'Chittagong', 'GEC Circle')).toBe('Outside Dhaka');
      expect(detectDistrictArea('Sylhet', 'Sylhet', 'Zindabazar')).toBe('Outside Dhaka');
      expect(detectDistrictArea('Cumilla', 'Chittagong', 'Kandirpar')).toBe('Outside Dhaka');
      expect(detectDistrictArea('Rajshahi', 'Rajshahi', 'Shaheb Bazar')).toBe('Outside Dhaka');
    });
  });

  describe('classifyPayment', () => {
    it('identifies Cash on Delivery', () => {
      const res = classifyPayment('Cash on Delivery', 'cod');
      expect(res.isCod).toBe(true);
      expect(res.isPrepaid).toBe(false);
    });

    it('identifies bKash as prepaid', () => {
      const res = classifyPayment('bKash Online Payment', 'bkash');
      expect(res.isCod).toBe(false);
      expect(res.isPrepaid).toBe(true);
    });

    it('identifies Card / SSLCommerz as prepaid', () => {
      const res = classifyPayment('Credit Card (SSLCommerz)', 'sslcommerz');
      expect(res.isCod).toBe(false);
      expect(res.isPrepaid).toBe(true);
    });
  });

  describe('detectBranchFromOrder', () => {
    it('identifies Mirpur Outlet POS by suffix "m"', () => {
      const res = detectBranchFromOrder({}, [], '17263 m');
      expect(res.branchCode).toBe('MIRPUR');
      expect(res.fulfillmentBranch).toBe('Mirpur Outlet POS');
      expect(res.isPos).toBe(true);
    });

    it('identifies Cumilla Branch by suffix "c"', () => {
      const res = detectBranchFromOrder({}, [], '17263 c');
      expect(res.branchCode).toBe('CUMILLA');
      expect(res.fulfillmentBranch).toBe('Cumilla Branch');
      expect(res.isPos).toBe(true);
    });

    it('identifies Wari Branch by suffix "w"', () => {
      const res = detectBranchFromOrder({}, [], '17263-w');
      expect(res.branchCode).toBe('WARI');
      expect(res.fulfillmentBranch).toBe('Wari Branch');
      expect(res.isPos).toBe(true);
    });

    it('identifies Sylhet Branch by suffix "s"', () => {
      const res = detectBranchFromOrder({}, [], '17263 s');
      expect(res.branchCode).toBe('SYLHET');
      expect(res.fulfillmentBranch).toBe('Sylhet Branch');
      expect(res.isPos).toBe(true);
    });

    it('identifies Exchange Replacement by prefix "D-"', () => {
      const res = detectBranchFromOrder({}, [], 'D-17263');
      expect(res.branchCode).toBe('EXCHANGE');
      expect(res.fulfillmentBranch).toBe('Exchange Replacement');
      expect(res.isPos).toBe(false);
    });

    it('identifies Online Central Store when unsuffixed', () => {
      const res = detectBranchFromOrder({}, [], '17263');
      expect(res.branchCode).toBe('ONLINE');
      expect(res.fulfillmentBranch).toBe('Online Store (Central Warehouse)');
      expect(res.isPos).toBe(false);
    });

    it('identifies POS from metadata outlet ID', () => {
      const meta = [{ key: '_sip_outlet_id', value: '2' }];
      const res = detectBranchFromOrder({}, meta, '17263');
      expect(res.branchCode).toBe('CUMILLA');
      expect(res.fulfillmentBranch).toBe('Cumilla Branch');
      expect(res.isPos).toBe(true);
    });
  });

  describe('extractConsignmentTracking', () => {
    it('extracts tracking from _pathao_consignment_id meta key', () => {
      const meta = [{ key: '_pathao_consignment_id', value: 'RD290926W5BWHU' }];
      expect(extractConsignmentTracking({}, meta)).toBe('RD290926W5BWHU');
    });

    it('extracts tracking from shipment tracking JSON items', () => {
      const meta = [
        {
          key: '_wc_shipment_tracking_items',
          value: [{ tracking_number: 'P123456789' }],
        },
      ];
      expect(extractConsignmentTracking({}, meta)).toBe('P123456789');
    });

    it('extracts tracking code from customer note regex fallback', () => {
      const order = { customer_note: 'Pathao Consignment: RD99887766AA' };
      expect(extractConsignmentTracking(order, [])).toBe('RD99887766AA');
    });
  });

  describe('extractVariationAttributes', () => {
    it('extracts Size and Color attributes', () => {
      const item = {
        meta_data: [
          { key: 'pa_size', value: '34' },
          { key: 'pa_color', value: 'Vintage Blue' },
        ],
      };
      const res = extractVariationAttributes(item);
      expect(res.size).toBe('34');
      expect(res.color).toBe('Vintage Blue');
    });
  });

  describe('formatWooCommerceToOrderRows', () => {
    it('accurately flattens a multi-line WooCommerce order with line attributes', () => {
      const mockOrder = {
        id: 17290,
        number: '17290',
        date_created: '2026-10-16T07:30:00',
        total: '4980',
        status: 'processing',
        payment_method_title: 'Cash on delivery',
        billing: {
          first_name: 'Mahmudul',
          last_name: 'Hasan',
          phone: '01711223344',
          city: 'Dhaka',
          state: 'Dhaka',
          address_1: 'House 8, Road 2, Dhanmondi',
        },
        shipping_lines: [{ total: '60' }],
        meta_data: [
          { key: '_pathao_consignment_id', value: 'RD161026XYZ99' },
        ],
        line_items: [
          {
            id: 101,
            name: 'DEEN Signature Raw Denim Jeans - Slim Fit',
            sku: 'DN-RAW-01',
            quantity: 1,
            subtotal: '2490',
            total: '2490',
            meta_data: [{ key: 'pa_size', value: '32' }],
          },
          {
            id: 102,
            name: 'Calvin Klein Crewneck Sweatshirt - Heather Grey',
            sku: 'CK-SW-02',
            quantity: 1,
            subtotal: '2490',
            total: '2490',
            meta_data: [{ key: 'pa_size', value: 'L' }],
          },
        ],
      };

      const rows = formatWooCommerceToOrderRows([mockOrder]);
      expect(rows.length).toBe(2);

      // Verify first item
      const item1 = rows[0];
      expect(item1['Order ID']).toBe('17290');
      expect(item1['Customer Name']).toBe('Mahmudul Hasan');
      expect(item1.Phone).toBe('01711223344');
      expect(item1.formattedPhone).toBe('8801711223344');
      expect(item1.districtArea).toBe('Inside Dhaka');
      expect(item1.isCod).toBe(true);
      expect(item1.isPrepaid).toBe(false);
      expect(item1['Consignment ID']).toBe('RD161026XYZ99');
      expect(item1['Item Cost']).toBe(2490);
      expect(item1.Size).toBe('32');
      expect(item1.Category).toBe('Jeans');
      expect(item1['Apparel Line']).toBe('DEEN Regular');
      expect(item1.isSelects).toBe(false);

      // Verify second item (Selects)
      const item2 = rows[1];
      expect(item2['Order ID']).toBe('17290');
      expect(item2.SKU).toBe('CK-SW-02');
      expect(item2.Size).toBe('L');
      expect(item2['Apparel Line']).toBe('DEEN Selects');
      expect(item2.isSelects).toBe(true);
    });
  });
});
