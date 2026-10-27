import { describe, it, expect } from 'vitest';
import { ReturnedItemRow } from '@/types';
import { compareOrdersByNumber } from '@/lib/excelExport';

// Test grouping function mirroring ItemReturnsTab logic
interface OrderWiseReturnGroup {
  orderId: string;
  orderDate: Date | null;
  customerName: string;
  phone: string;
  districtArea: string;
  returnSource: string;
  deliveryStatus: string;
  totalReturnedUnits: number;
  totalReturnedValue: number;
  orderAmount: number;
  items: ReturnedItemRow[];
  sipInventories: string[];
}

function groupReturnedItems(items: ReturnedItemRow[]): OrderWiseReturnGroup[] {
  const groupMap = new Map<string, OrderWiseReturnGroup>();

  for (const item of items) {
    const oid = item.orderId;
    let grp = groupMap.get(oid);
    if (!grp) {
      let retSource: string = item.returnSource;
      if (item.returnSource.includes('Partial')) {
        retSource = 'Partial Order Return (Rejected Item)';
      } else if (item.returnSource.includes('Paid Return')) {
        retSource = 'Full Return (RTO / Paid Return)';
      } else {
        retSource = 'Full Return (Non-Paid Return)';
      }

      grp = {
        orderId: oid,
        orderDate: item.orderDate,
        customerName: item.customerName || 'Customer',
        phone: item.phone || 'N/A',
        districtArea: item.districtArea || 'Outside Dhaka',
        returnSource: retSource,
        deliveryStatus: item.deliveryStatus || 'Returned',
        totalReturnedUnits: 0,
        totalReturnedValue: 0,
        orderAmount: item.orderAmount || 0,
        items: [],
        sipInventories: [],
      };
      groupMap.set(oid, grp);
    }

    if (item.returnSource.includes('Partial')) {
      grp.returnSource = 'Partial Order Return (Rejected Item)';
    } else if (item.returnSource.includes('Paid Return') && !grp.returnSource.includes('Partial')) {
      grp.returnSource = 'Full Return (RTO / Paid Return)';
    }

    grp.totalReturnedUnits += (item.quantity || 1);
    grp.totalReturnedValue += (item.returnedValue || (item.quantity * item.itemCost) || 0);
    if (item.orderAmount && item.orderAmount > grp.orderAmount) {
      grp.orderAmount = item.orderAmount;
    }
    grp.items.push(item);

    if (item.sipInventory && !grp.sipInventories.includes(item.sipInventory)) {
      grp.sipInventories.push(item.sipInventory);
    }
  }

  const list = Array.from(groupMap.values());
  return list.sort((a, b) => compareOrdersByNumber({ orderId: a.orderId }, { orderId: b.orderId }));
}

describe('ItemReturnsTab Order-Wise Return Consolidation Engine', () => {
  const sampleReturns: ReturnedItemRow[] = [
    // Order 19001: Multi-item full return with 2 items from Central Warehouse and Mirpur Outlet
    {
      orderId: '19001',
      returnSource: 'Full Return (Non-Paid Return)',
      deliveryStatus: 'Returned',
      orderDate: new Date('2026-10-20'),
      customerName: 'Shakib Al Hasan',
      phone: '01711000001',
      districtArea: 'Inside Dhaka',
      sku: '101-SLIM-32',
      itemName: 'Vintage Blue Slim Jeans',
      quantity: 1,
      itemCost: 2000,
      returnedValue: 2000,
      sipInventory: 'Central Warehouse',
      orderAmount: 3500,
    },
    {
      orderId: '19001',
      returnSource: 'Full Return (Non-Paid Return)',
      deliveryStatus: 'Returned',
      orderDate: new Date('2026-10-20'),
      customerName: 'Shakib Al Hasan',
      phone: '01711000001',
      districtArea: 'Inside Dhaka',
      sku: '102-CUBAN-M',
      itemName: 'Oxford Cuban Shirt',
      quantity: 1,
      itemCost: 1500,
      returnedValue: 1500,
      sipInventory: 'Mirpur Outlet',
      orderAmount: 3500,
    },
    // Order 19002: Partial Order return (customer accepted 1 item, rejected 1 item)
    {
      orderId: '19002',
      returnSource: 'Partial Order Return (Rejected Item)',
      deliveryStatus: 'Partial',
      orderDate: new Date('2026-10-21'),
      customerName: 'Mushfiqur Rahim',
      phone: '01811000002',
      districtArea: 'Outside Dhaka',
      sku: '101-BAGGY-34',
      itemName: 'Relaxed Baggy Denim',
      quantity: 1,
      itemCost: 2200,
      returnedValue: 2200,
      sipInventory: 'Cumilla Branch',
      orderAmount: 4200,
    },
    // Order 19003: Paid return (customer paid delivery charge / return fee)
    {
      orderId: '19003',
      returnSource: 'Full Return (RTO / Paid Return)',
      deliveryStatus: 'Returned',
      orderDate: new Date('2026-10-22'),
      customerName: 'Tamim Iqbal',
      phone: '01911000003',
      districtArea: 'Inside Dhaka',
      sku: '102-STRIPE-L',
      itemName: 'Striped Resort Shirt',
      quantity: 2,
      itemCost: 1600,
      returnedValue: 3200,
      sipInventory: 'Wari Branch',
      orderAmount: 3200,
    },
  ];

  it('correctly consolidates multi-item returns into a single Order-Wise group', () => {
    const groups = groupReturnedItems(sampleReturns);

    // 4 line items across 3 distinct orders
    expect(groups).toHaveLength(3);

    // Order 19001 should be consolidated
    const order19001 = groups.find((g) => g.orderId === '19001');
    expect(order19001).toBeDefined();
    expect(order19001?.items).toHaveLength(2);
    expect(order19001?.totalReturnedUnits).toBe(2);
    expect(order19001?.totalReturnedValue).toBe(3500); // 2000 + 1500
    expect(order19001?.orderAmount).toBe(3500);
    expect(order19001?.customerName).toBe('Shakib Al Hasan');
    expect(order19001?.districtArea).toBe('Inside Dhaka');
  });

  it('aggregates multiple SIP inventory locations cleanly', () => {
    const groups = groupReturnedItems(sampleReturns);
    const order19001 = groups.find((g) => g.orderId === '19001');

    expect(order19001?.sipInventories).toContain('Central Warehouse');
    expect(order19001?.sipInventories).toContain('Mirpur Outlet');
    expect(order19001?.sipInventories).toHaveLength(2);
  });

  it('accurately identifies Partial and Paid Return order classifications', () => {
    const groups = groupReturnedItems(sampleReturns);

    const orderPartial = groups.find((g) => g.orderId === '19002');
    expect(orderPartial?.returnSource).toBe('Partial Order Return (Rejected Item)');
    expect(orderPartial?.totalReturnedUnits).toBe(1);
    expect(orderPartial?.totalReturnedValue).toBe(2200);

    const orderPaid = groups.find((g) => g.orderId === '19003');
    expect(orderPaid?.returnSource).toBe('Full Return (RTO / Paid Return)');
    expect(orderPaid?.totalReturnedUnits).toBe(2);
    expect(orderPaid?.totalReturnedValue).toBe(3200);
  });

  it('sorts orders by number matching compareOrdersByNumber standard', () => {
    const groups = groupReturnedItems(sampleReturns);
    expect(groups.map((g) => g.orderId)).toEqual(['19001', '19002', '19003']);
  });
});
