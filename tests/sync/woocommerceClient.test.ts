import { describe, it, expect } from 'vitest';
import {
  cleanCustomerPhone,
  detectDistrictArea,
  classifyPayment,
  isOnlinePaymentMethod,
  detectBranchFromOrder,
  extractConsignmentTracking,
  extractPathaoPluginOrderInfo,
  extractVariationAttributes,
  formatWooCommerceToOrderRows,
  detectWordPressStatusMarks,
  resolveSipOutlet,
  extractLineItemSipInventory,
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
    it('identifies Mirpur Outlet POS by suffix "m" when in-store', () => {
      const res = detectBranchFromOrder({}, [], '17263 m');
      expect(res.branchCode).toBe('MIRPUR');
      expect(res.fulfillmentBranch).toBe('Mirpur Outlet POS');
      expect(res.isPos).toBe(true);
    });

    it('identifies Cumilla Branch by suffix "c" as Online Branch Dispatch (isPos = false)', () => {
      const res = detectBranchFromOrder({}, [], '17263 c');
      expect(res.branchCode).toBe('CUMILLA');
      expect(res.fulfillmentBranch).toBe('Cumilla Branch');
      expect(res.isPos).toBe(false);
    });

    it('identifies Wari Branch by suffix "w" as Online Branch Dispatch (isPos = false)', () => {
      const res = detectBranchFromOrder({}, [], '17263-w');
      expect(res.branchCode).toBe('WARI');
      expect(res.fulfillmentBranch).toBe('Wari Branch');
      expect(res.isPos).toBe(false);
    });

    it('identifies Sylhet Branch by suffix "s" as Online Branch Dispatch (isPos = false)', () => {
      const res = detectBranchFromOrder({}, [], '17263 s');
      expect(res.branchCode).toBe('SYLHET');
      expect(res.fulfillmentBranch).toBe('Sylhet Branch');
      expect(res.isPos).toBe(false);
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

    it('identifies POS from metadata outlet ID without online payment', () => {
      const meta = [{ key: '_sip_outlet_id', value: '2' }];
      const res = detectBranchFromOrder({}, meta, '17263');
      expect(res.branchCode).toBe('MIRPUR');
      expect(res.fulfillmentBranch).toBe('Mirpur Outlet POS');
      expect(res.isPos).toBe(true);
    });

    it('identifies Online Branch Dispatch when metadata outlet ID has ecom payment method (sip_ecom)', () => {
      const meta = [{ key: '_sip_outlet_id', value: '7' }];
      const res = detectBranchFromOrder({ payment_method: 'sip_ecom', payment_method_title: 'Ecommerce Outlet Fulfillment' }, meta, '17263');
      expect(res.branchCode).toBe('CUMILLA');
      expect(res.fulfillmentBranch).toBe('Cumilla Branch');
      expect(res.isPos).toBe(false);
    });

    it('identifies in-store POS walk-in sale when customer pays with bKash QR or Card at outlet register', () => {
      const meta = [{ key: '_sip_outlet_id', value: '8' }];
      const res = detectBranchFromOrder({ payment_method: 'bkash', payment_method_title: 'bKash QR' }, meta, '17263');
      expect(res.branchCode).toBe('WARI');
      expect(res.fulfillmentBranch).toBe('Wari Branch POS');
      expect(res.isPos).toBe(true);
    });

    it('identifies Online Branch Dispatch when metadata outlet ID was created via web checkout', () => {
      const meta = [{ key: '_sip_outlet_id', value: '9' }];
      const res = detectBranchFromOrder({ created_via: 'checkout' }, meta, '17263');
      expect(res.branchCode).toBe('SYLHET');
      expect(res.fulfillmentBranch).toBe('Sylhet Branch');
      expect(res.isPos).toBe(false);
    });
  });

  describe('extractConsignmentTracking', () => {
    it('extracts tracking from _pathao_consignment_id meta key', () => {
      const meta = [{ key: '_pathao_consignment_id', value: 'RD290926W5BWHU' }];
      expect(extractConsignmentTracking({}, meta)).toBe('RD290926W5BWHU');
    });

    it('extracts tracking from numeric consignment values', () => {
      const meta = [{ key: '_pathao_consignment_id', value: 10582914 }];
      expect(extractConsignmentTracking({}, meta)).toBe('10582914');
    });

    it('extracts tracking from JSON response meta payload', () => {
      const meta = [
        {
          key: '_pathao_response',
          value: '{"type":"success","data":{"consignment_id":"RD88332211","order_status":"Pending"}}',
        },
      ];
      expect(extractConsignmentTracking({}, meta)).toBe('RD88332211');
    });

    it('extracts tracking from parsed object meta data', () => {
      const meta = [
        {
          key: 'pathao_data',
          value: { consignment_id: 'RD77665544', order_status: 'In Transit' },
        },
      ];
      expect(extractConsignmentTracking({}, meta)).toBe('RD77665544');
    });

    it('extracts tracking from _pathao_tracking_url URL parameter', () => {
      const meta = [
        {
          key: '_pathao_tracking_url',
          value: 'https://hermes.pathao.com/tracking?consignment_id=RD44332211',
        },
      ];
      expect(extractConsignmentTracking({}, meta)).toBe('RD44332211');
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

    it('extracts tracking from ptc_consignment_id (official courier-woocommerce-plugin key)', () => {
      const meta = [{ key: 'ptc_consignment_id', value: 'RD290926W5BWHU' }];
      expect(extractConsignmentTracking({}, meta)).toBe('RD290926W5BWHU');
    });

    it('extracts tracking from _ptc_consignment_id hidden meta key', () => {
      const meta = [{ key: '_ptc_consignment_id', value: 'DL9988776655' }];
      expect(extractConsignmentTracking({}, meta)).toBe('DL9988776655');
    });

    it('extracts tracking from Pathao merchant panel URL', () => {
      const meta = [
        {
          key: '_pathao_tracking_url',
          value: 'https://merchant.pathao.com/courier/orders/RD5544332211',
        },
      ];
      expect(extractConsignmentTracking({}, meta)).toBe('RD5544332211');
    });

    it('ignores PTC_EMPTY_FLAG ("-") and invalid placeholders', () => {
      const meta = [
        { key: 'ptc_consignment_id', value: '-' },
        { key: 'pathao_consignment_id', value: 'null' },
      ];
      expect(extractConsignmentTracking({}, meta)).toBe('');
    });

    it('extracts tracking code from customer note regex fallback', () => {
      const order = { customer_note: 'Pathao Consignment: RD99887766AA' };
      expect(extractConsignmentTracking(order, [])).toBe('RD99887766AA');
    });

    it('extracts numeric tracking code from order notes with phrase', () => {
      const order = { order_notes: 'Pathao Consignment: 10582914 created' };
      expect(extractConsignmentTracking(order, [])).toBe('10582914');
    });
  });

  describe('extractPathaoPluginOrderInfo', () => {
    it('extracts consignmentId, status, and deliveryFee from WooCommerce plugin meta', () => {
      const meta = [
        { key: 'ptc_consignment_id', value: 'RD290926W5BWHU' },
        { key: 'ptc_status', value: 'In_Transit' },
        { key: 'ptc_delivery_fee', value: '60' },
      ];
      const res = extractPathaoPluginOrderInfo({}, meta);
      expect(res.consignmentId).toBe('RD290926W5BWHU');
      expect(res.status).toBe('In_Transit');
      expect(res.deliveryFee).toBe(60);
    });

    it('handles empty or unfulfilled orders gracefully', () => {
      const meta = [
        { key: 'ptc_consignment_id', value: '-' },
        { key: 'ptc_status', value: '-' },
      ];
      const res = extractPathaoPluginOrderInfo({}, meta);
      expect(res.consignmentId).toBe('');
      expect(res.status).toBe('');
      expect(res.deliveryFee).toBe(0);
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

    it('correctly maps Pathao Courier plugin metadata (ptc_consignment_id, ptc_status, ptc_delivery_fee)', () => {
      const mockOrder = {
        id: 18335,
        number: '18335',
        date_created: '2026-10-19T10:00:00',
        total: '2490',
        status: 'completed',
        billing: {
          first_name: 'Tanvir',
          last_name: 'Ahmed',
          phone: '01811223344',
          city: 'Chittagong',
          state: 'Chittagong',
          address_1: 'GEC Circle, Nasirabad',
        },
        meta_data: [
          { key: 'ptc_consignment_id', value: 'RD191026W5BWHU' },
          { key: 'ptc_status', value: 'In_Transit' },
          { key: 'ptc_delivery_fee', value: '90' },
        ],
        line_items: [
          {
            id: 201,
            name: 'DEEN Premium Oxford Shirt - L',
            sku: 'SHIRT-OX-01',
            quantity: 1,
            total: '2490',
          },
        ],
      };

      const rows = formatWooCommerceToOrderRows([mockOrder]);
      expect(rows.length).toBe(1);
      const row = rows[0];
      expect(row['Consignment ID']).toBe('RD191026W5BWHU');
      expect(row.consignmentId).toBe('RD191026W5BWHU');
      expect(row['Pathao Status']).toBe('In_Transit');
      expect(row.pathaoStatus).toBe('In_Transit');
      expect(row['Pathao Delivery Fee']).toBe(90);
      expect(row.pathaoDeliveryFee).toBe(90);
    });

    it('populates WordPress return marks and Pathao collected amount in order rows', () => {
      const mockReturnOrder = {
        id: 18400,
        number: '18400',
        date_created: '2026-10-20T12:00:00',
        total: '3450',
        status: 'returned',
        meta_data: [
          { key: 'ptc_status', value: 'Returned' },
          { key: 'ptc_collected_amount', value: '150' },
        ],
        line_items: [
          {
            id: 202,
            name: 'DEEN Cargo Denim Pants',
            sku: 'CARGO-01',
            quantity: 1,
            total: '3450',
          },
        ],
      };

      const rows = formatWooCommerceToOrderRows([mockReturnOrder]);
      expect(rows.length).toBe(1);
      const row = rows[0];
      expect(row.isReturnFromWp).toBe(true);
      expect(row.isPaidReturnFromWp).toBe(true);
      expect(row.wpDeliveryStatus).toBe('Paid Return');
      expect(row.pathaoCollectedAmount).toBe(150);
      expect(row.wpMarkSource).toBe('pathao_plugin');
    });

    it('populates WordPress partial marks and knapsack hints in order rows', () => {
      const mockPartialOrder = {
        id: 18401,
        number: '18401',
        date_created: '2026-10-20T14:00:00',
        total: '4500',
        status: 'processing',
        meta_data: [
          { key: 'ptc_status', value: 'Partial Delivery' },
          { key: 'ptc_collected_amount', value: '2500' },
        ],
        line_items: [
          {
            id: 203,
            name: 'DEEN Jacket',
            sku: 'JKT-01',
            quantity: 1,
            total: '2500',
          },
          {
            id: 204,
            name: 'DEEN Shirt',
            sku: 'SHT-01',
            quantity: 1,
            total: '2000',
          },
        ],
      };

      const rows = formatWooCommerceToOrderRows([mockPartialOrder]);
      expect(rows.length).toBe(2);
      rows.forEach(r => {
        expect(r.isPartialFromWp).toBe(true);
        expect(r.wpDeliveryStatus).toBe('Partial');
        expect(r.pathaoCollectedAmount).toBe(2500);
      });
    });
  });

  describe('detectWordPressStatusMarks', () => {
    it('detects return status from core WooCommerce statuses (returned, refunded, rto, failed)', () => {
      expect(detectWordPressStatusMarks({ status: 'returned' }).isReturnFromWp).toBe(true);
      expect(detectWordPressStatusMarks({ status: 'wc-returned' }).isReturnFromWp).toBe(true);
      expect(detectWordPressStatusMarks({ status: 'refunded' }).isReturnFromWp).toBe(true);
      expect(detectWordPressStatusMarks({ status: 'failed' }).isReturnFromWp).toBe(true);
      expect(detectWordPressStatusMarks({ status: 'cancelled' }).isReturnFromWp).toBe(true);
      expect(detectWordPressStatusMarks({ status: 'rto' }).isReturnFromWp).toBe(true);
    });

    it('detects partial delivery from WooCommerce status and Pathao plugin meta', () => {
      const res1 = detectWordPressStatusMarks({ status: 'partial' });
      expect(res1.isPartialFromWp).toBe(true);
      expect(res1.wpDeliveryStatus).toBe('Partial');

      const res2 = detectWordPressStatusMarks(
        { status: 'processing' },
        [{ key: 'ptc_status', value: 'Partial Delivery' }, { key: 'ptc_collected_amount', value: '1450' }]
      );
      expect(res2.isPartialFromWp).toBe(true);
      expect(res2.wpDeliveryStatus).toBe('Partial');
      expect(res2.pathaoCollectedAmount).toBe(1450);
      expect(res2.wpMarkSource).toBe('pathao_plugin');
    });

    it('detects exchange from WooCommerce status and custom status plugins', () => {
      const res1 = detectWordPressStatusMarks({ status: 'exchange' });
      expect(res1.isExchangeFromWp).toBe(true);
      expect(res1.wpDeliveryStatus).toBe('Exchange');

      const res2 = detectWordPressStatusMarks(
        { status: 'processing' },
        [{ key: 'ywcos_custom_status', value: 'Exchange Replacement' }]
      );
      expect(res2.isExchangeFromWp).toBe(true);
      expect(res2.wpDeliveryStatus).toBe('Exchange');
    });

    it('detects return and partial from staff order notes', () => {
      const resReturn = detectWordPressStatusMarks({ status: 'processing', customer_note: 'Customer rejected parcel at doorstep, return to hub' });
      expect(resReturn.isReturnFromWp).toBe(true);

      const resPartial = detectWordPressStatusMarks({ status: 'processing', customer_note: 'Customer accepted 1 shirt, partial return for 1 jeans' });
      expect(resPartial.isPartialFromWp).toBe(true);
    });
  });

  describe('resolveSipOutlet', () => {
    it('resolves Outlet 1 / warehouse to Central Warehouse', () => {
      const res = resolveSipOutlet('1');
      expect(res.outletId).toBe('1');
      expect(res.inventorySource).toBe('Central Warehouse');
      expect(res.inventoryCode).toBe('ONLINE');
      expect(res.isBranchFulfillment).toBe(false);
    });

    it('resolves Outlet 2 / mirpur to Mirpur Outlet', () => {
      const res = resolveSipOutlet('2');
      expect(res.outletId).toBe('2');
      expect(res.inventorySource).toBe('Mirpur Outlet');
      expect(res.inventoryCode).toBe('MIRPUR');
      expect(res.isBranchFulfillment).toBe(true);
    });

    it('resolves Outlet 7 / cumilla to Cumilla Branch', () => {
      const res = resolveSipOutlet('7');
      expect(res.outletId).toBe('7');
      expect(res.inventorySource).toBe('Cumilla Branch');
      expect(res.inventoryCode).toBe('CUMILLA');
      expect(res.isBranchFulfillment).toBe(true);
    });

    it('resolves Outlet 8 / wari to Wari Branch', () => {
      const res = resolveSipOutlet('8');
      expect(res.outletId).toBe('8');
      expect(res.inventorySource).toBe('Wari Branch');
      expect(res.inventoryCode).toBe('WARI');
      expect(res.isBranchFulfillment).toBe(true);
    });

    it('resolves Outlet 9 / sylhet to Sylhet Branch', () => {
      const res = resolveSipOutlet('9');
      expect(res.outletId).toBe('9');
      expect(res.inventorySource).toBe('Sylhet Branch');
      expect(res.inventoryCode).toBe('SYLHET');
      expect(res.isBranchFulfillment).toBe(true);
    });
  });

  describe('extractLineItemSipInventory & WooCommerce REST API Waterfall Deductions', () => {
    it('accurately resolves split line-item inventory from _sip_waterfall_deductions', () => {
      const mockOrder = {
        id: 18881,
        created_via: 'checkout',
        meta_data: [
          {
            key: '_sip_waterfall_deductions',
            value: [
              {
                outlet_id: 1,
                outlet_slug: 'warehouse',
                product_id: 17766,
                variation_id: 17767,
                qty: 1,
              },
              {
                outlet_id: 2,
                outlet_slug: 'mirpur-12',
                product_id: 18705,
                variation_id: 18706,
                qty: 1,
              },
            ],
          },
        ],
      };

      const item1 = {
        id: 101,
        product_id: 17766,
        variation_id: 17767,
        name: 'DEEN Regular Jeans',
      };
      const item2 = {
        id: 102,
        product_id: 18705,
        variation_id: 18706,
        name: 'DEEN Oxford Shirt',
      };

      const res1 = extractLineItemSipInventory(item1, mockOrder, mockOrder.meta_data);
      expect(res1.inventorySource).toBe('Central Warehouse');
      expect(res1.inventoryCode).toBe('ONLINE');
      expect(res1.outletId).toBe('1');

      const res2 = extractLineItemSipInventory(item2, mockOrder, mockOrder.meta_data);
      expect(res2.inventorySource).toBe('Mirpur Outlet');
      expect(res2.inventoryCode).toBe('MIRPUR');
      expect(res2.outletId).toBe('2');
    });

    it('formats multi-item orders into rows with specific SIP inventory per item', () => {
      const mockOrder = {
        id: 18740,
        number: '18740',
        date_created: '2026-10-25T14:00:00',
        total: '4980',
        status: 'completed',
        billing: {
          first_name: 'Karim',
          phone: '01712000000',
        },
        meta_data: [
          {
            key: '_sip_waterfall_deductions',
            value: [
              {
                outlet_id: 9,
                outlet_slug: 'sylhet',
                product_id: 9433,
                variation_id: 9435,
                qty: 1,
              },
              {
                outlet_id: 2,
                outlet_slug: 'mirpur-12',
                product_id: 9419,
                variation_id: 9422,
                qty: 1,
              },
            ],
          },
        ],
        line_items: [
          {
            id: 301,
            product_id: 9433,
            variation_id: 9435,
            name: 'Sylhet Fulfilled Item',
            sku: 'SYL-01',
            quantity: 1,
            total: '2490',
          },
          {
            id: 302,
            product_id: 9419,
            variation_id: 9422,
            name: 'Mirpur Fulfilled Item',
            sku: 'MIR-02',
            quantity: 1,
            total: '2490',
          },
        ],
      };

      const rows = formatWooCommerceToOrderRows([mockOrder]);
      expect(rows.length).toBe(2);

      expect(rows[0].sipInventory).toBe('Sylhet Branch');
      expect(rows[0].sipOutletId).toBe('9');
      expect(rows[0].branchCode).toBe('ONLINE');
      expect(rows[0]['Order Source']).toBe('Online');
      expect(rows[0].isPos).toBe(false);

      expect(rows[1].sipInventory).toBe('Mirpur Outlet');
      expect(rows[1].sipOutletId).toBe('2');
      expect(rows[1].branchCode).toBe('ONLINE');
      expect(rows[1]['Order Source']).toBe('Online');
      expect(rows[1].isPos).toBe(false);
    });
  });
});
