"use client";

import React, { useState, useMemo } from 'react';
import { DivisionMetric, BangladeshDivision } from '@/lib/geo';
import {
  Package,
  Coins,
  AlertTriangle,
  Compass,
  RotateCcw
} from 'lucide-react';

export type MapMetricType = 'orders' | 'revenue' | 'returnRate';

interface BangladeshMapChartProps {
  divisions: DivisionMetric[];
  nationalTotal: {
    dispatchedOrders: number;
    deliveredOrders: number;
    returnedOrders: number;
    partialOrders: number;
    exchangeOrders: number;
    netRevenue: number;
    grossRevenue: number;
    nationalReturnRate: number;
  };
  topNationwideDistricts?: { name: string; division: string; count: number; revenue: number }[];
  onSelectDivision?: (divisionName: BangladeshDivision | null) => void;
}

export function BangladeshMapChart({
  divisions,
  nationalTotal: _nationalTotal,
  topNationwideDistricts = [],
  onSelectDivision
}: BangladeshMapChartProps) {
  const [activeMetric, setActiveMetric] = useState<MapMetricType>('orders');
  const [hoveredDivision, setHoveredDivision] = useState<DivisionMetric | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(null);

  // Calculate maximums for normalized choropleth color scales
  const maxOrders = useMemo(() => Math.max(...divisions.map(d => d.dispatchedOrders), 1), [divisions]);
  const maxRevenue = useMemo(() => Math.max(...divisions.map(d => d.netRevenue), 1), [divisions]);

  // Selected division object
  const selectedDivision = useMemo(() => {
    if (!selectedDivisionId) return null;
    return divisions.find(d => d.id === selectedDivisionId || d.name === selectedDivisionId) || null;
  }, [selectedDivisionId, divisions]);

  // Compute dynamic fill color for each division according to selected metric
  const getDivisionFill = (div: DivisionMetric, isHovered: boolean, isSelected: boolean) => {
    if (isSelected) {
      return '#0284c7'; // vibrant primary blue when selected
    }

    if (activeMetric === 'orders') {
      // Scale from soft slate-blue to deep brand primary
      const ratio = div.dispatchedOrders / maxOrders;
      if (ratio > 0.6) return isHovered ? '#0369a1' : '#0284c7';
      if (ratio > 0.2) return isHovered ? '#0284c7' : '#38bdf8';
      if (ratio > 0.08) return isHovered ? '#38bdf8' : '#7dd3fc';
      return isHovered ? '#bae6fd' : '#e0f2fe';
    }

    if (activeMetric === 'revenue') {
      // Scale from mint emerald to deep emerald
      const ratio = div.netRevenue / maxRevenue;
      if (ratio > 0.6) return isHovered ? '#047857' : '#059669';
      if (ratio > 0.2) return isHovered ? '#059669' : '#10b981';
      if (ratio > 0.08) return isHovered ? '#10b981' : '#6ee7b7';
      return isHovered ? '#a7f3d0' : '#d1fae5';
    }

    // Return rate metric: lower is better (emerald), high is risk (rose)
    const rate = div.returnRate;
    if (rate > 22) return isHovered ? '#be123c' : '#f43f5e'; // High Risk (Rose)
    if (rate > 16) return isHovered ? '#b45309' : '#f59e0b'; // Moderate Risk (Amber)
    return isHovered ? '#047857' : '#10b981'; // Healthy (Emerald)
  };

  const handleDivisionClick = (div: DivisionMetric) => {
    if (selectedDivisionId === div.id) {
      setSelectedDivisionId(null);
      onSelectDivision?.(null);
    } else {
      setSelectedDivisionId(div.id);
      onSelectDivision?.(div.name);
    }
  };

  const handleReset = () => {
    setSelectedDivisionId(null);
    setHoveredDivision(null);
    onSelectDivision?.(null);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
      {/* Map Control Bar & Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-primary">
              Geographic Intelligence & Customer Delivery Analytics
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-black text-navy-deep font-headline flex items-center gap-2">
            <Compass className="w-5 h-5 text-primary" />
            Customer Delivery Territory Map: 8 Administrative Divisions
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Interactive parcel distribution across Dhaka Metro and 63 Outside Dhaka districts (central warehouse and retail outlets dispatch nationwide).
          </p>
        </div>

        {/* Metric Mode Selectors & Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex p-1 rounded-xl bg-slate-200/70 border border-slate-300/60 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveMetric('orders')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeMetric === 'orders'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-blue-600" />
              <span>Orders</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMetric('revenue')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeMetric === 'revenue'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Coins className="w-3.5 h-3.5 text-emerald-600" />
              <span>Revenue (৳)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMetric('returnRate')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeMetric === 'returnRate'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>Return %</span>
            </button>
          </div>

          {selectedDivisionId && (
            <button
              type="button"
              onClick={handleReset}
              className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-1 shadow-2xs"
              title="Clear selection"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Map Body: SVG Canvas + Live Insights Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:divide-x divide-slate-100">
        {/* Left Column: Interactive Vector SVG Map Canvas (7 cols) */}
        <div className="lg:col-span-7 p-4 sm:p-6 flex flex-col items-center justify-center relative bg-gradient-to-b from-slate-50/40 via-white to-slate-50/20">
          {/* Active Hover / Pinned Floating Badge */}
          <div className="w-full flex items-center justify-between mb-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-500 uppercase tracking-wide text-[10px]">Active View:</span>
              <span className="font-black text-navy-deep px-2 py-0.5 rounded-full bg-white border border-slate-200 shadow-2xs">
                {activeMetric === 'orders' ? 'Dispatched Volume' : activeMetric === 'revenue' ? 'Realized Net Sales (৳)' : 'Return Incidence (RTO)'}
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Low Risk (&lt;16%)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Medium
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> High (&gt;22%)
              </span>
            </div>
          </div>

          {/* SVG Map Container with Zero Layout Distortion */}
          <div className="relative w-full max-w-[560px] aspect-square flex items-center justify-center select-none">
            <svg
              viewBox="0 0 1000 1000"
              className="w-full h-full filter drop-shadow-sm transition-all duration-300"
              style={{ maxHeight: '580px' }}
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                {/* Subtle drop shadow for active / hovered division */}
                <filter id="hoverShadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0f172a" floodOpacity="0.25" />
                </filter>
                <filter id="selectedShadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0284c7" floodOpacity="0.35" />
                </filter>
              </defs>

              {/* Bay of Bengal & International Waters Background Accent */}
              <rect x="0" y="0" width="1000" height="1000" fill="transparent" />

              {/* Render All 8 Administrative Divisions */}
              <g id="bangladesh-divisions" className="cursor-pointer">
                {divisions.map((div) => {
                  const isHovered = hoveredDivision?.id === div.id;
                  const isSelected = selectedDivisionId === div.id;
                  const fillColor = getDivisionFill(div, isHovered, isSelected);

                  return (
                    <g
                      key={div.id}
                      onMouseEnter={() => setHoveredDivision(div)}
                      onMouseLeave={() => setHoveredDivision(null)}
                      onClick={() => handleDivisionClick(div)}
                      className="group"
                    >
                      <path
                        d={div.svgPath}
                        fill={fillColor}
                        stroke={isSelected ? '#0369a1' : '#ffffff'}
                        strokeWidth={isSelected ? '3.5' : isHovered ? '2.5' : '1.5'}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        filter={isSelected ? 'url(#selectedShadow)' : isHovered ? 'url(#hoverShadow)' : undefined}
                        className="transition-all duration-300 ease-out"
                      />
                    </g>
                  );
                })}
              </g>

              {/* Division Centroid Badges & Metric Indicators */}
              <g id="division-labels" className="pointer-events-none select-none">
                {divisions.map((div) => {
                  const isSelected = selectedDivisionId === div.id;
                  const isHovered = hoveredDivision?.id === div.id;

                  let displayValue = '';
                  if (activeMetric === 'orders') {
                    displayValue = `${div.dispatchedOrders.toLocaleString()}`;
                  } else if (activeMetric === 'revenue') {
                    displayValue = `৳${div.netRevenue >= 1000000 ? `${(div.netRevenue / 1000000).toFixed(1)}M` : `${Math.round(div.netRevenue / 1000)}k`}`;
                  } else {
                    displayValue = `${div.returnRate}%`;
                  }

                  return (
                    <g
                      key={`lbl-${div.id}`}
                      transform={`translate(${div.centerX}, ${div.centerY})`}
                      className="transition-transform duration-200"
                    >
                      {/* Label Container Pill */}
                      <rect
                        x="-48"
                        y="-17"
                        width="96"
                        height="34"
                        rx="17"
                        fill={isSelected ? '#0f172a' : isHovered ? '#1e293b' : 'rgba(255, 255, 255, 0.94)'}
                        stroke={isSelected ? '#38bdf8' : isHovered ? '#64748b' : '#cbd5e1'}
                        strokeWidth={isSelected ? '2' : '1'}
                        filter="drop-shadow(0 2px 4px rgba(0,0,0,0.12))"
                      />
                      {/* Division Name */}
                      <text
                        x="0"
                        y="-3"
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="800"
                        fill={isSelected || isHovered ? '#ffffff' : '#0f172a'}
                        fontFamily="var(--font-headline, sans-serif)"
                      >
                        {div.name}
                      </text>
                      {/* Metric Value */}
                      <text
                        x="0"
                        y="10"
                        textAnchor="middle"
                        fontSize="9.5"
                        fontWeight="700"
                        fill={
                          isSelected || isHovered
                            ? '#38bdf8'
                            : activeMetric === 'returnRate'
                            ? div.returnRate > 20 ? '#e11d48' : '#059669'
                            : '#0284c7'
                        }
                      >
                        {displayValue}
                      </text>
                    </g>
                  );
                })}
              </g>

            </svg>

            {/* Quick Map Legend at Bottom Left */}
            <div className="absolute bottom-2 left-2 bg-white/95 backdrop-blur-xs p-2 rounded-xl border border-slate-200/80 shadow-xs text-[10px] space-y-1 pointer-events-none">
              <span className="font-bold text-slate-700 block uppercase tracking-wider text-[9px]">Territory Intelligence</span>
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                <span>Customer Delivery Destinations</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Division Breakdown & Interactive Intelligence (5 cols) */}
        <div className="lg:col-span-5 p-4 sm:p-6 flex flex-col justify-between bg-white">
          <div>
            {/* Division Header or Pinned Details */}
            {selectedDivision ? (
              <div className="mb-5 p-4 rounded-xl bg-blue-50/70 border border-blue-200/70 transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-blue-700 tracking-wider">
                      Selected Division Detail
                    </span>
                    <h4 className="text-xl font-black text-navy-deep font-headline flex items-center gap-1.5 mt-0.5">
                      <span>{selectedDivision.name}</span>
                      <span className="text-sm font-semibold text-slate-400">({selectedDivision.nameBn})</span>
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDivisionId(null)}
                    className="text-slate-400 hover:text-slate-700 p-1 text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                {/* Selected Division Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 my-3.5 pt-3 border-t border-blue-100">
                  <div className="bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Dispatched Orders</span>
                    <span className="text-base font-black text-slate-900">{selectedDivision.dispatchedOrders.toLocaleString()}</span>
                    <span className="text-[10px] text-blue-600 font-bold block">{selectedDivision.orderShare}% of BD</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Realized Net Sales</span>
                    <span className="text-base font-black text-emerald-600">৳ {selectedDivision.netRevenue.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-500 font-medium block">AOV ৳{selectedDivision.aov.toLocaleString()}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Return Incidence</span>
                    <span className={`text-base font-black ${selectedDivision.returnRate > 20 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {selectedDivision.returnRate}%
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium block">
                      {selectedDivision.returnedOrders} RTO / {selectedDivision.partialOrders} Part
                    </span>
                  </div>
                </div>

                {/* Top Destination Districts in Selected Division */}
                {selectedDivision.topDistricts && selectedDivision.topDistricts.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                      Top Purchasing Districts in {selectedDivision.name}:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedDivision.topDistricts.map((d, dIdx) => (
                        <span
                          key={dIdx}
                          className="px-2 py-0.5 rounded-md bg-white border border-blue-200 text-xs font-semibold text-slate-800 shadow-2xs flex items-center gap-1"
                        >
                          <span>{d.name}</span>
                          <span className="text-[10px] text-blue-600 font-bold">({d.count})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : hoveredDivision ? (
              <div className="mb-5 p-4 rounded-xl bg-slate-50 border border-slate-200 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Hover Preview</span>
                    <h4 className="text-lg font-black text-navy-deep font-headline">
                      {hoveredDivision.name} <span className="text-xs text-slate-400 font-normal">({hoveredDivision.nameBn})</span>
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white text-primary border border-slate-200">
                    {hoveredDivision.orderShare}% Volume
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-200/60 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Orders</span>
                    <strong className="text-slate-900">{hoveredDivision.dispatchedOrders}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Net Sales</span>
                    <strong className="text-emerald-600">৳ {hoveredDivision.netRevenue.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Return Rate</span>
                    <strong className={hoveredDivision.returnRate > 20 ? 'text-rose-600' : 'text-emerald-600'}>
                      {hoveredDivision.returnRate}%
                    </strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Division Performance Leaderboard
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium">Click map to inspect</span>
                </div>
              </div>
            )}

            {/* Division Leaderboard Progress Bars */}
            <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {[...divisions]
                .sort((a, b) => {
                  if (activeMetric === 'orders') return b.dispatchedOrders - a.dispatchedOrders;
                  if (activeMetric === 'revenue') return b.netRevenue - a.netRevenue;
                  return b.returnRate - a.returnRate;
                })
                .map((div) => {
                  const isSelected = selectedDivisionId === div.id;
                  const ratio = activeMetric === 'orders'
                    ? (div.dispatchedOrders / maxOrders) * 100
                    : activeMetric === 'revenue'
                    ? (div.netRevenue / maxRevenue) * 100
                    : Math.min(100, div.returnRate * 3);

                  return (
                    <div
                      key={div.id}
                      onClick={() => handleDivisionClick(div)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/80 border-blue-300 shadow-xs'
                          : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: div.color }}
                          />
                          <span className="font-bold text-slate-900">{div.name}</span>
                          <span className="text-[11px] text-slate-400 font-medium">({div.nameBn})</span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-slate-900 mr-1.5">
                            {activeMetric === 'orders'
                              ? `${div.dispatchedOrders.toLocaleString()} ord`
                              : activeMetric === 'revenue'
                              ? `৳ ${Math.round(div.netRevenue).toLocaleString()}`
                              : `${div.returnRate}%`}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            ({div.orderShare}%)
                          </span>
                        </div>
                      </div>

                      {/* Visual Bar Indicator */}
                      <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(4, ratio)}%`,
                            backgroundColor:
                              activeMetric === 'returnRate'
                                ? div.returnRate > 20 ? '#f43f5e' : '#10b981'
                                : div.color
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Nationwide District Summary Footer */}
          {topNationwideDistricts.length > 0 && (
            <div className="mt-4 pt-3.5 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Top High-Velocity Destination Districts (Nationwide)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {topNationwideDistricts.slice(0, 7).map((d, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-700 flex items-center gap-1"
                    title={`${d.division} Division • ${d.count} orders • ৳${d.revenue.toLocaleString()} sales`}
                  >
                    <span>{d.name}</span>
                    <span className="text-[10px] text-slate-400 font-bold">{d.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
