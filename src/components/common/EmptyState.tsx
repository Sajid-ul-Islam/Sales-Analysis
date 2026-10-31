'use client';

import React from 'react';
import { PackageOpen, Sparkles, UploadCloud, Database, ArrowRight } from 'lucide-react';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  onLoadBaseline?: () => void;
  onDropFiles?: () => void;
  onConnectApi?: () => void;
  isLoading?: boolean;
}

export function EmptyState({
  title = 'Reconciliation & Operations Terminal Ready',
  description = 'No order datasets currently loaded in memory. Load the clean September baseline, connect live WooCommerce/Pathao APIs, or drop your export spreadsheets below to start reconciling.',
  onLoadBaseline,
  onDropFiles,
  onConnectApi,
  isLoading = false,
}: EmptyStateProps) {
  return (
    <div className="w-full max-w-4xl mx-auto my-8 p-8 md:p-12 rounded-3xl bg-[#0A0A0A] border border-neutral-800/80 shadow-2xl text-center relative overflow-hidden">
      {/* Background glow subtle effect */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700/60 flex items-center justify-center text-primary mb-6 shadow-xl shadow-black/60">
          <PackageOpen className="w-8 h-8 text-orange-500" />
        </div>

        <h3 className="text-xl md:text-2xl font-black text-white tracking-tight mb-3">
          {title}
        </h3>

        <p className="text-sm md:text-base text-neutral-400 max-w-2xl mb-8 leading-relaxed">
          {description}
        </p>

        {/* Action Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl">
          {onLoadBaseline && (
            <button
              onClick={onLoadBaseline}
              disabled={isLoading}
              className="p-4 rounded-2xl bg-neutral-900 hover:bg-neutral-800/80 border border-neutral-800 hover:border-orange-500/40 text-left transition-all duration-200 group flex flex-col justify-between"
            >
              <div>
                <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 mb-3 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white mb-1 group-hover:text-orange-400 transition-colors">
                  Load Baseline
                </h4>
                <p className="text-xs text-neutral-400">
                  Instant 1,026 verified September orders snapshot.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-[11px] font-semibold text-orange-400">
                <span>0ms Instant Load</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          )}

          {onDropFiles && (
            <button
              onClick={onDropFiles}
              disabled={isLoading}
              className="p-4 rounded-2xl bg-neutral-900 hover:bg-neutral-800/80 border border-neutral-800 hover:border-blue-500/40 text-left transition-all duration-200 group flex flex-col justify-between"
            >
              <div>
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">
                  Drop Files
                </h4>
                <p className="text-xs text-neutral-400">
                  Upload WooCommerce & Pathao Excel or CSV files.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-[11px] font-semibold text-blue-400">
                <span>Drag & Drop</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          )}

          {onConnectApi && (
            <button
              onClick={onConnectApi}
              disabled={isLoading}
              className="p-4 rounded-2xl bg-neutral-900 hover:bg-neutral-800/80 border border-neutral-800 hover:border-emerald-500/40 text-left transition-all duration-200 group flex flex-col justify-between"
            >
              <div>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 group-hover:scale-105 transition-transform">
                  <Database className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">
                  Cloud Live Sync
                </h4>
                <p className="text-xs text-neutral-400">
                  Sync live WooCommerce & Pathao Hermes API orders.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <span>Real-Time Ingest</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
