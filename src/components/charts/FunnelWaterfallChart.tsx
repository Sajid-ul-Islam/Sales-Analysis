"use client";

import React from 'react';
import { Eye, Shirt, ShoppingCart, CreditCard, CheckCircle2, ArrowDown } from 'lucide-react';

export interface FunnelStepData {
  eventName: string;
  label: string;
  eventCount: number;
  dropoffRatePercent?: number;
}

interface FunnelWaterfallChartProps {
  steps: FunnelStepData[];
  title?: string;
  subtitle?: string;
}

const STEP_ICONS: Record<string, React.ReactNode> = {
  page_view: <Eye className="w-4 h-4 text-indigo-600" />,
  view_item: <Shirt className="w-4 h-4 text-sky-600" />,
  add_to_cart: <ShoppingCart className="w-4 h-4 text-amber-600" />,
  begin_checkout: <CreditCard className="w-4 h-4 text-orange-600" />,
  purchase: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
};

const STEP_GRADIENTS: Record<string, { bg: string; bar: string; border: string }> = {
  page_view: { bg: 'bg-indigo-50/70', bar: 'bg-indigo-500', border: 'border-indigo-200/60' },
  view_item: { bg: 'bg-sky-50/70', bar: 'bg-sky-500', border: 'border-sky-200/60' },
  add_to_cart: { bg: 'bg-amber-50/70', bar: 'bg-amber-500', border: 'border-amber-200/60' },
  begin_checkout: { bg: 'bg-orange-50/70', bar: 'bg-orange-500', border: 'border-orange-200/60' },
  purchase: { bg: 'bg-emerald-50/70', bar: 'bg-emerald-500', border: 'border-emerald-200/60' },
};

export function FunnelWaterfallChart({
  steps,
  title = "eCommerce Conversion Funnel",
  subtitle = "End-to-end shopping pipeline drop-off & customer retention flow",
}: FunnelWaterfallChartProps) {
  const topCount = steps[0]?.eventCount || 1;
  const bottomCount = steps[steps.length - 1]?.eventCount || 0;
  const overallConversionRate = topCount > 0 ? ((bottomCount / topCount) * 100).toFixed(2) : '0.00';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
      {/* Funnel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-headline text-sm font-bold text-slate-900">{title}</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-medium">End-to-End Rate:</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
            {overallConversionRate}%
          </span>
        </div>
      </div>

      {/* Visual Stepped Pipeline */}
      <div className="space-y-2.5">
        {steps.map((step, idx) => {
          const widthPercent = topCount > 0 && step.eventCount > 0 ? Math.max(8, Math.round((step.eventCount / topCount) * 100)) : 0;
          const styling = STEP_GRADIENTS[step.eventName] || STEP_GRADIENTS.page_view;
          const icon = STEP_ICONS[step.eventName] || <CheckCircle2 className="w-4 h-4 text-slate-600" />;

          return (
            <React.Fragment key={step.eventName || idx}>
              {/* Drop-off connector bridge */}
              {idx > 0 && (
                <div className="flex items-center justify-between px-4 py-0.5 text-[10px] text-slate-400 font-medium">
                  <div className="flex items-center gap-1">
                    <ArrowDown className="w-3 h-3 text-slate-300" />
                    <span>Drop-off between stages:</span>
                  </div>
                  <span className="font-mono font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-100">
                    -{step.dropoffRatePercent || 0}%
                  </span>
                </div>
              )}

              {/* Stage Card */}
              <div className={`p-3.5 rounded-xl border ${styling.border} ${styling.bg} transition-all hover:shadow-xs`}>
                <div className="flex items-center justify-between gap-3 text-xs mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-white shadow-2xs border border-slate-200/60 flex items-center justify-center shrink-0">
                      {icon}
                    </div>
                    <span className="font-bold text-slate-800 truncate">{step.label}</span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 font-mono">
                    <strong className="text-slate-900 text-sm">{step.eventCount.toLocaleString()}</strong>
                    <span className="text-[11px] font-bold text-slate-500 w-12 text-right">
                      {((step.eventCount / topCount) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Stepped Horizontal Funnel Bar */}
                <div className="w-full bg-white/80 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-200/50 shadow-inner">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${styling.bar}`}
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
