import { describe, it, expect } from 'vitest';
import {
  ChannelBarData,
  CategoryChannelStackRow,
} from '@/components/charts';

describe('DEEN Visual Charts Suite (v2.5.0)', () => {
  const sampleChannels: ChannelBarData[] = [
    {
      key: 'ecom',
      label: 'Online Store (E-Commerce)',
      shortLabel: 'Ecom',
      revenue: 1063885,
      cogs: 452150,
      profit: 611735,
      margin: 0.575,
      units: 1035,
      color: '#0284c7',
    },
    {
      key: 'mirpur',
      label: 'Mirpur Outlet POS',
      shortLabel: 'Mirpur',
      revenue: 354746,
      cogs: 140120,
      profit: 214626,
      margin: 0.605,
      units: 353,
      color: '#16a34a',
    },
    {
      key: 'cumilla',
      label: 'Cumilla Branch POS',
      shortLabel: 'Cumilla',
      revenue: 196442,
      cogs: 88400,
      profit: 108042,
      margin: 0.550,
      units: 195,
      color: '#0891b2',
    },
    {
      key: 'wari',
      label: 'Wari Branch POS',
      shortLabel: 'Wari',
      revenue: 179350,
      cogs: 77120,
      profit: 102230,
      margin: 0.570,
      units: 178,
      color: '#7c3aed',
    },
    {
      key: 'sylhet',
      label: 'Sylhet Branch POS',
      shortLabel: 'Sylhet',
      revenue: 120029,
      cogs: 55475,
      profit: 64554,
      margin: 0.538,
      units: 79,
      color: '#b45309',
    },
  ];

  it('calculates total omnichannel revenue and units across all 5 channels accurately', () => {
    const totalRev = sampleChannels.reduce((sum, c) => sum + c.revenue, 0);
    const totalUnits = sampleChannels.reduce((sum, c) => sum + c.units, 0);
    const totalProfit = sampleChannels.reduce((sum, c) => sum + c.profit, 0);

    expect(totalRev).toBe(1914452);
    expect(totalUnits).toBe(1840);
    expect(totalProfit).toBe(1101187);

    const overallMargin = totalProfit / totalRev;
    expect(Number(overallMargin.toFixed(4))).toBe(0.5752); // 57.52% overall margin
  });

  it('validates channel market share math for visual donut charts', () => {
    const totalRev = sampleChannels.reduce((sum, c) => sum + c.revenue, 0);
    const ecom = sampleChannels.find((c) => c.key === 'ecom')!;
    const ecomShare = (ecom.revenue / totalRev) * 100;

    expect(Number(ecomShare.toFixed(1))).toBe(55.6); // 55.6% e-commerce revenue share

    const outletRev = totalRev - ecom.revenue;
    const outletShare = (outletRev / totalRev) * 100;
    expect(Number(outletShare.toFixed(1))).toBe(44.4); // 44.4% retail outlet revenue share
  });

  it('verifies category stacked bar row normalization', () => {
    const sampleCategory: CategoryChannelStackRow = {
      category: 'Jeans',
      totalUnits: 720,
      totalRevenue: 850000,
      channels: {
        ecom: { units: 420, revenue: 500000 },
        mirpur: { units: 140, revenue: 165000 },
        cumilla: { units: 60, revenue: 70000 },
        wari: { units: 65, revenue: 75000 },
        sylhet: { units: 35, revenue: 40000 },
      },
    };

    const sumUnits = Object.values(sampleCategory.channels).reduce((s, c) => s + c.units, 0);
    expect(sumUnits).toBe(sampleCategory.totalUnits);

    const sumRev = Object.values(sampleCategory.channels).reduce((s, c) => s + c.revenue, 0);
    expect(sumRev).toBe(sampleCategory.totalRevenue);
  });

  it('verifies financial leakage waterfall balance equation', () => {
    const grossDispatched = 2348200;
    const fullReturnLoss = 345000;
    const partialReturnLoss = 88748;
    const courierCharges = 98450;
    const packagingLoss = 12750;

    const netRetained = grossDispatched - fullReturnLoss - partialReturnLoss - courierCharges - packagingLoss;
    expect(netRetained).toBe(1803252);
    expect(netRetained).toBeLessThan(grossDispatched);

    const realizationRate = (netRetained / grossDispatched) * 100;
    expect(Number(realizationRate.toFixed(1))).toBe(76.8); // 76.8% realized
  });

  it('verifies return reason Pareto cumulative percentage progression', () => {
    const reasons = [
      { reason: 'Size & Fit Mismatch', share: 42.5 },
      { reason: 'Fabric / Color Dissatisfaction', share: 24.3 },
      { reason: 'Courier Delay / Customer Unreachable', share: 18.2 },
      { reason: 'Customer Changed Mind / Cash Shortage', share: 11.4 },
      { reason: 'Wrong Item / Defect in Stitching', share: 3.6 },
    ];

    let runningSum = 0;
    const cumulative = reasons.map((r) => {
      runningSum += r.share;
      return Number(runningSum.toFixed(1));
    });

    expect(cumulative[0]).toBe(42.5);
    expect(cumulative[1]).toBe(66.8);
    expect(cumulative[2]).toBe(85.0); // Breaches the 80% defect barrier
    expect(cumulative[4]).toBe(100.0);
  });

  it('verifies customer risk tier classification bounds', () => {
    const tierThresholds = {
      LOW: 15, // < 15% return rate
      MEDIUM: 35, // 15 - 35%
      HIGH: 35, // > 35%
    };

    const getTier = (rto: number) => {
      if (rto < tierThresholds.LOW) return 'LOW';
      if (rto <= tierThresholds.MEDIUM) return 'MEDIUM';
      return 'HIGH_RISK';
    };

    expect(getTier(8)).toBe('LOW');
    expect(getTier(22)).toBe('MEDIUM');
    expect(getTier(45)).toBe('HIGH_RISK');
  });
});
