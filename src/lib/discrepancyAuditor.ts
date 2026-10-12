import { ReconciledOrderRow } from '@/types';

export interface DiscrepancyAlert {
  orderId: string;
  type: 'PHANTOM_DELIVERY' | 'UNCOLLECTED_COD' | 'HIGH_RETURN_SURCHARGE' | 'MISSING_COURIER_CONSIGNMENT' | 'PRICE_MISMATCH';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  financialImpactBDT: number;
  customerName: string;
  phone: string;
  orderAmount: number;
  recommendation: string;
}

export interface DiscrepancyAuditSummary {
  totalAuditedOrders: number;
  discrepanciesCount: number;
  criticalCount: number;
  warningCount: number;
  totalAtRiskBDT: number;
  alerts: DiscrepancyAlert[];
}

export function runDiscrepancyAudit(reconciledOrders: ReconciledOrderRow[]): DiscrepancyAuditSummary {
  const alerts: DiscrepancyAlert[] = [];
  const processedOrders = new Set<string>();

  for (const order of reconciledOrders) {
    if (processedOrders.has(order.orderId)) continue;
    processedOrders.add(order.orderId);

    const deliveryStatus = (order.deliveryStatus || '').toLowerCase();
    const isFullReturn = order.orderCategory === 'FULL_RETURN';
    const isPartial = order.orderCategory === 'PARTIAL';
    const isDelivered = order.orderCategory === 'DELIVERED';

    // 1. Phantom Delivery: Full Return marked or Returned in courier, but customer kept 0 items while order was dispatched
    if (isFullReturn && order.orderAmount > 0 && order.netRevenueImpact === 0) {
      if (deliveryStatus.includes('delivered') && !deliveryStatus.includes('partial')) {
        alerts.push({
          orderId: order.orderId,
          type: 'PHANTOM_DELIVERY',
          severity: 'CRITICAL',
          title: `Phantom Delivery Conflict: #${order.orderId}`,
          description: `Store recorded order as delivered, but courier returned the consignment to warehouse.`,
          financialImpactBDT: order.orderAmount,
          customerName: order.customerName,
          phone: order.phone,
          orderAmount: order.orderAmount,
          recommendation: 'Reconcile physical stock return in inventory management immediately.'
        });
      }
    }

    // 2. Uncollected COD: Delivered order with 0 COD collected on COD payment method
    if (isDelivered && (order.paymentMethod || '').toLowerCase().includes('cod') && order.orderAmount > 100 && order.netRevenueImpact === 0) {
      alerts.push({
        orderId: order.orderId,
        type: 'UNCOLLECTED_COD',
        severity: 'CRITICAL',
        title: `Uncollected COD Shortfall: #${order.orderId}`,
        description: `Delivered order with COD payment method indicates 0 collected funds.`,
        financialImpactBDT: order.orderAmount,
        customerName: order.customerName,
        phone: order.phone,
        orderAmount: order.orderAmount,
        recommendation: 'Lodge formal remittance claim with Pathao Hermes merchant support.'
      });
    }

    // 3. High Return Surcharge Warning
    if (deliveryStatus.includes('paid return') && order.districtArea === 'Outside Dhaka') {
      alerts.push({
        orderId: order.orderId,
        type: 'HIGH_RETURN_SURCHARGE',
        severity: 'WARNING',
        title: `Paid Return Outside Dhaka: #${order.orderId}`,
        description: `Customer paid door return charge, but brand absorbed transit shipping differential.`,
        financialImpactBDT: 60, // net freight difference
        customerName: order.customerName,
        phone: order.phone,
        orderAmount: order.orderAmount,
        recommendation: 'Ensure mandatory advance collection of ৳150 for outside Dhaka orders.'
      });
    }
  }

  const criticalCount = alerts.filter(a => a.severity === 'CRITICAL').length;
  const warningCount = alerts.filter(a => a.severity === 'WARNING').length;
  const totalAtRiskBDT = alerts.reduce((acc, a) => acc + a.financialImpactBDT, 0);

  return {
    totalAuditedOrders: processedOrders.size,
    discrepanciesCount: alerts.length,
    criticalCount,
    warningCount,
    totalAtRiskBDT,
    alerts
  };
}
