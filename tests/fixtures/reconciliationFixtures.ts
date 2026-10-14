import { RawOrderRow } from '@/types';

/**
 * Fixture 1: Full Single-Parcel Delivered Order
 * Order 20001: 1 item, delivered successfully.
 */
export const singleParcelDeliveredOrder: RawOrderRow[] = [
  {
    'Order ID': '20001',
    'Order Date': '2026-09-10',
    'Customer Name': 'Rahim Ahmed',
    'Phone': '01711000001',
    'City': 'Dhaka',
    'SKU': '101-0100-149',
    'Item Name': 'DEEN Raw Washed Jeans - 32',
    'Quantity': 1,
    'Item Cost': 1494,
    'Order Amount': 1544, // 1494 + 50 shipping
    'Delivery Status': 'Delivered',
  },
];

export const singleParcelDeliveredCourier: RawOrderRow[] = [
  {
    'merchantorderid': '20001',
    'orderconsignmentid': 'CONS-20001',
    'orderstatus': 'Delivered',
    'collectedamount': 1544,
    'totalfee': 50,
  },
];

/**
 * Fixture 2: Full Return (Non-Paid Return)
 * Order 20002: Customer rejected parcel, zero COD collected.
 */
export const nonPaidReturnedOrder: RawOrderRow[] = [
  {
    'Order ID': '20002',
    'Order Date': '2026-09-11',
    'Customer Name': 'Karim Ullah',
    'Phone': '01811000002',
    'City': 'Chittagong',
    'SKU': '105-0201-028',
    'Item Name': 'DEEN Sea-Green Stripe T-Shirt - L',
    'Quantity': 1,
    'Item Cost': 400,
    'Order Amount': 490, // 400 + 90 shipping
    'Delivery Status': 'Returned',
  },
];

export const nonPaidReturnedCourier: RawOrderRow[] = [
  {
    'merchantorderid': '20002',
    'orderconsignmentid': 'CONS-20002',
    'orderstatus': 'Return',
    'collectedamount': 0,
    'totalfee': 60,
  },
];

/**
 * Fixture 3: Paid Return Multi-Parcel Propagation
 * Order 20003: Dispatched in 2 parcels (central warehouse 20003 and Cumilla branch 20003 c).
 * One parcel was returned as Paid Return (COD 100 collected for shipping).
 * By the Paid Return rule, all returned parcels in this order must inherit Paid Return classification.
 */
export const multiParcelPaidReturnOrder: RawOrderRow[] = [
  {
    'Order ID': '20003',
    'Order Date': '2026-09-12',
    'Customer Name': 'Shakil Khan',
    'Phone': '01911000003',
    'City': 'Cumilla',
    'SKU': '101-0100-150',
    'Item Name': 'DEEN Whisker Faded Jeans - 34',
    'Quantity': 1,
    'Item Cost': 1500,
    'Order Amount': 3090,
  },
  {
    'Order ID': '20003',
    'Order Date': '2026-09-12',
    'Customer Name': 'Shakil Khan',
    'Phone': '01911000003',
    'City': 'Cumilla',
    'SKU': '102-0301-002',
    'Item Name': 'DEEN Casual Half Shirt - XL',
    'Quantity': 1,
    'Item Cost': 1500,
    'Order Amount': 3090,
  },
];

export const multiParcelPaidReturnCourier: RawOrderRow[] = [
  {
    'merchantorderid': '20003',
    'orderconsignmentid': 'CONS-20003-MAIN',
    'orderstatus': 'Return',
    'collectedamount': 0,
    'totalfee': 60,
  },
  {
    'merchantorderid': '20003 c',
    'orderconsignmentid': 'CONS-20003-CUMILLA',
    'orderstatus': 'Paid Return',
    'collectedamount': 90, // Customer paid return shipping fee
    'totalfee': 60,
  },
];

