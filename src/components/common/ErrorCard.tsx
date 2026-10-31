'use client';

import React, { useState } from 'react';
import { AlertCircle, RefreshCw, Database, Settings, ChevronDown, ChevronUp } from 'lucide-react';

export interface ErrorCardProps {
  title?: string;
  message?: string;
  technicalDetails?: string;
  onRetry?: () => void;
  onFallbackBaseline?: () => void;
  onOpenSettings?: () => void;
}

export function ErrorCard({
  title = 'Reconciliation Operation Interrupted',
  message = 'An unexpected issue occurred while processing orders or connecting to external APIs.',
  technicalDetails,
  onRetry,
  onFallbackBaseline,
  onOpenSettings,
}: ErrorCardProps) {
  const [showTechDetails, setShowTechDetails] = useState(false);

  return (
    <div
      role="alert"
      className="w-full my-6 p-6 rounded-2xl bg-red-950/20 border border-red-500/30 text-neutral-100 shadow-2xl animate-fadeIn"
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
          <AlertCircle className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-base font-bold text-red-200 mb-1">
            {title}
          </h4>
          <p className="text-xs text-neutral-300 leading-relaxed mb-4">
            {message}
          </p>

          {/* Action Recovery Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 mb-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Operation</span>
              </button>
            )}

            {onFallbackBaseline && (
              <button
                onClick={onFallbackBaseline}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <Database className="w-3.5 h-3.5 text-orange-400" />
                <span>Load Offline Baseline</span>
              </button>
            )}

            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <Settings className="w-3.5 h-3.5 text-neutral-400" />
                <span>Review Credentials in Settings</span>
              </button>
            )}
          </div>

          {/* Technical Details Accordion */}
          {technicalDetails && (
            <div className="mt-3 pt-3 border-t border-red-950/40">
              <button
                type="button"
                onClick={() => setShowTechDetails(!showTechDetails)}
                className="text-[11px] font-semibold text-neutral-400 hover:text-neutral-200 flex items-center gap-1"
              >
                <span>{showTechDetails ? 'Hide diagnostic error details' : 'View diagnostic error details'}</span>
                {showTechDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showTechDetails && (
                <pre className="mt-2 p-3 rounded-lg bg-neutral-950/90 border border-neutral-800 text-[10px] font-mono text-red-300/90 overflow-x-auto whitespace-pre-wrap">
                  {technicalDetails}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
