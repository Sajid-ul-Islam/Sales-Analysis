"use client";

import React, { useMemo } from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, Users } from 'lucide-react';
import { CustomerRiskProfile } from '@/types';

interface CustomerRiskTierChartProps {
  profiles: CustomerRiskProfile[];
  title?: string;
  className?: string;
  selectedFilter?: 'ALL' | 'HIGH_RISK' | 'MEDIUM' | 'LOW';
  onSelectTier?: (tier: 'ALL' | 'HIGH_RISK' | 'MEDIUM' | 'LOW') => void;
}

export function CustomerRiskTierChart({
  profiles,
  title = "Customer RTO Risk Tier Distribution",
  className = "",
  selectedFilter = 'ALL',
  onSelectTier,
}: CustomerRiskTierChartProps) {
  const total = profiles.length || 1;

  const { low, medium, high } = useMemo(() => {
    let l = 0;
    let m = 0;
    let h = 0;
    let lLoss = 0;
    let mLoss = 0;
    let hLoss = 0;

    profiles.forEach((p) => {
      const estimatedLoss = p.totalSpent > 0 && p.deliveredOrders > 0
        ? (p.totalSpent / p.deliveredOrders) * p.returnedOrders
        : p.returnedOrders * 1500;

      if (p.riskTier === 'HIGH_RISK') {
        h++;
        hLoss += estimatedLoss;
      } else if (p.riskTier === 'MEDIUM') {
        m++;
        mLoss += estimatedLoss;
      } else {
        l++;
        lLoss += estimatedLoss;
      }
    });

    return {
      low: { count: l, share: (l / total) * 100, loss: lLoss },
      medium: { count: m, share: (m / total) * 100, loss: mLoss },
      high: { count: h, share: (h / total) * 100, loss: hLoss },
    };
  }, [profiles, total]);

  const tiers = [
    {
      id: 'LOW' as const,
      label: 'Safe Verified Buyers',
      sub: 'Return rate < 15% • Instant dispatch recommended',
      count: low.count,
      share: low.share,
      loss: low.loss,
      color: '#10b981',
      bgClass: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
      icon: ShieldCheck,
    },
    {
      id: 'MEDIUM' as const,
      label: 'Moderate Caution',
      sub: 'Return rate 15–35% • Phone pre-confirmation advised',
      count: medium.count,
      share: medium.share,
      loss: medium.loss,
      color: '#f59e0b',
      bgClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
      icon: AlertTriangle,
    },
    {
      id: 'HIGH_RISK' as const,
      label: 'Serial Returners / High RTO',
      sub: 'Return rate > 35% • Mandatory deposit or advance delivery fee',
      count: high.count,
      share: high.share,
      loss: high.loss,
      color: '#f43f5e',
      bgClass: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
      icon: ShieldAlert,
    },
  ];

  return (
    <div
      className={`bg-white dark:bg-[#0A0A0A] rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] p-4 sm:p-5 shadow-xs transition-all ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-primary border border-orange-200/60 dark:border-orange-800/40 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white font-headline">
              {title}
            </h4>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Aggregated from customer purchase history and Pathao delivery ratings
            </p>
          </div>
        </div>

        {selectedFilter !== 'ALL' && (
          <button
            type="button"
            onClick={() => onSelectTier?.('ALL')}
            className="text-xs font-bold text-primary hover:underline cursor-pointer"
          >
            Reset Filter (Show All)
          </button>
        )}
      </div>

      {/* Segmented Horizontal Progress Strip */}
      <div className="h-4 w-full bg-slate-100 dark:bg-[#181818] rounded-xl overflow-hidden flex shadow-2xs mb-4">
        {tiers.map((t) => (
          <div
            key={t.id}
            style={{ width: `${t.share}%`, backgroundColor: t.color }}
            className="h-full transition-all duration-300 hover:brightness-110 cursor-pointer"
            onClick={() => onSelectTier?.(selectedFilter === t.id ? 'ALL' : t.id)}
            title={`${t.label}: ${t.count} profiles (${t.share.toFixed(1)}%)`}
          />
        ))}
      </div>

      {/* 3 Tier Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {tiers.map((t) => {
          const Icon = t.icon;
          const isSelected = selectedFilter === t.id;

          return (
            <div
              key={t.id}
              onClick={() => onSelectTier?.(isSelected ? 'ALL' : t.id)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'ring-2 ring-primary border-primary bg-orange-50/20 dark:bg-orange-950/20'
                  : 'bg-slate-50/60 dark:bg-[#121212] border-slate-200/70 dark:border-[#1F1F1F] hover:border-slate-300 dark:hover:border-[#333333]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <div className="flex items-center gap-1.5 truncate">
                    <Icon className="w-4 h-4 shrink-0" style={{ color: t.color }} />
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {t.label}
                    </span>
                  </div>
                  <span
                    className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded"
                    style={{ backgroundColor: `${t.color}15`, color: t.color }}
                  >
                    {t.share.toFixed(1)}%
                  </span>
                </div>

                <p className="text-[10px] text-slate-400 mb-2">
                  {t.sub}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-[#222222] flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500 font-semibold">
                  {t.count.toLocaleString()} profiles
                </span>
                <span className="font-bold text-rose-600 dark:text-rose-400 text-[11px]">
                  ~৳{Math.round(t.loss / 1000)}k loss
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
