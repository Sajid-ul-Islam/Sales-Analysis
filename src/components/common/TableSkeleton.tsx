'use client';

import React from 'react';

export interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  hasHeader?: boolean;
}

export function TableSkeleton({ rows = 6, cols = 7, hasHeader = true }: TableSkeletonProps) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-neutral-800 bg-[#0A0A0A] p-4 animate-pulse">
      {hasHeader && (
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-neutral-800/80">
          <div className="h-5 w-44 bg-neutral-800/80 rounded-lg" />
          <div className="flex gap-2">
            <div className="h-8 w-24 bg-neutral-800/60 rounded-lg" />
            <div className="h-8 w-28 bg-neutral-800/60 rounded-lg" />
          </div>
        </div>
      )}

      <div className="space-y-3">
        {/* Table Header Row Skeleton */}
        <div className="grid grid-cols-7 gap-4 pb-2 border-b border-neutral-800/50">
          {Array.from({ length: cols }).map((_, i) => (
            <div
              key={`header-${i}`}
              className="h-3.5 bg-neutral-800/70 rounded"
              style={{ width: `${Math.max(45, 80 - (i % 3) * 15)}%` }}
            />
          ))}
        </div>

        {/* Table Data Rows Skeleton */}
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div
            key={`row-${rowIdx}`}
            className="grid grid-cols-7 gap-4 py-3 items-center border-b border-neutral-800/30"
          >
            {Array.from({ length: cols }).map((_, colIdx) => (
              <div
                key={`cell-${rowIdx}-${colIdx}`}
                className="h-4 bg-neutral-800/40 rounded"
                style={{
                  width: colIdx === 0 ? '60%' : colIdx === 1 ? '85%' : `${Math.max(50, 90 - (colIdx % 4) * 12)}%`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