/**
 * Fixture 4: Partial Delivery
 * Order 20004: 2 items (Shirt ৳700 + Jeans ৳1500, total product ৳2200 + ৳50 shipping = ৳2250).
 * Customer kept the shirt (৳700) and paid ৳750 (৳700 item + ৳50 delivery fee) at doorstep.
 * Courier reported partial delivery. Leftover ৳1500 is returned item.
 */
export const partialDeliveryOrder: RawOrderRow[] = [
  {
    'Order ID': '20004',
    'Order Date': '2026-09-14',
    'Customer Name': 'Farhan Masud',
    'Phone': '01611000004',
    'City': 'Dhaka',
    'SKU': 'SHIRT-700',
    'Item Name': 'DEEN Cuban Shirt - L',
    'Quantity': 1,
    'Item Cost': 700,
    'Order Amount': 2250,
  },
  {
    'Order ID': '20004',
    'Order Date': '2026-09-14',
    'Customer Name': 'Farhan Masud',
    'Phone': '01611000004',
    'City': 'Dhaka',
    'SKU': 'JEANS-1500',
    'Item Name': 'DEEN Slim Jeans - 32',
    'Quantity': 1,
    'Item Cost': 1500,
    'Order Amount': 2250,
  },
];

export const partialDeliveryCourier: RawOrderRow[] = [
  {
    'merchantorderid': '20004',
    'orderconsignmentid': 'CONS-20004',
    'orderstatus': 'Partial Delivery',
    'collectedamount': 750, // ৳700 item + ৳50 inside delivery fee
    'totalfee': 50,
  },
];

/**
 * Fixture 5: Exchange Order
 * Order D-20005: Replacement order with exchange prefix.
 */
export const exchangeOrder: RawOrderRow[] = [
  {
    'Order ID': 'D-20005',
    'Order Date': '2026-09-15',
    'Customer Name': 'Tanvir Hasan',
    'Phone': '01511000005',
    'City': 'Sylhet',
    'SKU': '101-0100-150',
    'Item Name': 'DEEN Whisker Faded Jeans - 36',
    'Quantity': 1,
    'Item Cost': 1494,
    'Order Amount': 1584,
  },
];

export const exchangeCourier: RawOrderRow[] = [
  {
    'merchantorderid': 'D-20005',
    'orderconsignmentid': 'CONS-D20005',
    'orderstatus': 'Exchange',
    'collectedamount': 90,
    'totalfee': 90,
  },
];

/**
 * Fixture 6: Split Multi-Parcel Delivery
 * Order 20006: 2 parcels from different branches (20006 from online store, 20006 w from Wari).
 * Both delivered successfully -> order must be classified as Delivered.
 */
export const splitParcelDeliveredOrder: RawOrderRow[] = [
  {
    'Order ID': '20006',
    'Order Date': '2026-09-16',
    'Customer Name': 'Imran Chowdhury',
    'Phone': '01711000006',
    'City': 'Dhaka',
    'SKU': 'SKU-A',
    'Item Name': 'DEEN Polo Shirt',
    'Quantity': 1,
    'Item Cost': 800,
    'Order Amount': 2300,
  },
  {
    'Order ID': '20006',
    'Order Date': '2026-09-16',
    'Customer Name': 'Imran Chowdhury',
    'Phone': '01711000006',
    'City': 'Dhaka',
    'SKU': 'SKU-B',
    'Item Name': 'DEEN Cargo Trouser',
    'Quantity': 1,
    'Item Cost': 1500,
    'Order Amount': 2300,
  },
];

export const splitParcelDeliveredCourier: RawOrderRow[] = [
  {
    'merchantorderid': '20006',
    'orderconsignmentid': 'CONS-20006-A',
    'orderstatus': 'Delivered',
    'collectedamount': 800,
    'totalfee': 50,
  },
  {
    'merchantorderid': '20006 w',
    'orderconsignmentid': 'CONS-20006-W',
    'orderstatus': 'Delivered',
    'collectedamount': 1500,
    'totalfee': 50,
  },
];
