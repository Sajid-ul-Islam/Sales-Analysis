"use client";

import React, { useState, useMemo, useRef } from 'react';

export interface TrendDataPoint {
  date: string;
  rawDate?: string;
  value: number;
  secondaryValue?: number;
}

interface InteractiveAreaTrendChartProps {
  data: TrendDataPoint[];
  title: string;
  subtitle?: string;
  primaryLabel: string;
  secondaryLabel?: string;
  primaryColor?: string;
  secondaryColor?: string;
  formatValue?: (val: number) => string;
  formatSecondaryValue?: (val: number) => string;
  height?: number;
  emptyMessage?: string;
}

export function InteractiveAreaTrendChart({
  data,
  title,
  subtitle,
  primaryLabel,
  secondaryLabel,
  primaryColor = '#EB5A19', // DEEN Brand Orange
  secondaryColor = '#6366F1', // Indigo Store
  formatValue = (v) => v.toLocaleString(),
  formatSecondaryValue = (v) => v.toLocaleString(),
  height = 240,
  emptyMessage = 'No timeline trend data available for this date range.',
}: InteractiveAreaTrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const { points, secondaryPoints, maxVal, minVal, pathD, areaD, secondaryPathD, peakIdx, avgVal } = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        points: [],
        secondaryPoints: [],
        maxVal: 0,
        minVal: 0,
        pathD: '',
        areaD: '',
        secondaryPathD: '',
        peakIdx: 0,
        avgVal: 0,
      };
    }

    const values = data.map((d) => d.value);
    const secValues = secondaryLabel ? data.map((d) => d.secondaryValue ?? 0) : [];
    const allVals = [...values, ...secValues];
    const rawMax = Math.max(...allVals, 1);
    const maxVal = Math.ceil(rawMax * 1.08); // 8% headroom for clean top margin
    const minVal = 0;
    const avgVal = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

    let peakIdx = 0;
    let peakVal = -1;
    values.forEach((v, idx) => {
      if (v > peakVal) {
        peakVal = v;
        peakIdx = idx;
      }
    });

    const viewBoxW = 800;
    const viewBoxH = height;
    const padL = 48;
    const padR = 24;
    const padT = 24;
    const padB = 40;
    const chartW = viewBoxW - padL - padR;
    const chartH = viewBoxH - padT - padB;

    const n = data.length;
    const stepX = n > 1 ? chartW / (n - 1) : 0;

    const points = data.map((d, i) => {
      const x = padL + i * stepX;
      const yNorm = maxVal > minVal ? (d.value - minVal) / (maxVal - minVal) : 0;
      const y = padT + chartH * (1 - yNorm);
      return { x, y, ...d };
    });

    const secondaryPoints = secondaryLabel
      ? data.map((d, i) => {
          const x = padL + i * stepX;
          const yNorm = maxVal > minVal ? ((d.secondaryValue ?? 0) - minVal) / (maxVal - minVal) : 0;
          const y = padT + chartH * (1 - yNorm);
          return { x, y, value: d.secondaryValue ?? 0 };
        })
      : [];

    let pathD = '';
    let areaD = '';
    let secondaryPathD = '';

    if (points.length > 0) {
      // Build primary line and area
      pathD = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} ` +
        points.slice(1).map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

      const bottomY = padT + chartH;
      areaD = `M ${points[0].x.toFixed(1)} ${bottomY.toFixed(1)} ` +
        points.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') +
        ` L ${points[points.length - 1].x.toFixed(1)} ${bottomY.toFixed(1)} Z`;

      // Build secondary line if requested
      if (secondaryPoints.length > 0) {
        secondaryPathD = `M ${secondaryPoints[0].x.toFixed(1)} ${secondaryPoints[0].y.toFixed(1)} ` +
          secondaryPoints.slice(1).map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      }
    }

    return { points, secondaryPoints, maxVal, minVal, pathD, areaD, secondaryPathD, peakIdx, avgVal };
  }, [data, secondaryLabel, height]);

  // Handle pointer hover across the responsive viewBox
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!points.length || !containerRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const relativeX = (clientX / rect.width) * 800; // Map to viewBox width

    // Find nearest point
    let closestIdx = 0;
    let minDistance = Infinity;
    points.forEach((p, idx) => {
      const dist = Math.abs(p.x - relativeX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = idx;
      }
    });

    setHoveredIdx(closestIdx);
  };

  const handleMouseLeave = () => {
    setHoveredIdx(null);
  };

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs text-center py-12">
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;
  const activeSecondary = hoveredIdx !== null && secondaryPoints.length > 0 ? secondaryPoints[hoveredIdx] : null;

  // Grid levels (0%, 25%, 50%, 75%, 100%)
  const yTicks = [
    { label: formatValue(maxVal), y: 24 },
    { label: formatValue(Math.round(maxVal * 0.66)), y: 24 + (height - 64) * 0.33 },
    { label: formatValue(Math.round(maxVal * 0.33)), y: 24 + (height - 64) * 0.66 },
    { label: '0', y: height - 40 },
  ];

  // X ticks: pick up to 5-7 evenly spaced date labels
  const stepInterval = Math.max(1, Math.floor(points.length / 5));
  const xTicks = points.filter((_, idx) => idx % stepInterval === 0 || idx === points.length - 1);

  return (
    <div ref={containerRef} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
      {/* Header bar with Summary Highlights */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-headline text-sm font-bold text-slate-900 tracking-tight">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        {/* Legend and Highlights */}
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />
            <span>{primaryLabel}</span>
          </div>

          {secondaryLabel && (
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: secondaryColor }} />
              <span>{secondaryLabel}</span>
            </div>
          )}

          <div className="h-3 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* Peak Badge */}
          {points[peakIdx] && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-primary border border-orange-200/60">
              Peak: {points[peakIdx].date} ({formatValue(points[peakIdx].value)})
            </span>
          )}

          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            Avg: {formatValue(avgVal)}/day
          </span>
        </div>
      </div>

      {/* Responsive SVG Chart Canvas */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 800 ${height}`}
          className="w-full h-auto overflow-visible"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ maxHeight: `${height + 20}px` }}
        >
          <defs>
            {/* Primary Gradient Fill */}
            <linearGradient id="areaTrendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={primaryColor} stopOpacity="0.28" />
              <stop offset="60%" stopColor={primaryColor} stopOpacity="0.08" />
              <stop offset="100%" stopColor={primaryColor} stopOpacity="0.00" />
            </linearGradient>

            {/* Subtle Drop Shadow */}
            <filter id="glowShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor={primaryColor} floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Horizontal Grid lines and Y-labels */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1="48"
                y1={tick.y}
                x2="776"
                y2={tick.y}
                stroke="#F1F5F9"
                strokeWidth="1"
                strokeDasharray={i === yTicks.length - 1 ? 'none' : '3 3'}
              />
              <text
                x="42"
                y={tick.y + 3}
                textAnchor="end"
                className="text-[10px] fill-slate-400 font-mono font-medium"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* Area Fill */}
          {areaD && (
            <path
              d={areaD}
              fill="url(#areaTrendGradient)"
              className="transition-all duration-300 pointer-events-none"
            />
          )}

          {/* Secondary Line (e.g. Active Users) */}
          {secondaryPathD && (
            <path
              d={secondaryPathD}
              fill="none"
              stroke={secondaryColor}
              strokeWidth="2"
              strokeDasharray="4 3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300 pointer-events-none opacity-80"
            />
          )}

          {/* Primary Trend Stroke */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke={primaryColor}
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#glowShadow)"
              className="transition-all duration-300 pointer-events-none"
            />
          )}

          {/* X Axis bottom dates */}
          {xTicks.map((p, idx) => (
            <text
              key={idx}
              x={p.x}
              y={height - 18}
              textAnchor="middle"
              className="text-[10px] fill-slate-400 font-mono font-medium"
            >
              {p.date}
            </text>
          ))}

          {/* Interactive Hover Vertical Guide and Focus Nodes */}
          {activePoint && (
            <g className="pointer-events-none transition-all duration-100">
              {/* Vertical line indicator */}
              <line
                x1={activePoint.x}
                y1="24"
                x2={activePoint.x}
                y2={height - 40}
                stroke={primaryColor}
                strokeWidth="1.5"
                strokeDasharray="2 2"
                opacity="0.6"
              />

              {/* Secondary Point Circle */}
              {activeSecondary && (
                <circle
                  cx={activePoint.x}
                  cy={activeSecondary.y}
                  r="4.5"
                  fill="#FFFFFF"
                  stroke={secondaryColor}
                  strokeWidth="2.5"
                />
              )}

              {/* Primary Point Halo & Circle */}
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="7"
                fill={primaryColor}
                opacity="0.25"
                className="animate-ping"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="5"
                fill="#FFFFFF"
                stroke={primaryColor}
                strokeWidth="3"
              />
            </g>
          )}
        </svg>

        {/* Dynamic Floating Tooltip */}
        {activePoint && (
          <div
            className="absolute z-20 pointer-events-none bg-slate-900/95 text-white p-2.5 rounded-xl shadow-lg border border-slate-700/60 backdrop-blur-sm transition-all duration-100 text-xs whitespace-nowrap"
            style={{
              left: `${Math.min(84, Math.max(16, (activePoint.x / 800) * 100))}%`,
              top: `${Math.max(10, Math.min(65, (activePoint.y / height) * 100 - 15))}%`,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="font-bold text-slate-200 text-[11px] border-b border-slate-800 pb-1 mb-1.5 flex items-center justify-between gap-3">
              <span>{activePoint.date}</span>
              <span className="text-[10px] text-slate-400 font-normal">{activePoint.rawDate || ''}</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                  {primaryLabel}:
                </span>
                <strong className="font-mono text-white">{formatValue(activePoint.value)}</strong>
              </div>

              {secondaryLabel && activeSecondary && (
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: secondaryColor }} />
                    {secondaryLabel}:
                  </span>
                  <strong className="font-mono text-white">{formatSecondaryValue(activeSecondary.value)}</strong>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
