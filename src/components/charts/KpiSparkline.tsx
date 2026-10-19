"use client";

import React, { useState, useRef, useId, useMemo } from 'react';
import { computeSparklineGeometry, getNearestSparklinePoint } from '@/lib/sparklineMath';

export interface KpiSparklineProps {
  data: number[];
  color: string; // stroke color
  gradientId?: string;
  fillOpacity?: number;
  height?: number;
  width?: number;
  labels?: string[];
  valuePrefix?: string;
  valueSuffix?: string;
  showBaseline?: boolean;
  showTerminalDot?: boolean;
  interactive?: boolean;
}

export function KpiSparkline({
  data,
  color,
  gradientId,
  fillOpacity = 0.25,
  height = 36,
  width = 160,
  labels,
  valuePrefix = '',
  valueSuffix = '',
  showBaseline = true,
  showTerminalDot = true,
  interactive = true,
}: KpiSparklineProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoId = useId().replace(/:/g, '');
  const gradId = gradientId || `kpi-spark-grad-${autoId}`;
  const shadowFilterId = `kpi-spark-shadow-${autoId}`;

  const geom = useMemo(() => {
    return computeSparklineGeometry(data, width, height, 6, 5, labels);
  }, [data, width, height, labels]);

  if (!data || data.length === 0 || geom.points.length === 0) {
    return <div style={{ height }} className="w-full" />;
  }

  const { points, pathD, areaD, avgY, range, lastPt } = geom;

  // Active point for hover tooltip
  const activePoint = activeIdx !== null ? points[activeIdx] : null;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !containerRef.current || points.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const mouseX = e.clientX - rect.left;
    const ratio = mouseX / rect.width;
    const match = getNearestSparklinePoint(points, ratio);
    if (match) {
      setActiveIdx(match.index);
    }
  };

  const handleMouseLeave = () => {
    setActiveIdx(null);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!interactive || !containerRef.current || points.length === 0 || !e.touches[0]) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const mouseX = e.touches[0].clientX - rect.left;
    const ratio = mouseX / rect.width;
    const match = getNearestSparklinePoint(points, ratio);
    if (match) {
      setActiveIdx(match.index);
    }
  };

  const handleTouchEnd = () => {
    setActiveIdx(null);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none cursor-crosshair group/sparkline"
      style={{ height }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      role="img"
      aria-label={`KPI trend sparkline with ${data.length} data points, currently at ${data[data.length - 1]}`}
    >
      {/* Floating Scrubbing Tooltip */}
      {interactive && activeIdx !== null && activePoint && (
        <div
          className="absolute z-30 pointer-events-none -top-6 transform -translate-x-1/2 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900/95 dark:bg-[#121212]/95 text-white text-[10px] font-bold shadow-md border border-slate-700/60 dark:border-[#2A2A2A] whitespace-nowrap backdrop-blur-md transition-all duration-75 select-none"
          style={{
            left: `${Math.max(18, Math.min(82, (activePoint.x / width) * 100))}%`,
          }}
        >
          <span className="text-slate-400 dark:text-slate-400 font-semibold text-[9.5px]">
            {activePoint.label || (activeIdx === points.length - 1 ? 'Today' : `D-${points.length - 1 - activeIdx}`)}
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-500" />
          <span className="font-mono text-white font-black text-[10px]">
            {valuePrefix}{Number(activePoint.val).toLocaleString()}{valueSuffix}
          </span>
        </div>
      )}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          {/* Multi-stage modern linear gradient */}
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
            <stop offset="65%" stopColor={color} stopOpacity={fillOpacity * 0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>

          {/* Stroke drop shadow for luminous elevated lines */}
          <filter id={shadowFilterId} x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor={color} floodOpacity="0.32" />
          </filter>
        </defs>

        {/* Optional Dotted 7-Day Baseline */}
        {showBaseline && range > 0 && (
          <line
            x1={6}
            y1={avgY}
            x2={width - 6}
            y2={avgY}
            stroke="currentColor"
            className="stroke-slate-200/90 dark:stroke-[#222222] text-slate-200 dark:text-[#222222]"
            strokeWidth="0.8"
            strokeDasharray="2 3"
          />
        )}

        {/* Gradient Fill under wave */}
        <path d={areaD} fill={`url(#${gradId})`} />

        {/* Wave stroke with soft drop shadow */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${shadowFilterId})`}
        />

        {/* Interactive Scrubbing Vertical Line & Dot */}
        {interactive && activePoint && (
          <g pointerEvents="none">
            <line
              x1={activePoint.x}
              y1={5}
              x2={activePoint.x}
              y2={height}
              stroke="currentColor"
              className="stroke-slate-300 dark:stroke-neutral-700 text-slate-300 dark:text-neutral-700"
              strokeWidth="0.9"
              strokeDasharray="2 2"
            />
            {/* Luminous hover halo */}
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r="4.5"
              fill={color}
              fillOpacity="0.25"
            />
            {/* Core hover point */}
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r="2.8"
              fill={color}
              stroke="#ffffff"
              className="dark:stroke-black"
              strokeWidth="1.4"
            />
          </g>
        )}

        {/* Real-time Pulsing Terminal Dot at latest point (when not hovering) */}
        {showTerminalDot && activeIdx === null && lastPt && (
          <g pointerEvents="none">
            {/* Subtle ping pulse */}
            <circle
              cx={lastPt.x}
              cy={lastPt.y}
              r="4"
              fill={color}
              className="animate-ping opacity-60 origin-center"
              style={{ transformOrigin: `${lastPt.x}px ${lastPt.y}px`, animationDuration: '2.5s' }}
            />
            {/* Soft halo */}
            <circle
              cx={lastPt.x}
              cy={lastPt.y}
              r="4.2"
              fill={color}
              fillOpacity="0.22"
            />
            {/* Solid terminal core with high contrast white/black rim */}
            <circle
              cx={lastPt.x}
              cy={lastPt.y}
              r="2.6"
              fill={color}
              stroke="#ffffff"
              className="dark:stroke-black"
              strokeWidth="1.2"
            />
          </g>
        )}
      </svg>
    </div>
  );
}
