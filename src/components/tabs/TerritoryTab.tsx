"use client";

import React from 'react';
import { SummaryAnalytics } from '@/types';
import { MapPin, Navigation, TrendingUp, AlertTriangle } from 'lucide-react';

interface TerritoryTabProps {
  summary: SummaryAnalytics;
}

export function TerritoryTab({ summary: s }: TerritoryTabProps) {
  const insideNetOrders = Math.max(0, s.insideOrders - s.insideReturns);
  const outsideNetOrders = Math.max(0, s.outsideOrders - s.outsideReturns);
  const insideReturnRate = s.insideOrders > 0 ? ((s.insideReturns + s.insidePartials) / s.insideOrders) * 100 : 0;
  const outsideReturnRate = s.outsideOrders > 0 ? ((s.outsideReturns + s.outsidePartials) / s.outsideOrders) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Territory Comparison Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Inside Dhaka Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Inside Dhaka Metro</h3>
                <span className="text-xs text-slate-500">Hub Delivery Zone (Standard ৳60 COD)</span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {((s.insideOrders / (s.grossOrders || 1)) * 100).toFixed(1)}% Share
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 my-5 py-4 border-y border-slate-100">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Dispatched Orders</span>
              <span className="text-2xl font-black text-slate-900">{s.insideOrders.toLocaleString()}</span>
              <span className="text-[11px] text-slate-500 block mt-0.5">{insideNetOrders} Net Delivered</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Realized Net Sales</span>
              <span className="text-2xl font-black text-emerald-600">৳ {Math.round(s.insideNetRevenue).toLocaleString()}</span>
              <span className="text-[11px] text-slate-500 block mt-0.5">Post-return revenue</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Return + Partial:</span>
              <span className="text-amber-600 font-bold">{s.insideReturns} Full / {s.insidePartials} Partial</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 mr-1.5">Return Incidence:</span>
              <span className={`font-bold ${insideReturnRate > 15 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {insideReturnRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Outside Dhaka Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <Navigation className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Outside Dhaka (63 Districts)</h3>
                <span className="text-xs text-slate-500">Inter-District Linehaul (Standard ৳120-150 COD)</span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              {((s.outsideOrders / (s.grossOrders || 1)) * 100).toFixed(1)}% Share
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 my-5 py-4 border-y border-slate-100">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Dispatched Orders</span>
              <span className="text-2xl font-black text-slate-900">{s.outsideOrders.toLocaleString()}</span>
              <span className="text-[11px] text-slate-500 block mt-0.5">{outsideNetOrders} Net Delivered</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Realized Net Sales</span>
              <span className="text-2xl font-black text-emerald-600">৳ {Math.round(s.outsideNetRevenue).toLocaleString()}</span>
              <span className="text-[11px] text-slate-500 block mt-0.5">Post-return revenue</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Return + Partial:</span>
              <span className="text-rose-600 font-bold">{s.outsideReturns} Full / {s.outsidePartials} Partial</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 mr-1.5">Return Incidence:</span>
              <span className={`font-bold ${outsideReturnRate > 20 ? 'text-rose-600' : 'text-amber-600'}`}>
                {outsideReturnRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Territory Ratio & Intelligence */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Territory Ratio Intelligence</h3>
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <div className="text-3xl font-black text-slate-900 mb-1">
              {s.outsideRatio} : 1
            </div>
            <p className="text-xs text-slate-500">
              For every 1 Dhaka order dispatched, DEEN delivers {s.outsideRatio} orders nationwide outside Dhaka.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5 mt-4">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-rose-900">Logistics Risk Notice:</span>
              <p className="text-[11px] text-rose-700 mt-0.5">
                Outside Dhaka return incidence is higher. Mandate advance delivery fee (৳150) verification for outside Dhaka high-value parcels to prevent return shipping burden.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Territory Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-primary" />
            <h3 className="text-base font-bold text-slate-900">Geographic Sales & Return Reconciliation Matrix</h3>
          </div>
          <span className="text-xs font-semibold text-slate-500">Clean Online Orders Audit</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Territory Zone</th>
                <th className="py-3.5 px-4 text-center">Gross Dispatched</th>
                <th className="py-3.5 px-4 text-center">Full Delivered</th>
                <th className="py-3.5 px-4 text-center">Partial Delivered</th>
                <th className="py-3.5 px-4 text-center">Full Returns (RTO)</th>
                <th className="py-3.5 px-4 text-center">Net Delivered Orders</th>
                <th className="py-3.5 px-4 text-center">Return Incidence %</th>
                <th className="py-3.5 px-4 text-right">Net Realized Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Inside Dhaka
                </td>
                <td className="py-3.5 px-4 text-center font-bold text-slate-900">{s.insideOrders.toLocaleString()}</td>
                <td className="py-3.5 px-4 text-center text-emerald-600 font-semibold">{s.insideOrders - s.insideReturns - s.insidePartials}</td>
                <td className="py-3.5 px-4 text-center text-amber-600 font-semibold">{s.insidePartials}</td>
                <td className="py-3.5 px-4 text-center text-rose-600 font-semibold">{s.insideReturns}</td>
                <td className="py-3.5 px-4 text-center font-bold text-slate-900">{insideNetOrders.toLocaleString()}</td>
                <td className="py-3.5 px-4 text-center font-bold text-blue-600">{insideReturnRate.toFixed(1)}%</td>
                <td className="py-3.5 px-4 text-right font-black text-emerald-600">৳ {Math.round(s.insideNetRevenue).toLocaleString()}</td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Outside Dhaka
                </td>
                <td className="py-3.5 px-4 text-center font-bold text-slate-900">{s.outsideOrders.toLocaleString()}</td>
                <td className="py-3.5 px-4 text-center text-emerald-600 font-semibold">{s.outsideOrders - s.outsideReturns - s.outsidePartials}</td>
                <td className="py-3.5 px-4 text-center text-amber-600 font-semibold">{s.outsidePartials}</td>
                <td className="py-3.5 px-4 text-center text-rose-600 font-semibold">{s.outsideReturns}</td>
                <td className="py-3.5 px-4 text-center font-bold text-slate-900">{outsideNetOrders.toLocaleString()}</td>
                <td className="py-3.5 px-4 text-center font-bold text-amber-600">{outsideReturnRate.toFixed(1)}%</td>
                <td className="py-3.5 px-4 text-right font-black text-emerald-600">৳ {Math.round(s.outsideNetRevenue).toLocaleString()}</td>
              </tr>
              <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                <td className="py-4 px-4 text-primary font-black uppercase">Consolidated Total</td>
                <td className="py-4 px-4 text-center text-slate-900 font-black">{s.grossOrders.toLocaleString()}</td>
                <td className="py-4 px-4 text-center text-emerald-600 font-black">{s.fullDeliveredOrders.toLocaleString()}</td>
                <td className="py-4 px-4 text-center text-amber-600 font-black">{s.partialOrders.toLocaleString()}</td>
                <td className="py-4 px-4 text-center text-rose-600 font-black">{s.fullReturnedOrders.toLocaleString()}</td>
                <td className="py-4 px-4 text-center text-slate-900 font-black">{(s.grossOrders - s.fullReturnedOrders).toLocaleString()}</td>
                <td className="py-4 px-4 text-center text-primary font-black">{s.returnRate.toFixed(1)}%</td>
                <td className="py-4 px-4 text-right font-black text-emerald-600 text-sm">৳ {Math.round(s.netDeliveredRevenue).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
