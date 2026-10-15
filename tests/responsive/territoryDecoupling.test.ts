import { describe, it, expect } from 'vitest';
import { detectDivision, aggregateDivisionMetrics } from '../../src/lib/geo';
import { ReconciledOrderRow } from '@/types';

describe('Territory & Fulfillment Decoupling Contract', () => {
  describe('detectDivision destination-based classification', () => {
    it('should classify order to Chattogram when fulfilled at Mirpur Outlet POS but delivered to Chattogram', () => {
      const division = detectDivision(
        'Chittagong',
        'Agrabad C/A, Chittagong',
        'Call before delivery',
        'Outside Dhaka',
        'Mirpur Outlet POS'
      );
      expect(division).toBe('Chattogram');
    });

    it('should classify order to Sylhet when fulfilled at Wari Branch POS but delivered to Sylhet', () => {
      const division = detectDivision(
        'Sylhet',
        'Zindabazar, Sylhet Sadar',
        'Leave at gate',
        'Outside Dhaka',
        'Wari Branch POS'
      );
      expect(division).toBe('Sylhet');
    });

    it('should classify order to Rajshahi when fulfilled at Cumilla Branch but delivered to Rajshahi', () => {
      const division = detectDivision(
        'Rajshahi',
        'Shaheb Bazar, Boalia, Rajshahi',
        null,
        'Outside Dhaka',
        'Cumilla Branch'
      );
      expect(division).toBe('Rajshahi');
    });

    it('should classify order to Khulna when fulfilled at Sylhet Branch but delivered to Khulna', () => {
      const division = detectDivision(
        'Khulna',
        'Shibbari Mor, Khulna',
        null,
        'Outside Dhaka',
        'Sylhet Branch'
      );
      expect(division).toBe('Khulna');
    });

    it('should classify order to Rangpur when fulfilled at Central Warehouse (Online)', () => {
      const division = detectDivision(
        'Rangpur',
        'Jahaj Company Mor, Rangpur',
        null,
        'Outside Dhaka',
        'Central Warehouse (Online)'
      );
      expect(division).toBe('Rangpur');
    });

    it('should classify to Dhaka when districtArea is Inside Dhaka', () => {
      const division = detectDivision(
        'Dhaka',
        'Dhanmondi 27, Dhaka',
        null,
        'Inside Dhaka',
        'Mirpur Outlet POS'
      );
      expect(division).toBe('Dhaka');
    });

    it('should classify to Mymensingh or Barishal based strictly on destination text', () => {
      const barishalDiv = detectDivision(
        'Barisal',
        'Sadullapur, Barisal',
        null,
        'Outside Dhaka',
        'Mirpur Outlet POS'
      );
      expect(barishalDiv).toBe('Barishal');

      const mymensinghDiv = detectDivision(
        'Mymensingh',
        'Town Hall, Mymensingh',
        null,
        'Outside Dhaka',
        'Wari Branch POS'
      );
      expect(mymensinghDiv).toBe('Mymensingh');
    });
  });

  describe('aggregateDivisionMetrics decoupling verification', () => {
    it('aggregates orders into customer destination divisions regardless of fulfillment location', () => {
      const mockOrders: Partial<ReconciledOrderRow>[] = [
        {
          orderId: '1001 m',
          fulfillmentLocation: 'Mirpur Outlet POS',
          city: 'Chittagong',
          rawNote: 'Customer address in Chittagong GEC Circle',
          districtArea: 'Outside Dhaka',
          deliveryStatus: 'Delivered',
          orderCategory: 'DELIVERED',
          itemCost: 2500,
          quantity: 1,
          orderAmount: 2500,
          netRevenueImpact: 2500
        },
        {
          orderId: '1002 w',
          fulfillmentLocation: 'Wari Branch',
          city: 'Sylhet',
          rawNote: 'Customer address in Sylhet Upashahar',
          districtArea: 'Outside Dhaka',
          deliveryStatus: 'Delivered',
          orderCategory: 'DELIVERED',
          itemCost: 3200,
          quantity: 1,
          orderAmount: 3200,
          netRevenueImpact: 3200
        },
        {
          orderId: '1003',
          fulfillmentLocation: 'Online Store (Central Warehouse)',
          city: 'Dhaka',
          rawNote: 'Mirpur 10, Dhaka',
          districtArea: 'Inside Dhaka',
          deliveryStatus: 'Delivered',
          orderCategory: 'DELIVERED',
          itemCost: 1800,
          quantity: 1,
          orderAmount: 1800,
          netRevenueImpact: 1800
        }
      ];

      const { divisions } = aggregateDivisionMetrics(mockOrders as ReconciledOrderRow[]);

      const chattogramMetric = divisions.find(d => d.name === 'Chattogram');
      const sylhetMetric = divisions.find(d => d.name === 'Sylhet');
      const dhakaMetric = divisions.find(d => d.name === 'Dhaka');

      expect(chattogramMetric).toBeDefined();
      expect(chattogramMetric?.dispatchedOrders).toBe(1);
      expect(chattogramMetric?.deliveredOrders).toBe(1);

      expect(sylhetMetric).toBeDefined();
      expect(sylhetMetric?.dispatchedOrders).toBe(1);
      expect(sylhetMetric?.deliveredOrders).toBe(1);

      expect(dhakaMetric).toBeDefined();
      expect(dhakaMetric?.dispatchedOrders).toBe(1);
      expect(dhakaMetric?.deliveredOrders).toBe(1);
    });
  });
});
