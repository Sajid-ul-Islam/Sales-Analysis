'use client';

import React, { useMemo, useState } from 'react';
import { Calendar, FileSpreadsheet } from 'lucide-react';
import { exportMonthlyNetSalesExcel } from '@/lib/excelExport';
import { ReconciliationResult } from '@/lib/reconciliationEngine';
import { ReconciledOrderRow, SummaryAnalytics } from '@/types';
import { getItemCogsInfo } from '@/lib/woocommerceClient';

export interface MonthEndCloseCardProps {
  orders?: ReconciledOrderRow[];
  summary?: SummaryAnalytics;
  reconciliationResult?: ReconciliationResult | null;
  onExport?: () => void;
  onCelebration?: () => void;
  metaAdCost?: number;
}

export function MonthEndCloseCard({
  orders = [],
  summary,
  reconciliationResult,
  onExport,
  onCelebration,
}: MonthEndCloseCardProps) {
  const [isExporting, setIsExporting] = useState(false);

  const orderCount = reconciliationResult?.reconciledOrders?.length ?? orders.length;

  // Detect if current date is within the closing window:
  // (Last 4 days of current month, or first 7 days of subsequent month)
  const closingPeriod = useMemo(() => {
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth();
    const year = now.getFullYear();

    // Days in current month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const isEndOfMonth = day >= daysInMonth - 4;
    const isStartOfNextMonth = day <= 7;

    const closingMonthDate = isStartOfNextMonth ? new Date(year, month - 1, 1) : new Date(year, month, 1);
    const monthName = closingMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    return {
      isEligible: isEndOfMonth || isStartOfNextMonth || orderCount > 0,
      monthName,
      isPending: true,
    };
  }, [orderCount]);

  if (!closingPeriod.isEligible || orderCount === 0) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (onExport) {
        onExport();
      } else if (reconciliationResult) {
        exportMonthlyNetSalesExcel(reconciliationResult, {
          monthLabel: closingPeriod.monthName,
        });
      } else {
        let actualCogs = 0;
        let cogsCoveredRevenue = 0;
        const realizedSales = orders.reduce((sum, o) => sum + (o.netRevenueImpact || 0), 0);

        for (const o of orders) {
          const isRowDelivered = o.itemDeliveryStatus
            ? o.itemDeliveryStatus === 'Delivered'
            : o.orderDeliveryStatus === 'Delivered' ||
              o.orderCategory === 'DELIVERED' ||
              ((o.orderDeliveryStatus === 'Partial' || o.orderCategory === 'PARTIAL') &&
                (Number(o.netRevenueImpact) || 0) > 0);
          if (!isRowDelivered) continue;
          const delQty = Number(o.quantity) || 1;
          const rowRev = Number(o.netRevenueImpact) || (Number(o.itemCost) || 0) * delQty;
          if (typeof o.actualCogs === 'number' && o.actualCogs > 0) {
            actualCogs += o.actualCogs;
            cogsCoveredRevenue += rowRev;
          } else {
            const unitPrice = Number(o.itemCost) || (delQty > 0 ? rowRev / delQty : 0);
            const cInfo = getItemCogsInfo(o.sku, unitPrice, {
              itemName: o.itemName,
            });
            if (cInfo.isExact && typeof cInfo.cogs === 'number') {
              actualCogs += cInfo.cogs * delQty;
              cogsCoveredRevenue += rowRev;
            }
          }
        }

        const grossMargin = Math.round(cogsCoveredRevenue - actualCogs);
        const grossMarginPercent =
          cogsCoveredRevenue > 0 ? Number(((grossMargin / cogsCoveredRevenue) * 100).toFixed(1)) : 0;
        const cogsRatioPercent =
          cogsCoveredRevenue > 0 ? Number(((actualCogs / cogsCoveredRevenue) * 100).toFixed(1)) : 0;
        const exactCoveragePercent =
          realizedSales > 0 ? Number(((cogsCoveredRevenue / realizedSales) * 100).toFixed(1)) : 0;

        const fallbackSummary: SummaryAnalytics = summary || ({
          grossOrders: orders.length,
          totalGrossItems: orders.length,
          fullDeliveredOrders: orders.filter((o) => o.orderDeliveryStatus === 'Delivered').length,
          partialOrders: orders.filter((o) => o.orderDeliveryStatus === 'Partial').length,
          fullReturnedOrders: orders.filter((o) => o.orderDeliveryStatus === 'Paid Return' || o.orderDeliveryStatus === 'Not Paid Return').length,
          totalReturnedOrders: orders.filter((o) => o.orderDeliveryStatus === 'Paid Return' || o.orderDeliveryStatus === 'Not Paid Return').length,
          totalPartialProducts: 0,
          regularReturnedQty: 0,
          partialReturnedQty: 0,
          partialDeliveredQty: 0,
          partialTotalItems: 0,
          totalReturnedQty: 0,
          totalReturnedPlusPartial: 0,
          returnRate: 0,
          fullReturnRate: 0,
          partialRate: 0,
          grossRevenue: orders.reduce((sum, o) => sum + (o.orderAmount || 0), 0),
          netDeliveredRevenue: realizedSales,
          totalItemsDelivered: 0,
          insideOrders: 0,
          outsideOrders: 0,
          insideReturns: 0,
          outsideReturns: 0,
          insidePartials: 0,
          outsidePartials: 0,
          insideNetRevenue: 0,
          outsideNetRevenue: 0,
          outsideRatio: '0%',
          courierCost: {
            totalDeliveryCharge: 0,
            totalCodFees: 0,
            insideDhakaDeliveryCost: 0,
            outsideDhakaDeliveryCost: 0,
            totalCourierBurden: 0,
            grossCourierExpenses: 0,
            netCustomerDeliveryCollection: 0,
            netCourierBurden: 0,
          },
          unitEconomics: {
            grossInvoicedSales: orders.reduce((sum, o) => sum + (o.orderAmount || 0), 0),
            netRealizedSales: realizedSales,
            estimatedCogs: Math.round(actualCogs),
            actualCogs: Math.round(actualCogs),
            grossMargin,
            grossMarginPercent,
            cogsRatioPercent,
            exactCogsCoveragePercent: exactCoveragePercent,
            cogsCoveredRevenue: Math.round(cogsCoveredRevenue),
            cogsMethod:
              cogsCoveredRevenue > 0
                ? exactCoveragePercent >= 99.9
                  ? 'ACTUAL_CATALOG_COGS'
                  : 'HYBRID'
                : 'NO_CATALOG_MATCH',
            totalCourierExpense: 0,
            packagingLoss: 0,
            metaAdCost: 0,
            netContributionMargin: grossMargin,
            netMarginPercentage: grossMarginPercent,
            roas: 0,
            cac: 0,
          },
          totalExchangedOrders: 0,
          totalExchangedItemsQty: 0,
          totalExchangeCodCollected: 0,
          totalExchangeCourierExpense: 0,
        } as unknown as SummaryAnalytics);

        const fallbackResult: ReconciliationResult = {
          reconciledOrders: orders,
          returnedItems: [],
          skuAnalytics: [],
          customerRiskProfiles: [],
          summary: fallbackSummary,
          courierMismatches: [],
          exchangedOrders: [],
        };
        exportMonthlyNetSalesExcel(fallbackResult, {
          monthLabel: closingPeriod.monthName,
        });
      }
      if (onCelebration) {
        onCelebration();
      }
    } catch (err) {
      console.error('Month-end close export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full my-4 p-4 md:p-5 rounded-2xl bg-gradient-to-r from-orange-950/30 via-neutral-900 to-neutral-900 border border-orange-500/30 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fadeIn">
      <div className="flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
          <Calendar className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
              📅 Accounting Close
            </span>
            <span className="text-xs font-bold text-white">
              {closingPeriod.monthName} Financial Period
            </span>
          </div>
          <p className="text-xs text-neutral-300 leading-relaxed max-w-xl">
            Reconcile realized net revenue, return deductions, COGS, and Pathao COD settlement into the official 7-sheet closing ledger.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full sm:w-auto py-2.5 px-4 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white shadow-lg shadow-orange-950/40 transition-all flex items-center justify-center gap-2 group hover:scale-[1.02] cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4 text-orange-200" />
          <span>{isExporting ? 'Generating Close .xlsx...' : 'Export 7-Sheet Month-End Close (.xlsx)'}</span>
        </button>
      </div>
    </div>
  );
}
